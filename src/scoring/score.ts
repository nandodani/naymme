import { COMMON_BIGRAMS, COMMON_WORDS, DISTINCTIVE_LETTERS } from "./data.js";

export interface ScoreComponent {
  value: number;
  max: number;
  detail: string;
}

export interface SyllableComponent extends ScoreComponent {
  count: number;
}

/** Type alias (not interface) so it's assignable to MCP structuredContent. */
export type NameScore = {
  name: string;
  normalized: string;
  punchiness: ScoreComponent;
  syllables: SyllableComponent;
  pronounceability: ScoreComponent;
  uniqueness: ScoreComponent;
  cleanliness: ScoreComponent;
  total: number;
  grade: "Excellent" | "Strong" | "Fair" | "Weak" | "Poor";
};

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);
const isVowel = (c: string) => VOWELS.has(c);
const isAlpha = (c: string) => c >= "a" && c <= "z";
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Rough syllable estimate: count vowel-letter groups ("y" counts as a vowel
 * here). Always ≥1 so consonant-only coinages ("sync") score as one syllable.
 */
export function estimateSyllables(normalized: string): number {
  const groups = normalized.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 0);
}

/** punchiness: short names are punchier. Peak at 5–8 chars. Max 25. */
export function punchinessScore(len: number): ScoreComponent {
  const value =
    len <= 2
      ? 5
      : len === 3
        ? 12
        : len === 4
          ? 18
          : len <= 8
            ? 25
            : len === 9
              ? 21
              : len === 10
                ? 17
                : len <= 12
                  ? 10
                  : len <= 15
                    ? 6
                    : 3;
  return { value, max: 25, detail: `length ${len} (peak: 5–8 chars)` };
}

/** syllables: 2–3 syllables roll off the tongue. Max 15. */
export function syllableScore(normalized: string): SyllableComponent {
  const count = estimateSyllables(normalized);
  const value =
    count === 1 ? 8 : count === 2 ? 15 : count === 3 ? 14 : count === 4 ? 10 : count === 5 ? 6 : 2;
  return {
    count,
    value,
    max: 15,
    detail: `${count} estimated syllable${count === 1 ? "" : "s"} (peak: 2–3)`,
  };
}

/** Longest consonant run. */
function maxConsonantRun(normalized: string): number {
  let max = 0;
  let run = 0;
  for (const c of normalized) {
    if (isAlpha(c) && !isVowel(c)) {
      run += 1;
      max = Math.max(max, run);
    } else {
      run = 0;
    }
  }
  return max;
}

/**
 * pronounceability: share of letter bigrams that are common in English, plus
 * penalties for consonant clusters and lopsided vowel balance. Max 25.
 */
export function pronounceabilityScore(normalized: string): ScoreComponent {
  const letters = [...normalized].filter(isAlpha).join("");
  const bigrams: string[] = [];
  for (let i = 0; i + 1 < letters.length; i++) {
    bigrams.push(letters.slice(i, i + 2));
  }
  const familiar = bigrams.filter((b) => COMMON_BIGRAMS.has(b)).length;
  const familiarRatio = bigrams.length === 0 ? 0 : familiar / bigrams.length;

  const vowelCount = [...letters].filter(isVowel).length;
  const vowelRatio = letters.length === 0 ? 0 : vowelCount / letters.length;
  const consonantRun = maxConsonantRun(normalized);

  let value = 10 + Math.round(15 * familiarRatio);
  if (consonantRun >= 4) value -= 8;
  else if (consonantRun === 3) value -= 3;
  if (vowelRatio < 0.25 || vowelRatio > 0.65) value -= 4;
  value = clamp(value, 0, 25);

  const detail =
    `${familiar}/${bigrams.length} familiar bigrams, vowel ratio ${vowelRatio.toFixed(2)}` +
    (consonantRun >= 3 ? `, consonant run ${consonantRun}` : "");
  return { value, max: 25, detail };
}

/**
 * uniqueness: rewards coinages over dictionary words and generic
 * "startup-y" tokens, plus a bonus for distinctive letters. Max 20.
 */
export function uniquenessScore(normalized: string): ScoreComponent {
  const alphaOnly = [...normalized].every(isAlpha);
  const isCommonWord = COMMON_WORDS.has(normalized);
  const hasDistinctive = [...normalized].some((c) => DISTINCTIVE_LETTERS.has(c));

  let value = alphaOnly ? 14 : 10;
  if (!isCommonWord) value += 3;
  if (hasDistinctive) value += 3;
  value = clamp(value, 0, 20);

  const reasons = [
    isCommonWord ? "matches a common/over-used word" : "not a common word",
    hasDistinctive ? "contains a distinctive letter" : "no distinctive letters",
    alphaOnly ? "letters only" : "contains non-letters",
  ];
  return { value, max: 20, detail: reasons.join("; ") };
}

/**
 * cleanliness: brand-safety shape — lowercase letters only is ideal; digits,
 * separators and tripled letters cost points. Max 15.
 */
export function cleanlinessScore(normalized: string): ScoreComponent {
  let value = 15;
  const notes: string[] = [];
  if (/\d/.test(normalized)) {
    value -= 5;
    notes.push("contains digits");
  }
  if (/-/.test(normalized)) {
    value -= 5;
    notes.push("contains hyphens");
  }
  if (/[._]/.test(normalized)) {
    value -= 4;
    notes.push("contains dots/underscores");
  }
  if (/(.)\1{2,}/.test(normalized)) {
    value -= 4;
    notes.push("has a repeated-letter run ≥3");
  }
  value = clamp(value, 0, 15);
  return {
    value,
    max: 15,
    detail: notes.length === 0 ? "clean lowercase letters only" : notes.join("; "),
  };
}

export function gradeFor(total: number): NameScore["grade"] {
  if (total >= 85) return "Excellent";
  if (total >= 70) return "Strong";
  if (total >= 55) return "Fair";
  if (total >= 40) return "Weak";
  return "Poor";
}

/**
 * Deterministic brand-name score out of 100. Pure function of the input —
 * same name always yields the same breakdown:
 *
 *   punchiness        0–25  length (peak 5–8 chars)
 *   syllables         0–15  estimated syllables (peak 2–3)
 *   pronounceability  0–25  familiar bigrams, clusters, vowel balance
 *   uniqueness        0–20  coinage vs common word, distinctive letters
 *   cleanliness       0–15  digits/separators/repeat penalties
 */
export function scoreName(name: string): NameScore {
  const normalized = name.trim().toLowerCase();
  const punchiness = punchinessScore(normalized.length);
  const syllables = syllableScore(normalized);
  const pronounceability = pronounceabilityScore(normalized);
  const uniqueness = uniquenessScore(normalized);
  const cleanliness = cleanlinessScore(normalized);
  const total =
    punchiness.value +
    syllables.value +
    pronounceability.value +
    uniqueness.value +
    cleanliness.value;
  return {
    name,
    normalized,
    punchiness,
    syllables,
    pronounceability,
    uniqueness,
    cleanliness,
    total,
    grade: gradeFor(total),
  };
}
