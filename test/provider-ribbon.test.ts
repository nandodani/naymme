import { describe, expect, it } from "vitest";

import { RIBBON, wrapTrackX } from "../components/provider-ribbon.js";
import { PROVIDER_GROUPS } from "../lib/provider-meta.js";
import { PROVIDER_IDS } from "../src/schemas.js";

const PLATFORM_IDS = PROVIDER_IDS.filter((id) => !id.startsWith("domain:"));

describe("provider ribbon", () => {
  it("contains no domain providers", () => {
    expect(RIBBON.every((e) => !e.id.startsWith("domain:"))).toBe(true);
  });

  it("covers every platform provider, deduplicated by label", () => {
    const families = new Set(
      PROVIDER_GROUPS.flatMap((g) => g.providers)
        .filter((p) => !p.id.startsWith("domain:"))
        .map((p) => p.label.replace(/\s*\(.*\)$/, "")),
    );
    expect(new Set(RIBBON.map((e) => e.label))).toEqual(families);
    // No duplicate entries — one row per label family.
    expect(RIBBON.length).toBe(families.size);
    expect(RIBBON.length).toBeLessThanOrEqual(PLATFORM_IDS.length);
  });

  it("renders GitHub exactly once", () => {
    expect(RIBBON.filter((e) => e.label === "GitHub")).toHaveLength(1);
  });
});

describe("wrapTrackX", () => {
  const W = 1000;

  it("keeps values already in range untouched", () => {
    expect(wrapTrackX(0, W)).toBe(0);
    expect(wrapTrackX(-400, W)).toBe(-400);
    expect(wrapTrackX(-999.5, W)).toBeCloseTo(-999.5);
  });

  it("wraps single-row overshoot in both directions", () => {
    expect(wrapTrackX(-1000, W)).toBe(0);
    expect(wrapTrackX(-1400, W)).toBe(-400);
    expect(wrapTrackX(200, W)).toBe(-800);
  });

  it("survives multi-row overshoot from hard flicks", () => {
    expect(wrapTrackX(-3500, W)).toBe(-500);
    expect(wrapTrackX(2700, W)).toBe(-300);
    expect(wrapTrackX(-10000, W)).toBe(0);
  });

  it("never returns a value outside (-rowWidth, 0]", () => {
    for (const v of [-99999, -5000, -1000, -999, -1, 0, 1, 999, 12345, 1e9]) {
      const wrapped = wrapTrackX(v, W);
      expect(wrapped).toBeGreaterThan(-W);
      expect(wrapped).toBeLessThanOrEqual(0);
    }
  });
});
