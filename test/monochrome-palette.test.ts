import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Palette guard: the UI is strictly monochrome (OLED black + zinc + white).
 * Any Tailwind color-utility or stray chromatic oklch/hsl reappearing in
 * app/components/lib source fails this test.
 */

const SCAN_DIRS = ["app", "components", "lib"];
const SCAN_EXT = /\.(tsx?|css)$/;

// Color-utility classnames like `text-emerald-400`, `bg-rose-500`,
// `border-sky-300` — zinc/slate/gray/white/black/stone are the allowed set.
const FORBIDDEN_UTILITY =
  /\b(?:bg|text|border|from|via|to|stroke|fill|ring|shadow|outline|decoration|caret|accent|divide|placeholder|drop-shadow)-(?:emerald|rose|sky|amber|pink|purple|violet|fuchsia|indigo|cyan|teal|lime|orange|red|green|blue|yellow)-\d/;

// oklch(<lightness> <chroma> …) — capture chroma; neutrals stay ≤ 0.03.
const OKLCH_CHROMA = /oklch\(\s*[\d.]+%?\s+([\d.]+)/g;
const MAX_CHROMA = 0.03;

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

describe("monochrome palette", () => {
  it("scans UI source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("uses no colored Tailwind utilities", () => {
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} uses a forbidden color utility`).not.toMatch(FORBIDDEN_UTILITY);
    }
  });

  it("keeps oklch tokens chroma-free", () => {
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const match of src.matchAll(OKLCH_CHROMA)) {
        const chroma = Number.parseFloat(match[1] ?? "0");
        expect(chroma, `${file} has chromatic oklch (chroma ${chroma})`).toBeLessThanOrEqual(
          MAX_CHROMA,
        );
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
