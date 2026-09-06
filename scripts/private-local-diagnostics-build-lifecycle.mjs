import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmodSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { commandPlan, validateSnapshot, validateTools } from "./private-local-diagnostics-producer-lib.mjs";

const exec = promisify(execFile), mutable = ["cli/package.json", "cli/README.md", "cli/package.dev.json"];
const fail = (code, message) => { throw new Error(`${code}: ${message}`); };
const digest = (file, fs = { readFileSync }) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const text = (value) => String(value ?? "").trim();

export function inspectAcpx(repo, lock, fs = { readFileSync, readdirSync }) {
  const match = lock.match(/acpx@0\.12\.0:\s*\n\s*hash:\s*([a-z0-9]+)/);
  const path = join(repo, "packages/adapter-utils/node_modules/acpx");
  try { const meta = JSON.parse(fs.readFileSync(join(path, "package.json"), "utf8")), dist = join(path, "dist"), names = fs.readdirSync(dist), declaration = fs.readFileSync(join(dist, "runtime.d.ts"), "utf8"), runtime = fs.readFileSync(join(dist, "runtime.js"), "utf8"), checkpoint = fs.readFileSync(join(dist, names.find((name) => /^live-checkpoint-.+\.js$/.test(name))), "utf8"), modules = fs.readFileSync(join(repo, "node_modules/.modules.yaml"), "utf8"); if (!match || !lock.includes(`acpx@0.12.0(patch_hash=${match[1]})`) || !modules.includes(`acpx@0.12.0(patch_hash=${match[1]})`) || meta.name !== "acpx" || meta.version !== "0.12.0" || ![declaration, runtime, checkpoint].every((file) => /spawnCwd/.test(file) && /onAgentSpawn/.test(file))) fail("L_ACPX", "installed ACPX does not match the locked patch identity"); return { identity: match[1], path: "packages/adapter-utils/node_modules/acpx", files: ["dist/runtime.d.ts", "dist/runtime.js", `dist/${names.find((name) => /^live-checkpoint-.+\.js$/.test(name))}`] }; } catch { fail("L_ACPX", "installed ACPX does not match the locked patch identity"); }
}
export async function defaultRun(file, args, options) {
  return exec(file, args, { cwd: options.cwd, env: options.env, shell: false, timeout: 120000, maxBuffer: 1024 * 1024 });
}
function snapshot(repo, fs) { return mutable.map((path) => { const file = join(repo, path), exists = fs.existsSync(file); return { file, exists, bytes: exists ? fs.readFileSync(file) : null, mode: exists ? fs.statSync(file).mode : null }; }); }
function restore(items, fs) { for (const item of items) { if (item.exists) { fs.writeFileSync(item.file, item.bytes); fs.chmodSync(item.file, item.mode); } else fs.rmSync(item.file, { force: true }); } }

export async function withBuildLifecycle(input, dependencies = {}) {
  const fs = { existsSync, readFileSync, readdirSync, statSync, writeFileSync, chmodSync, rmSync, ...dependencies.fs }, run = dependencies.run ?? defaultRun, repo = input.repo;
  const call = async (file, args, env = {}) => { try { return await run(file, args, { cwd: repo, env: { PATH: process.env.PATH ?? "", ...env }, shell: false, timeout: 120000, maxBuffer: 1024 * 1024 }); } catch { fail("L_EXEC", "command failed"); } };
  const git = async (args) => text((await call("git", args)).stdout);
  const before = await git(["status", "--porcelain"]), source = { head: await git(["rev-parse", "HEAD"]), headTree: await git(["rev-parse", "HEAD^{tree}"]), requestedTree: await git(["rev-parse", `${input.commit}^{tree}`]), forkMaster: await git(["rev-parse", "refs/remotes/fork/master"]), requested: input.commit, remote: await git(["config", "--get", "remote.fork.url"]), ref: "refs/remotes/fork/master", dirty: before ? before.split("\n") : [] };
  validateSnapshot(source); const tools = { node: text((await call("node", ["--version"])).stdout), pnpm: text((await call("pnpm", ["--version"])).stdout) }; validateTools(tools);
  const lock = join(repo, "pnpm-lock.yaml"), patch = join(repo, input.patch ?? "patches/acpx@0.12.0.patch"), lockSha256 = digest(lock, fs), acpxPatchSha256 = digest(patch, fs), plan = commandPlan(input.stage ?? join(repo, ".artifact-stage")), files = snapshot(repo, fs);
  try {
    await call(plan.install.file, plan.install.args, plan.install.env); if (digest(lock, fs) !== lockSha256) fail("L_LOCK", "lockfile changed during offline install");
    const acpx = inspectAcpx(repo, fs.readFileSync(lock, "utf8"), fs); await call(plan.smoke.file, plan.smoke.args); await call(plan.typecheck.file, plan.typecheck.args); await call(plan.build.file, plan.build.args, { PC_BUILD_COMMIT: input.commit });
    await dependencies.callback?.({ dist: join(repo, "cli/dist"), pack: plan.pack });
    return { source: { commit: source.head, tree: source.headTree, remote: source.remote, ref: source.ref }, node: tools.node, pnpm: tools.pnpm, lockSha256, acpxPatchSha256, acpx, commands: [plan.install, plan.smoke, plan.typecheck, plan.build], pack: plan.pack };
  } finally { restore(files, fs); fs.rmSync(join(repo, "cli/dist"), { recursive: true, force: true }); if ((await git(["status", "--porcelain"])) !== before) fail("L_CLEAN", "source state changed during lifecycle"); }
}
