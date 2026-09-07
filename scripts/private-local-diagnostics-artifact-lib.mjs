const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const SCHEMA_VERSION = 1;
export const PACKAGE_NAME = "paperclipai";
export const PACKAGE_VERSION = "0.3.1";
export const PACKAGE_BINS = Object.freeze({
  paperclipai: "./dist/index.js",
  "paperclipai-local-diagnostics": "./dist/local-diagnostics.js",
});
export const PACKAGE_ALLOWLIST = Object.freeze([
  "README.md", "dist/index.js", "dist/index.js.map", "dist/local-diagnostics.js", "package.json",
]);
export const ARTIFACT_NODE_VERSION = "v22.23.2";
export const ARTIFACT_PNPM_VERSION = "9.15.4";

/*
 * V1 receipt contract:
 * - `source` names the checkout that supplied the diagnostic executable.
 * - `build` captures only versions and immutable lock/patch identities.
 * - `package` is the exact CLI manifest surface verified by cli/build.test.mjs.
 * - `artifact` identifies the retained tarball; it does not claim a reproducible pack.
 * - `diagnostics` redundantly binds the executable's embedded version and commit.
 *
 * Authorization, storage, and signature are nullable evidence slots. Producers
 * must retain null until real evidence exists; they must never write placeholders.
 * The future producer and verifier use this library only for in-memory data:
 * no filesystem, process, network, package, signing, or storage operations live here.
 * V1 is intentionally fail-closed: extension fields require a future schema version.
 * Array order is evidence and is therefore never canonicalized by sorting.
 */
const fields = {
  receipt: [
    "schemaVersion", "artifactId", "source", "build", "package", "artifact",
    "diagnostics", "authorization", "storage", "signature",
  ],
  source: ["remote", "ref", "commit", "tree"],
  build: ["nodeVersion", "pnpmVersion", "lockSha256", "acpxPatchSha256"],
  package: ["name", "version", "bins", "allowlist", "distSha256", "manifestSha256"],
  artifact: ["filename", "bytes", "sha256"],
  diagnostics: ["command", "version", "commit"],
};

function fail(code, message) {
  throw new Error(`${code}: ${message}`);
}

