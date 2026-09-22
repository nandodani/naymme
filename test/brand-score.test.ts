import { describe, expect, it } from "vitest";

import { PROVIDER_IDS } from "../src/schemas.js";
import { brandScore, linguisticAnalysis, verdictFor } from "../src/scoring/brand.js";
import type { AvailabilityResult, AvailabilityStatus } from "../src/types.js";

function result(provider: string, status: AvailabilityStatus): AvailabilityResult {
  return {
    provider,
    status,
    subject: provider,
    available: status === "available" ? true : status === "unknown" ? null : false,
    durationMs: 1,
  };
}

/** Providers the spec's tier-2 social group names but the registry lacks. */
const EXTRA_SOCIALS = ["social:linkedin", "social:discord", "social:twitch"];
const UNIVERSE = [...PROVIDER_IDS, ...EXTRA_SOCIALS];
const CROWN = [
  "domain:com",
  "github:user",
  "github:org",
  "social:x",
  "npm",
  "social:instagram", // npm/IG slot candidate
];

const allFree = UNIVERSE.map((id) => result(id, "available"));
const allTaken = UNIVERSE.map((id) => result(id, "taken"));

describe("brandScore tiers", () => {
  it("awards full marks when everything is free", () => {
    const b = brandScore("acme", allFree);
    expect(b.crownJewels.free).toBe(4);
    expect(b.baseScore).toBe(100);
    expect(b.score).toBe(100);
    expect(b.verdict).toBe("Uncontested · Prime Real Estate");
  });

  it("awards each crown jewel its fixed points", () => {
    // Only .com free → exactly 15 points of base score.
    const b = brandScore("acme", [
      result("domain:com", "available"),
      ...allTaken.filter((r) => r.provider !== "domain:com"),
    ]);
    expect(b.tiers.crown.earned).toBe(15);
    expect(b.crownJewels.free).toBe(1);
  });

  it("counts GitHub free when either the user or org namespace is open", () => {
    const b = brandScore("acme", [
      result("github:user", "taken"),
      result("github:org", "available"),
    ]);
    expect(b.tiers.crown.earned).toBe(12);
  });

  it("labels the fourth jewel IG when npm was not checked", () => {
    const b = brandScore("acme", [result("social:instagram", "available")]);
    expect(b.crownJewels.slots[3]?.label).toBe("IG");
    expect(b.crownJewels.free).toBe(1);
    expect(b.tiers.crown.earned).toBe(11);
  });

  it("caps the base score at 50 when no crown jewel is free", () => {
    const b = brandScore(
      "acme",
      UNIVERSE.map((id) => result(id, CROWN.includes(id) ? "taken" : "available")),
    );
    expect(b.crownJewels.free).toBe(0);
    expect(b.baseScore).toBeLessThanOrEqual(50);
    expect(b.baseScore).toBe(50); // tiers 2+3 max out at exactly 50
  });

  it("scores zero when everything is taken", () => {
    const b = brandScore("acme", allTaken);
    expect(b.score).toBe(0);
    expect(b.verdict).toBe("Crowded · Heavily Taken");
  });

  it("spreads key-TLD points as 3 each over the five fixed slots", () => {
    const b = brandScore("acme", [result("domain:dev", "available")]);
    expect(b.tiers.core.earned).toBeCloseTo(3);
  });

  it("spreads core-social points across the five fixed slots", () => {
    // Only reddit and bluesky exist in the registry today — each earns 12/5.
    const b = brandScore("acme", [
      result("social:reddit", "available"),
      result("social:bluesky", "available"),
    ]);
    expect(b.tiers.core.earned).toBeCloseTo(24 / 5);
  });

  it("ignores providers outside every tier's universe", () => {
    const b = brandScore("acme", [result("devto", "available")]);
    expect(b.baseScore).toBe(0);
    // …but it still counts toward the raw availability tally the card shows.
    expect(b.availability).toEqual({ free: 1, total: 1 });
  });

  it("keeps instagram out of the long tail — it is a crown jewel candidate", () => {
    const b = brandScore("acme", allFree);
    const slot = b.crownJewels.slots[3];
    expect(slot?.label).toBe("npm"); // npm was checked, so it owns the slot
    expect(b.tiers.longtail.free).toBe(28); // the full long-tail universe
  });

  it("applies the linguistic multiplier to the base score", () => {
    // "acme": clean alpha, 4 chars → 1.10 premium, no phonetic adjustment.
    const b = brandScore("acme", [
      result("domain:com", "available"),
      result("domain:dev", "available"),
    ]);
    expect(b.baseScore).toBe(18); // 15 crown + 3 tld share (15/5)
    expect(b.multiplier).toBe(1.1);
    expect(b.score).toBe(Math.round(18 * 1.1));
  });
});

