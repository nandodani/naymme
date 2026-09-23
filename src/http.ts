import http from "node:http";
import { pathToFileURL } from "node:url";
import { apiErrorBody, API_ERROR_CODES } from "./api-errors.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { defaultDeps } from "./deps.js";
import { handleStatelessMcpRequest, readJsonBody, sendJson, setCorsHeaders } from "./mcp-http.js";
import {
  BodyTooLargeError,
  MAX_REQUEST_BODY_BYTES,
  RATE_LIMITS,
  rateLimiterFromEnv,
  rateLimitHeaders,
  type RateLimiter,
  type RateLimitVerdict,
} from "./security.js";
import { createNaymmeServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

interface SseSession {
  server: ReturnType<typeof createNaymmeServer>;
  transport: SSEServerTransport;
}

/** Bound on open legacy-SSE sessions — each holds a socket + McpServer. */
export const MAX_SSE_SESSIONS = 100;

export interface HttpServerOptions {
  /** Client-key rate limiter for POST /mcp and POST /messages. */
  limiter?: Pick<RateLimiter, "allow">;
  /** Max concurrent legacy-SSE sessions. */
  maxSseSessions?: number;
  /**
   * MCP-spec DNS-rebinding protection, forwarded to the transports —
   * enable when binding to loopback so drive-by browser requests with a
   * foreign Host header are rejected. Values are `Host` header allowlist
   * entries (e.g. "localhost:3000").
   */
  allowedHosts?: string[];
}

type StatelessTransportOptions = ConstructorParameters<typeof StreamableHTTPServerTransport>[0];

function clientKey(req: http.IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers["x-forwarded-for"];
    const raw = Array.isArray(xff) ? xff[0] : xff;
    const first = raw?.split(",")[0]?.trim();
    if (first !== undefined && first !== "") return first;
  }
  return req.socket.remoteAddress ?? "unknown";
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
export function createHttpServer(options: HttpServerOptions = {}): http.Server {
  const sseSessions = new Map<string, SseSession>();
  const maxSseSessions = options.maxSseSessions ?? MAX_SSE_SESSIONS;
  const limiter = options.limiter ?? rateLimiterFromEnv(RATE_LIMITS.mcp, process.env);
  const trustProxy = process.env.NAYMME_TRUST_PROXY === "1";
  const transportOptions: StatelessTransportOptions =
    options.allowedHosts !== undefined
      ? { enableDnsRebindingProtection: true, allowedHosts: options.allowedHosts }
      : {};

  function sendTooMany(
    res: http.ServerResponse,
    verdict: Extract<RateLimitVerdict, { ok: false }>,
  ): void {
    res.writeHead(429, {
      "content-type": "application/json",
      "retry-after": String(verdict.retryAfterSeconds),
      ...rateLimitHeaders(verdict),
    });
    res.end(
      JSON.stringify(
        apiErrorBody(
          API_ERROR_CODES.rateLimited,
          "rate limit exceeded",
          `Retry after ${verdict.retryAfterSeconds} seconds.`,
          { retryAfterSeconds: verdict.retryAfterSeconds },
        ),
      ),
    );
  }

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
        if (req.method === "POST") {
          const verdict = limiter.allow(clientKey(req, trustProxy));
          if (!verdict.ok) return sendTooMany(res, verdict);
          const declared = Number(req.headers["content-length"]);
          if (Number.isFinite(declared) && declared > MAX_REQUEST_BODY_BYTES) {
            sendJson(res, 413, {
              jsonrpc: "2.0",
              error: {
                code: -32600,
                message: "request body too large",
                data: { hint: `Bodies are capped at ${MAX_REQUEST_BODY_BYTES} bytes.` },
              },
              id: null,
            });
            return;
          }
        }
        await handleStatelessMcpRequest(req, res, transportOptions);
        return;
      }

      if (url.pathname === "/sse" && req.method === "GET") {
        if (sseSessions.size >= maxSseSessions) {
          sendJson(
            res,
            503,
            apiErrorBody(
              API_ERROR_CODES.tooManySessions,
              "too many open sessions",
              `At most ${maxSseSessions} concurrent SSE sessions are allowed; use POST /mcp (stateless) instead.`,
            ),
          );
          return;
        }
        const server = createNaymmeServer(defaultDeps());
        const transport = new SSEServerTransport("/messages", res, transportOptions);
        sseSessions.set(transport.sessionId, { server, transport });
        res.on("close", () => {
          sseSessions.delete(transport.sessionId);
          void server.close().catch(() => undefined);
        });
        await server.connect(transport);
        return;
      }

      if (url.pathname === "/messages" && req.method === "POST") {
        const verdict = limiter.allow(clientKey(req, trustProxy));
        if (!verdict.ok) return sendTooMany(res, verdict);
        const sessionId = url.searchParams.get("sessionId");
        const session = sessionId ? sseSessions.get(sessionId) : undefined;
        if (!session) {
          sendJson(res, 400, {
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "unknown or missing sessionId",
              data: { hint: "Open a session with GET /sse first, or use stateless POST /mcp." },
            },
            id: null,
          });
          return;
        }
        const declared = Number(req.headers["content-length"]);
        if (Number.isFinite(declared) && declared > MAX_REQUEST_BODY_BYTES) {
          sendJson(res, 413, {
            jsonrpc: "2.0",
            error: {
              code: -32600,
              message: "request body too large",
              data: { hint: `Bodies are capped at ${MAX_REQUEST_BODY_BYTES} bytes.` },
            },
            id: null,
          });
          return;
        }
        const body = await readJsonBody(req);
        await session.transport.handlePostMessage(req, res, body);
        return;
      }

      sendJson(
        res,
        404,
        apiErrorBody(
          API_ERROR_CODES.notFound,
          "not found",
          "Endpoints: POST /mcp (MCP Streamable HTTP), GET /sse + POST /messages (legacy SSE), GET /health.",
          { endpoints: ["/mcp", "/sse", "/messages", "/health"] },
        ),
      );
    })().catch((err: unknown) => {
      if (err instanceof BodyTooLargeError) {
        if (!res.headersSent) {
          sendJson(
            res,
            413,
            apiErrorBody(
              API_ERROR_CODES.bodyTooLarge,
              "request body too large",
              `Bodies are capped at ${MAX_REQUEST_BODY_BYTES} bytes.`,
            ),
          );
        } else res.destroy();
        return;
      }
      console.error("http request error:", err);
      if (!res.headersSent) {
        sendJson(
          res,
          500,
          apiErrorBody(
            API_ERROR_CODES.internal,
            "internal server error",
            "Retry; if it persists, check the server logs.",
          ),
        );
      } else res.destroy();
    });
  });
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  // Loopback-only deployments get MCP-spec DNS-rebinding protection: a
  // drive-by browser request carries a foreign Host header and is rejected.
  // When bound to a public interface the allowlist stays off (any Host).
  const allowedHosts = LOOPBACK_HOSTS.has(host)
    ? ["localhost", "127.0.0.1", "[::1]", `localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]
    : undefined;
  createHttpServer({ allowedHosts }).listen(port, host, () => {
    console.error(`${SERVER_NAME} ${SERVER_VERSION} listening on http://${host}:${port}`);
    console.error(`  streamable-http: POST http://${host}:${port}/mcp`);
    console.error(`  legacy sse:      GET  http://${host}:${port}/sse + POST /messages`);
  });
}
