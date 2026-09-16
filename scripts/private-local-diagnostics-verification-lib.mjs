import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { ARCHIVE_LIMITS, inspectStaticArchive } from "./private-local-diagnostics-archive.mjs";
import { canonicalJson, parseReceiptSidecar, validateReceipt } from "./private-local-diagnostics-artifact-lib.mjs";
import { crossBindAuthorization, parseAuthorizationEvidence, parseAuthorizationSidecar, validateAuthorizationPolicy } from "./private-local-diagnostics-authorization-lib.mjs";
const HASH = /^[0-9a-f]{64}$/;
const ID = /^paperclipai-local-diagnostics-[a-z0-9.-]+$/;
const DIST = ["dist/index.js", "dist/local-diagnostics.js"];
const fail = (message) => { throw new Error(`V_MANIFEST: ${message}`); };
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) => plain(value) && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
const hash = (value, label) => { if (typeof value !== "string" || !HASH.test(value)) fail(`${label} must be lowercase SHA-256`); return value; };
const name = (value, label) => { if (typeof value !== "string" || !/^[a-z0-9][a-z0-9.-]*$/.test(value) || value.includes("..")) fail(`${label} is unsafe`); return value; };
const digest = (value) => createHash("sha256").update(value).digest("hex");

export function createVerificationManifest(input) {
  return validateVerificationManifest({ schemaVersion: 1, ...input });
}

export function validateVerificationManifest(value) {
  if (!exact(value, ["schemaVersion", "artifactId", "receipt", "artifact", "package"]) || value.schemaVersion !== 1 || typeof value.artifactId !== "string" || !ID.test(value.artifactId)) fail("invalid top-level schema");
  if (!exact(value.receipt, ["filename", "sha256"]) || name(value.receipt.filename, "receipt filename") !== `${value.artifactId}.receipt.json`) fail("receipt identity mismatch");
  hash(value.receipt.sha256, "receipt hash");
  if (!exact(value.artifact, ["filename", "sha256", "bytes"]) || name(value.artifact.filename, "artifact filename") !== `${value.artifactId}.tgz` || !Number.isSafeInteger(value.artifact.bytes) || value.artifact.bytes < 1) fail("artifact identity mismatch");
  hash(value.artifact.sha256, "artifact hash");
  if (!exact(value.package, ["manifestSha256", "distFiles"]) || !exact(value.package.distFiles, DIST)) fail("package fields mismatch");
  hash(value.package.manifestSha256, "manifest hash");
  for (const path of DIST) hash(value.package.distFiles[path], `${path} hash`);
  return value;
}

export function formatVerificationSidecar(filename, sha256) {
  return `${hash(sha256, "sidecar hash")}  ${name(filename, "sidecar filename")}\n`;
}

export function parseVerificationSidecar(text, filename) {
  if (typeof text !== "string" || !/^[0-9a-f]{64}  [a-z0-9][a-z0-9.-]*\.verification\.json\n$/.test(text)) fail("invalid sidecar");
  const [sha256, actual] = text.trimEnd().split("  ");
  if (actual !== name(filename, "sidecar filename")) fail("sidecar filename mismatch");
  return { filename: actual, sha256 };
}

