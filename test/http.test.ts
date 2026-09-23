import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createHttpServer } from "../src/http.js";

let server: http.Server;
let base: string;

beforeAll(async () => {
  server = createHttpServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

async function mcpCall(body: unknown): Promise<{ status: number; messages: unknown[] }> {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const messages = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()) as unknown);
  return { status: res.status, messages };
}

describe("HTTP transport — streamable /mcp", () => {
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
    const msg = messages[0] as { result: { serverInfo: { name: string } } };
    expect(msg.result.serverInfo.name).toBe("naymme");
  });

  it("answers tools/call for score_name", async () => {
    const { status, messages } = await mcpCall({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "score_name", arguments: { name: "linear" } },
    });
    expect(status).toBe(200);
    const msg = messages[0] as { result: { structuredContent: { total: number } } };
    expect(msg.result.structuredContent.total).toBe(97);
  });
});

describe("HTTP transport — misc", () => {
  it("GET /health reports ok", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; name: string };
    expect(body.ok).toBe(true);
    expect(body.name).toBe("naymme");
  });

  it("GET / is a 404", async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(404);
  });

  it("GET /sse opens the legacy endpoint stream with a session id", async () => {
    const res = await fetch(`${base}/sse`, { headers: { accept: "text/event-stream" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    const first = new TextDecoder().decode(value);
    expect(first).toContain("sessionId=");
  });
});
