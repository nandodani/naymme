import { describe, expect, it } from "vitest";

import { GET as markdownGet } from "../app/api/markdown/route.js";
import { GET as apiOpenapiGet } from "../app/api/openapi.json/route.js";
import { GET as openapiGet } from "../app/openapi.json/route.js";
import { GET as v1Get } from "../app/v1/route.js";
import { GET as v1CheckGet } from "../app/v1/check/route.js";
import { GET as v1ScoreGet } from "../app/v1/score/route.js";
import { GET as v1CatchAllGet } from "../app/v1/[...path]/route.js";
import { guardAuxRequest } from "../lib/api-guard.js";
import { buildAuthMarkdown } from "../lib/agent-discovery.js";
import { demoAvailabilityService, handleAvailabilityRequest } from "../lib/availability.js";
import { buildLlmsFullTxt, buildLlmsTxt } from "../lib/llms.js";
import { buildOpenApiDocument } from "../lib/openapi.js";
import { DOCS_CONTENT } from "../lib/page-content.js";
import { handleScoreRequest } from "../lib/score-api.js";
import { RateLimiter } from "../src/security.js";

function get(path: string): Request {
  return new Request(`https://app.test${path}`);
}

const tinyLimiter = () => new RateLimiter({ windowMs: 60_000, max: 1 });

function expectApiConventions(res: Response) {
  expect(res.headers.get("api-version")).toBe("1");
  expect(res.headers.get("x-api-version")).toBe("1.0.0");
  expect(res.headers.get("ratelimit-limit")).toMatch(/^\d+$/);
  expect(res.headers.get("ratelimit-remaining")).toMatch(/^\d+$/);
  expect(res.headers.get("ratelimit-reset")).toMatch(/^\d+$/);
  expect(res.headers.get("ratelimit-policy")).toMatch(/^\d+;w=\d+$/);
}

describe("header contract on every API surface", () => {
  it("score carries the full quartet + version headers", () => {
    expectApiConventions(handleScoreRequest(get("/api/score?name=acme"), tinyLimiter()));
  });

  it("availability carries the full quartet + version headers", async () => {
    const res = await handleAvailabilityRequest(
      get("/api/availability?name=acme"),
      demoAvailabilityService(),
      tinyLimiter(),
    );
    expectApiConventions(res);
    expect(res.headers.get("ratelimit-policy")).toBe("1;w=60");
  });

  it("/api/markdown carries the aux-budget headers", async () => {
    const res = markdownGet(get("/api/markdown?path=/docs"));
    expect(res.status).toBe(200);
    expectApiConventions(res);
    const res404 = markdownGet(get("/api/markdown?path=/nope"));
    expect(res404.status).toBe(404);
    expectApiConventions(res404);
  });

  it("openapi.json routes carry the aux-budget headers", async () => {
    for (const handler of [openapiGet, apiOpenapiGet]) {
      const res = handler(get("/openapi.json"));
      expect(res.status).toBe(200);
      expectApiConventions(res);
    }
  });

  it("/v1 catch-all 404 carries the headers too", () => {
    const res = v1CatchAllGet(get("/v1/nope"));
    expect(res.status).toBe(404);
    expectApiConventions(res);
  });
});

describe("429 simulation", () => {
  it("exhausted aux budget returns Retry-After + structured envelope", () => {
    const limiter = tinyLimiter();
    expect(guardAuxRequest(get("/api/nope"), limiter).ok).toBe(true);
    const second = guardAuxRequest(get("/api/nope"), limiter);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.response.status).toBe(429);
    expect(second.response.headers.get("retry-after")).toBeTruthy();
    expect(second.response.headers.get("ratelimit-limit")).toBe("1");
    expect(second.response.headers.get("ratelimit-remaining")).toBe("0");
    expect(second.response.headers.get("ratelimit-policy")).toBe("1;w=60");
    return second.response.json().then((body) => {
      const envelope = body as { error: { code: string; hint: string } };
      expect(envelope.error.code).toBe("rate_limited");
      expect(envelope.error.hint).toBeTruthy();
    });
  });
});

describe("root /v1 alias surface", () => {
  it("GET /v1 returns the version index with headers", async () => {
    const res = v1Get(get("/v1"));
    expect(res.status).toBe(200);
    expectApiConventions(res);
    const body = (await res.json()) as {
      apiVersion: string;
      xApiVersion: string;
      deprecated: boolean;
      endpoints: { check: string; score: string; mcp: string };
    };
    expect(body.apiVersion).toBe("1");
    expect(body.xApiVersion).toBe("1.0.0");
    expect(body.deprecated).toBe(false);
    expect(body.endpoints.check).toBe("/v1/check");
  });

  it("GET /v1/check delegates to the availability handler", async () => {
    const res = await v1CheckGet(get("/v1/check?name="));
    expect(res.status).toBe(400);
    expectApiConventions(res);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_request");
  });

  it("GET /v1/score delegates to the score handler", async () => {
    const res = v1ScoreGet(get("/v1/score?name=acme"));
    expect(res.status).toBe(200);
    expectApiConventions(res);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe("acme");
  });
});

