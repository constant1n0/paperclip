import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, chmodSync, closeSync, existsSync, fstatSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { canonicalJson, createReceipt, formatReceiptSidecar } from "./private-local-diagnostics-artifact-lib.mjs";
import { acquirePinnedDirectory, createVerificationManifest, detectPinnedDirectoryCapability, formatVerificationSidecar, parseVerificationArgs, proveDirectoryAlias, requirePinnedDirectoryCapability, verifyArtifact, verifyPinnedDirectory } from "./private-local-diagnostics-verification-lib.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex"), commit = "c".repeat(40), bin = { paperclipai: "./dist/index.js", "paperclipai-local-diagnostics": "./dist/local-diagnostics.js" };
const fsReal = { openSync, fstatSync, statSync, lstatSync, closeSync, readFileSync, readSync, realpathSync };
function fixture({ malicious = false, index = "#!/usr/bin/env node\n" } = {}) { const root = mkdtempSync(join(tmpdir(), "verify-")), dir = join(root, "stage"), payload = join(root, "package"), dist = join(payload, "dist"), sentinel = join(root, "sentinel"), manifest = { name: "paperclipai", version: "0.3.1", description: "Paperclip CLI", main: "./dist/index.js", files: ["dist", "README.md"], bin }; mkdirSync(dir); mkdirSync(dist, { recursive: true }); const diagnostic = malicious ? `#!/usr/bin/env node\nimport{writeFileSync}from"node:fs";writeFileSync(${JSON.stringify(sentinel)},"executed")` : "#!/usr/bin/env node\nprocess.stdout.write('{}\\n')"; for (const [name, bytes] of [["README.md", "readme\n"], ["package.json", JSON.stringify(manifest)], ["dist/index.js", index], ["dist/index.js.map", "{}"], ["dist/local-diagnostics.js", diagnostic]]) writeFileSync(join(payload, name), bytes); chmodSync(join(dist, "index.js"), 0o755); chmodSync(join(dist, "local-diagnostics.js"), 0o755); const tarball = join(dir, "artifact.tgz"); execFileSync("tar", ["-czf", tarball, "-C", root, "package/README.md", "package/package.json", "package/dist/index.js", "package/dist/index.js.map", "package/dist/local-diagnostics.js"]); const artifact = readFileSync(tarball), distFiles = { "dist/index.js": digest(readFileSync(join(dist, "index.js"))), "dist/local-diagnostics.js": digest(readFileSync(join(dist, "local-diagnostics.js"))) }, receipt = createReceipt({ source: { remote: "git@github.com:constant1n0/paperclip.git", ref: "refs/remotes/fork/master", commit, tree: "d".repeat(40) }, build: { nodeVersion: "v22.23.2", pnpmVersion: "9.15.4", lockSha256: "e".repeat(64), acpxPatchSha256: "f".repeat(64) }, package: { name: "paperclipai", version: "0.3.1", bins: bin, allowlist: ["README.md", "dist/index.js", "dist/index.js.map", "dist/local-diagnostics.js", "package.json"], distSha256: digest(canonicalJson(distFiles)), manifestSha256: digest(readFileSync(join(payload, "package.json"))) }, artifact: { bytes: artifact.length, sha256: digest(artifact) }, diagnostics: { command: "paperclipai-local-diagnostics", version: "0.3.1", commit }, authorization: null, storage: null, signature: null }), receiptName = `${receipt.artifactId}.receipt.json`, receiptBytes = Buffer.from(canonicalJson(receipt)), verificationName = `${receipt.artifactId}.verification.json`, verificationBytes = Buffer.from(canonicalJson(createVerificationManifest({ artifactId: receipt.artifactId, receipt: { filename: receiptName, sha256: digest(receiptBytes) }, artifact: receipt.artifact, package: { manifestSha256: receipt.package.manifestSha256, distFiles } }))); renameSync(tarball, join(dir, receipt.artifact.filename)); for (const [name, bytes] of [[receiptName, receiptBytes], [`${receipt.artifactId}.receipt.sha256`, formatReceiptSidecar(receiptName, digest(receiptBytes))], [verificationName, verificationBytes], [`${receipt.artifactId}.verification.sha256`, formatVerificationSidecar(verificationName, digest(verificationBytes))]]) writeFileSync(join(dir, name), bytes); return { root, dir, receipt, receiptName, verificationName, sentinel }; }
const args = (f) => ["--artifact-dir", f.dir, "--receipt", f.receiptName];

