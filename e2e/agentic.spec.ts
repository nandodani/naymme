import { expect, test } from "@playwright/test";

/**
 * Agentic-readiness checks against the production build: markdown content
 * negotiation, agent-friendly 404s, machine-readable files and raw SSR
 * content — everything verifiable without a browser render.
 */

const MARKDOWN = { headers: { Accept: "text/markdown" } };
const HTML = { headers: { Accept: "text/html" } };

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

test.describe("markdown content negotiation", () => {
  for (const path of ["/", "/docs", "/about", "/contact", "/privacy", "/credits"]) {
    test(`${path} serves markdown to Accept: text/markdown`, async ({ request }) => {
      const res = await request.get(path, MARKDOWN);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/markdown");
      expect(res.headers()["vary"]).toContain("Accept");
      const body = await res.text();
      expect(body.startsWith("# ")).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(500);
      expect(body).toContain("lmkurname");
    });

    test(`${path} still serves HTML to browsers`, async ({ request }) => {
      const res = await request.get(path, HTML);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/html");
    });
  }
});

test.describe("agent-friendly 404", () => {
  test("unknown path returns markdown 404 for markdown clients", async ({ request }) => {
    const res = await request.get("/no-such-page-xyz", MARKDOWN);
    expect(res.status()).toBe(404);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    const body = await res.text();
    expect(body.length).toBeGreaterThan(20);
    expect(body).toContain("/no-such-page-xyz");
    expect(body).toContain("/llms.txt");
    expect(body).toContain("/sitemap.xml");
  });

  test("unknown path returns HTML 404 for browsers", async ({ request }) => {
    const res = await request.get("/no-such-page-xyz", HTML);
    expect(res.status()).toBe(404);
    expect(res.headers()["content-type"]).toContain("text/html");
  });
});

test.describe("raw SSR content", () => {
  test("homepage HTML carries a h1 and >=500 chars of meaningful text", async ({ request }) => {
    const res = await request.get("/", HTML);
    const html = await res.text();
    expect(html).toContain("<h1");
    const text = visibleText(html);
    // The homepage is intentionally minimal — hero copy, provider ticker
    // and footer chrome only; the long-form prose lives on /docs.
    expect(text.length).toBeGreaterThanOrEqual(500);
  });

  test("/docs HTML carries the explainer prose at >5% text ratio", async ({ request }) => {
    const res = await request.get("/docs", HTML);
    const html = await res.text();
    expect(html).toContain("<h1");
    const text = visibleText(html);
    expect(text.length).toBeGreaterThanOrEqual(500);
    expect(text.length / html.length).toBeGreaterThan(0.05);
  });
});

test.describe("machine-readable files", () => {
  for (const [path, type] of [
    ["/llms.txt", "text/markdown"],
    ["/llms-full.txt", "text/markdown"],
    ["/robots.txt", "text/plain"],
    ["/sitemap.xml", "xml"],
    ["/manifest.webmanifest", "manifest"],
    ["/.well-known/mcp", "application/json"],
  ] as const) {
    test(`${path} is served`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain(type);
    });
  }

  test("llms.txt has 'When to use' guidance and exact MCP instructions", async ({ request }) => {
    const body = await (await request.get("/llms.txt")).text();
    expect(body).toContain("When to use");
    expect(body).toContain("check_availability");
    expect(body).toContain("/api/mcp");
    expect(body).toContain("/llms-full.txt");
  });

  test(".well-known/mcp lists the tools and streamable-http transport", async ({ request }) => {
    const res = await request.get("/.well-known/mcp");
    const body = await res.json();
    expect(body.name).toBe("lmkurname");
    expect(JSON.stringify(body)).toContain("streamable-http");
    expect(body.tools.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(["check_availability", "score_name"]),
    );
  });

  test(".well-known/mcp performs a live MCP initialize handshake", async ({ request }) => {
    const res = await request.post("/.well-known/mcp", {
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "e2e", version: "0" },
        },
      },
    });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("lmkurname");
  });
});

