import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { loadBuildFactories } from "./build-options.js";

const cliDirectory = resolve(import.meta.dirname, "../../..");
const configUrl = pathToFileURL(resolve(cliDirectory, "esbuild.config.mjs")).href;

it("creates main build options without Git metadata", () => {
  const { PC_BUILD_COMMIT: _, ...environment } = process.env;
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval", `const { createMainBuildOptions } = await import(${JSON.stringify(configUrl)}); console.log(createMainBuildOptions().outfile);`], { env: { ...environment, PATH: "" } });

  expect(output.toString()).toContain("dist/index.js");
});

it("creates isolated CWD-invariant main and standalone build options", async () => {
  const { default: config, createLocalDiagnosticsBuildOptions, createMainBuildOptions } = await loadBuildFactories();
  const main = createMainBuildOptions();
  const standalone = createLocalDiagnosticsBuildOptions({
    define: { __PC_VERSION__: '"7.8.9"' },
    metafile: true,
    write: false,
  });

  expect(config).toEqual(main);
  expect(main).toMatchObject({
    absWorkingDir: cliDirectory,
    entryPoints: [resolve(cliDirectory, "src/index.ts")],
    outfile: resolve(cliDirectory, "dist/index.js"),
    sourcemap: true,
  });
  expect(standalone).toMatchObject({
    absWorkingDir: cliDirectory,
    define: { __PC_VERSION__: '"7.8.9"' },
    entryPoints: [resolve(cliDirectory, "src/local-diagnostics/index.ts")],
    external: [],
    metafile: true,
    outfile: resolve(cliDirectory, "dist/local-diagnostics.js"),
    sourcemap: false,
    write: false,
  });
});

it("does not share mutable options containers between factory calls", async () => {
  const { createLocalDiagnosticsBuildOptions } = await loadBuildFactories();
  const first = createLocalDiagnosticsBuildOptions({ define: { marker: '"first"' } });
  const second = createLocalDiagnosticsBuildOptions({ define: { marker: '"second"' } });

  expect(first).not.toBe(second);
  expect(first.entryPoints).not.toBe(second.entryPoints);
  expect(first.external).not.toBe(second.external);
  expect(first.banner).not.toBe(second.banner);
  expect(first.define).not.toBe(second.define);
  expect(first.define).toMatchObject({ marker: '"first"' });
  expect(second.define).toMatchObject({ marker: '"second"' });

  first.entryPoints.push("unexpected.ts");
  first.external.push("unexpected-package");
  first.banner.js = "unexpected-banner";
  first.define.marker = '"mutated"';
  const fresh = createLocalDiagnosticsBuildOptions({ define: { marker: '"fresh"' } });

  expect(fresh).toMatchObject({
    banner: { js: "#!/usr/bin/env node" },
    define: { marker: '"fresh"' },
    entryPoints: [resolve(cliDirectory, "src/local-diagnostics/index.ts")],
    external: [],
  });
});

it("does not share main factory define containers between calls", async () => {
  const { createMainBuildOptions } = await loadBuildFactories();
  const first = createMainBuildOptions();
  const second = createMainBuildOptions();

  expect(first.define).toEqual({});
  expect(first.define).not.toBe(second.define);
  first.define.marker = '"mutated"';
  expect(createMainBuildOptions().define).toEqual({});
});