test("validates benign and malicious five-file sets without executing archive-controlled JS", async () => { for (const malicious of [false, true]) { const f = fixture({ malicious }); try { const value = await verifyArtifact(args(f)); assert.equal(value.state, "staged"); assert.equal(value.smoke, "not-run-untrusted"); assert.equal(existsSync(f.sentinel), false); } finally { rmSync(f.root, { recursive: true, force: true }); } } });
test("rejects static archive, package, bin, shebang, receipt-diagnostic, and argument deviations without smoke", async () => { for (const value of [[], ["--artifact-dir", "/x", "--receipt", "../x"], ["--require-authorized"]]) assert.throws(() => parseVerificationArgs(value), /V_/); const bad = fixture({ index: "x" }); try { await assert.rejects(verifyArtifact(args(bad)), /A_EXEC/); assert.equal(existsSync(bad.sentinel), false); } finally { rmSync(bad.root, { recursive: true, force: true }); } const f = fixture(); try { const receiptPath = join(f.dir, f.receiptName), original = readFileSync(receiptPath), receipt = JSON.parse(original); receipt.diagnostics.commit = "a".repeat(40); writeFileSync(receiptPath, canonicalJson(receipt)); await assert.rejects(verifyArtifact(args(f)), /E_RECEIPT/); writeFileSync(receiptPath, original); rmSync(join(f.dir, f.receipt.artifact.filename)); symlinkSync("/etc/passwd", join(f.dir, f.receipt.artifact.filename)); await assert.rejects(verifyArtifact(args(f)), /V_/); } finally { rmSync(f.root, { recursive: true, force: true }); } });
test("CLI explicitly reports that untrusted smoke was not run", () => { const f = fixture(); try { const out = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL("./verify-private-local-diagnostics-artifact.mjs", import.meta.url)), ...args(f)], { encoding: "utf8" })); assert.equal(out.smoke, "not-run-untrusted"); } finally { rmSync(f.root, { recursive: true, force: true }); } });

test("pinned-directory capability probe reports support only on Linux with usable /proc/self/fd, and the capability guard throws V_CAPABILITY otherwise", () => {
  assert.equal(detectPinnedDirectoryCapability({ platform: "darwin", fs: fsReal }), false);
  assert.equal(detectPinnedDirectoryCapability({ platform: "linux", fs: { statSync: () => { throw new Error("boom"); } } }), false);
  assert.equal(detectPinnedDirectoryCapability({ platform: "linux", fs: fsReal }), true);
  assert.throws(() => requirePinnedDirectoryCapability({ platform: "win32", fs: fsReal }), /V_CAPABILITY: evidence verification requires Linux with usable \/proc\/self\/fd/);
});

test("acquires a pinned directory only after proving it via /proc/self/fd, and proves a caller alias by dev/ino identity only", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-acquire-")), other = mkdtempSync(join(tmpdir(), "pinned-other-"));
  writeFileSync(join(dir, "present.json"), "{}");
  try {
    const pinned = acquirePinnedDirectory(dir, { fs: fsReal });
    assert.equal(typeof pinned.fd, "number");
    assert.doesNotThrow(() => proveDirectoryAlias(dir, pinned, { fs: fsReal }));
    assert.throws(() => proveDirectoryAlias(other, pinned, { fs: fsReal }), /V_DIRECTORY: artifact directory is unsafe/);
    assert.throws(() => proveDirectoryAlias(join(dir, "missing"), pinned, { fs: fsReal }), /V_DIRECTORY: artifact directory is unsafe/);
    closeSync(pinned.fd);
    assert.throws(() => acquirePinnedDirectory(join(dir, "missing"), { fs: fsReal }), /V_DIRECTORY: artifact directory is unsafe/);
    assert.throws(() => acquirePinnedDirectory(join(dir, "present.json"), { fs: fsReal }), /V_DIRECTORY: artifact directory is unsafe/);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(other, { recursive: true, force: true }); }
});

