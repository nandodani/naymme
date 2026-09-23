import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { metadata as layoutMetadata, viewport } from "../app/layout.js";
import manifest from "../app/manifest.js";
import robots from "../app/robots.js";
import sitemap from "../app/sitemap.js";
import { jsonLdGraph } from "../lib/json-ld.js";
import { OG_CARD_ALT, OgCard, OG_IMAGE_SIZE } from "../lib/og-card.js";
import { SITE_NAME, SITE_URL } from "../lib/site.js";

describe("layout metadata", () => {
  it("resolves url-based fields against the canonical origin", () => {
    expect(layoutMetadata.metadataBase?.toString()).toBe(`${SITE_URL}/`);
  });

  it("defines a title default and template", () => {
    expect(layoutMetadata.title).toMatchObject({
      default: expect.stringContaining(SITE_NAME) as string,
      template: expect.stringContaining("%s") as string,
    });
  });

  it("describes the app for snippets and keywords", () => {
    expect(layoutMetadata.description).toContain("availability");
    expect(layoutMetadata.keywords).toEqual(
      expect.arrayContaining([expect.stringContaining("availability")]),
    );
  });

  it("canonicalizes the root URL", () => {
    expect(layoutMetadata.alternates?.canonical).toBe("/");
  });

  it("emits Open Graph and Twitter card fields", () => {
    expect(layoutMetadata.openGraph).toMatchObject({
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
    });
    expect(layoutMetadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("allows indexing", () => {
    expect(layoutMetadata.robots).toMatchObject({ index: true, follow: true });
  });

  it("declares a dark color scheme and black theme color", () => {
    expect(viewport.themeColor).toBe("#000000");
    expect(viewport.colorScheme).toBe("dark");
  });
});

describe("robots.txt", () => {
  it("allows crawlers, excludes API routes and points at the sitemap", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    expect(rules).toContainEqual(
      expect.objectContaining({ userAgent: "*", allow: "/", disallow: "/api/" }),
    );
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(r.host).toBe(SITE_URL);
  });
});

describe("sitemap.xml", () => {
  it("lists the canonical root and /credits with change frequency and priority", () => {
    const [entry, credits, ...rest] = sitemap();
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    });
    expect(entry?.lastModified).toBeTruthy();
    expect(credits).toMatchObject({
      url: `${SITE_URL}/credits`,
      changeFrequency: "monthly",
      priority: 0.3,
    });
    expect(credits?.lastModified).toBeTruthy();
  });
});

describe("manifest", () => {
  it("describes the installable app with the OLED theme", () => {
    const m = manifest();
    expect(m.name).toContain(SITE_NAME);
    expect(m.short_name).toBe(SITE_NAME);
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toBe("#000000");
    expect(m.theme_color).toBe("#000000");
    expect(m.icons?.length).toBeGreaterThan(0);
  });
});

describe("JSON-LD", () => {
  it("emits a WebSite + WebApplication graph on the canonical origin", () => {
    const ld = jsonLdGraph();
    const json = JSON.stringify(ld);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).toContain("WebSite");
    expect(json).toContain("WebApplication");
    expect(json).toContain(SITE_URL);
    expect(json).toContain("check_availability");
  });
});

describe("og card", () => {
  it("renders the wordmark and summary copy", () => {
    const markup = renderToStaticMarkup(createElement(OgCard));
    expect(markup).toContain("lmkurname");
    expect(markup).toContain("availability");
  });

  it("uses the standard social card size and honest alt text", () => {
    expect(OG_IMAGE_SIZE).toEqual({ width: 1200, height: 630 });
    expect(OG_CARD_ALT.length).toBeGreaterThan(10);
    expect(OG_CARD_ALT).toContain(SITE_NAME);
  });
});
