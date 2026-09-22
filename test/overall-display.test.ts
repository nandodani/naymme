import { describe, expect, it } from "vitest";

import { availabilityLegend, availabilitySegments } from "../lib/overall-display.js";
import type { AvailabilityTally } from "../src/scoring/overall.js";

function tally(partial: Partial<AvailabilityTally>): AvailabilityTally {
  const t: AvailabilityTally = {
    free: 0,
    taken: 0,
    unresolved: 0,
    pending: 0,
    checked: 0,
    total: 0,
    ...partial,
  };
  t.checked = t.free + t.taken + t.unresolved;
  t.total = t.checked + t.pending;
  return t;
}

describe("availabilitySegments", () => {
  it("sizes each bucket by its share of the full universe", () => {
    const segments = availabilitySegments(tally({ free: 3, taken: 1 }));
    expect(segments).toEqual([
      { key: "free", count: 3, share: 0.75 },
      { key: "taken", count: 1, share: 0.25 },
    ]);
  });

  it("includes unresolved and pending slices and drops empty buckets", () => {
    const segments = availabilitySegments(tally({ free: 2, unresolved: 1, pending: 1 }));
    expect(segments.map((s) => s.key)).toEqual(["free", "unresolved", "pending"]);
    const sum = segments.reduce((acc, s) => acc + s.share, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("returns no segments for an empty tally", () => {
    expect(availabilitySegments(tally({}))).toEqual([]);
  });
});

describe("availabilityLegend", () => {
  it("lists free and taken always, other buckets only when nonzero", () => {
    expect(availabilityLegend(tally({ free: 31, taken: 11 }))).toBe("31 free · 11 taken");
    expect(availabilityLegend(tally({ free: 31, taken: 11, unresolved: 9 }))).toBe(
      "31 free · 11 taken · 9 unresolved",
    );
    expect(availabilityLegend(tally({ free: 3, taken: 1, pending: 2 }))).toBe(
      "3 free · 1 taken · 2 checking",
    );
  });
});
