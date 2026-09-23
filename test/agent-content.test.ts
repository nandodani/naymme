import { describe, expect, it } from "vitest";

import { negotiateAgentRequest } from "../lib/agent-negotiation.js";
import { notFoundMarkdown, pageContentToMarkdown } from "../lib/markdown.js";
import { MARKDOWN_PAGE_PATHS, PAGE_CONTENTS } from "../lib/page-content.js";
import { SITE_URL } from "../lib/site.js";

describe("page content catalog", () => {
  it("covers the homepage and the static pages", () => {
    expect([...MARKDOWN_PAGE_PATHS]).toEqual([
      "/",
      "/docs",
      "/about",
      "/contact",
      "/privacy",
      "/credits",
    ]);
    for (const path of MARKDOWN_PAGE_PATHS) {
      expect(PAGE_CONTENTS[path], path).toBeDefined();
    }
  });

  it.each([...MARKDOWN_PAGE_PATHS])("%s renders >=500 chars of markdown", (path) => {
    const page = PAGE_CONTENTS[path];
    expect(page).toBeDefined();
    const md = pageContentToMarkdown(page!);
    expect(md.length).toBeGreaterThanOrEqual(500);
    expect(md.startsWith("# ")).toBe(true);
  });

  it("every page copy mentions the product name", () => {
    for (const page of Object.values(PAGE_CONTENTS)) {
      expect(pageContentToMarkdown(page)).toContain("naymme");
    }
  });
});

describe("agent 404 markdown", () => {
  it("explains the error and links docs, sitemap and llms.txt", () => {
    const md = notFoundMarkdown("/does-not-exist");
    expect(md.length).toBeGreaterThan(20);
    expect(md).toContain("404");
    expect(md).toContain("/does-not-exist");
    expect(md).toContain(`${SITE_URL}/llms.txt`);
    expect(md).toContain(`${SITE_URL}/sitemap.xml`);
    expect(md).toContain("docs");
  });
});

describe("markdown content negotiation", () => {
  it("rewrites markdown-capable pages for Accept: text/markdown", () => {
    for (const path of ["/", "/about", "/contact", "/privacy"]) {
      expect(negotiateAgentRequest(path, "text/markdown")).toEqual({ kind: "markdown", path });
    }
  });

  it("serves the markdown 404 to markdown clients on unknown paths", () => {
    expect(negotiateAgentRequest("/no-such-page", "text/markdown")).toEqual({
      kind: "not-found-markdown",
      path: "/no-such-page",
    });
  });

  it("passes through HTML and headerless requests", () => {
    expect(negotiateAgentRequest("/", "text/html")).toEqual({ kind: "passthrough" });
    expect(negotiateAgentRequest("/about", "text/html,application/xhtml+xml")).toEqual({
      kind: "passthrough",
    });
    expect(negotiateAgentRequest("/nope", "text/html")).toEqual({ kind: "passthrough" });
    expect(negotiateAgentRequest("/", null)).toEqual({ kind: "passthrough" });
  });

  it("answers JSON clients a structured 404 on unknown paths", () => {
    expect(negotiateAgentRequest("/no-such-page", "application/json")).toEqual({
      kind: "not-found-json",
      path: "/no-such-page",
    });
    expect(negotiateAgentRequest("/docs", "application/json")).toEqual({ kind: "passthrough" });
  });

  it("prefers markdown when a client accepts both markdown and JSON", () => {
    expect(negotiateAgentRequest("/nope", "text/markdown, application/json")).toEqual({
      kind: "not-found-markdown",
      path: "/nope",
    });
  });

  it("honours markdown mixed into a longer Accept list", () => {
    expect(negotiateAgentRequest("/", "text/html, application/json, text/markdown")).toEqual({
      kind: "markdown",
      path: "/",
    });
  });
});