export function parseVerificationArgs(argv) {
  if (!Array.isArray(argv) || argv.length < 4 || argv[0] !== "--artifact-dir" || argv[2] !== "--receipt" || !isAbsolute(argv[1])) fail("expected --artifact-dir ABSOLUTE_DIR --receipt SAFE_RECEIPT_BASENAME");
  return { artifactDir: argv[1], receipt: name(argv[3], "receipt filename"), contextArgs: argv.slice(4) };
}
const failAuth = (message) => { throw new Error(`E_AUTH: ${message}`); };
const CONTEXT_FLAGS = { "--audience": "audience", "--case-id": "caseId", "--incident-id": "incidentId" };
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const safeId = (value, label) => { if (typeof value !== "string" || !SAFE_ID.test(value)) failAuth(`${label} must be a SAFE_ID`); return value; };
function parseEvidenceContext(tail) {
  if (tail.length === 0 || tail.length % 2 !== 0) failAuth("expected --audience A --case-id ID [--incident-id ID]");
  const seen = {};
  for (let index = 0; index < tail.length; index += 2) {
    const key = CONTEXT_FLAGS[tail[index]];
    if (!key || typeof tail[index + 1] !== "string") failAuth("unexpected authorization evidence argument");
    if (Object.hasOwn(seen, key)) failAuth(`duplicate ${tail[index]}`);
    seen[key] = tail[index + 1];
  }
  if (seen.audience === "hefesto") { if (Object.hasOwn(seen, "incidentId")) failAuth("hefesto context must not include --incident-id"); return { audience: "hefesto", caseId: safeId(seen.caseId, "--case-id") }; }
  if (seen.audience === "optimus") { const caseId = safeId(seen.caseId, "--case-id"), incidentId = safeId(seen.incidentId, "--incident-id"); if (incidentId === caseId) failAuth("--incident-id must differ from --case-id"); return { audience: "optimus", caseId, incidentId }; }
  return failAuth("expected --audience hefesto or --audience optimus");
}
function snapshot(file, limit) {
  let fd;
  try {
    if (lstatSync(file).isSymbolicLink()) fail("symlinks are forbidden");
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(fd);
    if (!before.isFile() || before.size < 1 || before.size > limit) fail("unsafe file");
    const bytes = readFileSync(fd), after = fstatSync(fd);
    if (bytes.length !== before.size || after.size !== before.size) fail("file changed while read");
    return bytes;
  } finally { if (fd !== undefined) closeSync(fd); }
}
function canonical(bytes, label) {
  let value;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { fail(`${label} is invalid JSON`); }
  if (!Buffer.from(canonicalJson(value)).equals(bytes)) fail(`${label} is non-canonical`);
  return value;
}
async function verifyLegacyUnpinned(input, dependencies = {}) {
  const { artifactDir, receipt: receiptName } = parseVerificationArgs(input);
  if (lstatSync(artifactDir).isSymbolicLink() || !lstatSync(artifactDir).isDirectory()) fail("artifact directory is unsafe");
  const dir = realpathSync(artifactDir), receiptBytes = snapshot(join(dir, receiptName), 65536);
  const receipt = validateReceipt(canonical(receiptBytes, "receipt"));
  if (receiptName !== `${receipt.artifactId}.receipt.json`) fail("receipt filename mismatch");
  const receiptSha256 = digest(receiptBytes), receiptSidecar = snapshot(join(dir, `${receipt.artifactId}.receipt.sha256`), 1024).toString("utf8");
  if (parseReceiptSidecar(receiptSidecar, receiptName).sha256 !== receiptSha256) fail("receipt sidecar mismatch");
  const verificationName = `${receipt.artifactId}.verification.json`, verificationBytes = snapshot(join(dir, verificationName), 65536);
  const verification = validateVerificationManifest(canonical(verificationBytes, "verification manifest"));
  const verificationSha256 = digest(verificationBytes), verificationSidecar = snapshot(join(dir, `${receipt.artifactId}.verification.sha256`), 1024).toString("utf8");
  if (parseVerificationSidecar(verificationSidecar, verificationName).sha256 !== verificationSha256) fail("verification sidecar mismatch");
  if (canonicalJson(verification.receipt) !== canonicalJson({ filename: receiptName, sha256: receiptSha256 }) || canonicalJson(verification.artifact) !== canonicalJson(receipt.artifact) || verification.package.manifestSha256 !== receipt.package.manifestSha256 || digest(canonicalJson(verification.package.distFiles)) !== receipt.package.distSha256) fail("receipt cross-bind mismatch");
  const artifactBytes = snapshot(join(dir, receipt.artifact.filename), ARCHIVE_LIMITS.compressed);
  if (artifactBytes.length !== receipt.artifact.bytes || digest(artifactBytes) !== receipt.artifact.sha256) fail("artifact bytes mismatch");
  const archive = (dependencies.inspectStaticArchive ?? inspectStaticArchive)(artifactBytes, { expectedDistSha256: verification.package.distFiles, expectedManifestSha256: verification.package.manifestSha256, expectedArtifactSha256: receipt.artifact.sha256 }, dependencies.archiveOptions);
  return { state: "staged", smoke: "not-run-untrusted", artifactId: receipt.artifactId, artifactSha256: receipt.artifact.sha256, receiptSha256, verificationSha256, manifestSha256: archive.package.manifestSha256 };
}

