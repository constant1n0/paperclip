import { canonicalJson } from "./private-local-diagnostics-artifact-lib.mjs";

const SHA256 = /[0-9a-f]{64}/;
const SAFE_ID = /[A-Za-z0-9][A-Za-z0-9_-]{0,127}/;
const ARTIFACT_ID = /[a-z0-9][a-z0-9.-]*/;
const RFC3339_UTC = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z/;
export const CUSTODY_ROOT = "/home/dcm/CUSTODIA-ABSOLUT/private-artifacts/paperclip-local-diagnostics";

const fields = {
  evidence: ["schemaVersion", "artifactId", "receipt", "verification", "artifact", "storage", "grant", "revocation", "signature"],
  digest: ["filename", "sha256"], artifact: ["filename", "sha256", "bytes"], storage: ["custodyRoot", "locator"],
  grant: ["ownerAuthorizationRef", "caseId", "incidentId", "audience", "issuedAt", "expiresAt"], audience: ["principal", "mode"], revocation: ["status", "reference"],
};
function fail(message) { throw new Error(`E_AUTH: ${message}`); }
function plain(value) { return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype; }
function exact(value, expression) { const match = typeof value === "string" && expression.exec(value); return match !== false && match?.index === 0 && match[0].length === value.length; }
function closed(value, name, expected) {
  if (!plain(value) || Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) fail(`${name} has unknown or missing fields`);
  return value;
}
function id(value, name) { if (!exact(value, SAFE_ID)) fail(`${name} must be SAFE_ID`); return value; }
function artifactId(value) { if (!exact(value, ARTIFACT_ID) || value.includes("..")) fail("artifactId must be a safe receipt v1 basename"); return value; }
function digest(value, name) { if (!exact(value, SHA256)) fail(`${name} must be lowercase SHA-256`); return value; }
function text(value, name) { if (!exact(value, /[\x21-\x7e]{1,128}/) || /[\\/]/.test(value)) fail(`${name} must be bounded safe ASCII`); return value; }
function timestamp(value, name) {
  if (typeof value !== "string") fail(`${name} must be UTC RFC3339`);
  const match = RFC3339_UTC.exec(value); if (!match || match.index !== 0 || match[0].length !== value.length) fail(`${name} must be UTC RFC3339`);
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(hour, minute, second, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) fail(`${name} is impossible`);
  return BigInt(date.getTime()) * 1000000n + BigInt((match[7] ?? "").padEnd(9, "0") || "0");
}
function expectedFilename(value, suffix) { return `${artifactId(value)}${suffix}`; }

export { canonicalJson };
export function validateAuthorizationEvidence(value) {
  closed(value, "evidence", fields.evidence);
  if (value.schemaVersion !== 1) fail("unsupported schema version");
  const artifactName = artifactId(value.artifactId);
  for (const [name, suffix] of [["receipt", ".receipt.json"], ["verification", ".verification.json"]]) {
    const item = closed(value[name], name, fields.digest);
    if (item.filename !== expectedFilename(artifactName, suffix)) fail(`${name} filename mismatch`); digest(item.sha256, `${name}.sha256`);
  }
  const artifact = closed(value.artifact, "artifact", fields.artifact);
  if (artifact.filename !== expectedFilename(artifactName, ".tgz")) fail("artifact filename mismatch");
  digest(artifact.sha256, "artifact.sha256"); if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0) fail("artifact.bytes must be positive safe integer");
  const storage = closed(value.storage, "storage", fields.storage);
  if (storage.custodyRoot !== CUSTODY_ROOT || storage.locator !== `${CUSTODY_ROOT}/${artifactName}`) fail("storage must be canonical declarative custody locator");
  const grant = closed(value.grant, "grant", fields.grant); text(grant.ownerAuthorizationRef, "grant.ownerAuthorizationRef"); id(grant.caseId, "grant.caseId");
  const audience = closed(grant.audience, "grant.audience", fields.audience);
  if (!((audience.principal === "hefesto" && audience.mode === "normal" && grant.incidentId === null) || (audience.principal === "optimus" && audience.mode === "break-glass" && id(grant.incidentId, "grant.incidentId") !== grant.caseId))) fail("grant audience and incident policy mismatch");
  if (timestamp(grant.issuedAt, "grant.issuedAt") >= timestamp(grant.expiresAt, "grant.expiresAt")) fail("grant interval is invalid");
  const revocation = closed(value.revocation, "revocation", fields.revocation);
  if (revocation.status !== "unverified") fail("revocation status must be unverified"); text(revocation.reference, "revocation.reference");
  if (value.signature !== null) fail("signature must be null"); return value;
}
export function parseAuthorizationEvidence(source) {
  if (typeof source !== "string") fail("evidence must be text");
  let value; try { value = JSON.parse(source); } catch { fail("evidence is not JSON"); }
  validateAuthorizationEvidence(value); if (canonicalJson(value) !== source) fail("evidence is not canonical JSON"); return value;
}
export function formatAuthorizationSidecar(artifactId, sha256) { return `${digest(sha256, "sidecar SHA-256")}  ${expectedFilename(artifactId, ".authorization.json")}\n`; }
export function parseAuthorizationSidecar(source, artifactId) {
  const filename = expectedFilename(artifactId, ".authorization.json");
  if (typeof source !== "string" || source !== formatAuthorizationSidecar(artifactId, source.slice(0, 64))) fail("sidecar format mismatch");
  return { sha256: source.slice(0, 64), filename };
}
export function crossBindAuthorization(value, bindings) {
  validateAuthorizationEvidence(value); closed(bindings, "bindings", ["artifactId", "receipt", "verification", "artifact"]);
  if (bindings.artifactId !== value.artifactId) fail("bindings.artifactId mismatch");
  for (const name of ["receipt", "verification", "artifact"]) {
    const actual = value[name], bound = closed(bindings[name], `bindings.${name}`, fields[name === "artifact" ? "artifact" : "digest"]);
    if (bound.filename !== actual.filename || bound.sha256 !== actual.sha256 || (name === "artifact" && bound.bytes !== actual.bytes)) fail(`${name} binding mismatch`);
  }
  return value;
}
export function validateAuthorizationPolicy(value, context, verificationTime) {
  validateAuthorizationEvidence(value); closed(context, "expected context", context?.audience === "hefesto" ? ["audience", "caseId"] : ["audience", "caseId", "incidentId"]);
  const grant = value.grant, optimus = context.audience === "optimus";
  if (!((context.audience === "hefesto" && !Object.hasOwn(context, "incidentId")) || (optimus && id(context.incidentId, "expected incidentId") !== id(context.caseId, "expected caseId")))) fail("expected context policy mismatch");
  if (grant.audience.principal !== context.audience || grant.caseId !== id(context.caseId, "expected caseId") || grant.incidentId !== (optimus ? context.incidentId : null)) fail("expected context does not match evidence");
  const instant = typeof verificationTime === "bigint" ? verificationTime : timestamp(verificationTime, "verificationTime");
  if (timestamp(grant.issuedAt, "grant.issuedAt") > instant || instant >= timestamp(grant.expiresAt, "grant.expiresAt")) fail("evidence is outside its validity interval");
  return value;
}
