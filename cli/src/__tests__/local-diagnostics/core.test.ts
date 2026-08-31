import { describe, expect, it } from "vitest";
import { buildResult, internalResult, parseArguments } from "../../local-diagnostics/core.js";
import { renderJson } from "../../local-diagnostics/renderers.js";

const facts = { metadata: { version: "0.3.1", buildCommit: "a".repeat(40) }, runtime: { nodeVersion: "v20.0.0", platform: "linux", architecture: "x64" } };

describe("local diagnostics core", () => {
  it("constructs the ordered v1 local-only success result deterministically", () => {
    const first = renderJson(buildResult([], facts));
    const second = renderJson(buildResult(["--json"], facts));
    expect(first).toBe(second);
    expect(first).toBe(`{"schemaVersion":"v1","command":"paperclipai-local-diagnostics","status":"ok","scope":{"assessed":"diagnostic-runtime/build-compatibility","centralHealth":"not_assessed","centralLiveness":"not_assessed","centralReadiness":"not_assessed"},"paperclip":{"version":"0.3.1","buildCommit":"${"a".repeat(40)}"},"runtime":{"nodeVersion":"v20.0.0","platform":"linux","architecture":"x64"},"checks":[{"id":"build.metadata","status":"pass","code":"valid"},{"id":"runtime.node","status":"pass","code":"supported"}],"guarantees":{"localOnly":true,"centralInspected":false,"centralContacted":false,"centralStarted":false,"centralRecovered":false,"centralValidated":false,"filesystemAccessed":false,"environmentMutated":false,"subprocessSpawned":false,"networkAccessed":false,"databaseOpened":false,"storageOpened":false,"telemetryInitialized":false,"providersInitialized":false,"pluginsLoaded":false,"workersLoaded":false,"schedulersLoaded":false,"recoveryLoaded":false,"serverStarted":false,"persistentTimersInstalled":false,"signalHandlersInstalled":false,"repairsPerformed":false}}\n`);
  });

  it.each(["2026.707.1-canary.5", "2026.707.1-rc.1+build.9"])("accepts valid SemVer metadata %s", (version) => {
    const result = buildResult([], { ...facts, metadata: { ...facts.metadata, version } });
    expect([result.status, result.paperclip?.version, result.exitCode]).toEqual(["ok", version, 0]);
  });

  it.each(["2026.707", "2026.707.1-", "2026.707.1+", "2026.707.1-canary..5"])("rejects malformed SemVer metadata %s", (version) => {
    const result = buildResult([], { ...facts, metadata: { ...facts.metadata, version } });
    expect([result.status, result.error?.code, result.exitCode]).toEqual(["error", "invalid_build_metadata", 3]);
  });

  it.each([
    [[], "json", "ok", 0], [["--text"], "text", "ok", 0], [["--wat"], "json", "error", 2], [["--json", "--json"], "json", "error", 2], [["--json", "--text"], "json", "error", 2], [["arg"], "json", "error", 2],
  ])("parses %#", (argv, mode, status, exitCode) => {
    const parsed = parseArguments(argv);
    expect([parsed.mode, parsed.error, parsed.exitCode]).toEqual([mode, status === "error" ? "invalid_arguments" : null, exitCode]);
  });

  it.each([
    [{ metadata: { version: "", buildCommit: "secret" }, runtime: facts.runtime }, "error", "invalid_build_metadata", 3],
    [{ metadata: facts.metadata, runtime: { ...facts.runtime, nodeVersion: "v19.9.0" } }, "incompatible", "unsupported_runtime", 2],
  ])("redacts bad facts and applies the closed matrix", (input, status, code, exitCode) => {
    const result = buildResult([], input);
    expect([result.status, result.error?.code, result.exitCode, renderJson(result).includes("secret")]).toEqual([status, code, exitCode, false]);
  });

  it("builds the internal_error outcome directly (design §11 unit row — unreachable from index.ts, core.ts:12-19)", () => {
    const result = internalResult({ metadata: { version: "", buildCommit: "leaked-secret" }, runtime: facts.runtime });
    expect([result.status, result.error?.code, result.exitCode, result.paperclip, renderJson(result).includes("leaked-secret")]).toEqual(["error", "internal_error", 3, null, false]);
  });

  it("routes invalid_arguments through buildResult's own dispatch, not just parseArguments (R3-002)", () => {
    const result = buildResult(["--bad"], facts);
    expect([result.status, result.error?.code, result.exitCode]).toEqual(["error", "invalid_arguments", 2]);
  });
});
