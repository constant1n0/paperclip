import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { canonicalJson, createReceipt, formatReceiptSidecar } from "./private-local-diagnostics-artifact-lib.mjs";
import { CUSTODY_ROOT, formatAuthorizationSidecar } from "./private-local-diagnostics-authorization-lib.mjs";
import { createVerificationManifest, formatVerificationSidecar, hardenedSnapshot, parseVerificationArgs, verifyArtifact } from "./private-local-diagnostics-verification-lib.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex"), commit = "c".repeat(40), bin = { paperclipai: "./dist/index.js", "paperclipai-local-diagnostics": "./dist/local-diagnostics.js" };
function fixture({ malicious = false, index = "#!/usr/bin/env node\n" } = {}) { const root = mkdtempSync(join(tmpdir(), "verify-")), dir = join(root, "stage"), payload = join(root, "package"), dist = join(payload, "dist"), sentinel = join(root, "sentinel"), manifest = { name: "paperclipai", version: "0.3.1", description: "Paperclip CLI", main: "./dist/index.js", files: ["dist", "README.md"], bin }; mkdirSync(dir); mkdirSync(dist, { recursive: true }); const diagnostic = malicious ? `#!/usr/bin/env node\nimport{writeFileSync}from"node:fs";writeFileSync(${JSON.stringify(sentinel)},"executed")` : "#!/usr/bin/env node\nprocess.stdout.write('{}\\n')"; for (const [name, bytes] of [["README.md", "readme\n"], ["package.json", JSON.stringify(manifest)], ["dist/index.js", index], ["dist/index.js.map", "{}"], ["dist/local-diagnostics.js", diagnostic]]) writeFileSync(join(payload, name), bytes); chmodSync(join(dist, "index.js"), 0o755); chmodSync(join(dist, "local-diagnostics.js"), 0o755); const tarball = join(dir, "artifact.tgz"); execFileSync("tar", ["-czf", tarball, "-C", root, "package/README.md", "package/package.json", "package/dist/index.js", "package/dist/index.js.map", "package/dist/local-diagnostics.js"]); const artifact = readFileSync(tarball), distFiles = { "dist/index.js": digest(readFileSync(join(dist, "index.js"))), "dist/local-diagnostics.js": digest(readFileSync(join(dist, "local-diagnostics.js"))) }, receipt = createReceipt({ source: { remote: "git@github.com:constant1n0/paperclip.git", ref: "refs/remotes/fork/master", commit, tree: "d".repeat(40) }, build: { nodeVersion: "v22.23.2", pnpmVersion: "9.15.4", lockSha256: "e".repeat(64), acpxPatchSha256: "f".repeat(64) }, package: { name: "paperclipai", version: "0.3.1", bins: bin, allowlist: ["README.md", "dist/index.js", "dist/index.js.map", "dist/local-diagnostics.js", "package.json"], distSha256: digest(canonicalJson(distFiles)), manifestSha256: digest(readFileSync(join(payload, "package.json"))) }, artifact: { bytes: artifact.length, sha256: digest(artifact) }, diagnostics: { command: "paperclipai-local-diagnostics", version: "0.3.1", commit }, authorization: null, storage: null, signature: null }), receiptName = `${receipt.artifactId}.receipt.json`, receiptBytes = Buffer.from(canonicalJson(receipt)), verificationName = `${receipt.artifactId}.verification.json`, verificationBytes = Buffer.from(canonicalJson(createVerificationManifest({ artifactId: receipt.artifactId, receipt: { filename: receiptName, sha256: digest(receiptBytes) }, artifact: receipt.artifact, package: { manifestSha256: receipt.package.manifestSha256, distFiles } }))); renameSync(tarball, join(dir, receipt.artifact.filename)); for (const [name, bytes] of [[receiptName, receiptBytes], [`${receipt.artifactId}.receipt.sha256`, formatReceiptSidecar(receiptName, digest(receiptBytes))], [verificationName, verificationBytes], [`${receipt.artifactId}.verification.sha256`, formatVerificationSidecar(verificationName, digest(verificationBytes))]]) writeFileSync(join(dir, name), bytes); return { root, dir, receipt, receiptName, verificationName, sentinel }; }
const args = (f) => ["--artifact-dir", f.dir, "--receipt", f.receiptName];
function addEvidence(f, { audience = "hefesto", caseId = "case-1", incidentId, issuedAt = "2026-01-01T00:00:00Z", expiresAt = "2026-01-01T00:01:00Z" } = {}) {
  const artifactId = f.receipt.artifactId, authorizationName = `${artifactId}.authorization.json`, verificationName = `${artifactId}.verification.json`;
  const evidence = { schemaVersion: 1, artifactId, receipt: { filename: f.receiptName, sha256: digest(readFileSync(join(f.dir, f.receiptName))) }, verification: { filename: verificationName, sha256: digest(readFileSync(join(f.dir, verificationName))) }, artifact: f.receipt.artifact, storage: { custodyRoot: CUSTODY_ROOT, locator: `${CUSTODY_ROOT}/${artifactId}` }, grant: { ownerAuthorizationRef: "owner-ref", caseId, incidentId: audience === "optimus" ? incidentId : null, audience: { principal: audience, mode: audience === "optimus" ? "break-glass" : "normal" }, issuedAt, expiresAt }, revocation: { status: "unverified", reference: "revocation-ref" }, signature: null };
  const bytes = canonicalJson(evidence); writeFileSync(join(f.dir, authorizationName), bytes); writeFileSync(join(f.dir, `${authorizationName}.sha256`), formatAuthorizationSidecar(artifactId, digest(bytes)));
  return [...args(f), "--audience", audience, "--case-id", caseId, ...(audience === "optimus" ? ["--incident-id", incidentId] : [])];
}

