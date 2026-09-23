import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GET as apiCatalogGET } from "../app/.well-known/api-catalog/route.js";
import { GET as agentSkillsIndexGET } from "../app/.well-known/agent-skills/index.json/route.js";
import { GET as skillMdGET } from "../app/.well-known/agent-skills/[name]/SKILL.md/route.js";
import { GET as aiCatalogGET } from "../app/.well-known/ai-catalog.json/route.js";
import { GET as serverCardGET } from "../app/.well-known/mcp/server-card.json/route.js";
import { GET as oauthResourceGET } from "../app/.well-known/oauth-protected-resource/route.js";
import { GET as oauthResourceJsonGET } from "../app/.well-known/oauth-protected-resource.json/route.js";
import { GET as openapiGET } from "../app/openapi.json/route.js";
import { GET as apiOpenapiGET } from "../app/api/openapi.json/route.js";
import { GET as authMdGET } from "../app/auth.md/route.js";
import { GET as robotsGET } from "../app/robots.txt/route.js";
import {
  buildAiCatalog,
  buildApiCatalogLinkset,
  buildAuthMarkdown,
  buildMcpServerCard,
  buildOauthProtectedResource,
  buildRobotsTxt,
} from "../lib/agent-discovery.js";
import { AGENT_SKILLS, agentSkillMarkdown, sha256Hex } from "../lib/agent-skills.js";
import { buildOpenApiDocument } from "../lib/openapi.js";
import { SITE_URL } from "../lib/site.js";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("openapi.json", () => {
  it("is a valid OpenAPI 3.1 document with unique operationIds", async () => {
    const res = openapiGET(new Request("https://app.test/openapi.json"));
    expect(res.status).toBe(200);
    const doc = (await res.json()) as {
      openapi: string;
      paths: Record<string, Record<string, { operationId?: string }>>;
    };
    expect(doc.openapi).toBe("3.1.0");
    const operationIds = Object.values(doc.paths)
      .flatMap((methods) => Object.values(methods))
      .map((op) => op.operationId)
      .filter((id): id is string => typeof id === "string");
    expect(operationIds.length).toBeGreaterThanOrEqual(8);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it("documents every public API route", () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, unknown> };
    for (const path of [
      "/api/availability",
      "/api/score",
      "/api/mcp",
      "/mcp",
      "/health",
      "/api/markdown",
      "/.well-known/mcp",
      "/openapi.json",
    ]) {
      expect(doc.paths[path], path).toBeDefined();
    }
  });

  it("shares the document across /openapi.json and /api/openapi.json", async () => {
    const [a, b] = await Promise.all([
      openapiGET(new Request("https://app.test/openapi.json")).json(),
      apiOpenapiGET(new Request("https://app.test/api/openapi.json")).json(),
    ]);
    expect(b).toEqual(a);
    expect(
      apiOpenapiGET(new Request("https://app.test/api/openapi.json")).headers.get(
        "access-control-allow-origin",
      ),
    ).toBe("*");
  });
});

describe("/.well-known/api-catalog", () => {
  it("serves a valid linkset array as application/linkset+json", async () => {
    const res = apiCatalogGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/linkset+json");
    const body = (await res.json()) as {
      linkset: {
        anchor: string;
        "service-desc": { href: string }[];
        "service-doc": { href: string }[];
        status: { href: string }[];
      }[];
    };
    expect(Array.isArray(body.linkset)).toBe(true);
    const [link] = body.linkset;
    expect(link?.anchor).toBe(`${SITE_URL}/`);
    expect(link?.["service-desc"].map((l) => l.href)).toContain(`${SITE_URL}/openapi.json`);
    expect(link?.["service-doc"].map((l) => l.href)).toContain(`${SITE_URL}/docs`);
    expect(link?.status[0]?.href).toBe(`${SITE_URL}/api/mcp`);
  });
});

describe("/.well-known/mcp/server-card.json", () => {
  it("follows SEP-1649: serverInfo, transport endpoint, capabilities, tools", async () => {
    const res = serverCardGET();
    expect(res.status).toBe(200);
    const card = (await res.json()) as {
      $schema: string;
      protocolVersion: string;
      serverInfo: { name: string; title: string; version: string };
      transport: { type: string; endpoint: string };
      capabilities: { tools?: unknown };
      authentication: { required: boolean };
      tools: string[];
    };
    expect(card.$schema).toContain("modelcontextprotocol");
    expect(card.protocolVersion).toBe("2025-06-18");
    expect(card.serverInfo.name).toBe("naymme");
    expect(card.transport).toEqual({ type: "streamable-http", endpoint: "/api/mcp" });
    expect(card.capabilities.tools).toBeDefined();
    expect(card.authentication.required).toBe(false);
    expect(card.tools).toEqual(["check_availability", "score_name"]);
  });
});

