import type { AvailabilityResult, AvailabilityStatus } from "../types.js";

/**
 * Tiered brand score: availability coverage weighted by how much each
 * surface actually matters, modulated by a linguistic multiplier for the
 * name itself.
 *
 *   Tier 1 — Crown Jewels   50 pts  .com 18 · GitHub 12 · X 10 · npm/IG 10
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
  | "Partial · Key Ground Held"
  | "Pending · Jewels Unresolved"
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
  /** Checked-or-unchecked but not settled — must not read as "taken". */
  pending: boolean;
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
  crownJewels: { free: number; pending: number; slots: CrownJewel[] };
  /** Availability tally: `settled` is the definitive outcomes (available,
   * taken, invalid); `pending` is unknown statuses plus expected providers
   * that never returned. Pending slots never count as taken. */
  availability: { free: number; settled: number; pending: number; total: number };
  tiers: { crown: TierStat; core: TierStat; longtail: TierStat };
  /** Concise linguistic note, e.g. "5-letter crisp · High flow". */
  trait: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);
const isAlpha = (c: string) => c >= "a" && c <= "z";
const isVowel = (c: string) => VOWELS.has(c);

/** Tier-1 slots — fixed points each, always a denominator of 4. .com
 * carries the most weight: it is the default surface users try first. */
const CROWN_SLOTS = [
  { label: ".com", candidates: ["domain:com"], points: 18 },
  { label: "GitHub", candidates: ["github:user", "github:org"], points: 12 },
  { label: "X", candidates: ["social:x"], points: 10 },
  { label: "npm", altLabel: "IG", candidates: ["npm", "social:instagram"], points: 10 },
] as const;
const CROWN_MAX = 50;

/** Tier-2 groups — each group's points spread evenly across its slot universe. */
const TIER2_TLDS = ["domain:dev", "domain:io", "domain:ai", "domain:co", "domain:app"];
// Spec's core-social universe. Distribution divides by checked members, so
// providers the registry doesn't offer (LinkedIn/Discord/Twitch today)
// can't silently cap the group's 12 points.
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
/**
 * The long-tail universe is dynamic: every returned provider that no
 * earlier tier claims, including secondaries the registry doesn't
 * statically know (Dev.to-style platforms).
 */
function tier3Ids(results: readonly AvailabilityResult[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (seen.has(r.provider) || TIER1_CANDIDATES.has(r.provider) || TIER2_IDS.has(r.provider)) {
      continue;
    }
    seen.add(r.provider);
    ids.push(r.provider);
  }
  return ids;
}

interface CrownResolution {
  earned: number;
  free: number;
  /** Slots that are not confirmed-free but also not definitively taken —
   * unchecked candidates or `unknown` statuses. */
  pending: number;
  jewels: CrownJewel[];
}

function resolveCrownJewels(byProvider: Map<string, AvailabilityResult>): CrownResolution {
  let earned = 0;
  let free = 0;
  let pending = 0;
  const jewels: CrownJewel[] = [];
  for (const slot of CROWN_SLOTS) {
    const used = slot.candidates.filter((id) => byProvider.has(id));
    const slotFree = used.some((id) => byProvider.get(id)?.status === "available");
    if (slotFree) {
      earned += slot.points;
      free += 1;
    }
    // Settled means every candidate returned a definitive answer — any
    // unchecked candidate or `unknown` result leaves the slot pending.
    const slotSettled =
      slotFree ||
      (used.length === slot.candidates.length &&
        used.every((id) => byProvider.get(id)?.status !== "unknown"));
    const slotPending = !slotFree && !slotSettled;
    if (slotPending) pending += 1;
    const chosen = slot.candidates.find((id) => byProvider.has(id)) ?? null;
    const label = "altLabel" in slot && chosen === slot.candidates[1] ? slot.altLabel : slot.label;
    jewels.push({
      label,
      provider: chosen,
      free: slotFree,
      checked: used.length > 0,
      pending: slotPending,
    });
  }
  return { earned, free, pending, jewels };
}

interface GroupResolution {
  earned: number;
  free: number;
  checked: number;
  /** Slots with a definitive outcome (available/taken/invalid). */
  settled: number;
}

