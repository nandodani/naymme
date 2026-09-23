import { z } from "zod";

import {
  checkAvailabilityOutputSchema,
  nameSchema,
  scoreNameOutputSchema,
} from "../src/schemas.js";
import { SERVER_VERSION } from "../src/server.js";
import { guardAuxRequest } from "./api-guard.js";
import { SITE_NAME, SITE_URL } from "./site.js";

/**
 * OpenAPI 3.1 document served at /openapi.json (and the /api/openapi.json
 * alias). Schemas are generated from the same zod definitions that validate
 * the live endpoints, so the document cannot drift from the implementation.
 * Field descriptions are written for tool-calling agents: what to pass,
 * what comes back, and which failure codes to expect.
 */

const availabilityOutputJson = z.toJSONSchema(
  checkAvailabilityOutputSchema.extend({
    mode: z
      .enum(["live", "demo"])
      .describe('"live" queried real providers; "demo" returned deterministic fixtures.'),
  }),
);

const scoreOutputJson = z.toJSONSchema(scoreNameOutputSchema);

const nameParamJson = z.toJSONSchema(nameSchema);

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description:
            "Stable machine-readable code (invalid_request | not_found | rate_limited | body_too_large | upstream_failed | too_many_sessions | internal_error).",
        },
        message: { type: "string", description: "Human-readable summary of what went wrong." },
        hint: {
          type: "string",
          description: "Actionable guidance for fixing the request — written for agents.",
        },
        details: { description: "Optional diagnostics (e.g. per-field validation issues)." },
      },
      required: ["code", "message", "hint"],
    },
  },
  required: ["error"],
} as const;

/**
 * Response headers every API endpoint emits — the API version marker and
 * the RFC RateLimit budget fields (draft-ietf-httpapi-ratelimit-headers).
 */
const apiResponseHeaders = {
  "API-Version": {
    schema: { type: "string", enum: ["1"] },
    description:
      "API version of the response format. /api/v1/* and the unversioned /api/* paths are the same handlers.",
  },
  "RateLimit-Limit": {
    schema: { type: "integer" },
    description: "Requests allowed per 60-second window for this endpoint.",
  },
  "RateLimit-Remaining": {
    schema: { type: "integer" },
    description: "Requests remaining in the caller's current window.",
  },
  "RateLimit-Reset": {
    schema: { type: "integer" },
    description: "Seconds until the caller's rate-limit window resets.",
  },
  "RateLimit-Policy": {
    schema: { type: "string" },
    description:
      "The quota policy as `<limit>;w=<window>` — e.g. `30;w=60` means 30 requests per 60-second sliding window.",
  },
  "X-API-Version": {
    schema: { type: "string", enum: ["1.0.0"] },
    description: "Semantic API version (semver form of API-Version).",
  },
};

const retryAfterHeader = {
  "Retry-After": {
    schema: { type: "integer" },
    description: "Seconds to wait before retrying (present on 429).",
  },
};

function errorResponses(codes: { status: number; code: string; when: string }[]) {
  return Object.fromEntries(
    codes.map(({ status, code, when }) => [
      String(status),
      {
        description: `${when} — structured error envelope.`,
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        headers: {
          ...apiResponseHeaders,
          ...(status === 429 ? retryAfterHeader : {}),
        },
        "x-error-code": code,
      },
    ]),
  );
}

const nameQueryParam = {
  name: "name",
  in: "query",
  required: true,
  description:
    "Bare candidate name — 1–63 characters, starts with a letter or digit, ASCII letters/digits plus '.', '_' or '-'. No TLD, scope or spaces.",
  schema: nameParamJson,
};

const providersQueryParam = {
  name: "providers",
  in: "query",
  required: false,
  description:
    "Comma-separated provider ids or aliases to check. Defaults to all providers. Aliases: 'all' (everything), 'domains' (.com/.gg/.dev/.io), 'domains:all' (every TLD), 'domains:cctld' (ccTLDs), 'socials' (all social handles).",
  schema: { type: "string" },
  example: "domain:com,github:user,npm,social:x",
};

const mcpStatusSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    name: { type: "string" },
    version: { type: "string" },
    transport: { type: "string" },
    usage: { type: "string" },
  },
  required: ["ok", "name", "version", "transport", "usage"],
} as const;

const mcpGetOperation = {
  operationId: "getMcpStatus",
  summary: "MCP endpoint status",
  description:
    "Liveness/status document for the hosted MCP server. POST to the same URL speaks JSON-RPC 2.0 (initialize, tools/list, tools/call) over stateless Streamable HTTP.",
  // Explicit no-input marker for LLM function-calling consumers.
  parameters: [] as const,
  responses: {
    "200": {
      description: "Endpoint status document.",
      content: { "application/json": { schema: mcpStatusSchema } },
      headers: apiResponseHeaders,
    },
    ...errorResponses([{ status: 429, code: "rate_limited", when: "Request budget exhausted" }]),
  },
};

const mcpPostOperation = {
  operationId: "callMcpJsonRpc",
  summary: "MCP JSON-RPC 2.0 (Streamable HTTP)",
  description:
    "Stateless MCP transport: POST JSON-RPC 2.0 messages (initialize, tools/list, tools/call for check_availability and score_name). Send Accept: application/json, text/event-stream — responses are SSE-framed; a plain application/json Accept yields a JSON body.",
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            jsonrpc: { type: "string", enum: ["2.0"] },
            id: { description: "JSON-RPC request id (string, number or null)." },
            method: {
              type: "string",
              description: "e.g. initialize, tools/list, tools/call",
            },
            params: { type: "object" },
          },
          required: ["jsonrpc", "id", "method"],
        },
      },
    },
  },
  responses: {
    "200": {
      description:
        "JSON-RPC result — SSE-framed (text/event-stream) or plain JSON depending on Accept.",
      content: {
        "text/event-stream": { schema: { type: "string" } },
        "application/json": { schema: { $ref: "#/components/schemas/JsonRpcMessage" } },
      },
      headers: apiResponseHeaders,
    },
    ...errorResponses([
      { status: 413, code: "body_too_large", when: "Request body over the 1 MiB cap" },
      { status: 429, code: "rate_limited", when: "Request budget exhausted" },
      { status: 500, code: "internal_error", when: "Unexpected failure" },
    ]),
  },
};