describe("openapi.json audit", () => {
  const doc = buildOpenApiDocument() as {
    info: Record<string, unknown>;
    paths: Record<
      string,
      Record<
        string,
        {
          operationId?: string;
          parameters?: { schema?: object }[];
          requestBody?: { content?: Record<string, { schema?: object }> };
          responses?: Record<string, { content?: Record<string, { schema?: object }> }>;
        }
      >
    >;
  };

  it("declares the version + deprecation policy extensions", () => {
    expect(doc.info["x-api-version"]).toBe("1.0.0");
    expect(doc.info["x-deprecation-policy"]).toContain("Sunset");
    expect(doc.info["x-deprecation-policy"]).toContain("Deprecation");
  });

  it("documents every /v1/* root alias", () => {
    for (const path of ["/v1", "/v1/check", "/v1/score", "/v1/mcp"]) {
      expect(doc.paths[path], path).toBeDefined();
    }
  });

  const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];
  const operations = (doc: { paths: Record<string, Record<string, object>> }) =>
    Object.entries(doc.paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([method]) => HTTP_METHODS.includes(method))
        .map(([method, op]) => ({ path, method, op })),
    );

  it("every operation has a unique operationId", () => {
    const ops = operations(doc) as {
      path: string;
      method: string;
      op: { operationId?: string };
    }[];
    const ids = ops
      .map((o) => o.op.operationId)
      .filter((id): id is string => typeof id === "string");
    expect(new Set(ids).size).toBe(ids.length);
    for (const { path, method, op } of ops) {
      expect(op.operationId, `${method} ${path}`).toBeTruthy();
    }
  });

  it("every parameter and requestBody/response content is schema-typed", () => {
    for (const { path, method, op } of operations(doc)) {
      const operation = op as {
        parameters?: { schema?: object }[];
        requestBody?: { content?: Record<string, { schema?: object }> };
        responses?: Record<string, { content?: Record<string, { schema?: object }> }>;
      };
      for (const param of operation.parameters ?? []) {
        expect(
          param.schema && Object.keys(param.schema).length > 0,
          `${method} ${path} param`,
        ).toBe(true);
      }
      if (operation.requestBody?.content) {
        for (const [media, entry] of Object.entries(operation.requestBody.content)) {
          expect(
            entry.schema && Object.keys(entry.schema).length > 0,
            `${method} ${path} body ${media}`,
          ).toBe(true);
        }
      }
      for (const [status, res] of Object.entries(operation.responses ?? {})) {
        for (const [media, entry] of Object.entries(res.content ?? {})) {
          expect(
            entry.schema && Object.keys(entry.schema).length > 0,
            `${method} ${path} ${status} ${media}`,
          ).toBe(true);
        }
      }
    }
  });

  it("documents the RateLimit-Policy + X-API-Version headers", () => {
    const ok = doc.paths["/v1/score"]?.get?.responses?.["200"] as
      { headers?: Record<string, unknown> } | undefined;
    expect(ok?.headers?.["RateLimit-Policy"]).toBeDefined();
    expect(ok?.headers?.["X-API-Version"]).toBeDefined();
  });
});

describe("docs text keeps the conventions documented", () => {
  it("llms.txt names the quartet, X-API-Version and /v1 aliases", () => {
    const llms = buildLlmsTxt();
    expect(llms).toContain("RateLimit-Policy");
    expect(llms).toContain("X-API-Version");
    expect(llms).toContain("/v1/check");
    expect(buildLlmsFullTxt()).toContain("/v1/score");
  });

  it("auth.md documents RateLimit-Policy and the /v1 surface", () => {
    const md = buildAuthMarkdown();
    expect(md).toContain("RateLimit-Policy");
    expect(md).toContain("/v1/check");
    expect(md).toContain("X-API-Version: 1.0.0");
  });

  it("/docs documents the header + versioning conventions", () => {
    const http = DOCS_CONTENT.sections.find((s) => s.heading === "HTTP API");
    const text = (http?.paragraphs ?? []).join(" ");
    expect(text).toContain("RateLimit-Policy");
    expect(text).toContain("/v1/check");
    expect(text).toContain("Deprecation");
  });
});