test("validates benign and malicious five-file sets without executing archive-controlled JS", async () => { for (const malicious of [false, true]) { const f = fixture({ malicious }); try { const value = await verifyArtifact(args(f)); assert.equal(value.state, "staged"); assert.equal(value.smoke, "not-run-untrusted"); assert.equal(existsSync(f.sentinel), false); } finally { rmSync(f.root, { recursive: true, force: true }); } } });
test("rejects static archive, package, bin, shebang, receipt-diagnostic, and argument deviations without smoke", async () => { for (const value of [[], ["--artifact-dir", "/x", "--receipt", "../x"], ["--require-authorized"]]) assert.throws(() => parseVerificationArgs(value), /V_/); const bad = fixture({ index: "x" }); try { await assert.rejects(verifyArtifact(args(bad)), /A_EXEC/); assert.equal(existsSync(bad.sentinel), false); } finally { rmSync(bad.root, { recursive: true, force: true }); } const f = fixture(); try { const receiptPath = join(f.dir, f.receiptName), original = readFileSync(receiptPath), receipt = JSON.parse(original); receipt.diagnostics.commit = "a".repeat(40); writeFileSync(receiptPath, canonicalJson(receipt)); await assert.rejects(verifyArtifact(args(f)), /E_RECEIPT/); writeFileSync(receiptPath, original); rmSync(join(f.dir, f.receipt.artifact.filename)); symlinkSync("/etc/passwd", join(f.dir, f.receipt.artifact.filename)); await assert.rejects(verifyArtifact(args(f)), /V_/); } finally { rmSync(f.root, { recursive: true, force: true }); } });
test("CLI explicitly reports that untrusted smoke was not run", () => { const f = fixture(); try { const out = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL("./verify-private-local-diagnostics-artifact.mjs", import.meta.url)), ...args(f)], { encoding: "utf8" })); assert.equal(out.smoke, "not-run-untrusted"); } finally { rmSync(f.root, { recursive: true, force: true }); } });
test("uses an exact legacy result and rejects partial, replayed, timed, and malicious evidence without execution", async () => {
  const f = fixture({ malicious: true });
  try {
    const legacy = await verifyArtifact(args(f));
    const cli = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL("./verify-private-local-diagnostics-artifact.mjs", import.meta.url)), ...args(f)], { encoding: "utf8" }));
    assert.deepEqual(cli, legacy);
    writeFileSync(join(f.dir, `${f.receipt.artifactId}.authorization.json`), "{}");
    await assert.rejects(verifyArtifact(args(f)), /V_MANIFEST/);
    rmSync(join(f.dir, `${f.receipt.artifactId}.authorization.json`));
    await assert.rejects(verifyArtifact([...args(f), "--audience", "hefesto", "--case-id", "case-1"]), /V_MANIFEST/);
    const valid = addEvidence(f);
    for (const invalid of [[...valid, "--case-id", "duplicate"], [...valid, "--unknown", "input"]]) await assert.rejects(verifyArtifact(invalid), /V_MANIFEST/);
    let clockCalls = 0;
    const result = await verifyArtifact(valid, { clock: () => { clockCalls += 1; return "2026-01-01T00:00:00Z"; } });
    assert.equal(clockCalls, 1);
    assert.deepEqual({ authorizationEvidence: result.authorizationEvidence, caseId: result.caseId, incidentId: result.incidentId }, { authorizationEvidence: "unsigned", caseId: "case-1", incidentId: null });
    await assert.rejects(verifyArtifact([...valid.slice(0, -1), "other-case"], { clock: () => "2026-01-01T00:00:00Z" }), /E_AUTH/);
    await assert.rejects(verifyArtifact(addEvidence(f, { issuedAt: "2026-01-01T00:00:01Z" }), { clock: () => "2026-01-01T00:00:00Z" }), /E_AUTH/);
    await assert.rejects(verifyArtifact(addEvidence(f, { expiresAt: "2026-01-01T00:00:00Z" }), { clock: () => "2026-01-01T00:00:00Z" }), /E_AUTH/);
    await assert.rejects(verifyArtifact([...valid, "--require-authorized"], { clock: () => "2026-01-01T00:00:00Z" }), /V_MANIFEST/);
    assert.equal(existsSync(f.sentinel), false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test("preserves the base-derived legacy result without using the CLI as an oracle", async () => {
  const f = fixture();
  try {
    const receiptBytes = readFileSync(join(f.dir, f.receiptName));
    const verificationName = `${f.receipt.artifactId}.verification.json`;
    assert.deepEqual(await verifyArtifact(args(f)), {
      state: "staged",
      smoke: "not-run-untrusted",
      artifactId: f.receipt.artifactId,
      artifactSha256: f.receipt.artifact.sha256,
      receiptSha256: digest(receiptBytes),
      verificationSha256: digest(readFileSync(join(f.dir, verificationName))),
      manifestSha256: f.receipt.package.manifestSha256,
    });
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test("rejects dangling canonical evidence entries and discovery-time pathname changes", async () => {
  const f = fixture();
  try {
    const authorizationName = `${f.receipt.artifactId}.authorization.json`;
    for (const filename of [authorizationName, `${authorizationName}.sha256`]) {
      const path = join(f.dir, filename);
      symlinkSync(join(f.root, "missing"), path);
      await assert.rejects(verifyArtifact(args(f)), /V_MANIFEST/);
      rmSync(path);
    }
    let probes = 0;
    await assert.rejects(verifyArtifact(args(f), {
      afterEvidenceDiscovery: () => {
        probes += 1;
        symlinkSync(join(f.root, "replaced"), join(f.dir, authorizationName));
      },
    }), /V_MANIFEST/);
    assert.equal(probes, 1);
    rmSync(join(f.dir, authorizationName));
    const valid = addEvidence(f);
    await assert.rejects(verifyArtifact(valid, {
      afterEvidenceDiscovery: () => {
        rmSync(join(f.dir, authorizationName));
        symlinkSync(join(f.root, "replacement"), join(f.dir, authorizationName));
      },
      clock: () => "2026-01-01T00:00:00Z",
    }), /V_MANIFEST/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

const regular = (overrides = {}) => ({ dev: 1, ino: 1, size: 3, nlink: 1, mtimeMs: 1, ctimeMs: 1, isFile: () => true, isSymbolicLink: () => false, ...overrides });
function snapshotFs({ before = regular(), opened = before, after = opened, final = after, onOpen, onRead } = {}) {
  let lstatCalls = 0;
  return {
    constants: { O_RDONLY: 0, O_NOFOLLOW: 2, O_NONBLOCK: 4 },
    lstatSync: () => [before, final][lstatCalls++],
    openSync: (_file, flags) => { onOpen?.(flags); return 7; },
    fstatSync: (() => { let calls = 0; return () => [opened, after][calls++]; })(),
    readFileSync: () => { onRead?.(); return Buffer.from("abc"); },
    closeSync: () => {},
  };
}

test("RED hardened evidence snapshot rejects deterministic replacement, mutation, links, and non-regular files", () => {
  let flags;
  assert.throws(() => hardenedSnapshot("evidence", 4, undefined, snapshotFs({ opened: regular({ isFile: () => false }), onOpen: (value) => { flags = value; } })), /V_MANIFEST: evidence file replaced before read/);
  assert.equal(flags & 2, 2);
  assert.equal(flags & 4, 4);
  assert.throws(() => hardenedSnapshot("evidence", 4, undefined, snapshotFs({ opened: regular({ ino: 2 }) })), /V_MANIFEST: evidence file replaced before read/);
  let mutated = false;
  const changed = regular({ mtimeMs: 2 });
  assert.throws(() => hardenedSnapshot("evidence", 4, () => assert.equal(mutated, true), snapshotFs({ after: changed, onRead: () => { mutated = true; } })), /V_MANIFEST: evidence file changed while inspected/);
  assert.equal(mutated, true);
  assert.throws(() => hardenedSnapshot("evidence", 4, undefined, snapshotFs({ final: changed })), /V_MANIFEST: evidence file changed while inspected/);
  assert.throws(() => hardenedSnapshot("evidence", 4, undefined, snapshotFs({ before: regular({ nlink: 2 }) })), /V_MANIFEST: unsafe evidence file/);
  assert.throws(() => hardenedSnapshot("evidence", 4, undefined, snapshotFs({ before: regular({ isFile: () => false }) })), /V_MANIFEST: unsafe evidence file/);
});
