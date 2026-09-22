import { PROVIDER_IDS } from "../schemas.js";
import type { AvailabilityResult } from "../types.js";

/**
 * Tiered brand score: availability coverage weighted by how much each
 * surface actually matters, modulated by a linguistic multiplier for the
 * name itself.
 *
 *   Tier 1 — Crown Jewels   50 pts  .com 15 · GitHub 12 · X 12 · npm/IG 11
 *                                   (none free → base score capped at 50)
 *   Tier 2 — Core Web       35 pts  key TLDs 15 · core socials 12 · dev registries 8
 *   Tier 3 — Long-tail      15 pts  secondary TLDs + secondary platforms
 *
 *   Final = round(clamp(0..100, BaseScore × LinguisticMultiplier))
 *   LinguisticMultiplier ∈ [0.80, 1.15]: length premium/penalty, charset
 *   penalty for digits/hyphens, phonetic flow vs consonant clusters.
 */

export type BrandVerdict =
  | "Uncontested · Prime Real Estate"
  | "Strong · Available on Key Platforms"
  | "Contested · Crown Jewels Taken"
  | "Crowded · Heavily Taken";

export interface TierStat {
  /** Points earned toward the base score. */
  earned: number;
  /** Maximum points this tier can contribute. */
  max: number;
  /** Slots that resolved to `available`. */
  free: number;
  /** Slots that produced a result at all. */
  checked: number;
  /** Slots in the tier's universe (denominator for crown jewels is always 4). */
  slots: number;
}

export interface CrownJewel {
  label: string;
  /** Provider id whose result decided the slot, if any were checked. */
  provider: string | null;
  free: boolean;
  checked: boolean;
}

/** Type alias (not interface) so it's assignable to MCP structuredContent. */
export type BrandScore = {
  name: string;
  normalized: string;
  /** Availability points 0–100 after the crown-jewel cap, before linguistics. */
  baseScore: number;
  /** Linguistic multiplier actually applied, clamped to [0.80, 1.15]. */
  multiplier: number;
  /** Final 0–100 brand score. */
  score: number;
  verdict: BrandVerdict;
  crownJewels: { free: number; slots: CrownJewel[] };
  /** Every provider that resolved `available` over every result returned. */
  availability: { free: number; total: number };
  tiers: { crown: TierStat; core: TierStat; longtail: TierStat };
  /** Concise linguistic note, e.g. "5-letter crisp · High flow". */
  trait: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);
const isAlpha = (c: string) => c >= "a" && c <= "z";
const isVowel = (c: string) => VOWELS.has(c);

/** Tier-1 slots — fixed points each, always a denominator of 4. */
const CROWN_SLOTS = [
  { label: ".com", candidates: ["domain:com"], points: 15 },
  { label: "GitHub", candidates: ["github:user", "github:org"], points: 12 },
  { label: "X", candidates: ["social:x"], points: 12 },
  { label: "npm", altLabel: "IG", candidates: ["npm", "social:instagram"], points: 11 },
] as const;
const CROWN_MAX = 50;

/** Tier-2 groups — each group's points spread evenly across its slot universe. */
const TIER2_TLDS = ["domain:dev", "domain:io", "domain:ai", "domain:co", "domain:app"];
const TIER2_SOCIALS = [
  "social:linkedin",
  "social:reddit",
  "social:bluesky",
  "social:discord",
  "social:twitch",
];
const TIER2_REGISTRIES = [
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
];
const TIER2_MAX = 35;
const TIER3_MAX = 15;

const TIER1_CANDIDATES: ReadonlySet<string> = new Set(CROWN_SLOTS.flatMap((s) => s.candidates));
const TIER2_IDS: ReadonlySet<string> = new Set([
  ...TIER2_TLDS,
  ...TIER2_SOCIALS,
  ...TIER2_REGISTRIES,
]);
/** Every known provider no earlier tier claims — the long-tail universe. */
const TIER3_IDS: readonly string[] = PROVIDER_IDS.filter(
  (id) => !TIER1_CANDIDATES.has(id) && !TIER2_IDS.has(id),
);

interface CrownResolution {
  earned: number;
  free: number;
  jewels: CrownJewel[];
}

function resolveCrownJewels(byProvider: Map<string, AvailabilityResult>): CrownResolution {
  let earned = 0;
  let free = 0;
  const jewels: CrownJewel[] = [];
  for (const slot of CROWN_SLOTS) {
    const used = slot.candidates.filter((id) => byProvider.has(id));
    const slotFree = used.some((id) => byProvider.get(id)?.status === "available");
    if (slotFree) {
      earned += slot.points;
      free += 1;
    }
    const chosen = slot.candidates.find((id) => byProvider.has(id)) ?? null;
    const label = "altLabel" in slot && chosen === slot.candidates[1] ? slot.altLabel : slot.label;
    jewels.push({ label, provider: chosen, free: slotFree, checked: used.length > 0 });
  }
  return { earned, free, jewels };
}

interface GroupResolution {
  earned: number;
  free: number;
  checked: number;
}

/**
 * Spread `maxPoints` evenly over the tier's full slot universe; each free
 * member earns its share. Slots that were never checked contribute nothing —
 * points are for observed availability, not for what might have been queried.
 */
