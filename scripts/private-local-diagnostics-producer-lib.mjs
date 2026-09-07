import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { ARTIFACT_NODE_VERSION, ARTIFACT_PNPM_VERSION, PACKAGE_NAME, PACKAGE_VERSION } from "./private-local-diagnostics-artifact-lib.mjs";

const SHA = /^[0-9a-f]{40}$/;
const APPROVED = "git@github.com:constant1n0/paperclip.git";
const PACK_TARBALL = `${PACKAGE_NAME}-${PACKAGE_VERSION}.tgz`;
const fail = (code, message) => { throw new Error(`${code}: ${message}`); };
const keys = (value, expected) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).sort().join("\0") === expected.join("\0");

export function parseProductionArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 4) fail("P_ARGS", "expected --commit FULL_SHA --out-dir ABSOLUTE_PATH");
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i], value = argv[i + 1];
    if ((flag !== "--commit" && flag !== "--out-dir") || !value || Object.hasOwn(values, flag)) fail("P_ARGS", "invalid or duplicate argument");
    values[flag] = value;
  }
  if (!SHA.test(values["--commit"]) || !isAbsolute(values["--out-dir"])) fail("P_ARGS", "commit must be lowercase full SHA and out-dir absolute");
  return { commit: values["--commit"], outDir: values["--out-dir"] };
}

export function approvedRemote(value) {
  if (value === APPROVED) return APPROVED;
  fail("P_REMOTE", "fork remote must be the approved canonical repository URL");
}

export function validateSnapshot(value) {
  if (!value || !SHA.test(value.head) || value.head !== value.forkMaster || value.head !== value.requested || !SHA.test(value.headTree) || value.headTree !== value.requestedTree || value.ref !== "refs/remotes/fork/master" || !Array.isArray(value.dirty) || value.dirty.length) fail("P_SNAPSHOT", "repository snapshot is not the requested clean fork/master commit");
  approvedRemote(value.remote);
  return value;
}

export function validateTools(value) {
  if (value?.node !== ARTIFACT_NODE_VERSION || value?.pnpm !== ARTIFACT_PNPM_VERSION) fail("P_TOOL", `requires Node ${ARTIFACT_NODE_VERSION} and pnpm ${ARTIFACT_PNPM_VERSION}`);
  return value;
}

export function commandPlan(stage) {
  return Object.freeze({
    install: { file: "pnpm", args: ["install", "--offline", "--frozen-lockfile", "--ignore-scripts"], env: { COREPACK_ENABLE_NETWORK: "0" } },
    smoke: { file: "pnpm", args: ["exec", "vitest", "run", "packages/adapter-utils/src/acpx-engine/remote-spawn-smoke.test.ts"] },
    typecheck: { file: "pnpm", args: ["-r", "typecheck"] },
    build: { file: "bash", args: ["scripts/build-npm.sh", "--skip-typecheck"] },
    pack: { file: "pnpm", args: ["pack", "--json", "--pack-destination", stage] },
  });
}

const inside = (parent, child) => child === parent || child.startsWith(`${parent}/`);
export function validateOutDir(outDir, repoRoot, fs = { lstatSync, readdirSync, realpathSync }) {
  if (!isAbsolute(outDir)) fail("P_OUT", "out-dir must be absolute");
  let stat, out, repo;
  try { stat = fs.lstatSync(outDir); out = fs.realpathSync(outDir); repo = fs.realpathSync(repoRoot); } catch { fail("P_OUT", "out-dir and repository must exist"); }
  if (stat.isSymbolicLink() || !stat.isDirectory() || inside(repo, out) || fs.readdirSync(out).length) fail("P_OUT", "out-dir must be an empty real directory outside the checkout");
  return out;
}
export function safeBasename(value) {
  if (typeof value !== "string" || basename(value) !== value || !/^[a-z0-9][a-z0-9.-]*$/.test(value) || value.includes("..")) fail("P_OUT", "unsafe output basename");
  return value;
}
export function assertAbsent(outDir, names, existsSync) {
  for (const name of names) if (existsSync(resolve(outDir, safeBasename(name)))) fail("P_OUT", "refusing to overwrite output target");
}
export function parsePackResult(text, stage) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { fail("P_PACK", "pnpm pack did not return JSON"); }
  if (!keys(parsed, ["filename"]) || typeof parsed.filename !== "string" || !isAbsolute(parsed.filename) || !isAbsolute(stage)) fail("P_PACK", "pnpm pack must report one absolute filename");
  const target = resolve(parsed.filename), staging = resolve(stage);
  if (dirname(target) !== staging || basename(target) !== PACK_TARBALL) fail("P_PACK", "tarball is outside staging");
  return target;
}
export function subprocess(file, args, cwd) {
  if (typeof file !== "string" || !Array.isArray(args) || !isAbsolute(cwd) || args.some((arg) => typeof arg !== "string")) fail("P_EXEC", "invalid subprocess contract");
  return { file, args: [...args], options: { cwd, shell: false, stdio: "pipe", timeout: 120000, maxBuffer: 1048576 } };
}
