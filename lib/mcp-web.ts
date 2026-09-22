import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { ProviderDeps } from "../src/deps.js";
import { defaultDeps } from "../src/deps.js";
import { createNameCheckServer, SERVER_NAME, SERVER_VERSION } from "../src/server.js";

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

function withCors(response: Response): Response {
  const wrapped = new Response(response.body, response);
  for (const [name, value] of Object.entries(CORS_HEADERS)) wrapped.headers.set(name, value);
  return wrapped;
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
export async function handleMcpRequest(
  request: Request,
  deps: ProviderDeps = defaultDeps(),
): Promise<Response> {
  const server = createNameCheckServer(deps);
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
  );
}

/** GET /api/mcp (and the /health and /mcp aliases) — liveness + pointer. */
export function mcpStatusResponse(): Response {
  return Response.json(
    {
      ok: true,
      name: SERVER_NAME,
      version: SERVER_VERSION,
      transport: "streamable-http",
      usage: "POST /api/mcp",
    },
    { headers: CORS_HEADERS },
  );
}

export function mcpOptionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
