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
  it("counts resolved results and available ones separately", () => {
    const results = [
      result("a", "available"),
      result("b", "taken"),
      result("c", "unknown"),
      result("d", "available"),
    ];
    expect(resultCounts(results)).toEqual({ resolved: 4, available: 2 });
  });

  it("handles an empty result set", () => {
    expect(resultCounts([])).toEqual({ resolved: 0, available: 0 });
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
