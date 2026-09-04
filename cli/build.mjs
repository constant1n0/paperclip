import { chmod, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createLocalDiagnosticsBuildOptions, createMainBuildOptions } from "./esbuild.config.mjs";

const expectedDist = ["index.js", "index.js.map", "local-diagnostics.js"];
const distDirectory = new URL("./dist/", import.meta.url);

export function isMainModule(moduleUrl, argv = process.argv) {
  return typeof argv[1] === "string" && resolve(argv[1]) === fileURLToPath(moduleUrl);
}

export async function buildCli() {
  await rm(distDirectory, { force: true, recursive: true });
  await build(createMainBuildOptions());
  await build(createLocalDiagnosticsBuildOptions());
  await Promise.all([
    chmod(new URL("./index.js", distDirectory), 0o755),
    chmod(new URL("./local-diagnostics.js", distDirectory), 0o755),
  ]);

  const actualDist = (await readdir(distDirectory)).sort();
  if (actualDist.join("\0") !== expectedDist.join("\0")) {
    throw new Error(`unexpected CLI dist contents: ${actualDist.join(", ")}`);
  }
}

if (isMainModule(import.meta.url)) await buildCli();
