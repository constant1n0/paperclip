import assert from "node:assert/strict";
import { test } from "node:test";
import * as auth from "./private-local-diagnostics-authorization-lib.mjs";

const id = "artifact-1", hash = "a".repeat(64);
const productionId = "paperclipai-local-diagnostics-0.3.1-0123456789ab-aaaaaaaaaaaaaaaa";
const evidence = () => ({
  schemaVersion: 1, artifactId: id,
  receipt: { filename: `${id}.receipt.json`, sha256: hash },
  verification: { filename: `${id}.verification.json`, sha256: "b".repeat(64) },
  artifact: { filename: `${id}.tgz`, sha256: "c".repeat(64), bytes: 1 },
  storage: { custodyRoot: auth.CUSTODY_ROOT, locator: `${auth.CUSTODY_ROOT}/${id}` },
  grant: { ownerAuthorizationRef: "case-ref", caseId: "case_1", incidentId: null, audience: { principal: "hefesto", mode: "normal" }, issuedAt: "2026-01-01T00:00:00.000000000Z", expiresAt: "2026-01-01T00:00:00.000000002Z" },
  revocation: { status: "unverified", reference: "record-1" }, signature: null,
});
const bindings = () => ({ artifactId: id, receipt: { filename: `${id}.receipt.json`, sha256: hash }, verification: { filename: `${id}.verification.json`, sha256: "b".repeat(64) }, artifact: { filename: `${id}.tgz`, sha256: "c".repeat(64), bytes: 1 } });

test("RED contract: accepts only canonical closed evidence, exact sidecar, policy, and bindings", () => {
  const value = evidence(), text = auth.canonicalJson(value), sidecar = auth.formatAuthorizationSidecar(id, hash);
  assert.deepEqual(auth.parseAuthorizationEvidence(text), value);
  assert.deepEqual(auth.parseAuthorizationSidecar(sidecar, id), { filename: `${id}.authorization.json`, sha256: hash });
  assert.equal(auth.crossBindAuthorization(value, bindings()), value);
  assert.equal(auth.validateAuthorizationPolicy(value, { audience: "hefesto", caseId: "case_1" }, "2026-01-01T00:00:00.000000001Z"), value);
});

test("RED contract: rejects noncanonical shape, identity, sidecar, and cross-binding deviations", () => {
  const cases = [
    (v) => { v.extra = true; }, (v) => { v.artifact.bytes = 0; }, (v) => { v.artifact.sha256 = "C".repeat(64); },
    (v) => { v.artifactId = "bad/id"; }, (v) => { v.receipt.filename = "other.receipt.json"; },
    (v) => { v.storage.locator = `${auth.CUSTODY_ROOT}/other`; }, (v) => { v.signature = "signed"; },
  ];
  for (const mutate of cases) { const value = evidence(); mutate(value); assert.throws(() => auth.validateAuthorizationEvidence(value), /E_AUTH/); }
  assert.throws(() => auth.parseAuthorizationEvidence('{ "artifactId":"x"}\n'), /E_AUTH/);
  for (const text of [`${hash} ${id}.authorization.json\n`, `${hash}  other.authorization.json\n`, `${"A".repeat(64)}  ${id}.authorization.json\n`, `${hash}  ${id}.authorization.json\n\n`]) assert.throws(() => auth.parseAuthorizationSidecar(text, id), /E_AUTH/);
  for (const mutate of [(b) => { delete b.artifactId; }, (b) => { b.artifactId = "other"; }, (b) => { b.receipt.filename = "other.receipt.json"; }, (b) => { b.verification.sha256 = hash; }]) { const bound = bindings(); mutate(bound); assert.throws(() => auth.crossBindAuthorization(evidence(), bound), /E_AUTH/); }
});

