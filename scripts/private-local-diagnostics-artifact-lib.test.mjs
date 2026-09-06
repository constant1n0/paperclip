import assert from "node:assert/strict";
import { test } from "node:test";
import * as contract from "./private-local-diagnostics-artifact-lib.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const TREE = "fedcba9876543210fedcba9876543210fedcba98";
const HASH = "a".repeat(64);
const receiptInput = () => ({
  source: { remote: "git@github.com:constant1n0/paperclip.git", ref: "refs/heads/master", commit: COMMIT, tree: TREE },
  build: { nodeVersion: "v22.23.2", pnpmVersion: "9.15.4", lockSha256: HASH, acpxPatchSha256: "b".repeat(64) },
  package: {
    name: "paperclipai", version: "0.3.1",
    bins: { paperclipai: "./dist/index.js", "paperclipai-local-diagnostics": "./dist/local-diagnostics.js" },
    allowlist: ["README.md", "dist/index.js", "dist/index.js.map", "dist/local-diagnostics.js", "package.json"],
    distSha256: "c".repeat(64),
  },
  artifact: { bytes: 1, sha256: "d".repeat(64) },
  diagnostics: { command: "paperclipai-local-diagnostics", version: "0.3.1", commit: COMMIT },
  authorization: null, storage: null, signature: null,
});

test("exports the frozen v1 package contract derived from CLI build tests", () => {
  assert.equal(contract.SCHEMA_VERSION, 1);
  assert.equal(contract.PACKAGE_NAME, "paperclipai");
  assert.deepEqual(contract.PACKAGE_BINS, receiptInput().package.bins);
  assert.deepEqual(contract.PACKAGE_ALLOWLIST, receiptInput().package.allowlist);
  assert.equal(contract.ARTIFACT_NODE_VERSION, "v22.23.2");
  assert.equal(contract.ARTIFACT_PNPM_VERSION, "9.15.4");
});

test("canonical JSON recursively sorts objects, preserves arrays, and ends in one newline", () => {
  assert.equal(contract.canonicalJson({ z: [{ b: 2, a: 1 }], a: [3, 1] }), '{"a":[3,1],"z":[{"a":1,"b":2}]}\n');
  assert.equal(contract.canonicalJson({ a: "x\n" }).endsWith("\n\n"), false);
});

test("builds an immutable canonical receipt and validates a strict round trip", () => {
  const receipt = contract.createReceipt(receiptInput());
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(receipt.artifactId, contract.artifactId("0.3.1", COMMIT, "d".repeat(64)));
  assert.equal(receipt.artifact.filename, contract.artifactFilename("0.3.1", COMMIT, "d".repeat(64)));
  const bytes = Buffer.from(contract.canonicalJson(receipt), "utf8");
  assert.equal(bytes.at(-1), 0x0a);
  assert.equal(bytes.toString("utf8"), contract.canonicalJson(receipt));
  assert.deepEqual(contract.validateReceipt(JSON.parse(bytes)), receipt);
});

test("rejects a self-consistent receipt for an unsupported v1 package version", () => {
  const receipt = JSON.parse(contract.canonicalJson(contract.createReceipt(receiptInput())));
  receipt.package.version = "0.3.2";
  receipt.diagnostics.version = receipt.package.version;
  receipt.artifactId = contract.artifactId(receipt.package.version, receipt.source.commit, receipt.artifact.sha256);
  receipt.artifact.filename = contract.artifactFilename(receipt.package.version, receipt.source.commit, receipt.artifact.sha256);
  assert.throws(() => contract.validateReceipt(receipt), /E_VERSION: unsupported package version/);
});

test("rejects invalid identity, hash, version, and tool values", () => {
  for (const [name, mutate] of [
    ["commit uppercase", (v) => { v.source.commit = COMMIT.toUpperCase(); }], ["tree short", (v) => { v.source.tree = "x"; }],
    ["lock hash uppercase", (v) => { v.build.lockSha256 = "A".repeat(64); }], ["ACPX hash short", (v) => { v.build.acpxPatchSha256 = "b"; }],
    ["dist hash nonhex", (v) => { v.package.distSha256 = "g".repeat(64); }], ["artifact hash uppercase", (v) => { v.artifact.sha256 = "D".repeat(64); }],
    ["version traversal", (v) => { v.package.version = "../0.3.1"; }], ["version whitespace", (v) => { v.package.version = "0.3.1 x"; }],
    ["node", (v) => { v.build.nodeVersion = "v20.0.0"; }], ["pnpm", (v) => { v.build.pnpmVersion = "^9.15.4"; }],
    ["zero bytes", (v) => { v.artifact.bytes = 0; }], ["negative bytes", (v) => { v.artifact.bytes = -1; }], ["fractional bytes", (v) => { v.artifact.bytes = 1.5; }],
  ]) {
    const input = receiptInput(); mutate(input);
    assert.throws(() => contract.createReceipt(input), /E_/);
  }
});

test("rejects missing, unknown, nullable, and redundant receipt fields", () => {
  for (const [name, mutate] of [
    ["missing", (v) => { delete v.source.tree; }], ["nested unknown", (v) => { v.source.extra = true; }],
    ["authorization presence", (v) => { v.authorization = "pending"; }], ["storage presence", (v) => { v.storage = "pending"; }], ["signature presence", (v) => { v.signature = {}; }],
    ["id", (v) => { v.artifactId = "wrong"; }], ["filename traversal", (v) => { v.artifact.filename = "../../x.tgz"; }], ["filename mismatch", (v) => { v.artifact.filename = "other.tgz"; }],
    ["diagnostics commit", (v) => { v.diagnostics.commit = TREE; }], ["diagnostics version", (v) => { v.diagnostics.version = "0.3.2"; }], ["diagnostics command", (v) => { v.diagnostics.command = "other"; }],
    ["bins", (v) => { v.package.bins.paperclipai = "./elsewhere.js"; }], ["allowlist", (v) => { v.package.allowlist.pop(); }],
  ]) { const receipt = JSON.parse(contract.canonicalJson(contract.createReceipt(receiptInput()))); mutate(receipt); assert.throws(() => contract.validateReceipt(receipt), /E_/); }
});

test("rejects unsafe artifact names and sidecar tampering", () => {
  assert.throws(() => contract.artifactId("../0.3.1", COMMIT, HASH), /E_VERSION/);
  const receiptName = `${contract.artifactFilename("0.3.1", COMMIT, HASH)}.receipt.json`;
  const sidecar = contract.formatReceiptSidecar(receiptName, HASH);
  assert.deepEqual(contract.parseReceiptSidecar(sidecar, receiptName), { filename: receiptName, sha256: HASH });
  for (const value of [sidecar.replace(HASH, "A".repeat(64)), sidecar.replace(receiptName, "../x"), `${sidecar}extra\n`]) assert.throws(() => contract.parseReceiptSidecar(value, receiptName), /E_SIDECAR/);
});

test("canonical JSON rejects unsupported, hostile, and cyclic values", () => {
  const cycle = {}; cycle.self = cycle;
  for (const value of [{ x: undefined }, { x() {} }, { x: Symbol("x") }, { x: Infinity }, cycle, new Date(), { __proto__: { x: 1 } }]) {
    assert.throws(() => contract.canonicalJson(value), /E_JSON/);
  }
});
