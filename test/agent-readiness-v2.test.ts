import { describe, expect, it } from "vitest";

import { GET as authServerGET } from "../app/.well-known/oauth-authorization-server/route.js";
import {
  DELETE as apiCatchAllDelete,
  GET as apiCatchAllGet,
  POST as apiCatchAllPost,
} from "../app/api/[...path]/route.js";
import { GET as v1McpGet } from "../app/api/v1/mcp/route.js";
import { GET as v1ScoreGet } from "../app/api/v1/score/route.js";
import { buildAuthMarkdown, buildOauthAuthorizationServer } from "../lib/agent-discovery.js";
import { AGENT_SKILLS } from "../lib/agent-skills.js";
import { demoAvailabilityService, handleAvailabilityRequest } from "../lib/availability.js";
import { jsonLdGraph } from "../lib/json-ld.js";
import { buildLlmsFullTxt, buildLlmsTxt } from "../lib/llms.js";
import { handleMcpRequest } from "../lib/mcp-web.js";
import { buildOpenApiDocument } from "../lib/openapi.js";
import { handleScoreRequest } from "../lib/score-api.js";
import { SITE_URL } from "../lib/site.js";
import { RateLimiter } from "../src/security.js";
import { defaultDeps } from "../src/deps.js";

function get(path: string): Request {
  return new Request(`https://app.test${path}`);
}

const tinyLimiter = () => new RateLimiter({ windowMs: 60_000, max: 1 });