test("RED contract: accepts receipt v1 artifact identities but rejects unsafe identity and terminal bytes", () => {
  const value = evidence(); value.artifactId = productionId;
  for (const [name, suffix] of [["receipt", ".receipt.json"], ["verification", ".verification.json"], ["artifact", ".tgz"]]) value[name].filename = `${productionId}${suffix}`;
  value.storage.locator = `${auth.CUSTODY_ROOT}/${productionId}`;
  assert.doesNotThrow(() => auth.validateAuthorizationEvidence(value));
  for (const mutate of [(v) => { v.artifactId = "bad..id"; }, (v) => { v.artifactId = `${productionId}\n`; }]) { const invalid = evidence(); mutate(invalid); assert.throws(() => auth.validateAuthorizationEvidence(invalid), /E_AUTH/); }
  for (const mutate of [(v) => { v.receipt.sha256 += "\n"; }, (v) => { v.grant.caseId += "\r\n"; }, (v) => { v.grant.issuedAt += "\n"; }, (v) => { v.grant.ownerAuthorizationRef += "\r\n"; }]) { const invalid = evidence(); mutate(invalid); assert.throws(() => auth.validateAuthorizationEvidence(invalid), /E_AUTH/); }
});

test("RED contract: enforces the two exact policy pairs and nanosecond UTC interval", () => {
  const value = evidence();
  assert.doesNotThrow(() => auth.validateAuthorizationPolicy(value, { audience: "hefesto", caseId: "case_1" }, "2026-01-01T00:00:00.000000000Z"));
  for (const time of ["2025-12-31T23:59:59.999999999Z", "2026-01-01T00:00:00.000000002Z"]) assert.throws(() => auth.validateAuthorizationPolicy(value, { audience: "hefesto", caseId: "case_1" }, time), /E_AUTH/);
  for (const mutate of [
    (v) => { v.grant.issuedAt = "2026-02-30T00:00:00Z"; }, (v) => { v.grant.incidentId = "incident_1"; },
    (v) => { v.grant.audience.mode = "break-glass"; }, (v) => { v.grant.expiresAt = v.grant.issuedAt; },
  ]) { const invalid = evidence(); mutate(invalid); assert.throws(() => auth.validateAuthorizationEvidence(invalid), /E_AUTH/); }
  const optimus = evidence();
  Object.assign(optimus.grant, { incidentId: "incident_1", audience: { principal: "optimus", mode: "break-glass" } });
  assert.doesNotThrow(() => auth.validateAuthorizationPolicy(optimus, { audience: "optimus", caseId: "case_1", incidentId: "incident_1" }, "2026-01-01T00:00:00.000000001Z"));
  const invalidContexts = [
    { audience: "hefesto", caseId: "case_1", incidentId: "x" },
    { audience: "optimus", caseId: "case_1" },
    { audience: "optimus", caseId: "case_1", incidentId: "case_1" },
    { audience: "optimus", caseId: "other", incidentId: "incident_1" },
  ];
  for (const context of invalidContexts) {
    assert.throws(() => auth.validateAuthorizationPolicy(optimus, context, "2026-01-01T00:00:00.000000001Z"), /E_AUTH/);
  }
});

test("RED contract: preserves RFC3339 early-year UTC intervals", () => {
  const yearOne = evidence(); Object.assign(yearOne.grant, { issuedAt: "0001-01-01T00:00:00.000000000Z", expiresAt: "0001-01-01T00:00:00.000000002Z" });
  assert.doesNotThrow(() => auth.parseAuthorizationEvidence(auth.canonicalJson(yearOne)));
  assert.doesNotThrow(() => auth.validateAuthorizationPolicy(yearOne, { audience: "hefesto", caseId: "case_1" }, "0001-01-01T00:00:00.000000001Z"));
  const boundary = evidence(); Object.assign(boundary.grant, { issuedAt: "0099-12-31T23:59:59.999999999Z", expiresAt: "0100-01-01T00:00:00.000000001Z" });
  assert.doesNotThrow(() => auth.validateAuthorizationPolicy(boundary, { audience: "hefesto", caseId: "case_1" }, "0100-01-01T00:00:00.000000000Z"));
  const impossible = evidence(); impossible.grant.issuedAt = "0001-02-29T00:00:00Z";
  assert.throws(() => auth.validateAuthorizationEvidence(impossible), /E_AUTH/);
});
