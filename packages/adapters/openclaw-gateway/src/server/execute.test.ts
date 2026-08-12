import { describe, expect, it } from "vitest";
import {
  buildAgentParams,
  isPublishableRunSummary,
  resolveSessionKey,
  selectRunSummary,
} from "./execute.js";

describe("resolveSessionKey", () => {
  it("prefixes run-scoped session keys with the configured agent", () => {
    expect(
      resolveSessionKey({
        strategy: "run",
        configuredSessionKey: null,
        agentId: "meridian",
        runId: "run-123",
        issueId: null,
      }),
    ).toBe("agent:meridian:paperclip:run:run-123");
  });

  it("prefixes issue-scoped session keys with the configured agent", () => {
    expect(
      resolveSessionKey({
        strategy: "issue",
        configuredSessionKey: null,
        agentId: "meridian",
        runId: "run-123",
        issueId: "issue-456",
      }),
    ).toBe("agent:meridian:paperclip:issue:issue-456");
  });

  it("prefixes fixed session keys with the configured agent", () => {
    expect(
      resolveSessionKey({
        strategy: "fixed",
        configuredSessionKey: "paperclip",
        agentId: "meridian",
        runId: "run-123",
        issueId: null,
      }),
    ).toBe("agent:meridian:paperclip");
  });

  it("does not double-prefix an already-routed session key", () => {
    expect(
      resolveSessionKey({
        strategy: "fixed",
        configuredSessionKey: "agent:meridian:paperclip",
        agentId: "meridian",
        runId: "run-123",
        issueId: null,
      }),
    ).toBe("agent:meridian:paperclip");
  });
});

describe("buildAgentParams", () => {
  it("strips root-level paperclip fields from gateway agent params", () => {
    expect(
      buildAgentParams({
        payloadTemplate: {
          text: "old text",
          paperclip: { stale: true },
          keep: "value",
        },
        message: "wake text",
        sessionKey: "agent:meridian:paperclip:issue:issue-456",
        runId: "run-123",
        configuredAgentId: "meridian",
        waitTimeoutMs: 30_000,
      }),
    ).toEqual({
      keep: "value",
      message: "wake text",
      sessionKey: "agent:meridian:paperclip:issue:issue-456",
      idempotencyKey: "run-123",
      agentId: "meridian",
      timeout: 30_000,
    });
  });

  it("preserves an explicit agentId and timeout from the payload template", () => {
    expect(
      buildAgentParams({
        payloadTemplate: {
          agentId: "template-agent",
          timeout: 5_000,
        },
        message: "wake text",
        sessionKey: "paperclip",
        runId: "run-123",
        configuredAgentId: "configured-agent",
        waitTimeoutMs: 30_000,
      }),
    ).toEqual({
      agentId: "template-agent",
      timeout: 5_000,
      message: "wake text",
      sessionKey: "paperclip",
      idempotencyKey: "run-123",
    });
  });
});

describe("isPublishableRunSummary", () => {
  it("rejects torn-stream structural fragments", () => {
    expect(isPublishableRunSummary("{")).toBe(false);
    expect(isPublishableRunSummary("}")).toBe(false);
    expect(isPublishableRunSummary("[{")).toBe(false);
    expect(isPublishableRunSummary("...")).toBe(false);
    expect(isPublishableRunSummary('{"summary": "partial resu')).toBe(false);
  });

  it("keeps short answers and complete JSON publishable", () => {
    expect(isPublishableRunSummary("Done.")).toBe(true);
    expect(isPublishableRunSummary("OK — merged.")).toBe(true);
    expect(isPublishableRunSummary('{"summary": "done"}')).toBe(true);
    expect(isPublishableRunSummary("All done { see notes }")).toBe(true);
  });
});

describe("selectRunSummary", () => {
  it("prefers the stream summary on a normal end", () => {
    expect(
      selectRunSummary({
        summaryFromEvents: "Final answer.",
        summaryFromPayload: "Payload text.",
        streamEndedAbnormally: false,
      }),
    ).toBe("Final answer.");
  });

  it("falls back to the payload summary when the stream produced nothing", () => {
    expect(
      selectRunSummary({
        summaryFromEvents: "",
        summaryFromPayload: "Payload text.",
        streamEndedAbnormally: false,
      }),
    ).toBe("Payload text.");
  });

  it("falls through to the payload when the stream summary is a torn fragment", () => {
    expect(
      selectRunSummary({
        summaryFromEvents: "{",
        summaryFromPayload: "Payload text.",
        streamEndedAbnormally: false,
      }),
    ).toBe("Payload text.");
    expect(
      selectRunSummary({
        summaryFromEvents: '{"summary": "cut of',
        summaryFromPayload: "Payload text.",
        streamEndedAbnormally: false,
      }),
    ).toBe("Payload text.");
  });

  // Complete JSON from the stream is well-formed output, not a torn fragment.
  it("keeps a complete JSON stream summary on a normal end", () => {
    expect(
      selectRunSummary({
        summaryFromEvents: '{"summary": "done"}',
        summaryFromPayload: "Payload text.",
        streamEndedAbnormally: false,
      }),
    ).toBe('{"summary": "done"}');
  });

  it("prefers the payload summary when the stream ended abnormally", () => {
    expect(
      selectRunSummary({
        summaryFromEvents: "Partial sentence that got cut",
        summaryFromPayload: "Payload summary.",
        streamEndedAbnormally: true,
      }),
    ).toBe("Payload summary.");
  });

  it("keeps a publishable stream summary on abnormal end only when no payload exists", () => {
    expect(
      selectRunSummary({
        summaryFromEvents: "Recovered and finished.",
        summaryFromPayload: null,
        streamEndedAbnormally: true,
      }),
    ).toBe("Recovered and finished.");
  });

  it("returns null instead of emitting garbage", () => {
    expect(
      selectRunSummary({
        summaryFromEvents: "{",
        summaryFromPayload: null,
        streamEndedAbnormally: true,
      }),
    ).toBeNull();
    expect(
      selectRunSummary({
        summaryFromEvents: "",
        summaryFromPayload: null,
        streamEndedAbnormally: false,
      }),
    ).toBeNull();
    expect(
      selectRunSummary({
        summaryFromEvents: "[{",
        summaryFromPayload: "[",
        streamEndedAbnormally: false,
      }),
    ).toBeNull();
  });
});