/**
 * Spread `maxPoints` evenly over the members of `ids` that produced a
 * definitive outcome; each free member earns its share. Unchecked and
 * `unknown` slots stay out of the denominator entirely — in-flight or
 * inconclusive checks can neither earn nor cost points, so pending work
 * never depresses the score. Unchecked slots also can't cap the group for
 * providers the registry doesn't offer (LinkedIn/Discord/Twitch today).
 */
function resolveDistributed(
  byProvider: Map<string, AvailabilityResult>,
  ids: readonly string[],
  maxPoints: number,
): GroupResolution {
  let checked = 0;
  let settled = 0;
  let earned = 0;
  let free = 0;
  for (const id of ids) {
    const r = byProvider.get(id);
    if (r === undefined) continue;
    checked += 1;
    if (r.status === "unknown") continue;
    settled += 1;
    if (r.status === "available") {
      free += 1;
    }
  }
  if (settled > 0) {
    earned = (maxPoints / settled) * free;
  }
  return { earned, free, checked, settled };
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

/**
 * Verdict bands are crown-aware: "Crown Jewels Taken" is only claimed when
 * the brand literally holds none of the four; holding some of them — even
 * with mid overall coverage — reads as a partial claim, not a contested
 * defeat.
 */
export function verdictFor(score: number, crownFree = 0, crownPending = 0): BrandVerdict {
  if (score >= 90) return "Uncontested · Prime Real Estate";
  if (score >= 75) return "Strong · Available on Key Platforms";
  if (score >= 50) {
    if (crownFree > 0) return "Partial · Key Ground Held";
    // No jewel confirmed free but some still open — "taken" would be a lie.
    if (crownPending > 0) return "Pending · Jewels Unresolved";
    return "Contested · Crown Jewels Taken";
  }
  return "Crowded · Heavily Taken";
}

/** Statuses that resolved to a definitive yes/no. `unknown` stays pending. */
const SETTLED_STATUSES: ReadonlySet<AvailabilityStatus> = new Set([
  "available",
  "taken",
  "invalid",
]);

function availabilityTally(
  results: readonly AvailabilityResult[],
  byProvider: Map<string, AvailabilityResult>,
  expectedProviders: readonly string[],
): BrandScore["availability"] {
  let free = 0;
  let settled = 0;
  let pending = 0;
  for (const r of results) {
    if (r.status === "available") free += 1;
    if (SETTLED_STATUSES.has(r.status)) {
      settled += 1;
    } else {
      pending += 1;
    }
  }
  // Expected providers that never returned are in-flight, not missing.
  for (const id of expectedProviders) {
    if (!byProvider.has(id)) pending += 1;
  }
  return { free, settled, pending, total: settled + pending };
}

/**
 * Deterministic brand score for `name` over a completed availability run.
 * Unknown/invalid results earn nothing — only confirmed availability scores,
 * and pending checks occupy no denominator so they can't deflate it.
 */
export function brandScore(
  name: string,
  results: readonly AvailabilityResult[],
  /** Provider ids expected to return — used to count in-flight checks. */
  expectedProviders: readonly string[] = [],
): BrandScore {
  const normalized = name.trim().toLowerCase();
  const byProvider = new Map<string, AvailabilityResult>(results.map((r) => [r.provider, r]));

  const crown = resolveCrownJewels(byProvider);
  const tlds = resolveDistributed(byProvider, TIER2_TLDS, 15);
  const socials = resolveDistributed(byProvider, TIER2_SOCIALS, 12);
  const registries = resolveDistributed(byProvider, TIER2_REGISTRIES, 8);

  // Tier 3 inherits every returned provider no earlier tier claims.
  const tailIds = tier3Ids(results);
  const longtail = resolveDistributed(byProvider, tailIds, TIER3_MAX);

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
    slots: tailIds.length,
  };

  let baseScore = crown.earned + core.earned + tail.earned;
  // No crown jewel free AND none pending → definitively contested at the
  // top; ceiling 50. Pending jewels get the benefit of the doubt.
  if (crown.free === 0 && crown.pending === 0) baseScore = Math.min(baseScore, 50);
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
    verdict: verdictFor(score, crown.free, crown.pending),
    crownJewels: { free: crown.free, pending: crown.pending, slots: crown.jewels },
    availability: availabilityTally(results, byProvider, expectedProviders),
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