function resolveDistributed(
  byProvider: Map<string, AvailabilityResult>,
  ids: readonly string[],
  maxPoints: number,
): GroupResolution {
  const share = ids.length === 0 ? 0 : maxPoints / ids.length;
  let earned = 0;
  let free = 0;
  let checked = 0;
  for (const id of ids) {
    if (!byProvider.has(id)) continue;
    checked += 1;
    if (byProvider.get(id)?.status === "available") {
      earned += share;
      free += 1;
    }
  }
  return { earned, free, checked };
}

/** Longest run of consonant letters (non-letters break the run). */
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
 * Share of adjacent letter pairs that alternate vowel↔consonant — the
 * "open/closed" alternation that makes coinages pronounceable. 0.5 when
 * there are too few letters to judge.
 */
function flowRatio(normalized: string): number {
  const letters = [...normalized].filter(isAlpha).join("");
  if (letters.length < 2) return 0.5;
  let alternating = 0;
  for (let i = 0; i + 1 < letters.length; i++) {
    if (isVowel(letters.charAt(i)) !== isVowel(letters.charAt(i + 1))) alternating += 1;
  }
  return alternating / (letters.length - 1);
}

export interface LinguisticAnalysis {
  multiplier: number;
  /** Share of adjacent pairs alternating vowel/consonant, 0–1. */
  flow: number;
  /** Longest consonant cluster. */
  consonantRun: number;
  /** True when the name is lowercase letters only. */
  cleanAlpha: boolean;
  trait: string;
}

export function linguisticAnalysis(normalized: string): LinguisticAnalysis {
  const len = normalized.length;
  const cleanAlpha = /^[a-z]+$/.test(normalized);

  // Charset beats length: a name needing digits or separators for
  // disambiguation forfeits the short-name premium.
  let factor: number;
  if (!cleanAlpha) factor = 0.85;
  else if (len >= 3 && len <= 5) factor = 1.1;
  else if (len >= 12) factor = 0.9;
  else factor = 1.0;

  const flow = flowRatio(normalized);
  const run = maxConsonantRun(normalized);
  let adjustment = 0;
  if (run >= 4) adjustment = -0.1;
  else if (run === 3 || flow < 0.35) adjustment = -0.05;
  else if (flow >= 0.75) adjustment = 0.05;

  const multiplier = clamp(factor + adjustment, 0.8, 1.15);

  const lenWord = len <= 2 ? "tiny" : len <= 5 ? "crisp" : len <= 9 ? "balanced" : "long";
  const flowWord = flow >= 0.7 ? "High flow" : flow >= 0.4 ? "Even flow" : "Clustered";
  const parts = [`${len}-letter ${lenWord}`, flowWord];
  if (!cleanAlpha) parts.push("charset penalty");

  return { multiplier, flow, consonantRun: run, cleanAlpha, trait: parts.join(" · ") };
}

export function verdictFor(score: number): BrandVerdict {
  if (score >= 90) return "Uncontested · Prime Real Estate";
  if (score >= 75) return "Strong · Available on Key Platforms";
  if (score >= 50) return "Contested · Crown Jewels Taken";
  return "Crowded · Heavily Taken";
}

/**
 * Deterministic brand score for `name` over a completed availability run.
 * Unknown/invalid results earn nothing — only confirmed availability scores.
 */
export function brandScore(name: string, results: readonly AvailabilityResult[]): BrandScore {
  const normalized = name.trim().toLowerCase();
  const byProvider = new Map<string, AvailabilityResult>(results.map((r) => [r.provider, r]));

  const crown = resolveCrownJewels(byProvider);
  const tlds = resolveDistributed(byProvider, TIER2_TLDS, 15);
  const socials = resolveDistributed(byProvider, TIER2_SOCIALS, 12);
  const registries = resolveDistributed(byProvider, TIER2_REGISTRIES, 8);

  // Tier 3's universe is every known provider no earlier tier claims.
  const longtail = resolveDistributed(byProvider, TIER3_IDS, TIER3_MAX);

  const core = {
    earned: tlds.earned + socials.earned + registries.earned,
    max: TIER2_MAX,
    free: tlds.free + socials.free + registries.free,
    checked: tlds.checked + socials.checked + registries.checked,
    slots: TIER2_IDS.size,
  };
  const tail = {
    earned: longtail.earned,
    max: TIER3_MAX,
    free: longtail.free,
    checked: longtail.checked,
    slots: TIER3_IDS.length,
  };

  let baseScore = crown.earned + core.earned + tail.earned;
  // No crown jewel free → the name is contested at the top; ceiling 50.
  if (crown.free === 0) baseScore = Math.min(baseScore, 50);
  // Shares are fractional (12/5, 15/28…) — round off the float noise.
  baseScore = Math.round(baseScore * 100) / 100;

  const linguistic = linguisticAnalysis(normalized);
  const score = Math.round(clamp(baseScore * linguistic.multiplier, 0, 100));

  return {
    name,
    normalized,
    baseScore,
    multiplier: linguistic.multiplier,
    score,
    verdict: verdictFor(score),
    crownJewels: { free: crown.free, slots: crown.jewels },
    availability: {
      free: results.filter((r) => r.status === "available").length,
      total: results.length,
    },
    tiers: {
      crown: {
        earned: crown.earned,
        max: CROWN_MAX,
        free: crown.free,
        checked: crown.jewels.filter((j) => j.checked).length,
        slots: CROWN_SLOTS.length,
      },
      core,
      longtail: tail,
    },
    trait: linguistic.trait,
  };
}
