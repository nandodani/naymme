import type { AvailabilityResult } from "../types.js";

/**
 * Overall availability: the single headline metric for a searched name.
 * Pure coverage — `Math.round(free / checked * 100)` — with no weighting,
 * tiers, linguistic multipliers or verdicts. Every number the UI shows
 * comes from the same normalized tally so the buckets always reconcile:
 *
 *   free + taken + unresolved = checked   (the percentage denominator)
 *   checked + pending         = total     (the expected universe)
 *
 * `invalid` folds into `taken` (the name cannot exist there). `unknown`
 * means the check ran but could not answer — it is counted in `checked`
 * and displayed as its own bucket, never silently read as free or taken.
 * Expected providers that never returned are `pending`: in-flight checks,
 * not missing items — they stay out of the denominator entirely so a
 * still-running check can't deflate the percentage.
 */
export interface AvailabilityTally {
  /** Results that resolved `available`. */
  free: number;
  /** Results that resolved `taken` or `invalid` — definitively unavailable. */
  taken: number;
  /** Results that resolved `unknown` — ran, but no definitive answer. */
  unresolved: number;
  /** Expected providers that produced no result — still in flight. */
  pending: number;
  /** Returned results: free + taken + unresolved. The denominator. */
  checked: number;
  /** Checked + pending — the full expected universe. */
  total: number;
}

export function availabilityTally(
  results: readonly AvailabilityResult[],
  expectedProviders: readonly string[] = [],
): AvailabilityTally {
  const seen = new Set<string>();
  let free = 0;
  let taken = 0;
  let unresolved = 0;
  for (const r of results) {
    seen.add(r.provider);
    if (r.status === "available") free += 1;
    else if (r.status === "taken" || r.status === "invalid") taken += 1;
    else unresolved += 1;
  }
  let pending = 0;
  for (const id of expectedProviders) {
    if (!seen.has(id)) pending += 1;
  }
  const checked = free + taken + unresolved;
  return { free, taken, unresolved, pending, checked, total: checked + pending };
}

/** Availability percentage over checked items — 0 when nothing settled in. */
export function availabilityPercent(tally: AvailabilityTally): number {
  if (tally.checked === 0) return 0;
  return Math.round((tally.free / tally.checked) * 100);
}

export interface OverallScore {
  name: string;
  normalized: string;
  /** round(free / checked × 100), or 0 when nothing has been checked. */
  score: number;
  availability: AvailabilityTally;
}

export function overallScore(
  name: string,
  results: readonly AvailabilityResult[],
  /** Provider ids expected to return — used to count in-flight checks. */
  expectedProviders: readonly string[] = [],
): OverallScore {
  const normalized = name.trim().toLowerCase();
  const availability = availabilityTally(results, expectedProviders);
  return { name, normalized, score: availabilityPercent(availability), availability };
}

/** A provider category (row on the Overall card) with its own tally. */
export interface CategoryTally extends AvailabilityTally {
  id: string;
  /** Display title, e.g. "Domains". */
  title: string;
}

/**
 * Tally one category: results restricted to the group's providers, with
 * missing ones counted as pending. Same reconciliation invariant as the
 * global tally — pending stays out of `checked`.
 */
export function categoryTally(
  results: readonly AvailabilityResult[],
  group: { id: string; title: string; providers: readonly { id: string }[] },
): CategoryTally {
  const ids = new Set(group.providers.map((p) => p.id));
  const scoped = results.filter((r) => ids.has(r.provider));
  return { id: group.id, title: group.title, ...availabilityTally(scoped, [...ids]) };
}
