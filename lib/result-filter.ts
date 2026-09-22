/**
 * "Available only" filtering for the results grid — pure predicates so the
 * toggle's counts and row visibility are unit-testable.
 */

import type { AvailabilityResult } from "../src/types.js";

export type ResultFilter = "all" | "available";

export interface ResultCounts {
  /** Providers that have returned a result so far. */
  resolved: number;
  /** Resolved results whose status is `available`. */
  available: number;
}

export function resultCounts(results: readonly AvailabilityResult[]): ResultCounts {
  return {
    resolved: results.length,
    available: results.filter((r) => r.status === "available").length,
  };
}

/** Is this provider row visible under the active filter? Unresolved rows
 * stay visible under "all" and are hidden under "available" (they pop back
 * in if they resolve to free). */
export function rowVisible(result: AvailabilityResult | undefined, filter: ResultFilter): boolean {
  if (filter === "all") return true;
  return result?.status === "available";
}
