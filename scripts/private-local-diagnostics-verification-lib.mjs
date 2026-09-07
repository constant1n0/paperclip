import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
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
