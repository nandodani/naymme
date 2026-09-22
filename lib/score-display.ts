/**
 * Display helpers for the Brand Score card — pure functions so thresholds
 * and badge semantics can be unit-tested without a DOM.
 */

import type { SyllableComponent } from "@/src/scoring/score.js";

export type RatingTier = "Excellent" | "Strong" | "Fair" | "Contested";

/** Quality rating for the blended 0–100 brand rating. */
export function ratingTier(rating: number): RatingTier {
  if (rating >= 90) return "Excellent";
  if (rating >= 75) return "Strong";
  if (rating >= 55) return "Fair";
  return "Contested";
}

/** Quality word for the discrete syllable badge, e.g. `3 · Optimal`. */
export function syllableBand(component: SyllableComponent): string {
  const ratio = component.max === 0 ? 0 : component.value / component.max;
  if (ratio >= 0.9) return "Optimal";
  if (ratio >= 0.65) return "Good";
  if (ratio >= 0.4) return "Fair";
  return "Low";
}

/** Free/total coverage clamped to 0–1 for meter fills. */
export function coverageRatio(free: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, free / total));
}
