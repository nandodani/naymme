import { describe, expect, it } from "vitest";

import { RIBBON } from "../components/provider-ribbon.js";
import { PROVIDER_GROUPS } from "../lib/provider-meta.js";
import { PROVIDER_IDS } from "../src/schemas.js";

describe("provider ribbon", () => {
  it("mirrors the active provider list exactly", () => {
    expect(RIBBON.map((e) => e.id)).toEqual(
      PROVIDER_GROUPS.flatMap((g) => g.providers.map((p) => p.id)),
    );
  });

  it("covers every registered provider id", () => {
    const ids = new Set(RIBBON.map((e) => e.id));
    for (const id of PROVIDER_IDS) expect(ids.has(id)).toBe(true);
  });
});
