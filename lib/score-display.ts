/**
 * Display helpers for the Brand Score card — pure functions so thresholds
 * and badge semantics can be unit-tested without a DOM.
 */

import type { BrandVerdict } from "../src/scoring/brand.js";

export type VerdictTone = "uncontested" | "strong" | "contested" | "crowded";

/** Maps a verdict label to its badge tone on the score card. */
export function verdictTone(verdict: BrandVerdict): VerdictTone {
  if (verdict.startsWith("Uncontested")) return "uncontested";
  if (verdict.startsWith("Strong")) return "strong";
  if (verdict.startsWith("Contested")) return "contested";
  return "crowded";
}

/** Free/total coverage clamped to 0–1 for meter fills. */
export function coverageRatio(free: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, free / total));
}
