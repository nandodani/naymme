import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createNameCheckServer } from "./server.js";

/** Read and JSON-parse a request body. Empty body → undefined. */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (text === "") return undefined;
  return JSON.parse(text);
}

export function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "access-control-allow-headers",
    "content-type, mcp-session-id, mcp-protocol-version, last-event-id",
  );
  res.setHeader("access-control-expose-headers", "mcp-session-id");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * Stateless Streamable HTTP handler — the modern MCP remote transport
 * (spec 2025-03-26+). A fresh McpServer + transport pair is created per
 * request and `sessionIdGenerator: undefined` disables session state, which
 * makes this handler safe for serverless platforms (Vercel functions) where
 * consecutive requests may hit different instances.
 *
 * Supported methods per the transport: POST (JSON-RPC), GET/DELETE are
 * answered 405 by the transport itself — a standalone SSE stream requires a
 * session, which stateless mode intentionally has none of.
 */
export async function handleStatelessMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const server = createNameCheckServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    void transport.close().catch(() => undefined);
    void server.close().catch(() => undefined);
  });

  try {
    await server.connect(transport);
    const body = req.method === "POST" ? await readJsonBody(req) : undefined;
    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error("mcp request error:", err);
    if (!res.headersSent) {
      sendJson(res, 500, {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

export { sendJson };
