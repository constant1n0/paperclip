import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import * as p from "./private-local-diagnostics-producer-lib.mjs";

const sha = "a".repeat(40), tree = "b".repeat(40), root = "/repo";
test("rejects malformed production arguments", () => {
  for (const argv of [[], ["--commit", sha], ["--out-dir", "/out"], ["--commit", sha, "--commit", sha, "--out-dir", "/out"], ["--commit=x", "--out-dir", "/out"], ["--commit", sha, "--out-dir", "/out", "x"]]) assert.throws(() => p.parseProductionArgs(argv), /P_ARGS:/);
  assert.deepEqual(p.parseProductionArgs(["--commit", sha, "--out-dir", "/out"]), { commit: sha, outDir: "/out" });
});
test("accepts only the approved fork remote", () => {
  assert.equal(p.approvedRemote("git@github.com:constant1n0/paperclip.git"), "git@github.com:constant1n0/paperclip.git");
  for (const value of ["https://github.com/constant1n0/paperclip.git", "https://user@github.com/constant1n0/paperclip.git", "https://github.com/constant1n0/paperclip.git?x=1", "https://github.com/constant1n0/paperclip", "https://github.com/constant1n0/paperclip.git/x", "git@github.com:evil/paperclip.git"]) assert.throws(() => p.approvedRemote(value), /P_REMOTE:/);
});
test("fails closed on snapshot, dirt, and tool mismatches", () => {
  const good = { head: sha, headTree: tree, requestedTree: tree, forkMaster: sha, requested: sha, remote: "git@github.com:constant1n0/paperclip.git", ref: "refs/remotes/fork/master", dirty: [] };
  assert.doesNotThrow(() => p.validateSnapshot(good));
  for (const key of ["head", "headTree", "forkMaster", "requested", "ref", "dirty"]) { const bad = structuredClone(good); bad[key] = key === "dirty" ? ["?? x"] : "c".repeat(40); assert.throws(() => p.validateSnapshot(bad), /P_SNAPSHOT:/); }
  assert.throws(() => p.validateSnapshot({ ...good, remote: "https://github.com/evil/paperclip.git" }), /P_REMOTE:/);
  assert.doesNotThrow(() => p.validateTools({ node: "v22.23.2", pnpm: "9.15.4" }));
  for (const tools of [{ node: "v22", pnpm: "9.15.4" }, { node: "v22.23.2", pnpm: "9" }]) assert.throws(() => p.validateTools(tools), /P_TOOL:/);
});
test("plans one offline install, build, and pack without fallback", () => {
  const plan = p.commandPlan("/stage");
  assert.deepEqual(plan.install, { file: "pnpm", args: ["install", "--offline", "--frozen-lockfile"], env: { COREPACK_ENABLE_NETWORK: "0" } });
  assert.deepEqual(plan.build, { file: "bash", args: ["scripts/build-npm.sh", "--skip-typecheck"] });
  assert.deepEqual(plan.pack, { file: "pnpm", args: ["pack", "--json", "--pack-destination", "/stage"] });
  assert.deepEqual(Object.keys(plan), ["install", "typecheck", "build", "pack"]);
  assert.equal(JSON.stringify(plan).includes("retry"), false);
});
test("rejects unsafe output directories and target names", () => {
  const base = mkdtempSync(join(tmpdir(), "producer-")), out = join(base, "out"), inside = join(base, "repo", "out"); mkdirSync(out); mkdirSync(inside, { recursive: true });
  assert.equal(p.validateOutDir(out, join(base, "repo")), resolve(out));
  for (const target of [join(base, "repo"), inside]) assert.throws(() => p.validateOutDir(target, join(base, "repo")), /P_OUT:/);
  writeFileSync(join(out, "x"), "x"); assert.throws(() => p.validateOutDir(out, join(base, "repo")), /P_OUT:/);
  const link = join(base, "link"); symlinkSync(out, link); assert.throws(() => p.validateOutDir(link, join(base, "repo")), /P_OUT:/);
  for (const name of ["../x", "x/y", "X.tgz", "ok.tgz"]) { if (name === "ok.tgz") assert.equal(p.safeBasename(name), name); else assert.throws(() => p.safeBasename(name), /P_OUT:/); }
  assert.throws(() => p.assertAbsent(out, ["ok.tgz"], () => true), /P_OUT:/);
});
test("requires one staged pnpm tarball and safe subprocess settings", () => {
  const stage = "/stage";
  const packed = '{"tarballPath":"/stage/paperclipai-0.3.1.tgz"}';
  for (const value of ["no", "[]", '[{"tarballPath":"/stage/a.tgz"}]', "{}", '{"tarballPath":1}', '{"tarballPath":"a.tgz"}', '{"tarballPath":"/other/a.tgz"}', '{"tarballPath":"/stage/nested/a.tgz"}', '{"tarballPath":"/stage/../a.tgz"}', '{"tarballPath":"/stage/paper clip.tgz"}', '{"tarballPath":"/stage/a;touch-pwn.tgz"}', '{"tarballPath":"/stage/paperclipai-0.3.2.tgz"}', '{"tarballPath":"/stage/other-0.3.1.tgz"}', '{"tarballPath":"/stage/.paperclipai-0.3.1.tgz"}']) assert.throws(() => p.parsePackResult(value, stage), /P_PACK:/);
  assert.equal(p.parsePackResult(packed, stage), "/stage/paperclipai-0.3.1.tgz");
  assert.deepEqual(p.subprocess("pnpm", ["pack"], "/repo"), { file: "pnpm", args: ["pack"], options: { cwd: "/repo", shell: false, stdio: "pipe", timeout: 120000, maxBuffer: 1048576 } });
});
