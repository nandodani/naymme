import { describe, expect, it } from "vitest";
import {
  cleanlinessScore,
  estimateSyllables,
  gradeFor,
  punchinessScore,
  scoreName,
} from "../src/scoring/score.js";

describe("estimateSyllables", () => {
  it("counts vowel-letter groups (y counts as a vowel)", () => {
    expect(estimateSyllables("linear")).toBe(2); // i, ea — adjacent vowels merge
    expect(estimateSyllables("facebook")).toBe(3); // a, e, oo
    expect(estimateSyllables("stripe")).toBe(2); // i, e
    expect(estimateSyllables("go")).toBe(1);
  });

  it("treats consonant-only names as one syllable", () => {
    expect(estimateSyllables("sync")).toBe(1); // y is a vowel here
    expect(estimateSyllables("qzxk")).toBe(1); // no vowels at all → clamped to 1
  });
});

describe("punchinessScore", () => {
  it("peaks at 5–8 characters and decays on both sides", () => {
    expect(punchinessScore(6).value).toBe(25);
    expect(punchinessScore(4).value).toBe(18);
    expect(punchinessScore(10).value).toBe(17);
    expect(punchinessScore(1).value).toBe(5);
    expect(punchinessScore(20).value).toBe(3);
  });
});

describe("scoreName", () => {
  it("is deterministic", () => {
    expect(scoreName("zephyr")).toEqual(scoreName("zephyr"));
    expect(scoreName("Linear").total).toBe(scoreName("linear").total);
  });

  it("scores a strong common-shaped name high", () => {
    const s = scoreName("linear");
    expect(s).toMatchObject({
      normalized: "linear",
      punchiness: { value: 25 },
      syllables: { count: 2, value: 15 }, // i + ea → 2 groups, peak range
      pronounceability: { value: 25 }, // all bigrams familiar, balanced vowels
      uniqueness: { value: 17 }, // uncommon but no distinctive letters
      cleanliness: { value: 15 },
      total: 97,
      grade: "Excellent",
    });
  });

  it("penalizes digits, hyphens and consonant clusters", () => {
    const s = scoreName("qw3rty-x");
    expect(s.punchiness.value).toBe(25); // length 8
    expect(s.syllables).toMatchObject({ count: 1, value: 8 });
    expect(s.pronounceability.value).toBe(12); // vowel-ratio -4; '3' breaks the consonant run
    expect(s.uniqueness.value).toBe(16); // not alpha-only, but uncommon + distinctive
    expect(s.cleanliness.value).toBe(5); // digits and hyphen
    expect(s.total).toBe(66);
    expect(s.grade).toBe("Fair");
  });

  it("penalizes over-used words on uniqueness", () => {
    const s = scoreName("zen");
    expect(s.uniqueness.value).toBeLessThan(scoreName("zqn").uniqueness.value);
  });

  it("keeps total in [0, 100] and equal to the component sum", () => {
    for (const name of ["a", "stripe", "facebook", "xx--99__qq", "thequickbrownfoxjumps"]) {
      const s = scoreName(name);
      const sum =
        s.punchiness.value +
        s.syllables.value +
        s.pronounceability.value +
        s.uniqueness.value +
        s.cleanliness.value;
      expect(s.total).toBe(sum);
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(100);
    }
  });

  it("grades on documented thresholds", () => {
    expect(gradeFor(85)).toBe("Excellent");
    expect(gradeFor(70)).toBe("Strong");
    expect(gradeFor(55)).toBe("Fair");
    expect(gradeFor(40)).toBe("Weak");
    expect(gradeFor(39)).toBe("Poor");
  });
});

describe("cleanlinessScore", () => {
  it("rewards clean lowercase letters", () => {
    expect(cleanlinessScore("acme").value).toBe(15);
  });

  it("stacks penalties", () => {
    expect(cleanlinessScore("a-c1").value).toBe(5); // -5 hyphen, -5 digits
    expect(cleanlinessScore("aaa").value).toBe(11); // -4 repeat run
    expect(cleanlinessScore("a_c.d").value).toBe(11); // -4 separators
  });
});