// Linux-pinned directory primitives, wired into verifyArtifact's mode/evidence dispatch below.
const failCapability = () => { throw new Error("V_CAPABILITY: evidence verification requires Linux with usable /proc/self/fd"); };
const failDirectory = () => { throw new Error("V_DIRECTORY: artifact directory is unsafe"); };
const failRace = () => { throw new Error("V_RACE: inspection bundle changed during verification"); };
const MAPPED_ERRNO = new Set(["ENOENT", "ENOTDIR", "ELOOP", "EACCES"]);
const classify = (error, failer) => { if (error && MAPPED_ERRNO.has(error.code)) failer(); else throw error; };
const procFd = (fd) => `/proc/self/fd/${fd}`;
const childPath = (pinned, basename) => `${procFd(pinned.fd)}/${basename}`;
const pinnedFs = { openSync, fstatSync, statSync, lstatSync, closeSync, readFileSync, readSync, realpathSync };
const DIRECTORY_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const closeQuietly = (fs, fd) => { if (fd === undefined) return; try { fs.closeSync(fd); } catch { /* best-effort: never mask a propagating error */ } };
function closeAll(fs, fds) {
  let closeError;
  for (const fd of fds) { try { fs.closeSync(fd); } catch (error) { closeError ??= error; } }
  return closeError;
}
function openDirectoryHandle(path, fs) {
  const fd = fs.openSync(path, DIRECTORY_FLAGS);
  try {
    const stat = fs.fstatSync(fd, { bigint: true });
    if (!stat.isDirectory()) failDirectory();
    return { fd, stat };
  } catch (error) {
    closeQuietly(fs, fd);
    throw error;
  }
}

export function detectPinnedDirectoryCapability(options = {}) {
  const platform = options.platform ?? process.platform, fs = options.fs ?? pinnedFs;
  if (platform !== "linux" || typeof constants.O_DIRECTORY !== "number" || typeof constants.O_NOFOLLOW !== "number" || typeof constants.O_NONBLOCK !== "number") return false;
  try { return fs.statSync("/proc/self/fd", { bigint: true }).isDirectory(); } catch { return false; }
}

export function requirePinnedDirectoryCapability(options = {}) {
  if (!detectPinnedDirectoryCapability(options)) failCapability();
}

export function acquirePinnedDirectory(path, options = {}) {
  const fs = options.fs ?? pinnedFs;
  let fd;
  try {
    if (typeof path !== "string" || !isAbsolute(path) || fs.lstatSync(path).isSymbolicLink()) failDirectory();
    const opened = openDirectoryHandle(fs.realpathSync(path), fs);
    fd = opened.fd;
    const proc = fs.statSync(procFd(fd), { bigint: true });
    if (proc.dev !== opened.stat.dev || proc.ino !== opened.stat.ino) failDirectory();
    return { fd, dev: opened.stat.dev, ino: opened.stat.ino };
  } catch (error) {
    closeQuietly(fs, fd);
    if (error instanceof Error && /^V_/.test(error.message)) throw error;
    classify(error, failDirectory);
  }
}

export function proveDirectoryAlias(path, pinned, options = {}) {
  const fs = options.fs ?? pinnedFs;
  let fd;
  try {
    const opened = openDirectoryHandle(path, fs);
    fd = opened.fd;
    if (opened.stat.dev !== pinned.dev || opened.stat.ino !== pinned.ino) failDirectory();
  } catch (error) {
    classify(error, failDirectory);
  } finally {
    closeQuietly(fs, fd);
  }
}

