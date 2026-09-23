import { describe, expect, it } from "vitest";

import { resultCounts, rowVisible } from "../lib/result-filter.js";
import type { AvailabilityResult } from "../src/types.js";

function result(provider: string, status: AvailabilityResult["status"]): AvailabilityResult {
  return {
    provider,
    status,
    subject: `x-${provider}`,
    available: status === "available" ? true : status === "unknown" ? null : false,
    durationMs: 1,
  };
}

describe("resultCounts", () => {
  it("counts settled and unresolved results separately", () => {
    const results = [
      result("a", "available"),
      result("b", "taken"),
      result("c", "unknown"),
      result("d", "available"),
    ];
    expect(resultCounts(results)).toEqual({
      expected: 4,
      pending: 0,
      settled: 3,
      available: 2,
      taken: 1,
      unresolved: 1,
    });
  });

  it("handles an empty result set", () => {
    expect(resultCounts([])).toEqual({
      expected: 0,
      pending: 0,
      settled: 0,
      available: 0,
      taken: 0,
      unresolved: 0,
    });
  });

  it("counts expected providers with no result as pending, and folds invalid into taken", () => {
    const results = [result("a", "available"), result("b", "invalid"), result("c", "unknown")];
    const counts = resultCounts(results, ["a", "b", "c", "d", "e"]);
    expect(counts).toEqual({
      expected: 5,
      pending: 2,
      settled: 2,
      available: 1,
      taken: 1,
      unresolved: 1,
    });
    // The invariant the header promises: every bucket sums to the grid.
    expect(counts.available + counts.taken + counts.unresolved + counts.pending).toBe(
      counts.expected,
    );
  });
});

describe("rowVisible", () => {
  it("shows every row under the 'all' filter, including unresolved", () => {
    expect(rowVisible(result("a", "taken"), "all")).toBe(true);
    expect(rowVisible(result("a", "available"), "all")).toBe(true);
    expect(rowVisible(undefined, "all")).toBe(true);
  });

  it("shows only resolved-available rows under 'available'", () => {
    expect(rowVisible(result("a", "available"), "available")).toBe(true);
    expect(rowVisible(result("a", "taken"), "available")).toBe(false);
    expect(rowVisible(result("a", "unknown"), "available")).toBe(false);
    expect(rowVisible(result("a", "invalid"), "available")).toBe(false);
    expect(rowVisible(undefined, "available")).toBe(false);
  });
});
