import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildOptions } from "./build-options.js";
import { productManifest } from "./product-manifest.js";

const entry = productManifest.find((path) => path.endsWith("/index.ts"))!;
const runtime = `{"nodeVersion":${JSON.stringify(process.version)},"platform":${JSON.stringify(process.platform)},"architecture":${JSON.stringify(process.arch)}}`;
const scope = '{"assessed":"diagnostic-runtime/build-compatibility","centralHealth":"not_assessed","centralLiveness":"not_assessed","centralReadiness":"not_assessed"}';
const guarantees = '{"localOnly":true,"centralInspected":false,"centralContacted":false,"centralStarted":false,"centralRecovered":false,"centralValidated":false,"filesystemAccessed":false,"environmentMutated":false,"subprocessSpawned":false,"networkAccessed":false,"databaseOpened":false,"storageOpened":false,"telemetryInitialized":false,"providersInitialized":false,"pluginsLoaded":false,"workersLoaded":false,"schedulersLoaded":false,"recoveryLoaded":false,"serverStarted":false,"persistentTimersInstalled":false,"signalHandlersInstalled":false,"repairsPerformed":false}';
const fixtureDefine = { __PC_VERSION__: '"7.8.9"', __PC_BUILD_COMMIT__: '"0123456789abcdef0123456789abcdef01234567"' } as const;
const metadata = '{"version":"7.8.9","buildCommit":"0123456789abcdef0123456789abcdef01234567"}';
const checks = {
  ok: '[{"id":"build.metadata","status":"pass","code":"valid"},{"id":"runtime.node","status":"pass","code":"supported"}]',
  unsupported: '[{"id":"build.metadata","status":"pass","code":"valid"},{"id":"runtime.node","status":"fail","code":"unsupported"}]',
  invalidArguments: '[{"id":"build.metadata","status":"error","code":"not_evaluated"},{"id":"runtime.node","status":"error","code":"not_evaluated"}]',
  invalidMetadata: '[{"id":"build.metadata","status":"error","code":"invalid"},{"id":"runtime.node","status":"error","code":"not_evaluated"}]',
} as const;
const json = ({ status, paperclip, runtimeFacts = runtime, resultChecks, error }: { status: string; paperclip: string; runtimeFacts?: string; resultChecks: string; error?: string }) => `{"schemaVersion":"v1","command":"paperclipai-local-diagnostics","status":"${status}","scope":${scope},"paperclip":${paperclip},"runtime":${runtimeFacts},"checks":${resultChecks},"guarantees":${guarantees}${error ? `,"error":{"code":"${error}"}` : ""}}\n`;
const expectedOutput = {
  json: json({ status: "ok", paperclip: metadata, resultChecks: checks.ok }),
  text: `paperclipai-local-diagnostics\nstatus: ok\nscope: diagnostic-runtime/build-compatibility; CENTRAL health/liveness/readiness not assessed\npaperclip: 7.8.9 0123456789abcdef0123456789abcdef01234567\nruntime: ${process.version} ${process.platform} ${process.arch}\nchecks: build.metadata=pass/valid, runtime.node=pass/supported\nguarantees: localOnly=true, centralInspected=false, centralContacted=false, centralStarted=false, centralRecovered=false, centralValidated=false, filesystemAccessed=false, environmentMutated=false, subprocessSpawned=false, networkAccessed=false, databaseOpened=false, storageOpened=false, telemetryInitialized=false, providersInitialized=false, pluginsLoaded=false, workersLoaded=false, schedulersLoaded=false, recoveryLoaded=false, serverStarted=false, persistentTimersInstalled=false, signalHandlersInstalled=false, repairsPerformed=false\n`,
  invalidArguments: json({ status: "error", paperclip: "null", resultChecks: checks.invalidArguments, error: "invalid_arguments" }),
  unsupportedRuntime: json({ status: "incompatible", paperclip: metadata, runtimeFacts: '{"nodeVersion":"v18.0.0","platform":"linux","architecture":"x64"}', resultChecks: checks.unsupported, error: "unsupported_runtime" }),
  invalidMetadata: json({ status: "error", paperclip: "null", resultChecks: checks.invalidMetadata, error: "invalid_build_metadata" }),
} as const;

async function runBundle(options: Parameters<typeof buildOptions>[0], argv: string[]) {
  const result = await build(await buildOptions(options));
  const output = result.outputFiles?.find(({ path }) => path === "<stdout>");
  expect(output).toBeDefined();

  const directory = await mkdtemp(join(tmpdir(), "pc-ld-r5-3-"));
  try {
    const bundle = join(directory, "local-diagnostics.mjs");
    await writeFile(bundle, output!.text);
    return spawnSync(process.execPath, [bundle, ...argv], { encoding: "utf8" });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

describe("local-diagnostics bundle closure", () => {
  it("builds the real entry as a single-file bundle with no imports", async () => {
    const result = await build(await buildOptions({ entry }));
    const output = Object.entries(result.metafile!.outputs).find(([path]) => path.endsWith("index.js"));

    expect(output).toBeDefined();
    expect(output![1].imports).toEqual([]);
    expect(result.outputFiles?.some(({ path }) => path.endsWith(".map"))).toBe(false);
  });

  it("inherits shipped defines and merges deterministic fixture overrides", async () => {
    const shipped = await buildOptions({ entry });
    const overridden = await buildOptions({ entry, defineOverride: { "process.version": '"v18.0.0"' } });
    const fixture = await buildOptions({ entry, defineOverride: fixtureDefine });
    const omitted = await buildOptions({ entry, omitDefine: true });

    expect(overridden.sourcemap).toBe(false);
    expect(overridden.define).toEqual({ ...shipped.define, "process.version": '"v18.0.0"' });
    expect(fixture.define).toEqual({ ...shipped.define, ...fixtureDefine });
    expect(omitted.define).toEqual({});
    expect("outfile" in overridden).toBe(false);
    expect("outdir" in overridden).toBe(false);
  });

  it.each([
    ["json", { defineOverride: fixtureDefine }, [], 0, expectedOutput.json],
    ["text", { defineOverride: fixtureDefine }, ["--text"], 0, expectedOutput.text],
    ["invalid arguments", { defineOverride: fixtureDefine }, ["--nope"], 2, expectedOutput.invalidArguments],
    ["unsupported runtime", { defineOverride: { ...fixtureDefine, "process.version": '"v18.0.0"' } }, [], 2, expectedOutput.unsupportedRuntime],
    ["invalid build metadata", { omitDefine: true }, [], 3, expectedOutput.invalidMetadata],
  ])("routes %s through the real bundled entry", async (_label, variant, argv, exitCode, stdout) => {
    const run = await runBundle({ entry, ...variant }, argv);
    expect(run.status).toBe(exitCode);
    expect(run.stdout).toBe(stdout);
    expect(run.stderr).toBe("");
  });
});