describe("/.well-known/agent-skills", () => {
  it("indexes each skill per RFC v0.2.0 with a verifiable sha256 digest", async () => {
    const res = await agentSkillsIndexGET();
    expect(res.status).toBe(200);
    const index = (await res.json()) as {
      $schema: string;
      skills: { name: string; type: string; description: string; url: string; digest: string }[];
    };
    expect(index.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
    expect(index.skills.length).toBe(AGENT_SKILLS.length);
    for (const skill of index.skills) {
      expect(skill.name).toMatch(/^[a-z0-9-]{1,64}$/);
      expect(skill.type).toBe("skill-md");
      expect(skill.description.length).toBeGreaterThan(10);
      expect(skill.url).toBe(`${SITE_URL}/.well-known/agent-skills/${skill.name}/SKILL.md`);
      expect(skill.digest).toBe(`sha256:${sha256(agentSkillMarkdown(skill.name) ?? "")}`);
    }
  });

  it("serves each skill's SKILL.md as text/markdown", async () => {
    for (const skill of AGENT_SKILLS) {
      const res = await skillMdGET(new Request("https://app.test/"), {
        params: Promise.resolve({ name: skill.name }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/markdown");
      expect(await res.text()).toBe(skill.markdown);
    }
  });

  it("404s unknown skills with the structured error envelope", async () => {
    const res = await skillMdGET(new Request("https://app.test/"), {
      params: Promise.resolve({ name: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; hint: string } };
    expect(body.error.code).toBe("not_found");
    expect(body.error.hint).toContain("index.json");
  });

  it("computes sha256 hex digests", async () => {
    expect(await sha256Hex("abc")).toBe(sha256("abc"));
  });
});

describe("/.well-known/ai-catalog.json", () => {
  it("publishes the AI catalog with ACAO * and urn:air identifiers", async () => {
    const res = aiCatalogGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const catalog = (await res.json()) as {
      specVersion: string;
      host: { displayName: string; identifier: string };
      entries: {
        identifier: string;
        displayName: string;
        mediaType: string;
        url: string;
        representativeQueries: string[];
      }[];
    };
    expect(catalog.specVersion).toBeTruthy();
    expect(catalog.host.identifier).toBe("naymme.vercel.app");
    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(/^urn:air:naymme\.vercel\.app:/);
      expect(entry.displayName.length).toBeGreaterThan(0);
      expect(entry.mediaType).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/i);
      expect(entry.url).toMatch(/^https:\/\//);
      expect(entry.representativeQueries.length).toBeGreaterThan(0);
    }
    const identifiers = catalog.entries.map((e) => e.identifier);
    expect(identifiers).toContain("urn:air:naymme.vercel.app:tools:check");
  });
});

describe("/.well-known/oauth-protected-resource", () => {
  it("serves the exact RFC 9728 structure with CORS", async () => {
    const res = oauthResourceGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const doc = (await res.json()) as Record<string, unknown>;
    expect(doc).toEqual({
      resource: SITE_URL,
      authorization_servers: [SITE_URL],
      scopes_supported: ["public:read"],
      bearer_methods_supported: ["header"],
      resource_documentation: `${SITE_URL}/docs`,
    });
  });

  it("serves the identical document at the .json alias", async () => {
    const res = oauthResourceJsonGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual(await oauthResourceGET().json());
  });
});

describe("/robots.txt", () => {
  it("is served as text/plain with the content-signal directives", async () => {
    const res = robotsGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toBe(buildRobotsTxt());
    expect(body).toContain("Content-Signal: ai-train=no, search=yes, ai-input=no");
  });
});

describe("/auth.md", () => {
  it("documents the public unauthenticated tier, limits and headers", async () => {
    const res = authMdGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const body = buildAuthMarkdown();
    expect(await res.text()).toBe(body);
    expect(body).toContain("unauthenticated");
    expect(body).toContain("rate_limited");
    expect(body).toContain("/api/availability");
    expect(body).toContain("User-Agent");
    expect(body).toContain("oauth-protected-resource");
  });
});

describe("DNS-AID documentation", () => {
  const dnsAid = readFileSync(new URL("../DNS-AID.md", import.meta.url), "utf8");
  const zone = readFileSync(new URL("../dns/dnsaid.zone", import.meta.url), "utf8");

  it("documents _index._agents + agent ServiceMode records with required params", () => {
    for (const text of [dnsAid, zone]) {
      expect(text).toContain("_index._agents");
      expect(text).toContain("naymme._agents");
      expect(text).toContain("SVCB");
      expect(text).toContain('alpn="h2"');
      expect(text).toContain('bap="mcp"');
      expect(text).toContain('well-known="mcp/server-card.json"');
      expect(text).toContain("naymme.vercel.app");
    }
    // Skill requirements: HTTPS variant, numeric keyNNNNN guidance, DNSSEC,
    // and the explicit vercel.app zone-control limitation.
    expect(dnsAid).toContain("HTTPS");
    expect(dnsAid).toContain("keyNNNNN");
    expect(dnsAid).toContain("DNSSEC");
    expect(dnsAid).toContain("provider-owned");
  });

  it("documents the auditor's verified DoH query set and scanned-host scoping", () => {
    // The isitagentready auditor probes exactly these names under the
    // scanned hostname — records under a different zone cannot pass.
    for (const text of [dnsAid, zone]) {
      expect(text).toContain("_a2a._agents");
      expect(text).toContain("_mcp._agents");
      expect(text).toContain("TXT");
    }
    expect(dnsAid).toContain("cloudflare-dns.com/dns-query");
    expect(dnsAid).toContain("dns.google/resolve");
    expect(dnsAid).toContain("domainsChecked");
  });
});

describe("shared builders", () => {
  it("anchors the api-catalog linkset at the site origin", () => {
    const linkset = buildApiCatalogLinkset() as { linkset: { anchor: string }[] };
    expect(linkset.linkset[0]?.anchor).toBe(`${SITE_URL}/`);
  });

  it("advertises the real MCP endpoint in the server card", () => {
    const card = buildMcpServerCard() as { transport: { endpoint: string } };
    expect(card.transport.endpoint).toBe("/api/mcp");
  });

  it("keeps ai-catalog entries absolute and on-site", () => {
    const catalog = buildAiCatalog() as { entries: { url: string }[] };
    for (const entry of catalog.entries) {
      expect(entry.url.startsWith(SITE_URL)).toBe(true);
    }
  });

  it("points the oauth stub's documentation at /docs", () => {
    const doc = buildOauthProtectedResource() as { resource_documentation: string };
    expect(doc.resource_documentation).toBe(`${SITE_URL}/docs`);
  });
});
