import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { DnsExistence, ProviderDeps } from "../src/deps.js";
import {
  clientKeyFromHeaders,
  contentLengthExceeded,
  MAX_REQUEST_BODY_BYTES,
  RATE_LIMITS,
  RateLimiter,
  readJsonCapped,
  tooManyRequestsResponse,
} from "../src/security.js";
import { createNameCheckServer, SERVER_NAME, SERVER_VERSION } from "../src/server.js";

/**
 * Cloudflare Workers entry point — stateless Streamable HTTP at /mcp plus
 * /health (see wrangler.toml). Fetch API only: the Node transport
 * (`src/mcp-http.ts`) can't run here, and neither can the Node-side deps —
 * WHOIS opens raw TCP to port 43 (`node:net`, unavailable on Workers) and
 * `npm-name`/`node:dns` read the local filesystem. `workerDeps()` swaps in
 * portable implementations; anything that cannot run reports `unknown`.
 */

const NPM_REGISTRY = "https://registry.npmjs.org/";
/** RFC 1035 record types and NXDOMAIN rcode in a DNS-over-HTTPS JSON response. */
const DNS_TYPE_A = 1;
const DNS_TYPE_NS = 2;
const DNS_TYPE_CNAME = 5;
const DNS_TYPE_AAAA = 28;
const DNS_STATUS_NXDOMAIN = 3;

interface DohAnswer {
  type?: number;
  data?: string;
}

interface DohResponse {
  Status?: number;
  Answer?: DohAnswer[];
}

/** One DNS-over-HTTPS JSON query against Cloudflare's public resolver. */
async function dohQuery(fqdn: string, type: string): Promise<DohResponse> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(fqdn)}&type=${type}`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!res.ok) throw new Error(`DoH resolver answered HTTP ${res.status}`);
  const data = (await readJsonCapped(res)) as DohResponse | null;
  if (data === null) throw new Error("DoH resolver returned unreadable JSON");
  return data;
}

/** NS-record lookup via Cloudflare's public DoH JSON API (node:dns replacement). */
async function resolveNsDoh(fqdn: string): Promise<string[]> {
  const data = await dohQuery(fqdn, "NS");
  return (data.Answer ?? [])
    .filter((a) => a.type === DNS_TYPE_NS && typeof a.data === "string")
    .map((a) => a.data?.replace(/\.$/, "") ?? "");
}

/**
 * DNS existence probe over DoH (node:dns resolve4/6/CNAME replacement):
 * answers are A/AAAA/CNAME data strings; `nxdomain` requires an
 * NXDOMAIN rcode on both the A and AAAA queries — NODATA stays ambiguous.
 */
async function resolveAnyDoh(fqdn: string): Promise<DnsExistence> {
  const [a, aaaa] = await Promise.all([dohQuery(fqdn, "A"), dohQuery(fqdn, "AAAA")]);
  const interesting = new Set([DNS_TYPE_A, DNS_TYPE_CNAME, DNS_TYPE_AAAA]);
  const answers: string[] = [];
  for (const ans of [...(a.Answer ?? []), ...(aaaa.Answer ?? [])]) {
    if (typeof ans.data === "string" && interesting.has(ans.type ?? -1)) answers.push(ans.data);
  }
  const nxdomain =
    answers.length === 0 && a.Status === DNS_STATUS_NXDOMAIN && aaaa.Status === DNS_STATUS_NXDOMAIN;
  return { answers, nxdomain };
}

async function npmRegistryHasPackage(fetcher: typeof fetch, name: string): Promise<boolean> {
  const res = await fetcher(`${NPM_REGISTRY}${encodeURIComponent(name)}`, { method: "HEAD" });
  if (res.status === 404) return false;
  if (res.ok) return true;
  throw new Error(`npm registry answered HTTP ${res.status}`);
}

/** Punctuation variants npm also blocks (foo-bar collides with foobar etc.). */
function npmPunctuationVariants(name: string): string[] {
  const parts = name.split(/[-._]+/);
  if (parts.length === 1) return [];
  const variants = new Set(["", "-", "_", "."].map((sep) => parts.join(sep)));
  variants.delete(name);
  return [...variants];
}

function workerDeps(): ProviderDeps {
  return {
    fetch: globalThis.fetch.bind(globalThis),
    // Resolves (rather than rejects) so the domain adapter still falls through
    // to the DNS NS check — Workers can't open raw TCP port 43 for WHOIS.
    whoisDomain: () => Promise.resolve("whois unavailable on this runtime (raw TCP port 43)"),
    resolveNs: resolveNsDoh,
    resolveAny: resolveAnyDoh,
    npmNameAvailable: async (name) => {
      if (await npmRegistryHasPackage(globalThis.fetch, name)) return false;
      for (const variant of npmPunctuationVariants(name.toLowerCase())) {
        if (await npmRegistryHasPackage(globalThis.fetch, variant)) return false;
      }
      return true;
    },
    rdapBootstrapUrl: "https://data.iana.org/rdap/dns.json",
    githubApiBase: "https://api.github.com",
    timeoutMs: 5000,
    userAgent: "lmkurname/0.1 (+https://github.com/nandodani/name-check-mcp)",
  };
}

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
 * cancelled — the Workers equivalent of `res.on("close")` in src/mcp-http.ts,
 * which releases the per-request server/transport pair.
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

// One limiter per isolate — best-effort protection of the request budget.
const mcpLimiter = new RateLimiter({ windowMs: 60_000, max: RATE_LIMITS.mcp });

async function handleMcp(request: Request): Promise<Response> {
  const verdict = mcpLimiter.allow(clientKeyFromHeaders(request.headers));
  if (!verdict.ok) return tooManyRequestsResponse(verdict.retryAfterSeconds, CORS_HEADERS);
  if (contentLengthExceeded(request, MAX_REQUEST_BODY_BYTES)) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32600, message: "request body too large" }, id: null },
      { status: 413, headers: CORS_HEADERS },
    );
  }

  const server = createNameCheckServer(workerDeps());
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

function jsonStatus(): Response {
  return Response.json(
    {
      ok: true,
      name: SERVER_NAME,
      version: SERVER_VERSION,
      transport: "streamable-http",
      usage: "POST /mcp",
    },
    { headers: CORS_HEADERS },
  );
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Covers GET /health and GET /mcp alike — the stateless transport has no
    // standalone SSE stream to open, so a small status document is friendlier
    // than the transport's 405 (same behaviour as the Vercel api/mcp.ts).
    if (request.method === "GET") {
      return jsonStatus();
    }

    if (url.pathname === "/mcp") {
      return handleMcp(request);
    }

    return Response.json(
      { error: "not found", endpoints: ["/mcp", "/health"] },
      { status: 404, headers: CORS_HEADERS },
    );
  },
};
