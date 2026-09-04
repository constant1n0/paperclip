import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const cliDirectory = dirname(fileURLToPath(import.meta.url));
const distDirectory = resolve(cliDirectory, "dist");
const expectedDist = ["index.js", "index.js.map", "local-diagnostics.js"];
const expectedPack = ["README.md", "dist/index.js", "dist/index.js.map", "dist/local-diagnostics.js", "package.json"];
const buildNpmScript = resolve(cliDirectory, "../scripts/build-npm.sh");

it("uses a Node 20-compatible main-module guard", async () => {
  await rm(distDirectory, { force: true, recursive: true });
  const { isMainModule } = await import("./build.mjs");
  const buildUrl = new URL("./build.mjs", import.meta.url).href;

  expect(existsSync(distDirectory)).toBe(false);
  expect(isMainModule(buildUrl, [process.execPath])).toBe(false);
  expect(isMainModule(buildUrl, [process.execPath, fileURLToPath(buildUrl)])).toBe(true);
});

it("uses the sole build orchestrator from the package manifest", async () => {
  const packageManifest = JSON.parse(await readFile(resolve(cliDirectory, "package.json"), "utf8"));

  expect(packageManifest.scripts.build).toBe("node build.mjs");
});

it("build and package expose exactly the two CLI executables", async () => {
  const readme = await readFile(resolve(cliDirectory, "../README.md"), "utf8");
  expect(readme).toContain("npx --package=paperclipai -- paperclipai-local-diagnostics");
  expect(readme).not.toContain("npx paperclipai-local-diagnostics");
  const diagnosticsCommand = readme.indexOf("npx --package=paperclipai -- paperclipai-local-diagnostics");
  const registryWorkaround = readme.lastIndexOf("npx --registry https://registry.npmjs.org paperclipai onboard --yes");
  expect(diagnosticsCommand).toBeGreaterThan(registryWorkaround);
  await rm(distDirectory, { force: true, recursive: true });
  try {
    process.env.PC_BUILD_COMMIT = "0123456789abcdef0123456789abcdef01234567";
    const { buildCli } = await import("./build.mjs");

    await buildCli();

    expect((await readdir(distDirectory)).sort()).toEqual(expectedDist);
    for (const executable of ["index.js", "local-diagnostics.js"]) {
      expect((await stat(resolve(distDirectory, executable))).mode & 0o111).not.toBe(0);
    }

    const packageJson = await import("./package.json", { with: { type: "json" } });
    expect(packageJson.default.bin).toEqual({
      paperclipai: "./dist/index.js",
      "paperclipai-local-diagnostics": "./dist/local-diagnostics.js",
    });

    const packed = Object.values(JSON.parse(execFileSync("npm", ["pack", "--json", "--dry-run"], { cwd: cliDirectory, encoding: "utf8" })))[0];
    expect(packed.files.map(({ path }) => path).sort()).toEqual(expectedPack);
  } finally {
    await rm(distDirectory, { force: true, recursive: true });
  }
});

it.each([
  ["missing git provenance", () => {
    const binDirectory = mkdtempSync(join(tmpdir(), "paperclip-no-git-"));
    writeFileSync(join(binDirectory, "git"), "#!/usr/bin/env bash\nexit 1\n", { mode: 0o755 });
    return { PATH: `${binDirectory}:${process.env.PATH}`, PC_BUILD_COMMIT: "", cleanup: () => rmSync(binDirectory, { force: true, recursive: true }) };
  }],
  ["malformed provenance", () => ({ PC_BUILD_COMMIT: "not-a-commit", cleanup: () => undefined })],
])("fails closed before writing dist for %s", (_name, createEnvironment) => {
  const { cleanup, ...env } = createEnvironment();
  rmSync(distDirectory, { force: true, recursive: true });
  try {
    const result = spawnSync("bash", [buildNpmScript, "--skip-checks", "--skip-typecheck"], {
      cwd: cliDirectory,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
    expect(result.status).not.toBe(0);
    expect(existsSync(distDirectory)).toBe(false);
  } finally {
    rmSync(distDirectory, { force: true, recursive: true });
    rmSync(resolve(cliDirectory, "package.dev.json"), { force: true });
    cleanup();
  }
});