describe("RFC RateLimit + API-Version headers", () => {
  it("availability 200 carries API-Version and the full RateLimit trio", async () => {
    const res = await handleAvailabilityRequest(
      get("/api/availability?name=acme"),
      demoAvailabilityService(),
      tinyLimiter(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("api-version")).toBe("1");
    expect(res.headers.get("ratelimit-limit")).toBe("1");
    expect(res.headers.get("ratelimit-remaining")).toBe("0");
    expect(Number(res.headers.get("ratelimit-reset"))).toBeGreaterThan(0);
  });

  it("availability errors keep the same headers", async () => {
    const res = await handleAvailabilityRequest(
      get("/api/availability?name="),
      demoAvailabilityService(),
      tinyLimiter(),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("api-version")).toBe("1");
    expect(res.headers.get("ratelimit-limit")).toBe("1");
  });

  it("score 429 carries Retry-After and an exhausted RateLimit budget", () => {
    const limiter = tinyLimiter();
    handleScoreRequest(get("/api/score?name=acme"), limiter);
    const res = handleScoreRequest(get("/api/score?name=acme"), limiter);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(res.headers.get("ratelimit-limit")).toBe("1");
    expect(res.headers.get("ratelimit-remaining")).toBe("0");
    expect(res.headers.get("api-version")).toBe("1");
  });

  it("mcp 429 carries RateLimit headers too", async () => {
    const limiter = tinyLimiter();
    await handleMcpRequest(get("/api/mcp"), defaultDeps(), limiter);
    const res = await handleMcpRequest(get("/api/mcp"), defaultDeps(), limiter);
    expect(res.status).toBe(429);
    expect(res.headers.get("ratelimit-limit")).toBe("1");
    expect(res.headers.get("retry-after")).toBeTruthy();
  });
});

describe("/api/v1 aliases", () => {
  it("v1 score returns the score payload with the v1 header", async () => {
    const res = v1ScoreGet(get("/api/v1/score?name=acme"));
    expect(res.status).toBe(200);
    expect(res.headers.get("api-version")).toBe("1");
    const body = (await res.json()) as { name: string; total: number };
    expect(body.name).toBe("acme");
  });

  it("v1 mcp GET returns the status document", async () => {
    const res = v1McpGet(get("/api/v1/mcp"));
    expect(res.status).toBe(200);
    expect(res.headers.get("api-version")).toBe("1");
    expect(res.headers.get("ratelimit-limit")).toBeTruthy();
    const body = (await res.json()) as { name: string; transport: string };
    expect(body.name).toBe("lmkurname");
    expect(body.transport).toBe("streamable-http");
  });

  it("v1 score 400s with the structured envelope", async () => {
    const res = v1ScoreGet(get("/api/v1/score?name="));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_request");
  });
});

describe("api catch-all 404", () => {
  it("unmapped /api/* paths return the JSON envelope, not HTML", async () => {
    for (const path of ["/api/nope", "/api/v1/nope", "/api/availability/extra"]) {
      const res = apiCatchAllGet(get(path));
      expect(res.status, path).toBe(404);
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(res.headers.get("api-version")).toBe("1");
      const body = (await res.json()) as { error: { code: string; hint: string } };
      expect(body.error.code).toBe("not_found");
      expect(body.error.hint).toContain("/openapi.json");
      expect(res.headers.get("ratelimit-limit")).toBeTruthy();
      expect(res.headers.get("ratelimit-policy")).toMatch(/^\d+;w=\d+$/);
    }
  });

  it("POST and DELETE get the same envelope", async () => {
    for (const handler of [apiCatchAllPost, apiCatchAllDelete]) {
      const res = handler(get("/api/nope"));
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("not_found");
    }
  });
});

describe("RFC 8414 authorization-server metadata", () => {
  it("serves the issuer + empty capability stub with CORS", async () => {
    const res = authServerGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const doc = (await res.json()) as Record<string, unknown>;
    expect(doc.issuer).toBe(SITE_URL);
    expect(doc.grant_types_supported).toEqual([]);
    expect(doc.response_types_supported).toEqual([]);
    expect(doc.service_documentation).toBe(`${SITE_URL}/auth.md`);
    expect("token_endpoint" in doc).toBe(false);
    expect("authorization_endpoint" in doc).toBe(false);
  });

  it("builder output matches the route", async () => {
    const doc = buildOauthAuthorizationServer();
    expect(doc.issuer).toBe(SITE_URL);
  });
});

describe("auth.md (WorkOS convention)", () => {
  const md = buildAuthMarkdown();

  it("opens with the # auth.md heading and agent preamble", () => {
    expect(md.startsWith("# auth.md")).toBe(true);
    expect(md).toContain("You are an agent");
    expect(md).toContain("public, unauthenticated");
  });

  it("follows the numbered-step structure", () => {
    for (const step of [
      "## Step 1 — Discover",
      "## Step 2 — Pick a method",
      "## Step 3 — Register",
      "## Step 4 — Claim ceremony",
      "## Step 5 — Use the public tier",
      "## Errors",
      "## Revocation",
    ]) {
      expect(md, step).toContain(step);
    }
  });

  it("documents the versioned aliases, RateLimit headers and OAuth stubs", () => {
    expect(md).toContain("/api/v1/availability");
    expect(md).toContain("/api/v1/mcp");
    expect(md).toContain("RateLimit-Remaining");
    expect(md).toContain("API-Version: 1");
    expect(md).toContain("Deprecation");
    expect(md).toContain("/.well-known/oauth-authorization-server");
    expect(md).toContain("/.well-known/oauth-protected-resource");
  });
});

describe("openapi.json completeness", () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<
      string,
      Record<string, { operationId?: string; responses?: Record<string, unknown> }>
    >;
    components: { schemas: Record<string, unknown> };
  };

  it("documents the v1 paths with unique operationIds", () => {
    for (const path of ["/api/v1/availability", "/api/v1/score", "/api/v1/mcp"]) {
      expect(doc.paths[path], path).toBeDefined();
    }
    expect(doc.paths["/api/v1/mcp"]?.post?.operationId).toBe("callMcpJsonRpcV1");
    const ids = Object.values(doc.paths)
      .flatMap((methods) => Object.values(methods))
      .map((op) => op.operationId)
      .filter((id): id is string => typeof id === "string");
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(14);
  });

  it("documents RateLimit + API-Version + Retry-After response headers", () => {
    const ok = doc.paths["/api/v1/score"]?.get?.responses?.["200"] as
      { headers?: Record<string, unknown> } | undefined;
    expect(ok?.headers?.["API-Version"]).toBeDefined();
    expect(ok?.headers?.["RateLimit-Limit"]).toBeDefined();
    expect(ok?.headers?.["RateLimit-Remaining"]).toBeDefined();
    expect(ok?.headers?.["RateLimit-Reset"]).toBeDefined();
    const limited = doc.paths["/api/availability"]?.get?.responses?.["429"] as
      { headers?: Record<string, unknown> } | undefined;
    expect(limited?.headers?.["Retry-After"]).toBeDefined();
  });

  it("every operation response content schema is typed", () => {
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        if (!op.responses) continue;
        for (const [status, res] of Object.entries(op.responses)) {
          const content = (res as { content?: Record<string, { schema?: object }> }).content;
          if (!content) continue;
          for (const [media, entry] of Object.entries(content)) {
            expect(
              entry.schema && Object.keys(entry.schema).length > 0,
              `${method} ${path} ${status} ${media}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("types the JSON-RPC and discovery component schemas", () => {
    const rpc = doc.components.schemas.JsonRpcMessage as {
      properties: { id: { oneOf: unknown[] }; result: object };
    };
    expect(rpc.properties.id.oneOf).toHaveLength(3);
    expect(Object.keys(rpc.properties.result).length).toBeGreaterThan(0);
    expect(doc.components.schemas.McpDiscovery).toBeDefined();
    expect(doc.components.schemas.OpenApiDocument).toBeDefined();
  });
});

describe("llms.txt guidance", () => {
  it("ships invocation examples and the versioned surface", () => {
    const llms = buildLlmsTxt();
    expect(llms).toContain("## Invocation examples");
    expect(llms).toContain("/api/v1/availability?name=");
    expect(llms).toContain("tools/call");
    expect(llms).toContain("RateLimit-Remaining");
    expect(llms).toContain("oauth-authorization-server");
    expect(buildLlmsFullTxt()).toContain("/api/v1/availability");
  });
});

describe("agent skills", () => {
  it("every skill carries when-to-use, not-for and invocation examples", () => {
    for (const skill of AGENT_SKILLS) {
      expect(skill.markdown, skill.name).toContain("## When to use");
      expect(skill.markdown, skill.name).toContain("Do NOT use");
      expect(skill.markdown, skill.name).toContain("### Invocation");
      expect(skill.markdown, skill.name).toContain("tools/call");
      expect(skill.markdown, skill.name).toContain("/api/v1/");
    }
  });
});

describe("JSON-LD discoverability", () => {
  it("exposes the API as an APIReference node", () => {
    const graph = jsonLdGraph()["@graph"] as { "@type": string; name?: string; url?: string }[];
    const api = graph.find((node) => node["@type"] === "APIReference");
    expect(api).toBeDefined();
    expect(api?.name).toContain("lmkurname");
    expect(api?.url).toContain("openapi.json");
  });
});
