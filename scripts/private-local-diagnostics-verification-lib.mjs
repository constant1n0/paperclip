import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
import * as nodeFs from "node:fs";
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
  if (!Array.isArray(argv) || argv[0] !== "--artifact-dir" || argv[2] !== "--receipt" || !isAbsolute(argv[1]) || argv.length < 4) fail("expected --artifact-dir ABSOLUTE_DIR --receipt SAFE_RECEIPT_BASENAME");
  const result = { artifactDir: argv[1], receipt: name(argv[3], "receipt filename") }, expected = new Set(["--audience", "--case-id", "--incident-id"]);
  if (argv.length === 4) return result;
  if ((argv.length - 4) % 2 || argv.slice(4).some((value, index) => index % 2 === 0 ? !expected.has(value) : typeof value !== "string")) fail("invalid authorization evidence arguments");
  for (let index = 4; index < argv.length; index += 2) { const key = argv[index].slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); if (Object.hasOwn(result, key)) fail("duplicate authorization evidence argument"); result[key] = argv[index + 1]; }
  if (!((result.audience === "hefesto" && typeof result.caseId === "string" && !Object.hasOwn(result, "incidentId")) || (result.audience === "optimus" && typeof result.caseId === "string" && typeof result.incidentId === "string"))) fail("incomplete authorization evidence context");
  return result;
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
export function hardenedSnapshot(file, limit, inspect, filesystem = nodeFs) {
  let fd;
  try {
    const before = filesystem.lstatSync(file);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size < 1 || before.size > limit) fail("unsafe evidence file");
    fd = filesystem.openSync(file, filesystem.constants.O_RDONLY | filesystem.constants.O_NOFOLLOW | filesystem.constants.O_NONBLOCK);
    const opened = filesystem.fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) fail("evidence file replaced before read");
    const bytes = filesystem.readFileSync(fd), value = inspect?.(bytes), after = filesystem.fstatSync(fd), final = filesystem.lstatSync(file);
    for (const stat of [after, final]) if (!stat.isFile() || stat.nlink !== 1 || stat.dev !== before.dev || stat.ino !== before.ino || stat.size !== before.size || stat.mtimeMs !== before.mtimeMs || stat.ctimeMs !== before.ctimeMs) fail("evidence file changed while inspected");
    if (bytes.length !== before.size) fail("evidence file changed while read");
    return { bytes, value };
  } finally { if (fd !== undefined) filesystem.closeSync(fd); }
}
function evidenceEntry(file) {
  try { lstatSync(file); return true; }
  catch (error) {
    if (error?.code === "ENOENT") return false;
    fail("authorization evidence discovery failed");
  }
}
function discoverEvidence(dir, prefix) {
  const manifest = `${prefix}.authorization.json`;
  return {
    manifest: evidenceEntry(join(dir, manifest)),
    sidecar: evidenceEntry(join(dir, `${manifest}.sha256`)),
  };
}
function canonical(bytes, label) {
  let value;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { fail(`${label} is invalid JSON`); }
  if (!Buffer.from(canonicalJson(value)).equals(bytes)) fail(`${label} is non-canonical`);
  return value;
}
async function verifyLegacy(input, dependencies = {}) {
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
export async function verifyArtifact(input, dependencies = {}) {
  const parsed = parseVerificationArgs(input), prefix = parsed.receipt.endsWith(".receipt.json") ? parsed.receipt.slice(0, -".receipt.json".length) : "";
  const discovered = prefix && discoverEvidence(parsed.artifactDir, prefix);
  dependencies.afterEvidenceDiscovery?.();
  const rechecked = prefix && discoverEvidence(parsed.artifactDir, prefix);
  const hasEvidence = discovered && (discovered.manifest || discovered.sidecar || rechecked.manifest || rechecked.sidecar);
  if (!hasEvidence && input.length === 4) return verifyLegacy(input, dependencies);
  if (!hasEvidence || input.length === 4) fail("complete authorization evidence and context are required");
  if (lstatSync(parsed.artifactDir).isSymbolicLink() || !lstatSync(parsed.artifactDir).isDirectory()) fail("artifact directory is unsafe");
  const dir = realpathSync(parsed.artifactDir), read = (file, limit, inspect) => hardenedSnapshot(join(dir, file), limit, inspect, dependencies.filesystem), receiptBytes = read(parsed.receipt, 65536).bytes;
  const receipt = validateReceipt(canonical(receiptBytes, "receipt"));
  if (parsed.receipt !== `${receipt.artifactId}.receipt.json`) fail("receipt filename mismatch");
  const receiptSha256 = digest(receiptBytes), receiptSidecar = read(`${receipt.artifactId}.receipt.sha256`, 1024).bytes.toString("utf8");
  if (parseReceiptSidecar(receiptSidecar, parsed.receipt).sha256 !== receiptSha256) fail("receipt sidecar mismatch");
  const verificationName = `${receipt.artifactId}.verification.json`, verificationBytes = read(verificationName, 65536).bytes, verification = validateVerificationManifest(canonical(verificationBytes, "verification manifest"));
  const verificationSha256 = digest(verificationBytes), verificationSidecar = read(`${receipt.artifactId}.verification.sha256`, 1024).bytes.toString("utf8");
  if (parseVerificationSidecar(verificationSidecar, verificationName).sha256 !== verificationSha256 || canonicalJson(verification.receipt) !== canonicalJson({ filename: parsed.receipt, sha256: receiptSha256 }) || canonicalJson(verification.artifact) !== canonicalJson(receipt.artifact) || verification.package.manifestSha256 !== receipt.package.manifestSha256 || digest(canonicalJson(verification.package.distFiles)) !== receipt.package.distSha256) fail("verification cross-bind mismatch");
  const authorizationName = `${receipt.artifactId}.authorization.json`, authorizationBytes = read(authorizationName, 65536).bytes, authorization = parseAuthorizationEvidence(authorizationBytes.toString("utf8"));
  if (parseAuthorizationSidecar(read(`${authorizationName}.sha256`, 1024).bytes.toString("utf8"), receipt.artifactId).sha256 !== digest(authorizationBytes)) fail("authorization sidecar mismatch");
  const verificationTime = (dependencies.clock ?? (() => new Date().toISOString()))();
  crossBindAuthorization(authorization, { artifactId: receipt.artifactId, receipt: { filename: parsed.receipt, sha256: receiptSha256 }, verification: { filename: verificationName, sha256: verificationSha256 }, artifact: receipt.artifact });
  validateAuthorizationPolicy(authorization, { audience: parsed.audience, caseId: parsed.caseId, ...(parsed.audience === "optimus" ? { incidentId: parsed.incidentId } : {}) }, verificationTime);
  const archive = read(receipt.artifact.filename, ARCHIVE_LIMITS.compressed, (bytes) => {
    if (bytes.length !== receipt.artifact.bytes || digest(bytes) !== receipt.artifact.sha256) fail("artifact bytes mismatch");
    return (dependencies.inspectStaticArchive ?? inspectStaticArchive)(bytes, { expectedDistSha256: verification.package.distFiles, expectedManifestSha256: verification.package.manifestSha256, expectedArtifactSha256: receipt.artifact.sha256 }, dependencies.archiveOptions);
  }).value;
  return { state: "staged", smoke: "not-run-untrusted", artifactId: receipt.artifactId, artifactSha256: receipt.artifact.sha256, receiptSha256, verificationSha256, manifestSha256: archive.package.manifestSha256, authorizationEvidence: "unsigned", authorizationEvidenceSha256: digest(authorizationBytes), revocation: "unverified", audience: authorization.grant.audience.principal, mode: authorization.grant.audience.mode, caseId: authorization.grant.caseId, incidentId: authorization.grant.incidentId };
}
