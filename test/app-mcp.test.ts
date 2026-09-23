import { describe, expect, it } from "vitest";
import { GET, OPTIONS, POST } from "../app/api/mcp/route.js";
import { handleMcpRequest, handleMcpStatusRequest } from "../lib/mcp-web.js";
import { RateLimiter } from "../src/security.js";

/**
 * The Next.js /api/mcp route delegates to the framework-free handlers in
 * lib/mcp-web.ts — these exercise both the route exports and the underlying
 * handler, same SSE framing as the worker and Node /mcp endpoints.
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
  const res = await POST(
    new Request("https://app.test/api/mcp", {
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

describe("/api/mcp route", () => {
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
    expect(messages[0]?.result).toMatchObject({ serverInfo: { name: "naymme" } });
  });

  it("lists both tools", async () => {
    const { status, messages } = await mcpCall({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    expect(status).toBe(200);
    const tools = (messages[0]?.result as { tools?: { name: string }[] } | undefined)?.tools;
    expect(tools?.map((t) => t.name).sort()).toEqual(["check_availability", "score_name"]);
  });

  it("runs tools/call score_name deterministically", async () => {
    const { status, messages } = await mcpCall({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "score_name", arguments: { name: "acme" } },
    });
    expect(status).toBe(200);
    expect(messages[0]?.result).toMatchObject({
      structuredContent: { name: "acme", total: expect.any(Number) },
    });
  });

  it("GET returns the status document with CORS", async () => {
    const res = GET(new Request("https://app.test/api/mcp"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toMatchObject({ ok: true, name: "naymme" });
  });

  it("OPTIONS answers a CORS preflight", async () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

describe("handleMcpRequest", () => {
  it("streams the response through trackedBody without hanging", async () => {
    const res = await handleMcpRequest(
      new Request("https://app.test/api/mcp", {
        method: "POST",
        headers: MCP_HEADERS,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "score_name", arguments: { name: "test" } },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("data:");
  });
});

describe("handleMcpStatusRequest", () => {
  it("points clients at POST /api/mcp with rate-limit headers", async () => {
    const res = handleMcpStatusRequest(
      new Request("https://app.test/api/mcp"),
      new RateLimiter({ windowMs: 60_000, max: 5 }),
    );
    const body = (await res.json()) as { usage: string };
    expect(body.usage).toBe("POST /api/mcp");
    expect(res.headers.get("ratelimit-limit")).toBe("5");
    expect(res.headers.get("ratelimit-policy")).toBe("5;w=60");
  });
});
