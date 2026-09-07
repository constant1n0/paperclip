import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalJson } from "./private-local-diagnostics-artifact-lib.mjs";
import { createVerificationManifest, formatVerificationSidecar, parseVerificationSidecar, validateVerificationManifest } from "./private-local-diagnostics-verification-lib.mjs";

const artifactId = "paperclipai-local-diagnostics-0.3.1-aaaaaaaaaaaa-bbbbbbbbbbbbbbbb";
const distFiles = { "dist/index.js": "c".repeat(64), "dist/local-diagnostics.js": "d".repeat(64) };
function fixture() {
  const artifact = `${artifactId}.tgz`, receipt = `${artifactId}.receipt.json`;
  return createVerificationManifest({ artifactId, receipt: { filename: receipt, sha256: "a".repeat(64) }, artifact: { filename: artifact, sha256: "b".repeat(64), bytes: 42 }, package: { manifestSha256: "e".repeat(64), distFiles } });
}

test("creates canonical strict v1 verification manifest and sidecar", () => {
  const manifest = fixture(), bytes = canonicalJson(manifest), name = `${artifactId}.verification.json`;
  assert.equal(bytes, canonicalJson(JSON.parse(bytes)));
  assert.deepEqual(validateVerificationManifest(JSON.parse(bytes)), manifest);
  assert.equal(formatVerificationSidecar(name, "f".repeat(64)), `${"f".repeat(64)}  ${name}\n`);
});

test("rejects unknown or missing fields, mismatched identities, hashes, bytes, and sidecars", () => {
  for (const mutate of [
    (v) => { v.extra = true; }, (v) => { delete v.package.distFiles; },
    (v) => { v.artifact.filename = "../artifact.tgz"; }, (v) => { v.artifact.bytes = 0; },
    (v) => { v.receipt.sha256 = "A".repeat(64); }, (v) => { v.package.distFiles["dist/other.js"] = "f".repeat(64); },
  ]) { const value = structuredClone(fixture()); mutate(value); assert.throws(() => validateVerificationManifest(value), /V_/); }
  for (const value of [`${"a".repeat(64)}  ${artifactId}.verification.json\nextra`, `${"A".repeat(64)}  ${artifactId}.verification.json\n`]) assert.throws(() => parseVerificationSidecar(value, `${artifactId}.verification.json`), /V_/);
});
