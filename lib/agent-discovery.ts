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
      identifier: "name-check-mcp.vercel.app",
      url: SITE_URL,
    },
    entries: [
      entry(
        "urn:air:name-check-mcp.vercel.app:mcp:server",
        "lmkurname MCP server (check_availability, score_name)",
        "application/json",
        `${SITE_URL}/.well-known/mcp/server-card.json`,
        [
          "is the name acme available everywhere?",
          "check acme on domains, github and npm",
          "score the brand name acme",
        ],
      ),
      entry(
        "urn:air:name-check-mcp.vercel.app:tools:check",
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
        "urn:air:name-check-mcp.vercel.app:tools:score",
        "Brand name score (REST)",
        "application/json",
        `${SITE_URL}/api/score`,
        ["rate acme as a brand name", "how strong is the name acme out of 100?"],
      ),
      entry(
        "urn:air:name-check-mcp.vercel.app:api:openapi",
        "OpenAPI 3.1 description of the lmkurname HTTP API",
        "application/json",
        `${SITE_URL}/openapi.json`,
        ["what endpoints does lmkurname expose?", "how do i call the availability api?"],
      ),
      entry(
        "urn:air:name-check-mcp.vercel.app:skills:index",
        "Agent skills index (agent-skills discovery RFC)",
        "application/json",
        `${SITE_URL}/.well-known/agent-skills/index.json`,
        ["does lmkurname publish agent skills?", "how should an agent use the name checker?"],
      ),
      entry(
        "urn:air:name-check-mcp.vercel.app:docs:llms",
        "Agent quick-start (llms.txt)",
        "text/markdown",
        `${SITE_URL}/llms.txt`,
        ["how do i use lmkurname from an ai assistant?"],
      ),
      entry(
        "urn:air:name-check-mcp.vercel.app:docs:auth",
        "Authentication and rate-limit document",
        "text/markdown",
        `${SITE_URL}/auth.md`,
        ["does the lmkurname api need a key?", "what are the rate limits?"],
      ),
    ],
  };
}

/**
 * RFC 9728 OAuth Protected Resource Metadata stub. The API is public and
 * unauthenticated, so the document declares the resource and an empty
 * authorization-server list — a compliant way to state "no token tier".
 */
export function buildOauthProtectedResource(): Record<string, unknown> {
  return {
    resource: MCP_ENDPOINT,
    resource_name: `${SITE_NAME} MCP + REST API`,
    resource_documentation: `${SITE_URL}/auth.md`,
    authorization_servers: [],
    scopes_supported: [],
    bearer_methods_supported: [],
    resource_signing_alg_values_supported: [],
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
 * /auth.md — the authentication document agents fetch to learn how (not)
 * to authenticate: the public tier, rate limits, required headers and what
 * registration means here (none — just a descriptive User-Agent).
 */
export function buildAuthMarkdown(): string {
  return [
    `# ${SITE_NAME} — authentication & API access`,
    "",
    `All lmkurname endpoints are **public and unauthenticated**. No API key, token, OAuth flow or account registration is required — call them directly.`,
    "",
    "## Public endpoints",
    "",
    `- \`GET ${SITE_URL}/api/availability?name=<name>[&providers=<csv>]\` — name availability results`,
    `- \`GET ${SITE_URL}/api/score?name=<name>\` — deterministic brand score`,
    `- \`POST ${SITE_URL}/api/mcp\` — MCP Streamable HTTP transport (JSON-RPC 2.0)`,
    `- \`GET ${SITE_URL}/api/mcp\` (also \`/mcp\`, \`/health\`) — endpoint status`,
    `- \`GET ${SITE_URL}/api/markdown?path=</page>\` — markdown representations of pages`,
    `- \`GET ${SITE_URL}/openapi.json\` — OpenAPI 3.1 description of this API`,
    "",
    "## Rate limits",
    "",
    `Limits are per client IP per 60-second window, enforced per server instance:`,
    "",
    `- \`/api/availability\` — ${RATE_LIMITS.availability} requests/minute (each request fans out to ~60 upstream checks)`,
    `- \`/api/score\` — ${RATE_LIMITS.score} requests/minute`,
    `- \`/api/mcp\` — ${RATE_LIMITS.mcp} requests/minute`,
    "",
    `Exceeding a limit returns \`429\` with a \`Retry-After\` header and an \`{ "error": { "code": "rate_limited", ... } }\` body. Set \`LMKURNAME_RATE_LIMIT_RPM\` when self-hosting to tune.`,
    "",
    "## Headers",
    "",
    `- \`Accept: application/json\` — JSON everywhere; on unknown URLs it also yields a structured \`{error:{code,message,hint}}\` 404`,
    `- \`Accept: text/markdown\` — markdown representations of any page`,
    `- \`Accept: application/json, text/event-stream\` + \`Content-Type: application/json\` — required on \`POST /api/mcp\``,
    `- \`User-Agent\` — please send a descriptive agent name, e.g. \`my-agent/1.0 (+https://you.example)\``,
    "",
    "## Errors",
    "",
    `Every API error is structured: \`{ "error": { "code": "<stable code>", "message": "<summary>", "hint": "<how to fix>" } }\`. MCP JSON-RPC errors keep their protocol shape and carry the hint under \`error.data.hint\`.`,
    "",
    "## Agent registration",
    "",
    `None needed — the service is open. If you operate an agent, identifying yourself in \`User-Agent\` is appreciated but not enforced.`,
    "",
    "## OAuth",
    "",
    `No OAuth tier exists: nothing here requires a token. \`/.well-known/oauth-protected-resource\` is published as an RFC 9728 stub declaring an empty authorization-server list, which is how this host documents its public/no-token tier.`,
    "",
  ].join("\n");
}
