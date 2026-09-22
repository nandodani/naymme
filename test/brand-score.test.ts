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
    // Only .com free → exactly 18 points of base score.
    const b = brandScore("acme", [
      result("domain:com", "available"),
      ...allTaken.filter((r) => r.provider !== "domain:com"),
    ]);
    expect(b.tiers.crown.earned).toBe(18);
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
    expect(b.tiers.crown.earned).toBe(10);
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

  it("spreads key-TLD points as 3 each over the five checked slots", () => {
    const b = brandScore("acme", [
      result("domain:dev", "available"),
      result("domain:io", "taken"),
      result("domain:ai", "taken"),
      result("domain:co", "taken"),
      result("domain:app", "taken"),
    ]);
    expect(b.tiers.core.earned).toBeCloseTo(3);
  });

  it("spreads core-social points across the checked slots", () => {
    // LinkedIn/Discord/Twitch were never checked — the 12 points split
    // across the two slots that were, so phantom providers can't cap it.
    const b = brandScore("acme", [
      result("social:reddit", "available"),
      result("social:bluesky", "available"),
    ]);
    expect(b.tiers.core.earned).toBe(12);
  });

  it("folds unknown secondaries into the long tail", () => {
    // "devto" is no registered provider — a Dev.to-style secondary, so it
    // lands in tier 3 instead of being silently ignored.
    const b = brandScore("acme", [result("devto", "available")]);
    expect(b.tiers.longtail).toMatchObject({ free: 1, checked: 1, slots: 1 });
    expect(b.baseScore).toBe(15);
    // …and it still counts toward the raw availability tally the card shows.
    expect(b.availability).toEqual({ free: 1, settled: 1, pending: 0, total: 1 });
  });

  it("keeps instagram out of the long tail — it is a crown jewel candidate", () => {
    const b = brandScore("acme", allFree);
    const slot = b.crownJewels.slots[3];
    expect(slot?.label).toBe("npm"); // npm was checked, so it owns the slot
    expect(b.tiers.longtail.free).toBe(28); // the full long-tail universe
  });

  it("credits .com properly when two crown jewels and most of the web are free", () => {
    // 31 of 54 checked slots free, crown jewels .com + npm free: the old
    // blend sat at ~53, which read as "Contested · Crown Jewels Taken"
    // despite two jewels held — an unfair, contradictory verdict.
    const free = new Set([
      "domain:com",
      "npm",
      "domain:dev",
      "domain:io",
      "domain:ai",
      "domain:co",
      "social:reddit",
      "social:bluesky",
      "social:discord",
      "pypi",
      "crates",
      "dockerhub",
      "gitlab",
      "nuget",
    ]);
    // 17 long-tail frees to reach 31 free total (excludes every tier-1/2 id).
    const tier2 = new Set([
      "domain:dev",
      "domain:io",
      "domain:ai",
      "domain:co",
      "domain:app",
      "social:linkedin",
      "social:reddit",
      "social:bluesky",
      "social:discord",
      "social:twitch",
      "gitlab",
      "pypi",
      "crates",
      "dockerhub",
      "huggingface",
      "nuget",
      "rubygems",
      "homebrew",
      "codepen",
      "replit",
    ]);
    const tail = UNIVERSE.filter(
      (id) => !free.has(id) && !CROWN.includes(id) && !tier2.has(id),
    ).slice(0, 17);
    for (const id of tail) free.add(id);
    const results = UNIVERSE.map((id) => result(id, free.has(id) ? "available" : "taken"));
    const b = brandScore("acme", results);
    expect(b.crownJewels.free).toBe(2);
    expect(b.availability).toEqual({ free: 31, settled: 54, pending: 0, total: 54 });
    expect(b.score).toBeGreaterThan(53);
    expect(b.score).toBeLessThan(75);
    expect(b.verdict).toBe("Partial · Key Ground Held");
  });

  it("applies the linguistic multiplier to the base score", () => {
    // "acme": clean alpha, 4 chars → 1.10 premium, no phonetic adjustment.
    const b = brandScore("acme", [
      result("domain:com", "available"),
      result("domain:dev", "available"),
    ]);
    expect(b.baseScore).toBe(33); // 18 crown + 15 tld share (dev is the only TLD checked)
    expect(b.multiplier).toBe(1.1);
    expect(b.score).toBe(Math.round(33 * 1.1));
  });

  it("never lets pending checks read as taken", () => {
    // .com unresolved (unknown status) — must not count as taken: no
    // 'Crown Jewels Taken' verdict and no 50-cap logic fires.
    const b = brandScore(
      "acme",
      UNIVERSE.map((id) =>
        result(id, id === "domain:com" ? "unknown" : CROWN.includes(id) ? "taken" : "available"),
      ),
    );
    expect(b.crownJewels.free).toBe(0);
    expect(b.crownJewels.pending).toBe(1);
    expect(b.crownJewels.slots[0]?.pending).toBe(true);
    expect(b.availability).toMatchObject({ free: 48, settled: 53, pending: 1, total: 54 });
    expect(b.verdict).toBe("Pending · Jewels Unresolved");
  });

  it("keeps unknown slots out of a group's share denominator", () => {
    // reddit free + bluesky unknown: the 12 social points split over the
    // one settled slot — pending can't cost points.
    const b = brandScore("acme", [
      result("social:reddit", "available"),
      result("social:bluesky", "unknown"),
    ]);
    expect(b.tiers.core.earned).toBe(12);
    expect(b.availability).toEqual({ free: 1, settled: 1, pending: 1, total: 2 });
  });

  it("counts expected-but-missing providers as pending, never missing", () => {
    const b = brandScore(
      "acme",
      [result("domain:com", "available")],
      ["domain:com", "domain:dev", "domain:io"],
    );
    expect(b.availability).toEqual({ free: 1, settled: 1, pending: 2, total: 3 });
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
    // Regression: the trait must reflect the real letter count.
    expect(linguisticAnalysis("nandodani").trait).toContain("9-letter");
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
    expect(verdictFor(95, 4)).toBe("Uncontested · Prime Real Estate");
    expect(verdictFor(80, 3)).toBe("Strong · Available on Key Platforms");
    expect(verdictFor(60, 0)).toBe("Contested · Crown Jewels Taken");
    expect(verdictFor(30, 1)).toBe("Crowded · Heavily Taken");
  });

  it("only claims Crown Jewels Taken when literally none are free", () => {
    expect(verdictFor(74, 0)).toBe("Contested · Crown Jewels Taken");
    for (const held of [1, 2, 3, 4]) {
      expect(verdictFor(74, held)).toBe("Partial · Key Ground Held");
      expect(verdictFor(50, held)).toBe("Partial · Key Ground Held");
    }
    expect(verdictFor(50, 0)).toBe("Contested · Crown Jewels Taken");
  });

  it("reads as pending, not taken, when no jewel is free but some are open", () => {
    expect(verdictFor(60, 0, 1)).toBe("Pending · Jewels Unresolved");
    expect(verdictFor(60, 0, 0)).toBe("Contested · Crown Jewels Taken");
    expect(verdictFor(74, 0, 3)).toBe("Pending · Jewels Unresolved");
  });
});