export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: `${SITE_NAME} API`,
      version: SERVER_VERSION,
      description:
        "naymme checks a candidate name's availability across 61 providers (domains, GitHub, npm and other registries, hosted subdomains, stores and socials) and scores it deterministically for brand quality. Public API — no authentication; the API is version 1 (/api/v1/* is canonical, unversioned /api/* are aliases — API-Version: 1 on every response). Errors use {error:{code,message,hint}}; responses carry RFC RateLimit headers (RateLimit-Limit/Remaining/Reset), documented with rate limits in /auth.md.",
      contact: { name: "nandodani", url: "https://nandodani.dev" },
      "x-api-version": "1.0.0",
      "x-deprecation-policy":
        'Stable versions are never removed without notice. If a breaking v2 ships, v1 stays live and emits `Deprecation: true`, `Sunset: <http-date>` and `Link: <migration-guide>; rel="deprecation"` headers for at least 6 months before removal. Documented at /auth.md.',
    },
    servers: [{ url: SITE_URL, description: "Production" }],
    paths: {
      "/api/availability": {
        get: {
          operationId: "checkAvailability",
          summary: "Check name availability across providers",
          description:
            "Runs the candidate name against domain registries (RDAP/WHOIS/DNS), GitHub/GitLab, package registries (npm, PyPI, crates.io, Docker Hub, Hugging Face, JSR, deno.land, NuGet, RubyGems, Homebrew), hosted subdomains (vercel.app, netlify.app, pages.dev, fly.dev, up.railway.app, supabase.co), stores and social handles. Each provider reports status available | taken | unknown | invalid; unknown is never treated as available.",
          parameters: [nameQueryParam, providersQueryParam],
          responses: {
            "200": {
              description: "Normalized availability results plus per-status tallies.",
              content: { "application/json": { schema: availabilityOutputJson } },
              headers: apiResponseHeaders,
            },
            ...errorResponses([
              { status: 400, code: "invalid_request", when: "Invalid or missing name/providers" },
              { status: 429, code: "rate_limited", when: "Request budget exhausted" },
              { status: 502, code: "upstream_failed", when: "A provider lookup failed" },
            ]),
          },
        },
      },
      "/api/score": {
        get: {
          operationId: "scoreName",
          summary: "Deterministically score a name for brand quality",
          description:
            "Scores the name 0–100 for punchiness, syllables, pronounceability, uniqueness and cleanliness, and returns a letter grade. Pure heuristic — no network lookups; the same name always scores identically.",
          parameters: [nameQueryParam],
          responses: {
            "200": {
              description: "Brand score breakdown with per-component values.",
              content: { "application/json": { schema: scoreOutputJson } },
              headers: apiResponseHeaders,
            },
            ...errorResponses([
              { status: 400, code: "invalid_request", when: "Invalid or missing name" },
              { status: 429, code: "rate_limited", when: "Request budget exhausted" },
            ]),
          },
        },
      },
      "/api/v1/availability": {
        description:
          "Canonical versioned path; the unversioned /api/availability is the same handler (API-Version: 1 on every response).",
        get: {
          operationId: "checkAvailabilityV1",
          summary: "Check name availability across providers (v1)",
          description:
            "Versioned alias for GET /api/availability — identical parameters and response. Prefer this path for new integrations; unversioned paths remain v1 aliases and will carry Deprecation + Sunset headers before any future breaking change.",
          parameters: [nameQueryParam, providersQueryParam],
          responses: {
            "200": {
              description: "Normalized availability results plus per-status tallies.",
              content: { "application/json": { schema: availabilityOutputJson } },
              headers: apiResponseHeaders,
            },
            ...errorResponses([
              { status: 400, code: "invalid_request", when: "Invalid or missing name/providers" },
              { status: 429, code: "rate_limited", when: "Request budget exhausted" },
              { status: 502, code: "upstream_failed", when: "A provider lookup failed" },
            ]),
          },
        },
      },
      "/api/v1/score": {
        description: "Canonical versioned path; /api/score is the same handler.",
        get: {
          operationId: "scoreNameV1",
          summary: "Deterministically score a name for brand quality (v1)",
          description: "Versioned alias for GET /api/score — identical parameters and response.",
          parameters: [nameQueryParam],
          responses: {
            "200": {
              description: "Brand score breakdown with per-component values.",
              content: { "application/json": { schema: scoreOutputJson } },
              headers: apiResponseHeaders,
            },
            ...errorResponses([
              { status: 400, code: "invalid_request", when: "Invalid or missing name" },
              { status: 429, code: "rate_limited", when: "Request budget exhausted" },
            ]),
          },
        },
      },
      "/api/mcp": { get: mcpGetOperation, post: mcpPostOperation },
      "/api/v1/mcp": {
        description: "Canonical versioned path; /api/mcp is the same handler.",
        get: {
          ...mcpGetOperation,
          operationId: "getMcpStatusV1",
          description: "Versioned alias for GET /api/mcp — the MCP endpoint status document.",
        },
        post: {
          ...mcpPostOperation,
          operationId: "callMcpJsonRpcV1",
          description: "Versioned alias for POST /api/mcp — the JSON-RPC 2.0 transport.",
        },
      },
      "/v1": {
        description:
          "Root-level version index — which API version is served and where the v1 endpoints live.",
        get: {
          operationId: "getApiVersionIndex",
          summary: "API version index",
          parameters: [],
          description:
            "Returns { apiVersion, xApiVersion, deprecated, sunset, endpoints } — the discovery entry point for the root-level /v1/* aliases (mirrors of the canonical /api/v1/* paths).",
          responses: {
            "200": {
              description: "Version index document.",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/VersionIndex" } },
              },
              headers: apiResponseHeaders,
            },
            ...errorResponses([
              { status: 429, code: "rate_limited", when: "Request budget exhausted" },
            ]),
          },
        },
      },
      "/v1/check": {
        description: "Root-level versioned alias for /api/v1/availability (same handler).",
        get: {
          operationId: "checkAvailabilityV1Root",
          summary: "Check name availability across providers (root v1 alias)",
          description:
            "Versioned alias for GET /api/availability — identical parameters and response.",
          parameters: [nameQueryParam, providersQueryParam],
          responses: {
            "200": {
              description: "Normalized availability results plus per-status tallies.",
              content: { "application/json": { schema: availabilityOutputJson } },
              headers: apiResponseHeaders,
            },
            ...errorResponses([
              { status: 400, code: "invalid_request", when: "Invalid or missing name/providers" },
              { status: 429, code: "rate_limited", when: "Request budget exhausted" },
              { status: 502, code: "upstream_failed", when: "A provider lookup failed" },
            ]),
          },
        },
      },
      "/v1/score": {
        description: "Root-level versioned alias for /api/v1/score (same handler).",
        get: {
          operationId: "scoreNameV1Root",
          summary: "Deterministically score a name for brand quality (root v1 alias)",
          description: "Versioned alias for GET /api/score — identical parameters and response.",
          parameters: [nameQueryParam],
          responses: {
            "200": {
              description: "Brand score breakdown with per-component values.",
              content: { "application/json": { schema: scoreOutputJson } },
              headers: apiResponseHeaders,
            },
            ...errorResponses([
              { status: 400, code: "invalid_request", when: "Invalid or missing name" },
              { status: 429, code: "rate_limited", when: "Request budget exhausted" },
            ]),
          },
        },
      },
      "/v1/mcp": {
        description: "Root-level versioned alias for /api/v1/mcp (same handler).",
        get: {
          ...mcpGetOperation,
          operationId: "getMcpStatusV1Root",
          description: "Versioned alias for GET /api/mcp — the MCP endpoint status document.",
        },
        post: {
          ...mcpPostOperation,
          operationId: "callMcpJsonRpcV1Root",
          description: "Versioned alias for POST /api/mcp — the JSON-RPC 2.0 transport.",
        },
      },
      "/mcp": {
        description: "Path alias for /api/mcp.",
        get: {
          ...mcpGetOperation,
          operationId: "getMcpStatusAlias",
          description: "Alias for GET /api/mcp — the MCP endpoint status document.",
        },
        post: {
          ...mcpPostOperation,
          operationId: "callMcpJsonRpcAlias",
          description: "Alias for POST /api/mcp — the JSON-RPC 2.0 transport.",
        },
      },
      "/health": {
        get: {
          ...mcpGetOperation,
          operationId: "getHealthStatus",
          summary: "Health check",
          description: "Path alias for GET /api/mcp — the endpoint status document.",
        },
      },
      "/api/markdown": {
        get: {
          operationId: "getPageMarkdown",
          summary: "Markdown representation of a site page",
          description:
            "Returns the markdown document for a page path (/, /docs, /about, /contact, /privacy, /credits). The edge proxy also rewrites Accept: text/markdown requests to pages through this endpoint.",
          parameters: [
            {
              name: "path",
              in: "query",
              required: true,
              description: "Site page path to render as markdown.",
              schema: { type: "string" },
              example: "/docs",
            },
          ],
          responses: {
            "200": {
              description: "Markdown document for the page.",
              content: { "text/markdown": { schema: { type: "string" } } },
              headers: apiResponseHeaders,
            },
            "404": {
              description:
                "Unknown path — markdown 404, or the JSON error envelope for JSON clients.",
              content: {
                "text/markdown": { schema: { type: "string" } },
                "application/json": { schema: { $ref: "#/components/schemas/Error" } },
              },
              headers: apiResponseHeaders,
            },
            ...errorResponses([
              { status: 429, code: "rate_limited", when: "Request budget exhausted" },
            ]),
          },
        },
      },
      "/.well-known/mcp": {
        get: {
          operationId: "getMcpDiscovery",
          summary: "MCP discovery document",
          parameters: [],
          description:
            "Describes the hosted MCP server — name, version, transport, endpoint and tools with live input schemas — so agents can use it without reading docs. POST performs the same JSON-RPC handshake as /api/mcp.",
          responses: {
            "200": {
              description: "MCP discovery document.",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/McpDiscovery" } },
              },
            },
          },
        },
        post: {
          ...mcpPostOperation,
          operationId: "callMcpDiscoveryJsonRpc",
          description: "Alias for POST /api/mcp — full JSON-RPC handshake at the discovery URL.",
        },
      },
      "/openapi.json": {
        get: {
          operationId: "getOpenApiDocument",
          summary: "This OpenAPI document",
          parameters: [],
          description: "OpenAPI 3.1 description of every public HTTP endpoint.",
          responses: {
            "200": {
              description: "The OpenAPI document.",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/OpenApiDocument" } },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Error: errorSchema,
        AvailabilityResult: availabilityOutputJson,
        BrandScore: scoreOutputJson,
        JsonRpcMessage: {
          type: "object",
          properties: {
            jsonrpc: { type: "string", enum: ["2.0"] },
            id: {
              oneOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
              description: "JSON-RPC request id echoed back; null for parse errors.",
            },
            result: {
              description:
                "Method-specific result — for tools/call, the MCP tool result envelope {content, isError?, structuredContent?}; initialize returns {protocolVersion, capabilities, serverInfo}.",
            },
            error: {
              type: "object",
              properties: {
                code: { type: "integer" },
                message: { type: "string" },
                data: {
                  type: "object",
                  properties: { hint: { type: "string" } },
                },
              },
              required: ["code", "message"],
            },
          },
        },
        McpDiscovery: {
          type: "object",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
            description: { type: "string" },
            homepage: { type: "string" },
            mcp: {
              type: "object",
              properties: {
                transport: { type: "string", enum: ["streamable-http"] },
                endpoint: { type: "string" },
                method: { type: "string", enum: ["POST"] },
                session: { type: "string", enum: ["stateless"] },
                note: { type: "string" },
              },
              required: ["transport", "endpoint"],
            },
            tools: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", enum: ["check_availability", "score_name"] },
                  title: { type: "string" },
                  description: { type: "string" },
                  inputSchema: { type: "object", description: "JSON Schema for the tool input." },
                },
                required: ["name", "inputSchema"],
              },
            },
            api: {
              type: "object",
              properties: {
                availability: { type: "string" },
                score: { type: "string" },
              },
            },
          },
          required: ["name", "version", "mcp", "tools"],
        },
        VersionIndex: {
          type: "object",
          properties: {
            apiVersion: { type: "string", enum: ["1"] },
            xApiVersion: { type: "string", enum: ["1.0.0"] },
            deprecated: { type: "boolean", enum: [false] },
            sunset: { type: ["string", "null"], description: "RFC 8594 sunset date, or null." },
            deprecationPolicy: { type: "string" },
            endpoints: {
              type: "object",
              properties: {
                check: { type: "string" },
                score: { type: "string" },
                mcp: { type: "string" },
                canonicalPrefix: { type: "string" },
              },
              required: ["check", "score", "mcp", "canonicalPrefix"],
            },
            docs: { type: "string" },
            openapi: { type: "string" },
          },
          required: [
            "apiVersion",
            "xApiVersion",
            "deprecated",
            "sunset",
            "deprecationPolicy",
            "endpoints",
            "docs",
            "openapi",
          ],
        },
        OpenApiDocument: {
          type: "object",
          properties: {
            openapi: { type: "string", const: "3.1.0" },
            info: { type: "object" },
            paths: { type: "object" },
            components: { type: "object" },
          },
          required: ["openapi", "info", "paths"],
        },
      },
    },
  };
}

export function openApiResponse(request: Request): Response {
  const guard = guardAuxRequest(request);
  if (!guard.ok) return guard.response;
  return Response.json(buildOpenApiDocument(), {
    headers: { "access-control-allow-origin": "*", ...guard.headers },
  });
}
