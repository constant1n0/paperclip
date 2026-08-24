import { describe, expect, it } from "vitest";
import { buildResult } from "../../local-diagnostics/core.js";
import { renderJson, renderText } from "../../local-diagnostics/renderers.js";

const facts = { metadata: { version: "0.3.1", buildCommit: "c".repeat(40) }, runtime: { nodeVersion: "v22.0.0", platform: "linux", architecture: "x64" } };

describe("renderers (renderJson/renderText shape)", () => {
  it("renderJson strips the internal exitCode field and emits one newline-terminated JSON line", () => {
    const json = renderJson(buildResult([], facts));
    expect(json.endsWith("\n")).toBe(true);
    expect(JSON.parse(json)).not.toHaveProperty("exitCode");
    expect(JSON.parse(json)).toMatchObject({ schemaVersion: "v1", command: "paperclipai-local-diagnostics", status: "ok" });
  });

  it("renderJson strips exitCode from every outcome shape, ok and failure alike", () => {
    const ok = JSON.parse(renderJson(buildResult([], facts)));
    const failure = JSON.parse(renderJson(buildResult([], { ...facts, runtime: { ...facts.runtime, nodeVersion: "v18.0.0" } })));
    expect([ok, failure].map((parsed) => "exitCode" in parsed)).toEqual([false, false]);
  });

  it("renderText renders the deterministic text projection of the canonical result (spec: Text view)", () => {
    const result = buildResult(["--text"], facts);
    expect(renderText(result)).toBe(`paperclipai-local-diagnostics\nstatus: ok\nscope: diagnostic-runtime/build-compatibility; CENTRAL health/liveness/readiness not assessed\npaperclip: 0.3.1 ${"c".repeat(40)}\nruntime: v22.0.0 linux x64\nchecks: build.metadata=pass/valid, runtime.node=pass/supported\nguarantees: localOnly=true, centralInspected=false, centralContacted=false, centralStarted=false, centralRecovered=false, centralValidated=false, filesystemAccessed=false, environmentMutated=false, subprocessSpawned=false, networkAccessed=false, databaseOpened=false, storageOpened=false, telemetryInitialized=false, providersInitialized=false, pluginsLoaded=false, workersLoaded=false, schedulersLoaded=false, recoveryLoaded=false, serverStarted=false, persistentTimersInstalled=false, signalHandlersInstalled=false, repairsPerformed=false\n`);
  });

  it("renderJson and renderText derive from the same result and never diverge on shared fields", () => {
    const result = buildResult([], facts);
    const json = JSON.parse(renderJson(result));
    const text = renderText(result);
    expect(text).toContain(`status: ${json.status}`);
    expect(text).toContain(`paperclip: ${json.paperclip.version} ${json.paperclip.buildCommit}`);
  });
});
