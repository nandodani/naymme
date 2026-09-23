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
