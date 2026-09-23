import { SERVER_NAME, SERVER_VERSION } from "../src/server.js";
import { RATE_LIMITS } from "../src/security.js";
import { SITE_NAME, SITE_URL } from "./site.js";

/**
 * Agent-discovery documents served under /.well-known and friends — the
 * machine-readable catalog surface audits probe for: the RFC 9264 API
 * catalog linkset, the SEP-1649 MCP server card, the AI Catalog manifest,
 * the OAuth protected-resource stub (public tier), robots.txt content
 * signals, and the /auth.md authentication document.
 */

const MCP_ENDPOINT = `${SITE_URL}/api/mcp`;

/**
 * RFC 9264 linkset served at /.well-known/api-catalog as
 * application/linkset+json. Anchors the API origin and advertises the
 * service description (OpenAPI), service documentation and status endpoint.
 */
export function buildApiCatalogLinkset(): Record<string, unknown> {
  return {
    linkset: [
      {
        anchor: `${SITE_URL}/`,
        "service-desc": [
          { href: `${SITE_URL}/openapi.json`, type: "application/json" },
          {
            href: `${SITE_URL}/.well-known/mcp/server-card.json`,
            type: "application/json",
          },
        ],
        "service-doc": [{ href: `${SITE_URL}/docs`, type: "text/html" }],
        status: [{ href: MCP_ENDPOINT, type: "application/json" }],
      },
    ],
  };
}

/**
 * SEP-1649 MCP Server Card at /.well-known/mcp/server-card.json — static
 * metadata an agent can read before paying for an MCP handshake.
 */
export function buildMcpServerCard(): Record<string, unknown> {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
    version: "1.0",
    protocolVersion: "2025-06-18",
    serverInfo: {
      name: SERVER_NAME,
      title: `${SITE_NAME} — name availability checker`,
      version: SERVER_VERSION,
    },
    description:
      "Check a bare name's availability across 61 providers (domains, GitHub, npm and other dev registries, hosted subdomains, stores and social handles) and score it deterministically for brand quality.",
    iconUrl: `${SITE_URL}/icon.svg`,
    documentationUrl: `${SITE_URL}/docs`,
    transport: {
      type: "streamable-http",
      endpoint: "/api/mcp",
    },
    capabilities: {
      tools: { listChanged: false },
    },
    authentication: {
      required: false,
      schemes: [],
    },
    instructions:
      "Public endpoint — no token or registration needed. POST JSON-RPC 2.0 with Accept: application/json, text/event-stream; stateless, no session id required.",
    tools: ["check_availability", "score_name"],
  };
}

/**
 * AI Catalog at /.well-known/ai-catalog.json — typed, nestable manifest of
 * the AI-facing artifacts this host publishes (ai-catalog.io spec). Each
 * entry carries both `mediaType` and `type` (the two field names the base
 * spec and the agentic-resource-discovery layer use) plus
 * `representativeQueries` for intent matching.
 */
export function buildAiCatalog(): Record<string, unknown> {
  const entry = (
    identifier: string,
    displayName: string,
    mediaType: string,
    url: string,
    representativeQueries: string[],
  ): Record<string, unknown> => ({
    identifier,
    displayName,
    mediaType,
    type: mediaType,
    url,
    representativeQueries,
  });
  return {
    specVersion: "1.0",
    host: {
      displayName: SITE_NAME,
      identifier: "naymme.vercel.app",
      url: SITE_URL,
    },
    entries: [
      entry(
        "urn:air:naymme.vercel.app:mcp:server",
        "naymme MCP server (check_availability, score_name)",
        "application/json",
        `${SITE_URL}/.well-known/mcp/server-card.json`,
        [
          "is the name acme available everywhere?",
          "check acme on domains, github and npm",
          "score the brand name acme",
        ],
      ),
      entry(
        "urn:air:naymme.vercel.app:tools:check",
        "Name availability check (REST)",
        "application/json",
        `${SITE_URL}/api/availability`,
        [
          "check whether the project name acme is taken",
          "which providers still have acme free?",
          "is acme.com and @acme on github available?",
        ],
      ),
      entry(
        "urn:air:naymme.vercel.app:tools:score",
        "Brand name score (REST)",
        "application/json",
        `${SITE_URL}/api/score`,
        ["rate acme as a brand name", "how strong is the name acme out of 100?"],
      ),
      entry(
        "urn:air:naymme.vercel.app:api:openapi",
        "OpenAPI 3.1 description of the naymme HTTP API",
        "application/json",
        `${SITE_URL}/openapi.json`,
        ["what endpoints does naymme expose?", "how do i call the availability api?"],
      ),
      entry(
        "urn:air:naymme.vercel.app:skills:index",
        "Agent skills index (agent-skills discovery RFC)",
        "application/json",
        `${SITE_URL}/.well-known/agent-skills/index.json`,
        ["does naymme publish agent skills?", "how should an agent use the name checker?"],
      ),
      entry(
        "urn:air:naymme.vercel.app:docs:llms",
        "Agent quick-start (llms.txt)",
        "text/markdown",
        `${SITE_URL}/llms.txt`,
        ["how do i use naymme from an ai assistant?"],
      ),
      entry(
        "urn:air:naymme.vercel.app:docs:auth",
        "Authentication and rate-limit document",
        "text/markdown",
        `${SITE_URL}/auth.md`,
        ["does the naymme api need a key?", "what are the rate limits?"],
      ),
    ],
  };
}