test("tracks directory/basename entry stability without false positives on a recorded-absent basename, and detects child metadata drift", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-stability-"));
  writeFileSync(join(dir, "present.json"), '{"n":"present.json"}');
  const entries = [{ basename: "present.json", limit: 4096 }, { basename: "absent.json", limit: 4096 }];
  try {
    const result = verifyPinnedDirectory(dir, entries, { fs: fsReal });
    assert.equal(result.children.length, 1);
    assert.equal(result.children[0].basename, "present.json");
    assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: fsReal, onCheckpoint: (point) => { if (point === "step1-complete") { const bytes = readFileSync(join(dir, "present.json")); bytes[bytes.length - 2] ^= 0xff; writeFileSync(join(dir, "present.json"), bytes); } } }), /V_RACE: inspection bundle changed during verification/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("verifies content by re-reading to EOF: catches an append after the step-4 metadata recheck and a frozen-timestamp same-size mutation only through the digest", () => {
  const entries = [{ basename: "present.json", limit: 4096 }];
  const appendDir = mkdtempSync(join(tmpdir(), "pinned-append-"));
  writeFileSync(join(appendDir, "present.json"), '{"n":"present.json"}');
  try {
    assert.throws(() => verifyPinnedDirectory(appendDir, entries, { fs: fsReal, onCheckpoint: (point) => { if (point === "step4-metadata-complete") appendFileSync(join(appendDir, "present.json"), "x"); } }), /V_RACE: inspection bundle changed during verification/);
  } finally { rmSync(appendDir, { recursive: true, force: true }); }
  const frozenDir = mkdtempSync(join(tmpdir(), "pinned-frozen-"));
  writeFileSync(join(frozenDir, "present.json"), '{"n":"present.json"}');
  const lstatCache = new Map(), fstatCache = new Map();
  const frozenFs = { ...fsReal, lstatSync: (p, o) => { if (!lstatCache.has(p)) lstatCache.set(p, fsReal.lstatSync(p, o)); return lstatCache.get(p); }, fstatSync: (fd, o) => { if (!fstatCache.has(fd)) fstatCache.set(fd, fsReal.fstatSync(fd, o)); return fstatCache.get(fd); } };
  try {
    assert.throws(() => verifyPinnedDirectory(frozenDir, entries, { fs: frozenFs, onCheckpoint: (point) => { if (point === "step1-complete") { const bytes = readFileSync(join(frozenDir, "present.json")); bytes[bytes.length - 2] ^= 0xff; writeFileSync(join(frozenDir, "present.json"), bytes); } } }), /V_RACE: inspection bundle changed during verification/);
  } finally { rmSync(frozenDir, { recursive: true, force: true }); }
});

test("defends against directory rename/poison during child reads: reads stay anchored to the original identity, the poisoned replacement is never consumed, and the final alias check rejects it", () => {
  const root = mkdtempSync(join(tmpdir(), "pinned-aba-")), a = join(root, "a"), b = join(root, "b");
  mkdirSync(a);
  writeFileSync(join(a, "present.json"), '{"n":"original"}');
  const entries = [{ basename: "present.json", limit: 4096 }];
  try {
    assert.throws(() => verifyPinnedDirectory(a, entries, { fs: fsReal, onCheckpoint: (point) => { if (point === "step2-complete") { renameSync(a, b); mkdirSync(a); writeFileSync(join(a, "present.json"), '{"n":"poisoned"}'); } } }), /V_DIRECTORY: artifact directory is unsafe/);
    assert.equal(readFileSync(join(b, "present.json"), "utf8"), '{"n":"original"}');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("an ancestor rename after the final alias check does not change the result", () => {
  const root = mkdtempSync(join(tmpdir(), "pinned-ancestor-")), parent = join(root, "parent"), moved = join(root, "moved"), dir = join(parent, "target");
  mkdirSync(parent);
  mkdirSync(dir);
  writeFileSync(join(dir, "present.json"), '{"n":"original"}');
  const entries = [{ basename: "present.json", limit: 4096 }];
  try {
    const result = verifyPinnedDirectory(dir, entries, { fs: fsReal, onCheckpoint: (point) => { if (point === "step3-complete") renameSync(parent, moved); } });
    assert.equal(result.children[0].basename, "present.json");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a basename appearing between step 1 and step 2 is a race", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-race-add-"));
  writeFileSync(join(dir, "present.json"), '{"n":"present.json"}');
  const entries = [{ basename: "present.json", limit: 4096 }, { basename: "extra.json", limit: 4096 }];
  try {
    assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: fsReal, onCheckpoint: (point) => { if (point === "step1-complete") writeFileSync(join(dir, "extra.json"), "{}"); } }), /V_RACE: inspection bundle changed during verification/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an alias renamed away, or renamed away and replaced by a new directory, between steps 2 and 3 is rejected as unsafe", () => {
  for (const tamper of [(dir) => renameSync(dir, `${dir}-away`), (dir) => { renameSync(dir, `${dir}-away`); mkdirSync(dir); }]) {
    const dir = mkdtempSync(join(tmpdir(), "pinned-alias-"));
    writeFileSync(join(dir, "present.json"), '{"n":"present.json"}');
    const entries = [{ basename: "present.json", limit: 4096 }];
    try {
      assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: fsReal, onCheckpoint: (point) => { if (point === "step2-complete") tamper(dir); } }), /V_DIRECTORY: artifact directory is unsafe/);
    } finally { try { rmSync(`${dir}-away`, { recursive: true, force: true }); } catch { /* already restored */ } rmSync(dir, { recursive: true, force: true }); }
  }
});

