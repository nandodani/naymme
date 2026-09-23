import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

import CreditsPage from "../app/credits/page.js";
import { CREDIT_GROUPS } from "../lib/credits.js";

/** renderToStaticMarkup — presentational check, no DOM required. */
const html = (node: ReactNode) => renderToStaticMarkup(node);
const markup = html(createElement(CreditsPage));

describe("credits data", () => {
  it("every entry has a name, https URL, license, and usage line", () => {
    for (const group of CREDIT_GROUPS) {
      for (const entry of group.entries) {
        expect(entry.name, `${group.id} entry missing name`).toBeTruthy();
        expect(entry.href, `${entry.name} missing href`).toMatch(/^https:\/\//);
        expect(entry.license, `${entry.name} missing license`).toBeTruthy();
        expect(entry.usedFor, `${entry.name} missing usedFor`).toBeTruthy();
      }
    }
  });
});

describe("CreditsPage", () => {
  it("renders a single h1 and the main landmark", () => {
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain('id="main-content"');
  });

  it("renders every group and every credited project", () => {
    for (const group of CREDIT_GROUPS) {
      expect(markup, `missing group ${group.title}`).toContain(
        group.title.replaceAll("&", "&amp;"),
      );
      for (const entry of group.entries) {
        expect(markup, `missing credit ${entry.name}`).toContain(
          entry.name.replaceAll("&", "&amp;"),
        );
        expect(markup, `missing link for ${entry.name}`).toContain(`href="${entry.href}"`);
        expect(markup, `missing license for ${entry.name}`).toContain(entry.license);
      }
    }
  });

  it("covers the named third-party assets", () => {
    for (const name of ["loading.dev", "Silk", "React Bits", "Base UI", "Lucide", "Geist"]) {
      expect(markup, `missing ${name}`).toContain(name);
    }
  });

  it("external links open safely in a new tab with an accessible note", () => {
    const total = markup.match(/<a [^>]*target="_blank"/g)?.length ?? 0;
    const safe = markup.match(/<a [^>]*rel="noopener noreferrer"/g)?.length ?? 0;
    expect(total).toBeGreaterThan(0);
    expect(safe).toBe(total);
    expect(markup).toContain("opens in a new tab");
  });

  it("keeps the skip link first and points back to the app", () => {
    expect(markup.indexOf('href="#main-content"')).toBeLessThan(markup.indexOf("<h1"));
    expect(markup).toContain('href="/"');
  });
});
