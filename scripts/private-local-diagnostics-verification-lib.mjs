import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { ARCHIVE_LIMITS, inspectStaticArchive } from "./private-local-diagnostics-archive.mjs";
import { canonicalJson, parseReceiptSidecar, validateReceipt } from "./private-local-diagnostics-artifact-lib.mjs";
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
  if (!Array.isArray(argv) || argv.length !== 4 || argv[0] !== "--artifact-dir" || argv[2] !== "--receipt" || !isAbsolute(argv[1])) fail("expected --artifact-dir ABSOLUTE_DIR --receipt SAFE_RECEIPT_BASENAME");
  return { artifactDir: argv[1], receipt: name(argv[3], "receipt filename") };
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
export async function verifyArtifact(input, dependencies = {}) {
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

// Linux-pinned directory primitives (not yet wired into verifyArtifact/parseVerificationArgs dispatch).
const failCapability = () => { throw new Error("V_CAPABILITY: evidence verification requires Linux with usable /proc/self/fd"); };
const failDirectory = () => { throw new Error("V_DIRECTORY: artifact directory is unsafe"); };
const failRace = () => { throw new Error("V_RACE: inspection bundle changed during verification"); };
const RAW_ERRNO = new Set(["EMFILE", "ENFILE", "EIO", "ENOMEM"]);
const classify = (error, failer) => { if (error && RAW_ERRNO.has(error.code)) throw error; failer(); };
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
    return { basename: entry.basename, limit: entry.limit, fd, dev: opened.dev, ino: opened.ino, nlink: 1n, size: after.size, mtimeNs: after.mtimeNs, ctimeNs: after.ctimeNs, sha256: digest(bytes) };
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
