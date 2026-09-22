/**
 * Presentation helpers for the Overall card — pure functions so the bar's
 * segments and ratios can be unit-tested without a DOM.
 */

import type { AvailabilityTally } from "../src/scoring/overall.js";

/** One colored slice of the segmented availability bar. */
export interface BarSegment {
  key: "free" | "taken" | "unresolved" | "pending";
  count: number;
  /** Share of the full expected universe, 0–1. */
  share: number;
}

/**
 * Slice the tally into bar segments that always sum to the full expected
 * width — free, then taken, then unresolved, then in-flight. Empty
 * buckets drop out so the visible bar only shows what actually happened.
 */
export function availabilitySegments(availability: AvailabilityTally): BarSegment[] {
  const { free, taken, unresolved, pending, total } = availability;
  const segments: BarSegment[] = [
    { key: "free", count: free, share: 0 },
    { key: "taken", count: taken, share: 0 },
    { key: "unresolved", count: unresolved, share: 0 },
    { key: "pending", count: pending, share: 0 },
  ];
  if (total <= 0) return [];
  return segments.filter((s) => s.count > 0).map((s) => ({ ...s, share: s.count / total }));
}

/** Compact bucket list for the legend line — drops empty buckets. */
export function availabilityLegend(availability: AvailabilityTally): string {
  const parts = [`${availability.free} free`, `${availability.taken} taken`];
  if (availability.unresolved > 0) parts.push(`${availability.unresolved} unresolved`);
  if (availability.pending > 0) parts.push(`${availability.pending} checking`);
  return parts.join(" · ");
}