test.describe("agent discovery endpoints", () => {
  test("homepage advertises discovery links via Link headers", async ({ request }) => {
    const res = await request.get("/");
    const link = res.headers()["link"] ?? "";
    for (const rel of ["api-catalog", "service-desc", "service-doc"]) {
      expect(link).toContain(`rel="${rel}"`);
    }
    for (const href of [
      "</.well-known/api-catalog>",
      "</.well-known/mcp/server-card.json>",
      "</openapi.json>",
      "</docs>",
    ]) {
      expect(link).toContain(href);
    }
  });

  test("/openapi.json and /api/openapi.json serve the same OpenAPI 3.1 document", async ({
    request,
  }) => {
    const [a, b] = await Promise.all([
      request.get("/openapi.json"),
      request.get("/api/openapi.json"),
    ]);
    expect(a.status()).toBe(200);
    expect(b.status()).toBe(200);
    const docA = await a.json();
    expect(docA.openapi).toBe("3.1.0");
    expect(await b.json()).toEqual(docA);
    for (const path of ["/api/availability", "/api/score", "/api/mcp", "/api/markdown"]) {
      expect(docA.paths[path], path).toBeDefined();
    }
  });

  test("/.well-known/api-catalog is a linkset+json document", async ({ request }) => {
    const res = await request.get("/.well-known/api-catalog");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/linkset+json");
    const body = await res.json();
    expect(Array.isArray(body.linkset)).toBe(true);
    expect(body.linkset[0]["service-desc"].map((l: { href: string }) => l.href)).toContain(
      "https://name-check-mcp.vercel.app/openapi.json",
    );
  });

  test("/.well-known/mcp/server-card.json follows SEP-1649", async ({ request }) => {
    const res = await request.get("/.well-known/mcp/server-card.json");
    expect(res.status()).toBe(200);
    const card = await res.json();
    expect(card.serverInfo.name).toBe("lmkurname");
    expect(card.transport).toEqual({ type: "streamable-http", endpoint: "/api/mcp" });
    expect(card.tools).toEqual(["check_availability", "score_name"]);
    expect(card.authentication.required).toBe(false);
  });

  test("/.well-known/agent-skills/index.json lists skills with sha256 digests", async ({
    request,
  }) => {
    const res = await request.get("/.well-known/agent-skills/index.json");
    expect(res.status()).toBe(200);
    const index = await res.json();
    expect(index.$schema).toContain("agentskills");
    expect(index.skills.length).toBeGreaterThan(0);
    for (const skill of index.skills) {
      expect(skill.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      const doc = await request.get(new URL(skill.url).pathname);
      expect(doc.status()).toBe(200);
      expect(doc.headers()["content-type"]).toContain("text/markdown");
      const crypto = await import("node:crypto");
      expect(skill.digest).toBe(
        `sha256:${crypto
          .createHash("sha256")
          .update(await doc.text(), "utf8")
          .digest("hex")}`,
      );
    }
  });

  test("/.well-known/ai-catalog.json is cross-origin readable", async ({ request }) => {
    const res = await request.get("/.well-known/ai-catalog.json");
    expect(res.status()).toBe(200);
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
    const catalog = await res.json();
    expect(catalog.specVersion).toBeTruthy();
    expect(catalog.entries.length).toBeGreaterThan(0);
    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(/^urn:air:/);
      expect(entry.representativeQueries.length).toBeGreaterThan(0);
    }
  });

  test("/.well-known/oauth-protected-resource documents the public tier", async ({ request }) => {
    const res = await request.get("/.well-known/oauth-protected-resource");
    expect(res.status()).toBe(200);
    const doc = await res.json();
    expect(doc.authorization_servers).toEqual([]);
    expect(doc.resource_documentation).toContain("/auth.md");
  });

  test("/auth.md documents the unauthenticated API and its limits", async ({ request }) => {
    const res = await request.get("/auth.md");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("unauthenticated");
    expect(body).toContain("/api/availability");
    expect(body).toContain("User-Agent");
  });
});

test.describe("structured errors", () => {
  test("unknown path returns {error:{code,message,hint}} for JSON clients", async ({ request }) => {
    const res = await request.get("/no-such-page-xyz", {
      headers: { Accept: "application/json" },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBeTruthy();
    expect(body.error.hint).toBeTruthy();
  });

  test("invalid API requests carry code, message and hint", async ({ request }) => {
    const res = await request.get("/api/availability?name=");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.message).toBeTruthy();
    expect(body.error.hint).toBeTruthy();
  });
});

test.describe("robots.txt content signals", () => {
  test("publishes ai-train, search and ai-input directives", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Content-Signal: ai-train=no, search=yes, ai-input=no");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Sitemap:");
  });
});

test.describe("static pages", () => {
  for (const [path, title] of [
    ["/docs", "Documentation"],
    ["/about", "About"],
    ["/contact", "Contact"],
    ["/privacy", "Privacy"],
    ["/credits", "Credits"],
  ] as const) {
    test(`${path} renders an h1 and meaningful copy`, async ({ request }) => {
      const res = await request.get(path, HTML);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain("<h1");
      expect(visibleText(html).length).toBeGreaterThanOrEqual(500);
      expect(html).toContain(title);
    });
  }
});
