import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { defaultDeps } from "../src/deps.js";
import { createNaymmeServer } from "../src/server.js";

async function makeClientServer() {
  const deps = defaultDeps({
    fetch: async () => new Response(null, { status: 404 }),
    whoisDomain: async () => ({ "whois.test": { __raw: "No match" } }),
    resolveNs: async () => [],
    npmNameAvailable: async () => true,
    timeoutMs: 50,
  });
  const server = createNaymmeServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe("MCP server (in-memory transport)", () => {
  it("lists both tools", async () => {
    const { client } = await makeClientServer();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["check_availability", "score_name"]);
  });

  it("tools/call score_name returns structured content", async () => {
    const { client } = await makeClientServer();
    const res = await client.callTool({ name: "score_name", arguments: { name: "linear" } });
    const out = res.structuredContent as { total: number; grade: string };
    expect(out.total).toBe(97);
    expect(out.grade).toBe("Excellent");
    expect(Array.isArray(res.content)).toBe(true);
  });

  it("tools/call check_availability returns normalized results", async () => {
    const { client } = await makeClientServer();
    const res = await client.callTool({
      name: "check_availability",
      arguments: { name: "acme", providers: ["github:user", "npm"] },
    });
    const out = res.structuredContent as {
      name: string;
      results: Array<{ provider: string; status: string }>;
      summary: Record<string, number>;
    };
    expect(out.results.map((r) => r.provider)).toEqual(["github:user", "npm"]);
    expect(out.summary.available).toBe(2);
  });

  it("rejects invalid tool arguments at the protocol layer", async () => {
    const { client } = await makeClientServer();
    const res = await client.callTool({
      name: "check_availability",
      arguments: { name: "acme", providers: ["twitter"] },
    });
    expect(res.isError).toBe(true);
  });
});
