import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Palette guard: page chrome is strictly monochrome (OLED black + zinc +
 * white), while semantic colors stay vibrant — availability statuses,
 * rating tiers, brand accents, and the destructive token.
 *
 * - Files on the semantic allowlist may use colored utilities.
 * - Every other UI source file must stay zinc/white/black only.
 * - In CSS, only --destructive may carry chroma.
 */

const SCAN_DIRS = ["app", "components", "lib"];
const SCAN_EXT = /\.(tsx?|css)$/;

const SEMANTIC_ALLOWLIST = new Set([
  "components/provider-row.tsx", // availability icon + chip tints
  "components/overall-card.tsx", // availability segment fills
  "components/connect-mcp-dialog.tsx", // copy-confirm state
  "components/results-grid.tsx", // error banner
  "components/search-input.tsx", // validation hint
]);

// Color-utility classnames like `text-emerald-400` — zinc/slate/gray/
// white/black/stone are the allowed set everywhere else.
const FORBIDDEN_UTILITY =
  /\b(?:bg|text|border|from|via|to|stroke|fill|ring|shadow|outline|decoration|caret|accent|divide|placeholder|drop-shadow)-(?:emerald|rose|sky|amber|pink|purple|violet|fuchsia|indigo|cyan|teal|lime|orange|red|green|blue|yellow)-\d/;

// (<var>): oklch(<lightness> <chroma> …) — capture var name + chroma.
const OKLCH_VAR = /(--[\w-]+):\s*oklch\(\s*[\d.]+%?\s+([\d.]+)/g;
const MAX_NEUTRAL_CHROMA = 0.03;
const CHROMATIC_VARS = new Set(["--destructive"]);

const FORBIDDEN_WORDS = [/watermelon/i];

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collect(path));
    } else if (SCAN_EXT.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => collect(d));

describe("monochrome chrome + semantic colors", () => {
  it("scans UI source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("keeps chrome files free of colored utilities", () => {
    for (const file of files) {
      if (SEMANTIC_ALLOWLIST.has(file)) continue;
      const src = readFileSync(file, "utf8");
      expect(src, `${file} uses a colored utility outside semantic allowlist`).not.toMatch(
        FORBIDDEN_UTILITY,
      );
    }
  });

  it("keeps CSS tokens chroma-free except --destructive", () => {
    for (const file of files) {
      if (!file.endsWith(".css")) continue;
      const src = readFileSync(file, "utf8");
      for (const match of src.matchAll(OKLCH_VAR)) {
        const [, varName, chromaStr] = match;
        if (varName !== undefined && CHROMATIC_VARS.has(varName)) continue;
        const chroma = Number.parseFloat(chromaStr ?? "0");
        expect(
          chroma,
          `${file}: ${varName} has chromatic oklch (chroma ${chroma})`,
        ).toBeLessThanOrEqual(MAX_NEUTRAL_CHROMA);
      }
    }
  });

  it("carries no legacy palette references", () => {
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const word of FORBIDDEN_WORDS) {
        expect(src, `${file} references ${word}`).not.toMatch(word);
      }
    }
  });
});
