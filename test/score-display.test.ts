import { describe, expect, it } from "vitest";

import { coverageRatio, verdictTone } from "../lib/score-display.js";
import { verdictFor } from "../src/scoring/brand.js";

describe("verdictFor", () => {
  it("maps score thresholds to verdicts", () => {
    expect(verdictFor(100)).toBe("Uncontested · Prime Real Estate");
    expect(verdictFor(90)).toBe("Uncontested · Prime Real Estate");
    expect(verdictFor(89)).toBe("Strong · Available on Key Platforms");
    expect(verdictFor(75)).toBe("Strong · Available on Key Platforms");
    expect(verdictFor(74, 0)).toBe("Contested · Crown Jewels Taken");
    expect(verdictFor(74, 2)).toBe("Partial · Key Ground Held");
    expect(verdictFor(50, 1)).toBe("Partial · Key Ground Held");
    expect(verdictFor(50, 0)).toBe("Contested · Crown Jewels Taken");
    expect(verdictFor(49, 3)).toBe("Crowded · Heavily Taken");
    expect(verdictFor(0)).toBe("Crowded · Heavily Taken");
  });
});

describe("verdictTone", () => {
  it("maps every verdict to a badge tone", () => {
    expect(verdictTone(verdictFor(95, 4))).toBe("uncontested");
    expect(verdictTone(verdictFor(80, 2))).toBe("strong");
    expect(verdictTone(verdictFor(60, 2))).toBe("partial");
    expect(verdictTone(verdictFor(60, 0, 2))).toBe("pending");
    expect(verdictTone(verdictFor(60, 0))).toBe("contested");
    expect(verdictTone(verdictFor(10))).toBe("crowded");
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
