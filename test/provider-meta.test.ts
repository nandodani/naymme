import { describe, expect, it } from "vitest";
import {
  ALL_PROVIDER_IDS,
  PROVIDER_GROUPS,
  providerGroup,
  type ProviderGroupId,
} from "../lib/provider-meta.js";
import { PROVIDER_IDS } from "../src/schemas.js";

describe("PROVIDER_GROUPS / ALL_PROVIDER_IDS", () => {
  it("lists every provider id exactly once and covers PROVIDER_IDS", () => {
    expect(ALL_PROVIDER_IDS.length).toBe(PROVIDER_IDS.length);
    expect(new Set(ALL_PROVIDER_IDS).size).toBe(ALL_PROVIDER_IDS.length);
    expect(new Set(ALL_PROVIDER_IDS)).toEqual(new Set(PROVIDER_IDS));
  });

  it("has unique group ids, titles and non-empty provider labels", () => {
    expect(new Set(PROVIDER_GROUPS.map((g) => g.id)).size).toBe(PROVIDER_GROUPS.length);
    expect(new Set(PROVIDER_GROUPS.map((g) => g.title)).size).toBe(PROVIDER_GROUPS.length);
    for (const group of PROVIDER_GROUPS) {
      expect(group.providers.length).toBeGreaterThan(0);
      for (const meta of group.providers) {
        expect(meta.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps all domain providers inside the three domain groups", () => {
    const domainGroups = new Set<ProviderGroupId>(["domains", "regions", "niche"]);
    for (const group of PROVIDER_GROUPS) {
      for (const meta of group.providers) {
        const isDomain = meta.id.startsWith("domain:");
        expect(isDomain, `${meta.id} in ${group.id}`).toBe(domainGroups.has(group.id));
      }
    }
  });
});

describe("providerGroup", () => {
  it.each(PROVIDER_GROUPS.map((g) => g.id))("returns the %s group", (id) => {
    expect(providerGroup(id).id).toBe(id);
  });

  it("throws for an unknown group id", () => {
    expect(() => providerGroup("nope" as ProviderGroupId)).toThrow("unknown provider group: nope");
  });
});