function captureDirectoryStamp(pinned, fs) { const stat = fs.fstatSync(pinned.fd, { bigint: true }); return { dev: stat.dev, ino: stat.ino, size: stat.size, mtimeNs: stat.mtimeNs, ctimeNs: stat.ctimeNs }; }
const sameStamp = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;

function classifyBasename(pinned, basename, fs) {
  try { fs.lstatSync(childPath(pinned, basename), { bigint: true }); return true; }
  catch (error) { if (error && error.code === "ENOENT") return false; classify(error, failRace); }
}

function readPinnedChild(pinned, entry, fs) {
  const anchored = childPath(pinned, entry.basename);
  let fd;
  try {
    const before = fs.lstatSync(anchored, { bigint: true });
    if (before.isSymbolicLink()) fail("symlinks are forbidden");
    if (!before.isFile() || before.nlink !== 1n || before.size < 1n || before.size > BigInt(entry.limit)) fail("unsafe file");
    fd = fs.openSync(anchored, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = fs.fstatSync(fd, { bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1n) failRace();
    const bytes = fs.readFileSync(fd), after = fs.fstatSync(fd, { bigint: true });
    if (BigInt(bytes.length) !== before.size || after.size !== before.size || after.nlink !== 1n) failRace();
    return { basename: entry.basename, limit: entry.limit, fd, dev: opened.dev, ino: opened.ino, nlink: 1n, size: after.size, mtimeNs: after.mtimeNs, ctimeNs: after.ctimeNs, sha256: digest(bytes), content: bytes };
  } catch (error) {
    closeQuietly(fs, fd);
    if (error instanceof Error && /^V_/.test(error.message)) throw error;
    classify(error, failRace);
  }
}

function recheckPinnedChild(pinned, child, fs) {
  let stat;
  try { stat = fs.lstatSync(childPath(pinned, child.basename), { bigint: true }); }
  catch (error) { classify(error, failRace); }
  const live = fs.fstatSync(child.fd, { bigint: true });
  for (const current of [stat, live]) if (current.dev !== child.dev || current.ino !== child.ino || current.size !== child.size || current.nlink !== child.nlink || current.mtimeNs !== child.mtimeNs || current.ctimeNs !== child.ctimeNs) failRace();
}

function readChildToEnd(child, fs) {
  const chunks = [];
  let position = 0, total = 0;
  for (;;) {
    const buffer = Buffer.alloc(65536);
    let bytesRead;
    try { bytesRead = fs.readSync(child.fd, buffer, 0, 65536, position); } catch (error) { classify(error, failRace); }
    if (bytesRead === 0) break;
    total += bytesRead;
    if (total > child.limit) failRace();
    chunks.push(buffer.subarray(0, bytesRead));
    position += bytesRead;
  }
  return Buffer.concat(chunks);
}

function verifyChildContent(child, fs) { const bytes = readChildToEnd(child, fs); if (BigInt(bytes.length) !== child.size || digest(bytes) !== child.sha256) failRace(); }

export function verifyPinnedDirectory(path, entries, options = {}) {
  const fs = options.fs ?? pinnedFs, checkpoint = options.onCheckpoint ?? (() => {});
  for (const entry of entries) name(entry.basename, "basename");
  const pinned = acquirePinnedDirectory(path, { fs });
  const children = [];
  let result, primaryError, failed = false;
  try {
    checkpoint("acquired");
    const stamp = captureDirectoryStamp(pinned, fs);
    const presence = entries.map((entry) => ({ entry, present: classifyBasename(pinned, entry.basename, fs) }));
    checkpoint("classified");
    for (const { entry, present } of presence) if (present) { children.push(readPinnedChild(pinned, entry, fs)); checkpoint(`read:${entry.basename}`); }
    if (options.afterRead) options.afterRead(children, fs);
    checkpoint("step1-complete");
    const recheck = () => {
      if (!sameStamp(captureDirectoryStamp(pinned, fs), stamp)) failRace();
      for (const { entry, present } of presence) if (classifyBasename(pinned, entry.basename, fs) !== present) failRace();
      for (const child of children) recheckPinnedChild(pinned, child, fs);
    };
    recheck();
    checkpoint("step2-complete");
    proveDirectoryAlias(path, pinned, { fs });
    checkpoint("step3-complete");
    recheck();
    checkpoint("step4-metadata-complete");
    for (const child of children) verifyChildContent(child, fs);
    checkpoint("step4-complete");
    result = { dev: pinned.dev, ino: pinned.ino, children: children.map(({ basename, sha256, size }) => ({ basename, sha256, bytes: Number(size) })) };
  } catch (error) {
    failed = true;
    primaryError = error;
  }
  const closeError = closeAll(fs, [...children.map((child) => child.fd), pinned.fd]);
  if (failed) throw primaryError;
  if (closeError) throw closeError;
  return result;
}

// Mode/evidence dispatch: activates evidence mode via the canonical authorization pathname or any
// --audience/--case-id/--incident-id argument; otherwise the frozen four-argument legacy grammar applies.
const RECEIPT_SUFFIX = ".receipt.json";
const deriveArtifactId = (receiptName) => { if (!receiptName.endsWith(RECEIPT_SUFFIX)) fail("expected --artifact-dir ABSOLUTE_DIR --receipt SAFE_RECEIPT_BASENAME"); return receiptName.slice(0, -RECEIPT_SUFFIX.length); };
const findChild = (children, basename) => children.find((child) => child.basename === basename);
const requireChild = (children, basename, label) => { const child = findChild(children, basename); if (!child) fail(`${label} is unsafe or absent`); return child; };

function buildPinnedResult(children, receiptName, verificationName, authorizationName, context, dependencies) {
  const receiptChild = requireChild(children, receiptName, "receipt");
  const receipt = validateReceipt(canonical(receiptChild.content, "receipt"));
  if (receiptName !== `${receipt.artifactId}.receipt.json`) fail("receipt filename mismatch");
  const receiptSidecarChild = requireChild(children, `${receipt.artifactId}.receipt.sha256`, "receipt sidecar");
  if (parseReceiptSidecar(receiptSidecarChild.content.toString("utf8"), receiptName).sha256 !== receiptChild.sha256) fail("receipt sidecar mismatch");

  const verificationChild = requireChild(children, verificationName, "verification manifest");
  const verification = validateVerificationManifest(canonical(verificationChild.content, "verification manifest"));
  const verificationSidecarChild = requireChild(children, `${receipt.artifactId}.verification.sha256`, "verification sidecar");
  if (parseVerificationSidecar(verificationSidecarChild.content.toString("utf8"), verificationName).sha256 !== verificationChild.sha256) fail("verification sidecar mismatch");
  if (canonicalJson(verification.receipt) !== canonicalJson({ filename: receiptName, sha256: receiptChild.sha256 }) || canonicalJson(verification.artifact) !== canonicalJson(receipt.artifact) || verification.package.manifestSha256 !== receipt.package.manifestSha256 || digest(canonicalJson(verification.package.distFiles)) !== receipt.package.distSha256) fail("receipt cross-bind mismatch");

  const artifactChild = requireChild(children, receipt.artifact.filename, "artifact archive");
  if (BigInt(artifactChild.content.length) !== BigInt(receipt.artifact.bytes) || artifactChild.sha256 !== receipt.artifact.sha256) fail("artifact bytes mismatch");
  const archive = (dependencies.inspectStaticArchive ?? inspectStaticArchive)(artifactChild.content, { expectedDistSha256: verification.package.distFiles, expectedManifestSha256: verification.package.manifestSha256, expectedArtifactSha256: receipt.artifact.sha256 }, dependencies.archiveOptions);
  const base = { state: "staged", smoke: "not-run-untrusted", artifactId: receipt.artifactId, artifactSha256: receipt.artifact.sha256, receiptSha256: receiptChild.sha256, verificationSha256: verificationChild.sha256, manifestSha256: archive.package.manifestSha256 };

  const authorizationManifestChild = findChild(children, authorizationName), authorizationSidecarChild = findChild(children, `${authorizationName}.sha256`);
  const pairPresent = (authorizationManifestChild ? 1 : 0) + (authorizationSidecarChild ? 1 : 0);
  if (pairPresent === 0 && context === null) return base;
  if (pairPresent < 2 || context === null) failAuth("complete authorization evidence pair and context are required");

  const authorization = parseAuthorizationEvidence(authorizationManifestChild.content.toString("utf8"));
  if (parseAuthorizationSidecar(authorizationSidecarChild.content.toString("utf8"), receipt.artifactId).sha256 !== authorizationManifestChild.sha256) failAuth("authorization sidecar mismatch");
  crossBindAuthorization(authorization, { artifactId: receipt.artifactId, receipt: { filename: receiptName, sha256: receiptChild.sha256 }, verification: { filename: verificationName, sha256: verificationChild.sha256 }, artifact: receipt.artifact });
  validateAuthorizationPolicy(authorization, context, (dependencies.clock ?? (() => new Date().toISOString()))());
  return { ...base, authorizationEvidence: "unsigned", authorizationEvidenceSha256: authorizationManifestChild.sha256, revocation: "unverified", audience: authorization.grant.audience.principal, mode: authorization.grant.audience.mode, caseId: authorization.grant.caseId, incidentId: authorization.grant.incidentId };
}

function verifyPinnedArtifact(parsed, context, dependencies) {
  const { artifactDir, receipt: receiptName } = parsed, artifactIdGuess = deriveArtifactId(receiptName);
  const verificationName = `${artifactIdGuess}.verification.json`, authorizationName = `${artifactIdGuess}.authorization.json`;
  const entries = [
    { basename: receiptName, limit: 65536 }, { basename: `${artifactIdGuess}.receipt.sha256`, limit: 1024 },
    { basename: verificationName, limit: 65536 }, { basename: `${artifactIdGuess}.verification.sha256`, limit: 1024 },
    { basename: authorizationName, limit: 65536 }, { basename: `${authorizationName}.sha256`, limit: 1024 },
    { basename: `${artifactIdGuess}.tgz`, limit: ARCHIVE_LIMITS.compressed },
  ];
  let outcome;
  verifyPinnedDirectory(artifactDir, entries, { fs: dependencies.fs, onCheckpoint: dependencies.onCheckpoint, afterRead: (children) => { outcome = buildPinnedResult(children, receiptName, verificationName, authorizationName, context, dependencies); } });
  return outcome;
}

function probeEvidencePresence(artifactDir, receiptName, fs) {
  let artifactIdGuess;
  try { artifactIdGuess = deriveArtifactId(receiptName); } catch { return false; }
  const manifestPath = join(artifactDir, `${artifactIdGuess}.authorization.json`);
  const probe = (path) => { try { fs.lstatSync(path); return true; } catch (error) { if (error && error.code === "ENOENT") return false; throw error; } };
  return probe(manifestPath) || probe(`${manifestPath}.sha256`);
}

async function verifyUnsupportedArtifact(parsed, dependencies) {
  const fs = dependencies.fs ?? pinnedFs;
  if (probeEvidencePresence(parsed.artifactDir, parsed.receipt, fs)) failCapability();
  const result = await verifyLegacyUnpinned(["--artifact-dir", parsed.artifactDir, "--receipt", parsed.receipt], dependencies);
  if (probeEvidencePresence(parsed.artifactDir, parsed.receipt, fs)) failCapability();
  return result;
}

export async function verifyArtifact(input, dependencies = {}) {
  const parsed = parseVerificationArgs(input), capabilityOptions = { platform: dependencies.platform, fs: dependencies.fs };
  if (parsed.contextArgs.length > 0) { requirePinnedDirectoryCapability(capabilityOptions); return verifyPinnedArtifact(parsed, parseEvidenceContext(parsed.contextArgs), dependencies); }
  if (!detectPinnedDirectoryCapability(capabilityOptions)) return verifyUnsupportedArtifact(parsed, dependencies);
  return verifyPinnedArtifact(parsed, null, dependencies);
}
