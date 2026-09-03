import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import { loadBuildFactories } from "./build-options.js";
import { productManifest } from "./product-manifest.js";

const runtime = `{"nodeVersion":${JSON.stringify(process.version)},"platform":${JSON.stringify(process.platform)},"architecture":${JSON.stringify(process.arch)}}`;
const fixtureDefine = { __PC_VERSION__: '"7.8.9"', __PC_BUILD_COMMIT__: '"0123456789abcdef0123456789abcdef01234567"' } as const;
const scope = '{"assessed":"diagnostic-runtime/build-compatibility","centralHealth":"not_assessed","centralLiveness":"not_assessed","centralReadiness":"not_assessed"}';
const guarantees = '{"localOnly":true,"centralInspected":false,"centralContacted":false,"centralStarted":false,"centralRecovered":false,"centralValidated":false,"filesystemAccessed":false,"environmentMutated":false,"subprocessSpawned":false,"networkAccessed":false,"databaseOpened":false,"storageOpened":false,"telemetryInitialized":false,"providersInitialized":false,"pluginsLoaded":false,"workersLoaded":false,"schedulersLoaded":false,"recoveryLoaded":false,"serverStarted":false,"persistentTimersInstalled":false,"signalHandlersInstalled":false,"repairsPerformed":false}';
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

async function runBundle(define: Record<string, string>, argv: string[]) {
  const { createLocalDiagnosticsBuildOptions } = await loadBuildFactories();
  const result = await build(createLocalDiagnosticsBuildOptions({ define, metafile: true, write: false }));
  const output = result.outputFiles?.find(({ path }) => path.endsWith("local-diagnostics.js"));
  expect(output).toBeDefined();
  const directory = await mkdtemp(join(tmpdir(), "pc-ld-b1-"));
  try {
    const bundle = join(directory, "local-diagnostics.mjs");
    await writeFile(bundle, output!.text);
    return spawnSync(process.execPath, [bundle, ...argv], { encoding: "utf8" });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

describe("local-diagnostics bundle closure", () => {
  it("builds the seven-file product as one sourcemap-free import-closed bundle", async () => {
    expect(productManifest).toHaveLength(7);
    const { createLocalDiagnosticsBuildOptions } = await loadBuildFactories();
    const result = await build(createLocalDiagnosticsBuildOptions({ metafile: true, write: false }));
    const output = Object.entries(result.metafile!.outputs).find(([path]) => path.endsWith("local-diagnostics.js"));
    expect(output?.[1].imports).toEqual([]);
    expect(result.outputFiles?.some(({ path }) => path.endsWith(".map"))).toBe(false);
  });

  it.each([
    ["json", fixtureDefine, [], 0, expectedOutput.json],
    ["text", fixtureDefine, ["--text"], 0, expectedOutput.text],
    ["invalid arguments", fixtureDefine, ["--nope"], 2, expectedOutput.invalidArguments],
    ["unsupported runtime", { ...fixtureDefine, "process.version": '"v18.0.0"' }, [], 2, expectedOutput.unsupportedRuntime],
    ["invalid build metadata", { __PC_VERSION__: "undefined", __PC_BUILD_COMMIT__: "undefined" }, [], 3, expectedOutput.invalidMetadata],
  ])("routes %s through the real bundled entry", async (_label, define, argv, exitCode, stdout) => {
    const run = await runBundle(define, argv);
    expect([run.status, run.stdout, run.stderr]).toEqual([exitCode, stdout, ""]);
  });
});
