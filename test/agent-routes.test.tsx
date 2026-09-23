import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { GET as markdownGET } from "../app/api/markdown/route.js";
import {
  GET as wellKnownGET,
  OPTIONS as wellKnownOPTIONS,
  POST as wellKnownPOST,
} from "../app/.well-known/mcp/route.js";
import { GET as llmsGET } from "../app/llms.txt/route.js";
import { GET as llmsFullGET } from "../app/llms-full.txt/route.js";
import NotFound from "../app/not-found.js";
import DocsPage from "../app/docs/page.js";
import AboutPage from "../app/about/page.js";
import ContactPage from "../app/contact/page.js";
import PrivacyPage from "../app/privacy/page.js";
import sitemap from "../app/sitemap.js";
import { SITE_URL } from "../lib/site.js";

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

describe("GET /api/markdown", () => {
  it("serves the homepage as markdown with Vary: Accept", async () => {
    const res = markdownGET(new Request("https://app.test/api/markdown?path=/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(res.headers.get("vary")).toContain("Accept");
    const body = await res.text();
    expect(body.startsWith("# ")).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(500);
    expect(body).toContain("lmkurname");
  });

  it.each(["/docs", "/about", "/contact", "/privacy"])("serves %s as markdown", async (path) => {
    const res = markdownGET(new Request(`https://app.test/api/markdown?path=${path}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const body = await res.text();
    expect(body.length).toBeGreaterThanOrEqual(500);
    expect(body).toContain("lmkurname");
  });

  it("returns a markdown 404 for unknown paths", async () => {
    const res = markdownGET(new Request("https://app.test/api/markdown?path=/missing"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const body = await res.text();
    expect(body.length).toBeGreaterThan(20);
    expect(body).toContain("/llms.txt");
    expect(body).toContain("/sitemap.xml");
  });

  it("returns a markdown 404 when path is absent", async () => {
    const res = markdownGET(new Request("https://app.test/api/markdown"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/markdown");
  });
});

describe("GET /.well-known/mcp", () => {
  it("exposes the MCP discovery document", async () => {
    const res = wellKnownGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.name).toBe("lmkurname");
    expect(body.tools.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(["check_availability", "score_name"]),
    );
    expect(JSON.stringify(body)).toContain("streamable-http");
    expect(JSON.stringify(body)).toContain("/api/mcp");
  });

  it("POST performs a live MCP initialize handshake", async () => {
    const res = await wellKnownPOST(
      new Request("https://app.test/.well-known/mcp", {
        method: "POST",
        headers: MCP_HEADERS,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "0" },
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("lmkurname");
  });

  it("OPTIONS answers the CORS preflight", () => {
    const res = wellKnownOPTIONS();
    expect(res.status).toBe(204);
  });
});

describe("llms.txt files", () => {
  it("llms.txt is markdown with usage guidance and links", async () => {
    const res = llmsGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("# lmkurname");
    expect(body).toContain("When to use");
    expect(body).toContain("check_availability");
    expect(body).toContain("/api/mcp");
    expect(body).toContain("/about");
    expect(body).toContain("/llms-full.txt");
  });

  it("llms-full.txt carries the full agent instructions", async () => {
    const res = llmsFullGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("check_availability");
    expect(body).toContain("score_name");
    expect(body).toContain("/api/availability");
    expect(body).toContain("/api/score");
    expect(body.length).toBeGreaterThan(2000);
  });
});

describe("static pages", () => {
  it.each([
    ["Docs", DocsPage],
    ["About", AboutPage],
    ["Contact", ContactPage],
    ["Privacy", PrivacyPage],
  ])("%s renders an h1 with >=500 chars of copy", (_label, Page) => {
    const markup = renderToStaticMarkup(createElement(Page));
    expect(markup).toContain("<h1");
    expect(markup).toContain("lmkurname");
    const text = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text.length).toBeGreaterThanOrEqual(500);
  });
});

describe("not-found page", () => {
  it("renders a styled 404 with recovery links", () => {
    const markup = renderToStaticMarkup(createElement(NotFound));
    expect(markup).toContain("404");
    expect(markup).toContain('href="/"');
    expect(markup).toContain("llms.txt");
  });
});

describe("sitemap", () => {
  it("lists the homepage plus the static pages", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        SITE_URL,
        `${SITE_URL}/about`,
        `${SITE_URL}/contact`,
        `${SITE_URL}/privacy`,
      ]),
    );
  });
});
