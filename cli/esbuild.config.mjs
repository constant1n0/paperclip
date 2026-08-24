/**
 * esbuild configuration for building the paperclipai CLI for npm.
 *
 * Bundles all workspace packages (@paperclipai/*) into a single file.
 * External npm packages remain as regular dependencies.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundledCliNpmDependencies } from "../scripts/cli-bundled-npm-dependencies.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Embedded provenance for the local-diagnostics bin (C2 sentinels, #5172 §8).
const cliVersion = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")).version;
const buildCommit = process.env.PC_BUILD_COMMIT ?? execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim();

// Workspace packages whose code should be bundled into the CLI.
// Note: "server" is excluded — it's published separately and resolved at runtime.
const workspacePaths = [
  "cli",
  "packages/db",
  "packages/shared",
  "packages/adapter-utils",
  "packages/adapters/claude-local",
  "packages/adapters/codex-local",
  "packages/adapters/hermes-gateway",
  "packages/adapters/hermes",
  "packages/adapters/openclaw-gateway",
];

// Workspace packages that should NOT be bundled — they'll be published
// to npm and resolved at runtime (e.g. @paperclipai/server uses dynamic import).
const externalWorkspacePackages = new Set([
  "@paperclipai/server",
]);

// Collect all external (non-workspace) npm package names
const externals = new Set();
for (const p of workspacePaths) {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, p, "package.json"), "utf8"));
  for (const name of Object.keys(pkg.dependencies || {})) {
    if (externalWorkspacePackages.has(name)) {
      externals.add(name);
    } else if (!name.startsWith("@paperclipai/") && !bundledCliNpmDependencies.has(name)) {
      externals.add(name);
    }
  }
  for (const name of Object.keys(pkg.optionalDependencies || {})) {
    externals.add(name);
  }
}
// Also add all published workspace packages as external
for (const name of externalWorkspacePackages) {
  externals.add(name);
}

/** @type {import('esbuild').BuildOptions} */
export default {
  entryPoints: { index: "src/index.ts", "local-diagnostics": "src/local-diagnostics/index.ts" },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outdir: "dist",
  banner: { js: "#!/usr/bin/env node" },
  define: {
    __PC_VERSION__: JSON.stringify(cliVersion),
    __PC_BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
  external: [...externals].sort(),
  treeShaking: true,
  sourcemap: true,
};
