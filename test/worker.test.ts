import { describe, expect, it } from "vitest";
import worker from "../worker/index.js";

/**
 * The Worker entry point is a plain fetch handler, so it runs under plain
 * Node for tests — no workerd needed. Same SSE framing as the Node /mcp
 * endpoint (stateless Streamable HTTP).
 */

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

interface JsonRpcMessage {
  result?: Record<string, unknown>;
  error?: { code: number };
}

async function mcpCall(body: unknown): Promise<{ status: number; messages: JsonRpcMessage[] }> {
  const res = await worker.fetch(
    new Request("https://worker.test/mcp", {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  const messages = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()) as JsonRpcMessage);
  return { status: res.status, messages };
}

describe("worker fetch handler", () => {
  it("answers initialize with serverInfo", async () => {
    const { status, messages } = await mcpCall({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    });
    expect(status).toBe(200);
    expect(messages[0]?.result).toMatchObject({ serverInfo: { name: "lmkurname" } });
  });

  it("runs tools/call score_name", async () => {
    const { status, messages } = await mcpCall({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "score_name", arguments: { name: "acme" } },
    });
    expect(status).toBe(200);
    expect(messages[0]?.result).toMatchObject({
      structuredContent: { name: "acme" },
    });
  });

  it("GET returns a status document", async () => {
    const res = await worker.fetch(new Request("https://worker.test/health"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toMatchObject({ ok: true, name: "lmkurname" });
  });

  it("answers OPTIONS with CORS headers", async () => {
    const res = await worker.fetch(new Request("https://worker.test/mcp", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("404s POST to an unknown path", async () => {
    const res = await worker.fetch(
      new Request("https://worker.test/nope", {
        method: "POST",
        headers: MCP_HEADERS,
        body: "{}",
      }),
    );
    expect(res.status).toBe(404);
  });
});
