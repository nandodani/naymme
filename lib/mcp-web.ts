import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { ProviderDeps } from "../src/deps.js";
import { defaultDeps } from "../src/deps.js";
import { apiVersionHeaders } from "../src/api-version.js";
import {
  clientKeyFromHeaders,
  contentLengthExceeded,
  MAX_REQUEST_BODY_BYTES,
  RATE_LIMITS,
  rateLimiterFromEnv,
  rateLimitHeaders,
  tooManyRequestsResponse,
  type RateLimiter,
  type RateLimitVerdict,
} from "../src/security.js";
import { createNaymmeServer, SERVER_NAME, SERVER_VERSION } from "../src/server.js";

/**
 * Web-standard (Request/Response) stateless Streamable-HTTP handler for the
 * MCP endpoint — the same transport shape as worker/index.ts, backed by the
 * full Node ProviderDeps (RDAP, WHOIS, DNS, npm-name) instead of the Worker's
 * portable subset.
 */

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers":
    "content-type, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers": "mcp-session-id",
};

function withCors(response: Response, extra: Record<string, string> = {}): Response {
  const wrapped = new Response(response.body, response);
  for (const [name, value] of Object.entries(CORS_HEADERS)) wrapped.headers.set(name, value);
  for (const [name, value] of Object.entries(extra)) wrapped.headers.set(name, value);
  return wrapped;
}

/** API version + remaining request budget — same contract as the REST routes. */
function quotaHeaders(verdict: RateLimitVerdict): Record<string, string> {
  return { ...apiVersionHeaders(), ...rateLimitHeaders(verdict) };
}

/**
 * Re-wrap the response body so `onDone` fires once the stream is consumed or
 * cancelled — releases the per-request server/transport pair.
 */
function trackedBody(response: Response, onDone: () => void): Response {
  const body = response.body as ReadableStream<Uint8Array> | null;
  if (body === null) {
    onDone();
    return response;
  }
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        onDone();
      }
    },
    cancel(reason) {
      void body.cancel(reason);
      onDone();
    },
  });
  return new Response(stream, response);
}

/**
 * POST /api/mcp — one McpServer + stateless transport per request
 * (`sessionIdGenerator: undefined`), so the endpoint is safe on serverless
 * where consecutive requests may hit different instances. Responses are
 * SSE-framed by default; clients that ask for `application/json` only get a
 * plain JSON body.
 */
let sharedLimiter: RateLimiter | null = null;
function defaultLimiter(): RateLimiter {
  sharedLimiter ??= rateLimiterFromEnv(RATE_LIMITS.mcp, process.env);
  return sharedLimiter;
}

export async function handleMcpRequest(
  request: Request,
  deps: ProviderDeps = defaultDeps(),
  limiter: Pick<RateLimiter, "allow"> = defaultLimiter(),
): Promise<Response> {
  const verdict = limiter.allow(clientKeyFromHeaders(request.headers));
  if (!verdict.ok) {
    return tooManyRequestsResponse(verdict, { ...CORS_HEADERS, ...apiVersionHeaders() });
  }
  if (contentLengthExceeded(request, MAX_REQUEST_BODY_BYTES)) {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "request body too large",
          data: { hint: `Bodies are capped at ${MAX_REQUEST_BODY_BYTES} bytes.` },
        },
        id: null,
      },
      { status: 413, headers: { ...CORS_HEADERS, ...quotaHeaders(verdict) } },
    );
  }

  try {
    return await dispatch(request, deps, verdict);
  } catch (err) {
    console.error("mcp request error:", err);
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "internal error",
          data: { hint: "Retry; if it persists, report the request id and timestamp." },
        },
        id: null,
      },
      { status: 500, headers: { ...CORS_HEADERS, ...quotaHeaders(verdict) } },
    );
  }
}

async function dispatch(
  request: Request,
  deps: ProviderDeps,
  verdict: RateLimitVerdict,
): Promise<Response> {
  const server = createNaymmeServer(deps);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  transport.onclose = () => void server.close().catch(() => undefined);
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return withCors(
    trackedBody(response, () => {
      void transport.close().catch(() => undefined);
    }),
    quotaHeaders(verdict),
  );
}

/**
 * GET /api/mcp (and the /health, /mcp and /v1/mcp aliases) — liveness +
 * pointer. Consumes the same MCP budget as POST so the response can carry
 * real RateLimit-* values like every other API endpoint.
 */
export function handleMcpStatusRequest(
  request: Request,
  limiter: Pick<RateLimiter, "allow"> = defaultLimiter(),
): Response {
  const verdict = limiter.allow(clientKeyFromHeaders(request.headers));
  if (!verdict.ok) {
    return tooManyRequestsResponse(verdict, { ...CORS_HEADERS, ...apiVersionHeaders() });
  }
  return Response.json(
    {
      ok: true,
      name: SERVER_NAME,
      version: SERVER_VERSION,
      transport: "streamable-http",
      usage: "POST /api/mcp",
    },
    { headers: { ...CORS_HEADERS, ...quotaHeaders(verdict) } },
  );
}

/** CORS preflight — never rate-limited, but still versioned. */
export function mcpOptionsResponse(): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, ...apiVersionHeaders() } });
}
