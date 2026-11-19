import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaperclipMcpServer } from "./index.js";

const CALL_RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENV_RUN_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ISSUE_ID = "11111111-1111-4111-8111-111111111111";

async function connect(runId: string | null) {
  const { server } = createPaperclipMcpServer({
    apiUrl: "http://localhost:3100/api",
    apiKey: "token-123",
    companyId: "c1",
    agentId: "a1",
    runId,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "sdk-transport-test", version: "0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

function stubFetch() {
  const fetchMock = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentRunIds(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(
    ([, init]) => ((init as RequestInit).headers as Record<string, string>)["X-Paperclip-Run-Id"],
  );
}

describe("per-call run id through the MCP SDK", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reaches the request header when PAPERCLIP_RUN_ID is not set", async () => {
    const fetchMock = stubFetch();
    const client = await connect(null);

    await client.callTool({
      name: "paperclipAddComment",
      arguments: { issueId: ISSUE_ID, body: "hello", runId: CALL_RUN_ID },
    });

    expect(sentRunIds(fetchMock)).toEqual([CALL_RUN_ID]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty("runId");
  });

  it("leaves PAPERCLIP_RUN_ID in charge when it is set", async () => {
    const fetchMock = stubFetch();
    const client = await connect(ENV_RUN_ID);

    await client.callTool({
      name: "paperclipAddComment",
      arguments: { issueId: ISSUE_ID, body: "hello", runId: CALL_RUN_ID },
    });

    expect(sentRunIds(fetchMock)).toEqual([ENV_RUN_ID]);
  });

  it("rejects a malformed run id before any request", async () => {
    const fetchMock = stubFetch();
    const client = await connect(null);

    const result = await client.callTool({
      name: "paperclipAddComment",
      arguments: { issueId: ISSUE_ID, body: "hello", runId: "not-a-run-id" },
    });

    expect(result.isError).toBe(true);
    const [first] = result.content as Array<{ type: string; text?: string }>;
    expect(first?.text).toMatch(/Input validation error: .*\brunId\b/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