test("a same-A child replacement between steps 3 and 4 is a race, while a mutation strictly before its step-1 read is legitimate input", () => {
  const entries = [{ basename: "present.json", limit: 4096 }];
  const replaceDir = mkdtempSync(join(tmpdir(), "pinned-replace-"));
  writeFileSync(join(replaceDir, "present.json"), '{"n":"present.json"}');
  try {
    assert.throws(() => verifyPinnedDirectory(replaceDir, entries, { fs: fsReal, onCheckpoint: (point) => { if (point === "step3-complete") { writeFileSync(join(replaceDir, "present.json.new"), '{"n":"REPLACED"}'); renameSync(join(replaceDir, "present.json.new"), join(replaceDir, "present.json")); } } }), /V_RACE: inspection bundle changed during verification/);
  } finally { rmSync(replaceDir, { recursive: true, force: true }); }
  const inputDir = mkdtempSync(join(tmpdir(), "pinned-input-"));
  writeFileSync(join(inputDir, "present.json"), '{"n":"original"}');
  try {
    const result = verifyPinnedDirectory(inputDir, entries, { fs: fsReal, onCheckpoint: (point) => { if (point === "classified") writeFileSync(join(inputDir, "present.json"), '{"n":"before-read"}'); } });
    assert.equal(result.children[0].sha256, digest('{"n":"before-read"}'));
  } finally { rmSync(inputDir, { recursive: true, force: true }); }
});

