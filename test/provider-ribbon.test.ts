import { describe, expect, it } from "vitest";

import { RIBBON } from "../components/provider-ribbon.js";
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