describe("linguisticAnalysis", () => {
  it("boosts clean alpha names of 3–5 chars by 10%", () => {
    expect(linguisticAnalysis("acme").multiplier).toBe(1.1);
    expect(linguisticAnalysis("abc").multiplier).toBe(1.1);
  });

  it("is neutral for 6–9 chars with ordinary flow", () => {
    expect(linguisticAnalysis("sixteen").multiplier).toBe(1.0);
    expect(linguisticAnalysis("bootcamp").multiplier).toBe(1.0);
  });

  it("penalizes 12+ chars by 10%", () => {
    expect(linguisticAnalysis("bookkeeperish").multiplier).toBeCloseTo(0.9, 5);
  });

  it("penalizes digits and hyphens by 15%", () => {
    expect(linguisticAnalysis("acme-1").multiplier).toBeCloseTo(0.85, 5);
    expect(linguisticAnalysis("acme99").multiplier).toBeCloseTo(0.85, 5);
  });

  it("penalizes hard consonant clusters", () => {
    // "bktlps": no vowels at all → consonant run 6 → -0.10 on top of 1.0.
    expect(linguisticAnalysis("bktlps").multiplier).toBeCloseTo(0.9, 5);
  });

  it("rewards high vowel/consonant alternation", () => {
    // "paloma": every adjacent pair alternates → +0.05 on the 1.0 base.
    expect(linguisticAnalysis("paloma").multiplier).toBeCloseTo(1.05, 5);
    // Short + high flow reaches the premium band.
    expect(linguisticAnalysis("lilo").multiplier).toBeCloseTo(1.15, 5);
  });

  it("clamps the multiplier to [0.80, 1.15]", () => {
    for (const name of ["a", "x-y-z-1", "qqqqqqqqqqqqqqqqqqqq", "paloma"]) {
      const { multiplier } = linguisticAnalysis(name);
      expect(multiplier).toBeGreaterThanOrEqual(0.8);
      expect(multiplier).toBeLessThanOrEqual(1.15);
    }
  });

  it("produces a concise trait string", () => {
    expect(linguisticAnalysis("paloma").trait).toContain("6-letter");
    expect(linguisticAnalysis("paloma").trait).toContain("High flow");
    expect(linguisticAnalysis("acme-1").trait).toContain("charset penalty");
  });
});

describe("score boundaries", () => {
  it("never exceeds 100 and never dips below 0", () => {
    expect(brandScore("paloma", allFree).score).toBeLessThanOrEqual(100);
    expect(brandScore("x-y-z-1", allTaken).score).toBe(0);
  });

  it("stays deterministic for the same inputs", () => {
    expect(brandScore("acme", allFree)).toEqual(brandScore("acme", allFree));
  });
});

describe("verdictFor", () => {
  it("matches the documented verdict bands", () => {
    expect(verdictFor(95)).toBe("Uncontested · Prime Real Estate");
    expect(verdictFor(80)).toBe("Strong · Available on Key Platforms");
    expect(verdictFor(60)).toBe("Contested · Crown Jewels Taken");
    expect(verdictFor(30)).toBe("Crowded · Heavily Taken");
  });
});
