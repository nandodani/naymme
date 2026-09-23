/**
 * "Available only" filtering for the results grid — pure predicates so the
 * toggle's counts and row visibility are unit-testable.
 */

import type { AvailabilityResult } from "../src/types.js";

export type ResultFilter = "all" | "available";

export interface ResultCounts {
  /** Providers the grid is expected to render (51 across the four groups). */
  expected: number;
  /** Expected providers with no result yet — in-flight, not missing. */
  pending: number;
  /** Results with a definitive outcome (available, taken or invalid). */
  settled: number;
  available: number;
  /** Definitively unavailable: `taken` plus `invalid`. */
  taken: number;
  /** `unknown` — the check ran but couldn't answer (errors, timeouts). */
  unresolved: number;
}

/**
 * Tally the run so the header's categories reconcile exactly with the grid:
 * free + taken + unresolved + pending = expected. `invalid` folds into
 * `taken` (the name cannot exist there); `unknown` stays its own bucket.
 */
export function resultCounts(
  results: readonly AvailabilityResult[],
  expectedProviders: readonly string[] = [],
): ResultCounts {
  const seen = new Set(results.map((r) => r.provider));
  let available = 0;
  let taken = 0;
  let unresolved = 0;
  for (const r of results) {
    if (r.status === "available") available += 1;
    else if (r.status === "taken" || r.status === "invalid") taken += 1;
    else unresolved += 1;
  }
  const pending = expectedProviders.filter((id) => !seen.has(id)).length;
  const expected = expectedProviders.length === 0 ? results.length : expectedProviders.length;
  return { expected, pending, settled: available + taken, available, taken, unresolved };
}

/** Is this provider row visible under the active filter? Unresolved rows
 * stay visible under "all" and are hidden under "available" (they pop back
 * in if they resolve to free). */
export function rowVisible(result: AvailabilityResult | undefined, filter: ResultFilter): boolean {
  if (filter === "all") return true;
  return result?.status === "available";
}
