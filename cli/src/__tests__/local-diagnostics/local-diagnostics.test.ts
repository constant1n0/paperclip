import { describe, expect, it, vi } from "vitest";
import { buildResult } from "../../local-diagnostics/core.js";
import { runLocalDiagnostics } from "../../local-diagnostics/local-diagnostics.js";
import { renderJson, renderText } from "../../local-diagnostics/renderers.js";
import type { Facts } from "../../local-diagnostics/schema.js";

const facts: Facts = { metadata: { version: "0.3.1", buildCommit: "d".repeat(40) }, runtime: { nodeVersion: "v22.0.0", platform: "linux", architecture: "x64" } };

describe("local-diagnostics facade (R3-001)", () => {
  it("writes the renderText form on ok + --text, not JSON", () => {
    const write = vi.fn();
    const result = runLocalDiagnostics(["--text"], facts, { write });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(renderText(buildResult(["--text"], facts)));
    expect(write.mock.calls[0][0].startsWith("{")).toBe(false);
    expect(result).toEqual(buildResult(["--text"], facts));
  });

  it.each([
    ["--json explicit", ["--json"]],
    ["no-args default", []],
  ])("writes the renderJson form on ok + %s", (_label, argv) => {
    const write = vi.fn();
    const result = runLocalDiagnostics(argv, facts, { write });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(renderJson(buildResult(argv, facts)));
    expect(() => JSON.parse(write.mock.calls[0][0])).not.toThrow();
    expect(result).toEqual(buildResult(argv, facts));
  });

  it("selects renderJson, not renderText, once status is not ok even when --text was requested", () => {
    const write = vi.fn();
    const incompatible: Facts = { ...facts, runtime: { ...facts.runtime, nodeVersion: "v18.0.0" } };
    const result = runLocalDiagnostics(["--text"], incompatible, { write });
    expect(write).toHaveBeenCalledWith(renderJson(result));
    expect(() => JSON.parse(write.mock.calls[0][0])).not.toThrow();
  });

  it("falls back to internalResult (exit 3) when buildResult throws, and still writes exactly one rendered result", () => {
    const write = vi.fn();
    // `metadata` is missing entirely — violates the Facts contract at runtime (simulating
    // corrupted/unexpected embedded metadata reaching the facade). `validMetadata()` dereferences
    // `facts.metadata.version` and throws before `buildResult` can return, deterministically
    // exercising the try/catch -> internalResult fallback without touching product code.
    const malformed = { runtime: facts.runtime } as unknown as Facts;
    const result = runLocalDiagnostics([], malformed, { write });
    expect([result.status, result.error?.code, result.exitCode, result.paperclip]).toEqual(["error", "internal_error", 3, null]);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(renderJson(result));
  });
});
