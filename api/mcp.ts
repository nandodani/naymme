import type { IncomingMessage, ServerResponse } from "node:http";
import { handleStatelessMcpRequest, sendJson, setCorsHeaders } from "../src/mcp-http.js";
import { SERVER_NAME, SERVER_VERSION } from "../src/server.js";

/**
 * Vercel serverless entry point — /mcp and /health rewrite here
 * (see vercel.json).
 *
 * Only the stateless Streamable HTTP transport is served: the legacy SSE
 * transport keeps in-memory sessions and cannot work across serverless
 * invocations. For SSE, deploy `dist/http.js` to a persistent Node host.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Covers GET /health and GET /mcp alike — the stateless transport has no
  // standalone SSE stream to open, so a small status document is friendlier
  // than the transport's 405 and keeps the health check useful.
  if (req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      name: SERVER_NAME,
      version: SERVER_VERSION,
      transport: "streamable-http",
      usage: "POST /mcp",
    });
    return;
  }

  await handleStatelessMcpRequest(req, res);
}