test("EMFILE, ENFILE, EIO, and ENOMEM stay unclassified and propagate raw, while V_DIRECTORY/V_RACE/V_CAPABILITY messages never expose paths, FDs, proc paths, metadata, or digests", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-errno-"));
  writeFileSync(join(dir, "present.json"), '{"n":"present.json"}');
  const entries = [{ basename: "present.json", limit: 4096 }];
  const secret = new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  try {
    for (const code of ["EMFILE", "ENFILE", "EIO", "ENOMEM"]) {
      const raw = Object.assign(new Error("synthetic"), { code });
      assert.throws(() => acquirePinnedDirectory(dir, { fs: { ...fsReal, openSync: () => { throw raw; } } }), (error) => error === raw);
      assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: { ...fsReal, lstatSync: () => { throw raw; } } }), (error) => error === raw);
    }
    let capabilityError, directoryError, raceError;
    try { requirePinnedDirectoryCapability({ platform: "darwin", fs: fsReal }); } catch (error) { capabilityError = error; }
    try { acquirePinnedDirectory(join(dir, "missing"), { fs: fsReal }); } catch (error) { directoryError = error; }
    try { verifyPinnedDirectory(dir, entries, { fs: fsReal, onCheckpoint: (point) => { if (point === "step1-complete") writeFileSync(join(dir, "present.json"), '{"n":"mutated!!"}'); } }); } catch (error) { raceError = error; }
    assert.equal(capabilityError.message, "V_CAPABILITY: evidence verification requires Linux with usable /proc/self/fd");
    assert.equal(directoryError.message, "V_DIRECTORY: artifact directory is unsafe");
    assert.equal(raceError.message, "V_RACE: inspection bundle changed during verification");
    for (const message of [capabilityError.message, directoryError.message, raceError.message]) assert.doesNotMatch(message, secret);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rejects unsafe basenames (separators, .., empty) before any filesystem lookup", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-basename-"));
  try {
    for (const basename of ["sub/c.json", "../escape.json", ""]) {
      const calls = [];
      const tracked = {};
      for (const key of Object.keys(fsReal)) tracked[key] = (...args) => { calls.push(key); return fsReal[key](...args); };
      assert.throws(() => verifyPinnedDirectory(dir, [{ basename, limit: 4096 }], { fs: tracked }), /V_MANIFEST: basename is unsafe/);
      assert.deepEqual(calls, []);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("step-1 static child violations are classified as V_MANIFEST (legacy snapshot classes), never V_RACE", () => {
  const entries = [{ basename: "child.json", limit: 4096 }];
  const cases = [
    { setup: (dir) => { writeFileSync(join(dir, "child.json"), '{"n":"x"}'); linkSync(join(dir, "child.json"), join(dir, "child2.json")); }, expect: /V_MANIFEST: unsafe file/ },
    { setup: (dir) => execFileSync("mkfifo", [join(dir, "child.json")]), expect: /V_MANIFEST: unsafe file/ },
    { setup: (dir) => mkdirSync(join(dir, "child.json")), expect: /V_MANIFEST: unsafe file/ },
    { setup: (dir) => { writeFileSync(join(dir, "real.json"), "{}"); symlinkSync(join(dir, "real.json"), join(dir, "child.json")); }, expect: /V_MANIFEST: symlinks are forbidden/ },
    { setup: (dir) => writeFileSync(join(dir, "child.json"), "x".repeat(5000)), expect: /V_MANIFEST: unsafe file/ },
    { setup: (dir) => writeFileSync(join(dir, "child.json"), ""), expect: /V_MANIFEST: unsafe file/ },
  ];
  for (const { setup, expect } of cases) {
    const dir = mkdtempSync(join(tmpdir(), "pinned-static-"));
    setup(dir);
    try { assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: fsReal }), expect); } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test("acquisition rejects a relative path without any filesystem lookup", () => {
  const calls = [];
  const tracked = {};
  for (const key of Object.keys(fsReal)) tracked[key] = (...args) => { calls.push(key); return fsReal[key](...args); };
  assert.throws(() => acquirePinnedDirectory("relative/path", { fs: tracked }), /V_DIRECTORY: artifact directory is unsafe/);
  assert.deepEqual(calls, []);
});

test("acquisition rejects a final symlink via lstat before ever attempting to open it", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-symlink-"));
  const trap = Object.assign(new Error("must not reach open"), { code: "EMFILE" });
  const seam = { ...fsReal, lstatSync: (p) => (p === dir ? { isSymbolicLink: () => true } : fsReal.lstatSync(p)), openSync: () => { throw trap; } };
  try {
    assert.throws(() => acquirePinnedDirectory(dir, { fs: seam }), /V_DIRECTORY: artifact directory is unsafe/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("acquisition opens the realpathSync-canonicalized path rather than the raw input path", () => {
  const raw = mkdtempSync(join(tmpdir(), "pinned-raw-")), canon = mkdtempSync(join(tmpdir(), "pinned-canon-"));
  const seam = { ...fsReal, realpathSync: (p) => (p === raw ? canon : fsReal.realpathSync(p)) };
  try {
    const pinned = acquirePinnedDirectory(raw, { fs: seam });
    try {
      const canonStat = fsReal.statSync(canon, { bigint: true });
      assert.equal(pinned.dev, canonStat.dev);
      assert.equal(pinned.ino, canonStat.ino);
    } finally { closeSync(pinned.fd); }
  } finally { rmSync(raw, { recursive: true, force: true }); rmSync(canon, { recursive: true, force: true }); }
});

test("an ancestor symlink in the caller path is accepted (acquisition canonicalizes it) and step 3 still re-opens the original, uncanonicalized caller path successfully", () => {
  const root = mkdtempSync(join(tmpdir(), "pinned-alias-canon-"));
  const real = join(root, "real"), link = join(root, "link"), target = join(real, "target");
  mkdirSync(real);
  mkdirSync(target);
  symlinkSync(real, link);
  const viaAncestorSymlink = join(link, "target");
  try {
    const pinned = acquirePinnedDirectory(viaAncestorSymlink, { fs: fsReal });
    try {
      assert.doesNotThrow(() => proveDirectoryAlias(viaAncestorSymlink, pinned, { fs: fsReal }));
    } finally { closeSync(pinned.fd); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a hard link appearing during a child open or read is a race, never accepted as the recorded baseline", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-nlink-"));
  writeFileSync(join(dir, "present.json"), '{"n":"present.json"}');
  const entries = [{ basename: "present.json", limit: 4096 }];
  try {
    for (const which of [0, 1]) {
      let n = 0;
      const seam = { ...fsReal, fstatSync: (fd, o) => { const s = fsReal.fstatSync(fd, o); return s.isFile?.() && n++ === which ? { ...s, nlink: 2n } : s; } };
      assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: seam }), /V_RACE: inspection bundle changed during verification/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("openDirectoryHandle closes its FD when fstat fails or reports a non-directory, for both acquire and the alias check, without reclassifying the error", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-leak-"));
  const cases = [
    { fstatSync: () => { throw Object.assign(new Error("io"), { code: "EIO" }); }, expect: (e) => e.code === "EIO" },
    { fstatSync: () => ({ isDirectory: () => false }), expect: /V_DIRECTORY: artifact directory is unsafe/ },
  ];
  try {
    for (const { fstatSync, expect } of cases) {
      let openedFd, closed = [];
      const seam = { ...fsReal, openSync: (...a) => (openedFd = fsReal.openSync(...a)), fstatSync, closeSync: (fd) => { closed.push(fd); return fsReal.closeSync(fd); } };
      assert.throws(() => acquirePinnedDirectory(dir, { fs: seam }), expect);
      assert.deepEqual(closed, [openedFd]);
      const pinned = acquirePinnedDirectory(dir, { fs: fsReal });
      try { closed = []; assert.throws(() => proveDirectoryAlias(dir, pinned, { fs: seam }), expect); assert.deepEqual(closed, [openedFd]); }
      finally { closeSync(pinned.fd); }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a close failure during cleanup never masks a propagating V_RACE, and every FD still receives a close attempt", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-cleanup-"));
  writeFileSync(join(dir, "a.json"), "{}");
  writeFileSync(join(dir, "b.json"), "{}");
  const entries = [{ basename: "a.json", limit: 4096 }, { basename: "b.json", limit: 4096 }, { basename: "extra.json", limit: 4096 }];
  const attempts = [];
  let calls = 0;
  const seam = { ...fsReal, closeSync: (fd) => { attempts.push(fd); if (calls++ === 0) throw new Error("close failed"); return fsReal.closeSync(fd); } };
  try {
    assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: seam, onCheckpoint: (p) => { if (p === "step1-complete") writeFileSync(join(dir, "extra.json"), "{}"); } }), /V_RACE: inspection bundle changed during verification/);
    assert.equal(attempts.length, 3);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("an EACCES on a step-2/4 lookup for an entry recorded present is a race", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-eacces-"));
  writeFileSync(join(dir, "present.json"), "{}");
  const entries = [{ basename: "present.json", limit: 4096 }];
  let fail = false;
  const seam = { ...fsReal, lstatSync: (p, o) => { if (fail && p.endsWith("/present.json")) throw Object.assign(new Error("denied"), { code: "EACCES" }); return fsReal.lstatSync(p, o); } };
  try { assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: seam, onCheckpoint: (pt) => { if (pt === "step1-complete") fail = true; } }), /V_RACE: inspection bundle changed during verification/); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ENOTDIR and ELOOP on the alias reopen (step 3) are V_DIRECTORY", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-alias-errno-"));
  writeFileSync(join(dir, "present.json"), "{}");
  const entries = [{ basename: "present.json", limit: 4096 }];
  try {
    for (const code of ["ENOTDIR", "ELOOP"]) {
      let calls = 0;
      const seam = { ...fsReal, openSync: (p, f) => { if (p === dir && calls++ === 1) throw Object.assign(new Error(code), { code }); return fsReal.openSync(p, f); } };
      assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: seam }), /V_DIRECTORY: artifact directory is unsafe/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a non-allowlisted errno (EPERM/EROFS) on a lookup propagates unchanged, and EBADF on a held-descriptor fstat propagates unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-unmapped-"));
  writeFileSync(join(dir, "present.json"), "{}");
  const entries = [{ basename: "present.json", limit: 4096 }];
  try {
    for (const code of ["EPERM", "EROFS"]) {
      const raw = Object.assign(new Error("blocked"), { code });
      const seam = { ...fsReal, lstatSync: (p, o) => (p.endsWith("/present.json") ? (() => { throw raw; })() : fsReal.lstatSync(p, o)) };
      assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: seam }), (error) => error === raw);
    }
    const raw = Object.assign(new Error("bad fd"), { code: "EBADF" });
    let calls = 0;
    const seam = { ...fsReal, fstatSync: (fd, o) => (o?.bigint && calls++ === 1 ? (() => { throw raw; })() : fsReal.fstatSync(fd, o)) };
    assert.throws(() => verifyPinnedDirectory(dir, entries, { fs: seam }), (error) => error === raw);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