function object(value, name, keys) {
  if (!isPlainObject(value)) fail("E_RECEIPT", `${name} must be a plain object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join("\0") !== expected.join("\0")) fail("E_RECEIPT", `${name} has unknown or missing fields`);
  return value;
}
function isPlainObject(value) {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function string(value, name) {
  if (typeof value !== "string" || !value) fail("E_RECEIPT", `${name} must be a non-empty string`);
  return value;
}

function hash(value, name) {
  if (typeof value !== "string" || !SHA256.test(value)) fail("E_HASH", `${name} must be lowercase SHA-256`);
  return value;
}

function commit(value, name) {
  if (typeof value !== "string" || !COMMIT.test(value)) fail("E_COMMIT", `${name} must be lowercase full Git identity`);
  return value;
}

function version(value) {
  if (typeof value !== "string" || !VERSION.test(value) || value.includes("/") || value.includes("\\")) {
    fail("E_VERSION", "version must be a portable semver");
  }
  return value;
}

function equal(actual, expected, name) {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail("E_RECEIPT", `${name} does not match the contract`);
}

function safeName(value, name) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9.-]*$/.test(value) || value.includes("..")) {
    fail("E_FILENAME", `${name} is unsafe`);
  }
  return value;
}

export function artifactId(packageVersion, sourceCommit, artifactSha256) {
  return safeName(
    `paperclipai-local-diagnostics-${version(packageVersion)}-${commit(sourceCommit, "commit").slice(0, 12)}-${hash(artifactSha256, "artifact digest").slice(0, 16)}`,
    "artifact id",
  );
}
export function artifactFilename(packageVersion, sourceCommit, artifactSha256) {
  return `${artifactId(packageVersion, sourceCommit, artifactSha256)}.tgz`;
}

export function canonicalJson(value) {
  const seen = new Set();
  const encode = (item) => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number") {
      if (!Number.isFinite(item)) fail("E_JSON", "numbers must be finite");
      return JSON.stringify(item);
    }
    if (Array.isArray(item)) {
      if (seen.has(item)) fail("E_JSON", "cycles are not allowed");
      seen.add(item);
      const out = `[${item.map(encode).join(",")}]`;
      seen.delete(item);
      return out;
    }
    if (!isPlainObject(item)) fail("E_JSON", "only plain JSON objects are allowed");
    if (seen.has(item)) fail("E_JSON", "cycles are not allowed"); seen.add(item);
    const out = `{${Object.keys(item).sort().map((key) => {
      if (DANGEROUS_KEYS.has(key)) fail("E_JSON", "prototype keys are not allowed");
      return `${JSON.stringify(key)}:${encode(item[key])}`;
    }).join(",")}}`;
    seen.delete(item); return out;
  };
  return `${encode(value)}\n`;
}

export function createReceipt(input) {
  const receipt = { schemaVersion: SCHEMA_VERSION, artifactId: "", ...input };
  receipt.artifactId = artifactId(receipt.package?.version, receipt.source?.commit, receipt.artifact?.sha256);
  receipt.artifact = {
    ...receipt.artifact,
    filename: artifactFilename(receipt.package?.version, receipt.source?.commit, receipt.artifact?.sha256),
  };
  return freeze(validateReceipt(receipt));
}

export function validateReceipt(receipt) {
  object(receipt, "receipt", fields.receipt);
  if (receipt.schemaVersion !== SCHEMA_VERSION) fail("E_RECEIPT", "unsupported schema version");
  const source = object(receipt.source, "source", fields.source);
  string(source.remote, "source.remote");
  string(source.ref, "source.ref");
  commit(source.commit, "source.commit");
  commit(source.tree, "source.tree");

  const build = object(receipt.build, "build", fields.build);
  if (build.nodeVersion !== ARTIFACT_NODE_VERSION) fail("E_TOOL", "unsupported Node version");
  if (build.pnpmVersion !== ARTIFACT_PNPM_VERSION) fail("E_TOOL", "unsupported pnpm version");
  hash(build.lockSha256, "build.lockSha256");
  hash(build.acpxPatchSha256, "build.acpxPatchSha256");

  const pkg = object(receipt.package, "package", fields.package);
  if (pkg.name !== PACKAGE_NAME) fail("E_RECEIPT", "package name mismatch");
  version(pkg.version);
  if (pkg.version !== PACKAGE_VERSION) fail("E_VERSION", "unsupported package version");
  equal(pkg.bins, PACKAGE_BINS, "package bins");
  equal(pkg.allowlist, PACKAGE_ALLOWLIST, "package allowlist");
  hash(pkg.distSha256, "package.distSha256");
  hash(pkg.manifestSha256, "package.manifestSha256");

  const artifact = object(receipt.artifact, "artifact", fields.artifact);
  if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0) {
    fail("E_BYTES", "artifact.bytes must be positive");
  }
  hash(artifact.sha256, "artifact.sha256");
  const expectedId = artifactId(pkg.version, source.commit, artifact.sha256);
  if (receipt.artifactId !== expectedId || artifact.filename !== `${expectedId}.tgz`) {
    fail("E_RECEIPT", "artifact identity mismatch");
  }

  const diagnostics = object(receipt.diagnostics, "diagnostics", fields.diagnostics);
  if (diagnostics.command !== "paperclipai-local-diagnostics" || diagnostics.version !== pkg.version || diagnostics.commit !== source.commit) {
    fail("E_RECEIPT", "diagnostics identity mismatch");
  }
  for (const key of ["authorization", "storage", "signature"]) {
    if (receipt[key] !== null) fail("E_RECEIPT", `${key} must be null when absent`);
  }
  return receipt;
}

// Portable sidecars are exactly: `<lowercase sha256><two spaces><receipt filename>\n`.
export function formatReceiptSidecar(receiptFilename, receiptSha256) {
  return `${hash(receiptSha256, "receipt SHA-256")}  ${safeName(receiptFilename, "receipt filename")}\n`;
}
export function parseReceiptSidecar(text, expectedFilename) {
  if (typeof text !== "string" || !/^[0-9a-f]{64}  [a-z0-9][a-z0-9.-]*\.receipt\.json\n$/.test(text)) fail("E_SIDECAR", "invalid sidecar format");
  const [sha256, filename] = text.trimEnd().split("  ");
  if (filename !== safeName(expectedFilename, "receipt filename")) fail("E_SIDECAR", "sidecar filename mismatch");
  return { filename, sha256 };
}

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
