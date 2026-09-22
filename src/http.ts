import http from "node:http";
import { pathToFileURL } from "node:url";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { handleStatelessMcpRequest, readJsonBody, sendJson, setCorsHeaders } from "./mcp-http.js";
import { createNameCheckServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

interface SseSession {
  server: ReturnType<typeof createNameCheckServer>;
  transport: SSEServerTransport;
}

/**
 * Long-running Node HTTP server exposing BOTH transports:
 *
 *   POST /mcp            Streamable HTTP (stateless) — modern MCP transport,
 *                        also what Vercel serves via api/mcp.ts.
 *   GET  /sse            Legacy SSE transport — opens the event stream and
 *   POST /messages       receives the matching JSON-RPC posts (?sessionId=).
 *   GET  /health         Liveness probe.
 *
 * Legacy SSE keeps per-session state in memory, so it only works on a
 * persistent single process — deploy it to a Node host (Render, Fly.io,
 * Railway, a VPS…), NOT to serverless. Remote clients should prefer /mcp.
 */
export function createHttpServer(): http.Server {
  const sseSessions = new Map<string, SseSession>();

  return http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      setCorsHeaders(res);

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (url.pathname === "/health" && req.method === "GET") {
        sendJson(res, 200, {
          ok: true,
          name: SERVER_NAME,
          version: SERVER_VERSION,
          transports: ["streamable-http POST /mcp", "legacy-sse GET /sse + POST /messages"],
        });
        return;
      }

      if (url.pathname === "/mcp") {
        await handleStatelessMcpRequest(req, res);
        return;
      }

      if (url.pathname === "/sse" && req.method === "GET") {
        const server = createNameCheckServer();
        const transport = new SSEServerTransport("/messages", res);
        sseSessions.set(transport.sessionId, { server, transport });
        res.on("close", () => {
          sseSessions.delete(transport.sessionId);
          void server.close().catch(() => undefined);
        });
        await server.connect(transport);
        return;
      }

      if (url.pathname === "/messages" && req.method === "POST") {
        const sessionId = url.searchParams.get("sessionId");
        const session = sessionId ? sseSessions.get(sessionId) : undefined;
        if (!session) {
          sendJson(res, 400, {
            jsonrpc: "2.0",
            error: { code: -32000, message: "unknown or missing sessionId" },
            id: null,
          });
          return;
        }
        const body = await readJsonBody(req);
        await session.transport.handlePostMessage(req, res, body);
        return;
      }

      sendJson(res, 404, {
        error: "not found",
        endpoints: ["/mcp", "/sse", "/messages", "/health"],
      });
    })().catch((err: unknown) => {
      console.error("http request error:", err);
      if (!res.headersSent) sendJson(res, 500, { error: "internal server error" });
      else res.destroy();
    });
  });
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  createHttpServer().listen(port, host, () => {
    console.error(`${SERVER_NAME} ${SERVER_VERSION} listening on http://${host}:${port}`);
    console.error(`  streamable-http: POST http://${host}:${port}/mcp`);
    console.error(`  legacy sse:      GET  http://${host}:${port}/sse + POST /messages`);
  });
}
