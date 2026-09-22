import { providerGroup } from "./provider-meta.js";
import type { CheckAvailabilityOutput } from "../src/schemas.js";
import type { AvailabilityResult } from "../src/types.js";

/** Creator/community platforms roll up with the social handles. */
const COMMUNITY_IDS = new Set<string>(providerGroup("community").providers.map((p) => p.id));

/**
 * Coverage rollups derived from normalized availability results — the
 * fractions shown on the brand score card and in card headers.
 */

export interface CategoryCount {
  /** Providers that resolved to `available`. */
  free: number;
  /** Providers that returned any result. */
  total: number;
}

export interface AvailabilityStats {
  tld: CategoryCount;
  social: CategoryCount;
  dev: CategoryCount;
  /** Weighted composite 0..1 used for the headline rating. */
  composite: number;
}

function count(results: readonly AvailabilityResult[], match: (id: string) => boolean) {
  let free = 0;
  let total = 0;
  for (const r of results) {
    if (!match(r.provider)) continue;
    total += 1;
    if (r.status === "available") free += 1;
  }
  return { free, total };
}

export function availabilityStats(data: CheckAvailabilityOutput | null): AvailabilityStats | null {
  if (data === null || data.results.length === 0) return null;
  const tld = count(data.results, (id) => id.startsWith("domain:"));
  const social = count(
    data.results,
    (id) => id.startsWith("social:") || COMMUNITY_IDS.has(id as never),
  );
  const dev = count(
    data.results,
    (id) =>
      !id.startsWith("domain:") && !id.startsWith("social:") && !COMMUNITY_IDS.has(id as never),
  );
  const fraction = (c: CategoryCount) => (c.total === 0 ? 0 : c.free / c.total);
  // .com anchors a brand, so it counts triple inside the composite rating
  // even though the displayed TLD metric is a plain count.
  let tldWeight = 0;
  let tldFree = 0;
  for (const r of data.results) {
    if (!r.provider.startsWith("domain:")) continue;
    const w = r.provider === "domain:com" ? 3 : 1;
    tldWeight += w;
    if (r.status === "available") tldFree += w;
  }
  const tldReach = tldWeight === 0 ? 0 : tldFree / tldWeight;
  return {
    tld,
    social,
    dev,
    composite: 0.5 * tldReach + 0.3 * fraction(social) + 0.2 * fraction(dev),
  };
}
