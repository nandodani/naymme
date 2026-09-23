import { afterAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const children = new Set<ChildProcess>();

afterAll(() => {
  for (const child of children) child.kill("SIGKILL");
});

interface JsonRpcMessage {
  id?: number;
  result?: unknown;
  error?: unknown;
}

/**
 * Drive the real stdio entry point end-to-end: spawn tsx + src/index.ts and
 * speak newline-delimited JSON-RPC over its stdin/stdout, exactly like an
 * MCP client would.
 */
describe("stdio transport (src/index.ts)", () => {
  it("answers initialize and tools/call over stdio", async () => {
    const child = spawn("node_modules/.bin/tsx", ["src/index.ts"], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    children.add(child);

    const pending = new Map<number, (msg: JsonRpcMessage) => void>();
    let buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line === "") continue;
        const msg = JSON.parse(line) as JsonRpcMessage;
        if (msg.id !== undefined) pending.get(msg.id)?.(msg);
      }
    });

    const send = (msg: unknown) => child.stdin.write(`${JSON.stringify(msg)}\n`);
    const response = (id: number, timeoutMs = 15_000) =>
      new Promise<JsonRpcMessage>((resolve, reject) => {
        pending.set(id, resolve);
        setTimeout(() => reject(new Error(`no response for id ${id}`)), timeoutMs);
      });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "stdio-test", version: "0" },
      },
    });
    const init = (await response(1)) as {
      result: { serverInfo: { name: string } };
    };
    expect(init.result.serverInfo.name).toBe("naymme");

    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "score_name", arguments: { name: "linear" } },
    });
    const call = (await response(2)) as {
      result: { structuredContent: { total: number; grade: string } };
    };
    expect(call.result.structuredContent.total).toBe(97);
    expect(call.result.structuredContent.grade).toBe("Excellent");

    child.kill("SIGKILL");
  });
});