/**
 * RFC 9728 OAuth Protected Resource Metadata. The API is public and
 * unauthenticated — the document declares the resource origin, the
 * `public:read` scope and the `header` bearer method, and points
 * `authorization_servers` at this origin. Following that issuer to the
 * RFC 8414 document shows it grants no tokens, which is the definitive
 * "anonymous tier" answer for agents probing the standard discovery path.
 */
export function buildOauthProtectedResource(): Record<string, unknown> {
  return {
    resource: SITE_URL,
    authorization_servers: [SITE_URL],
    scopes_supported: ["public:read"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${SITE_URL}/docs`,
  };
}

/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata stub at
 * /.well-known/oauth-authorization-server. There is no authorization
 * server behind this host — the document exists so agents probing the
 * standard discovery path get a definitive answer instead of a 404:
 * `issuer` identifies the host, the flow/grant lists are empty (the
 * issuer advertises the public:read scope but grants no tokens), and
 * `service_documentation` points at /auth.md for the full public tier.
 */
export function buildOauthAuthorizationServer(): Record<string, unknown> {
  return {
    issuer: SITE_URL,
    service_documentation: `${SITE_URL}/auth.md`,
    response_types_supported: [],
    response_modes_supported: [],
    grant_types_supported: [],
    token_endpoint_auth_methods_supported: [],
    scopes_supported: ["public:read"],
    code_challenge_methods_supported: [],
  };
}

/**
 * robots.txt body. The `Content-Signal` directives inside the `User-agent: *`
 * group publish AI-usage preferences (Cloudflare Content Signals
 * convention): no model training, search indexing welcome, no use of site
 * content as generative AI input.
 */
export function buildRobotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Content-Signal: ai-train=no, search=yes, ai-input=no",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    `Host: ${SITE_URL}`,
    "",
  ].join("\n");
}

/**
 * /auth.md — the WorkOS-style auth.md document agents fetch to learn how
 * to authenticate. Follows the auth.md convention (`# auth.md` heading,
 * numbered steps an agent can walk top to bottom); since the service is
 * fully public, the steps resolve to "no registration — call directly".
 */
export function buildAuthMarkdown(): string {
  return [
    "# auth.md",
    "",
    `You are an agent. ${SITE_NAME} (${SITE_URL}) is a **public, unauthenticated service**: there is no registration, claim ceremony, credential, or OAuth flow — every step below resolves to calling the endpoints directly. The resource server is ${SITE_URL}; no authorization server exists (the RFC 8414 document below says so explicitly).`,
    "",
    "## Step 1 — Discover",
    "",
    `The structured discovery documents confirm the no-token tier:`,
    "",
    `- \`GET ${SITE_URL}/.well-known/oauth-protected-resource\` — RFC 9728 Protected Resource Metadata; declares the resource origin, the \`public:read\` scope and \`authorization_servers: [${SITE_URL}]\` — the same issuer that grants no tokens`,
    `- \`GET ${SITE_URL}/.well-known/oauth-authorization-server\` — RFC 8414 Authorization Server Metadata stub; \`grant_types_supported\` and \`response_types_supported\` are empty lists`,
    `- \`GET ${SITE_URL}/openapi.json\` — OpenAPI 3.1 description of every endpoint`,
    `- \`GET ${SITE_URL}/.well-known/mcp\` — MCP discovery document (transport, tools, input schemas)`,
    `- \`GET ${SITE_URL}/.well-known/mcp/server-card.json\` — SEP-1649 MCP server card`,
    "",
    "## Step 2 — Pick a method",
    "",
    `There is exactly one method: **anonymous public access**. No API key, bearer token, OAuth client, or account exists for this service. Do not attempt \`/agent/identity\`, \`/oauth2/token\`, or any registration call — those endpoints do not exist and return a structured 404.`,
    "",
    "## Step 3 — Register",
    "",
    `Nothing to register. If you operate an agent, a descriptive \`User-Agent\` (e.g. \`my-agent/1.0 (+https://you.example)\`) is appreciated but not required or enforced.`,
    "",
    "## Step 4 — Claim ceremony",
    "",
    `Not applicable — no credentials are issued, so nothing is ever claimed.`,
    "",
    "## Step 5 — Use the public tier",
    "",
    `Call any endpoint directly:`,
    "",
    `- \`GET ${SITE_URL}/api/availability?name=<name>[&providers=<csv>]\` — name availability results (v1 alias: \`/api/v1/availability\`)`,
    `- \`GET ${SITE_URL}/api/score?name=<name>\` — deterministic brand score (v1 alias: \`/api/v1/score\`)`,
    `- \`POST ${SITE_URL}/api/mcp\` — MCP Streamable HTTP transport, JSON-RPC 2.0 (v1 alias: \`/api/v1/mcp\`)`,
    `- \`GET ${SITE_URL}/api/mcp\` (also \`/mcp\`, \`/health\`) — endpoint status`,
    `- \`GET ${SITE_URL}/api/markdown?path=</page>\` — markdown representations of pages`,
    "",
    `A 401 never happens here — there is no credential to expire or revoke.`,
    "",
    "## Rate limits",
    "",
    `Limits are per client IP per 60-second window, enforced per server instance:`,
    "",
    `- \`/api/availability\` (+ \`/api/v1/availability\`, \`/v1/check\`) — ${RATE_LIMITS.availability} requests/minute (each request fans out to ~60 upstream checks)`,
    `- \`/api/score\` (+ \`/api/v1/score\`, \`/v1/score\`) — ${RATE_LIMITS.score} requests/minute`,
    `- \`/api/mcp\` (+ \`/api/v1/mcp\`, \`/v1/mcp\`) — ${RATE_LIMITS.mcp} requests/minute`,
    `- metadata/document endpoints (\`/api/markdown\`, \`/api/openapi.json\`, \`/openapi.json\`, \`/v1\`, API 404s) — ${RATE_LIMITS.aux} requests/minute`,
    "",
    `Every API response — including errors and 404s — carries RFC RateLimit headers: \`RateLimit-Limit\`, \`RateLimit-Remaining\`, \`RateLimit-Reset\` (seconds until the window resets) and \`RateLimit-Policy\` (e.g. \`60;w=60\` — the quota and window). Exceeding a limit returns \`429\` with \`Retry-After\` and an \`{ "error": { "code": "rate_limited", ... } }\` body. Set \`NAYMME_RATE_LIMIT_RPM\` when self-hosting to tune.`,
    "",
    "## Versioning",
    "",
    `The API is version 1. \`/api/v1/*\` is canonical; the unversioned \`/api/*\` paths and the root-level \`/v1/*\` aliases (\`/v1/check\`, \`/v1/score\`, \`/v1/mcp\`, \`/v1\` version index) are the same handlers. Every response carries \`API-Version: 1\` and \`X-API-Version: 1.0.0\`. A future breaking v2 will keep v1 serving and mark it with \`Deprecation: true\` and \`Sunset\` headers plus a \`Link: <…>; rel="deprecation"\` pointer for at least 6 months before any removal.`,
    "",
    "## Headers",
    "",
    `- \`Accept: application/json\` — JSON everywhere; unknown URLs (including unmapped \`/api/*\` paths) return a structured \`{error:{code,message,hint}}\` 404`,
    `- \`Accept: text/markdown\` — markdown representations of any page`,
    `- \`Accept: application/json, text/event-stream\` + \`Content-Type: application/json\` — required on \`POST /api/mcp\``,
    `- \`User-Agent\` — a descriptive agent name is appreciated, e.g. \`my-agent/1.0 (+https://you.example)\``,
    "",
    "## Errors",
    "",
    `Every API error is structured: \`{ "error": { "code": "<stable code>", "message": "<summary>", "hint": "<how to fix>", "details?": … } }\`. Stable codes: \`invalid_request\`, \`not_found\`, \`rate_limited\`, \`body_too_large\`, \`upstream_failed\`, \`too_many_sessions\`, \`internal_error\`. MCP JSON-RPC errors keep their protocol shape and carry the hint under \`error.data.hint\`. Nothing here requires re-auth — there is no auth to renew.`,
    "",
    "## Revocation",
    "",
    `No credentials exist, so nothing is revoked. If a \`429\` arrives, honor \`Retry-After\`; if a \`404\` arrives on a previously working path, re-read \`/openapi.json\`.`,
    "",
    "## DNS-AID",
    "",
    `This host documents its DNS-AID (draft-mozleywilliams-dnsop-dnsaid) SVCB/HTTPS records — the \`_index._agents\` organizational index pointer and the known-agent record — in DNS-AID.md in the repository.`,
    "",
  ].join("\n");
}
