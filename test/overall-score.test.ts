import { describe, expect, it } from "vitest";

import { PROVIDER_GROUPS } from "../lib/provider-meta.js";
import { PROVIDER_IDS } from "../src/schemas.js";
import {
  availabilityPercent,
  availabilityTally,
  categoryTally,
  overallScore,
} from "../src/scoring/overall.js";
import type { AvailabilityResult, AvailabilityStatus } from "../src/types.js";

function result(provider: string, status: AvailabilityStatus): AvailabilityResult {
  return {
    provider,
    status,
    subject: provider,
    available: status === "available" ? true : status === "unknown" ? null : false,
    durationMs: 1,
  };
}

const UNIVERSE = [...PROVIDER_IDS];
const allFree = UNIVERSE.map((id) => result(id, "available"));

describe("overallScore", () => {
  it("is pure availability — free over checked, no weighting", () => {
    // .com counts the same as the most niche provider: no tiers, no
    // linguistic adjustment, nothing — just coverage.
    const results = [
      result("domain:com", "available"),
      result("domain:xyz", "available"),
      result("npm", "taken"),
      result("figma", "taken"),
    ];
    const s = overallScore("acme", results);
    expect(s.score).toBe(50);
    expect(s.availability).toEqual({
      free: 2,
      taken: 2,
      unresolved: 0,
      pending: 0,
      checked: 4,
      total: 4,
    });
  });

  it("is 0 when nothing settled in and when everything is taken", () => {
    expect(overallScore("acme", []).score).toBe(0);
    expect(overallScore("acme", [result("npm", "taken")]).score).toBe(0);
    expect(overallScore("acme", [result("npm", "unknown")]).score).toBe(0);
  });

  it("counts pending providers as in-flight, never taken", () => {
    // Only 3 of the 5 expected providers returned — the other two are
    // still checking and must not sit in the denominator.
    const s = overallScore(
      "acme",
      [result("a", "available"), result("b", "taken"), result("c", "available")],
      ["a", "b", "c", "d", "e"],
    );
    expect(s.availability).toEqual({
      free: 2,
      taken: 1,
      unresolved: 0,
      pending: 2,
      checked: 3,
      total: 5,
    });
    expect(s.score).toBe(67); // 2/3 — pending excluded
  });

  it("keeps unresolved results visible but out of the taken bucket", () => {
    const s = overallScore("acme", [
      result("a", "available"),
      result("b", "unknown"),
      result("c", "taken"),
    ]);
    expect(s.availability).toEqual({
      free: 1,
      taken: 1,
      unresolved: 1,
      pending: 0,
      checked: 3,
      total: 3,
    });
    expect(s.score).toBe(33);
  });

  it("always reconciles: free + taken + unresolved + pending = total", () => {
    const cases: AvailabilityResult[][] = [
      [],
      allFree,
      UNIVERSE.map((id) => result(id, "taken")),
      UNIVERSE.map((id, i) =>
        result(id, i % 3 === 0 ? "available" : i % 3 === 1 ? "taken" : "unknown"),
      ),
    ];
    for (const results of cases) {
      const a = overallScore("acme", results, UNIVERSE).availability;
      expect(a.free + a.taken + a.unresolved + a.pending).toBe(a.total);
      expect(a.free + a.taken + a.unresolved).toBe(a.checked);
    }
  });

  it("is deterministic for the same inputs", () => {
    expect(overallScore("acme", allFree)).toEqual(overallScore("acme", allFree));
  });
});

describe("availabilityTally / availabilityPercent", () => {
  it("counts invalid as taken — the name cannot exist there", () => {
    const t = availabilityTally([result("a", "invalid"), result("b", "available")]);
    expect(t.taken).toBe(1);
    expect(t.free).toBe(1);
    expect(availabilityPercent(t)).toBe(50);
  });

  it("returns 0 percent for an empty tally", () => {
    expect(
      availabilityPercent({ free: 0, taken: 0, unresolved: 0, pending: 0, checked: 0, total: 0 }),
    ).toBe(0);
  });
});

describe("categoryTally", () => {
  it("groups results by provider ids and reconciles per category", () => {
    const domains = PROVIDER_GROUPS.find((g) => g.id === "domains")!;
    const results = [
      result("domain:com", "available"),
      result("domain:dev", "taken"),
      result("domain:io", "unknown"),
      // social:x belongs to a different group — ignored here
      result("social:x", "available"),
    ];
    const c = categoryTally(results, domains);
    expect(c.id).toBe("domains");
    expect(c.title).toBe("Core domains");
    expect(c.free).toBe(1);
    expect(c.taken).toBe(1);
    expect(c.unresolved).toBe(1);
    // 9 core-domain slots, 3 returned → 6 pending
    expect(c.pending).toBe(domains.providers.length - 3);
    expect(c.checked + c.pending).toBe(c.total);
    expect(c.total).toBe(domains.providers.length);
  });

  it("handles an empty category cleanly", () => {
    const community = PROVIDER_GROUPS.find((g) => g.id === "community")!;
    const c = categoryTally([], community);
    expect(c.checked).toBe(0);
    expect(c.free).toBe(0);
    expect(c.pending).toBe(community.providers.length);
    expect(availabilityPercent(c)).toBe(0);
  });

  it("covers every provider group defined in the app", () => {
    // The card renders one row per group — assert the helper works for
    // all of them so no category is silently dropped.
    const categories = PROVIDER_GROUPS.map((g) => categoryTally(allFree, g));
    expect(categories.length).toBe(PROVIDER_GROUPS.length);
    for (const c of categories) {
      expect(c.free).toBe(c.total);
      expect(availabilityPercent(c)).toBe(100);
    }
  });
});
