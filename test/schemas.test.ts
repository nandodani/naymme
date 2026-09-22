import { describe, expect, it } from "vitest";
import {
  checkAvailabilityInputSchema,
  nameSchema,
  PROVIDER_IDS,
  resolveProviderIds,
  scoreNameInputSchema,
} from "../src/schemas.js";

describe("nameSchema", () => {
  it("accepts typical names", () => {
    for (const name of ["acme", "Acme-1", "acme_app", "a", "x".repeat(63)]) {
      expect(nameSchema.safeParse(name).success).toBe(true);
    }
  });

  it("trims whitespace", () => {
    expect(nameSchema.parse("  acme  ")).toBe("acme");
  });

  it("rejects empty, too-long and malformed names", () => {
    for (const name of ["", "   ", "x".repeat(64), "-acme", "_acme", ".acme", "ac me", "acme!"]) {
      expect(nameSchema.safeParse(name).success).toBe(false);
    }
  });
});

describe("resolveProviderIds", () => {
  it("defaults to all providers", () => {
    expect(resolveProviderIds(undefined)).toEqual([...PROVIDER_IDS]);
    expect(resolveProviderIds([])).toEqual([...PROVIDER_IDS]);
  });

  it("expands 'domains' to the four TLD providers", () => {
    expect(resolveProviderIds(["domains"])).toEqual([
      "domain:com",
      "domain:gg",
      "domain:dev",
      "domain:io",
    ]);
  });

  it("expands 'domains:cctld' to the ccTLD providers", () => {
    expect(resolveProviderIds(["domains:cctld"])).toEqual([
      "domain:gg",
      "domain:io",
      "domain:pt",
      "domain:es",
      "domain:de",
      "domain:fr",
      "domain:uk",
      "domain:eu",
      "domain:co",
      "domain:me",
      "domain:sh",
      "domain:so",
    ]);
  });

  it("expands 'domains:all' to every domain provider", () => {
    expect(resolveProviderIds(["domains:all"])).toEqual([
      "domain:com",
      "domain:gg",
      "domain:dev",
      "domain:io",
      "domain:ai",
      "domain:app",
      "domain:pt",
      "domain:es",
      "domain:de",
      "domain:fr",
      "domain:uk",
      "domain:eu",
      "domain:co",
      "domain:me",
      "domain:org",
      "domain:sh",
      "domain:so",
      "domain:xyz",
      "domain:design",
      "domain:store",
      "domain:work",
      "domain:studio",
      "domain:tech",
      "domain:agency",
      "domain:space",
    ]);
  });

  it("expands 'socials' to the social handle providers", () => {
    expect(resolveProviderIds(["socials"])).toEqual([
      "social:x",
      "social:bluesky",
      "social:instagram",
      "social:reddit",
      "social:youtube",
      "social:tiktok",
    ]);
  });

  it("de-duplicates while preserving order", () => {
    expect(resolveProviderIds(["github:user", "domains", "github:user", "npm"])).toEqual([
      "github:user",
      "domain:com",
      "domain:gg",
      "domain:dev",
      "domain:io",
      "npm",
    ]);
  });

  it("de-duplicates overlapping aliases", () => {
    expect(resolveProviderIds(["domains", "domains:cctld", "social:x"])).toEqual([
      "domain:com",
      "domain:gg",
      "domain:dev",
      "domain:io",
      "domain:pt",
      "domain:es",
      "domain:de",
      "domain:fr",
      "domain:uk",
      "domain:eu",
      "domain:co",
      "domain:me",
      "domain:sh",
      "domain:so",
      "social:x",
    ]);
  });
});

describe("checkAvailabilityInputSchema", () => {
  it("parses a minimal call", () => {
    const parsed = checkAvailabilityInputSchema.parse({ name: "acme" });
    expect(parsed).toEqual({ name: "acme" });
  });

  it("accepts provider ids and aliases", () => {
    const parsed = checkAvailabilityInputSchema.parse({
      name: "acme",
      providers: ["github:user", "domains"],
    });
    expect(parsed.providers).toEqual(["github:user", "domains"]);
  });

  it("rejects unknown providers", () => {
    expect(
      checkAvailabilityInputSchema.safeParse({ name: "acme", providers: ["twitter"] }).success,
    ).toBe(false);
  });
});

describe("scoreNameInputSchema", () => {
  it("requires a valid name", () => {
    expect(scoreNameInputSchema.safeParse({ name: "acme" }).success).toBe(true);
    expect(scoreNameInputSchema.safeParse({ name: "" }).success).toBe(false);
    expect(scoreNameInputSchema.safeParse({}).success).toBe(false);
  });
});
