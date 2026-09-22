import { describe, expect, it } from "vitest";

import { coverageRatio, ratingTier, syllableBand } from "../lib/score-display.js";
import { scoreName } from "../src/scoring/score.js";

describe("ratingTier", () => {
  it("maps thresholds to quality ratings", () => {
    expect(ratingTier(100)).toBe("Excellent");
    expect(ratingTier(90)).toBe("Excellent");
    expect(ratingTier(89)).toBe("Strong");
    expect(ratingTier(75)).toBe("Strong");
    expect(ratingTier(74)).toBe("Fair");
    expect(ratingTier(55)).toBe("Fair");
    expect(ratingTier(54)).toBe("Contested");
    expect(ratingTier(0)).toBe("Contested");
  });
});

describe("syllableBand", () => {
  it("labels peak syllable counts Optimal", () => {
    expect(syllableBand(scoreName("devto").syllables)).toBe("Optimal"); // 2 syllables → 15/15
    expect(syllableBand(scoreName("devtool").syllables)).toBe("Optimal"); // 3 syllables → 14/15
  });

  it("degrades gracefully off the peak", () => {
    expect(syllableBand(scoreName("sync").syllables)).toBe("Fair"); // 1 syllable → 8/15
    expect(syllableBand(scoreName("abacadabara").syllables)).toBe("Low"); // 6 syllables → 2/15
  });
});

describe("coverageRatio", () => {
  it("clamps the free/total fraction to 0–1", () => {
    expect(coverageRatio(7, 25)).toBeCloseTo(0.28);
    expect(coverageRatio(0, 25)).toBe(0);
    expect(coverageRatio(25, 25)).toBe(1);
    expect(coverageRatio(30, 25)).toBe(1);
    expect(coverageRatio(5, 0)).toBe(0);
  });
});
