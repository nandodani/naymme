import { describe, expect, it } from "vitest";
import { platformLinks, REGISTRARS, tldPrices } from "../lib/links.js";
import { PROVIDER_IDS, type ProviderId } from "../src/schemas.js";

const DOMAIN_IDS = PROVIDER_IDS.filter((id) => id.startsWith("domain:"));
const NON_DOMAIN_IDS = PROVIDER_IDS.filter((id) => !id.startsWith("domain:"));

describe("REGISTRARS", () => {
  it("has unique ids and labels", () => {
    expect(new Set(REGISTRARS.map((r) => r.id)).size).toBe(REGISTRARS.length);
    expect(new Set(REGISTRARS.map((r) => r.label)).size).toBe(REGISTRARS.length);
  });

  it.each(REGISTRARS)("$id searchUrl returns an https URL containing the domain", (registrar) => {
    const url = registrar.searchUrl("acme-example.com");
    expect(url).toMatch(/^https:\/\//);
    expect(url).toContain("acme-example.com");
  });

  it("encodes special characters in the domain", () => {
    for (const registrar of REGISTRARS) {
      const url = registrar.searchUrl("a b.com");
      expect(url).not.toContain(" ");
    }
  });
});

describe("tldPrices", () => {
  it("returns one price per registrar for every domain provider", () => {
    for (const id of DOMAIN_IDS) {
      const prices = tldPrices(id);
      expect(prices.length).toBe(REGISTRARS.length);
      expect(prices.map((p) => p.registrar.id)).toEqual(REGISTRARS.map((r) => r.id));
    }
  });

  it("every estimate is a positive integer USD value or null", () => {
    for (const id of DOMAIN_IDS) {
      for (const { estimate } of tldPrices(id)) {
        expect(estimate === null || (Number.isInteger(estimate) && estimate > 0)).toBe(true);
      }
    }
  });

  it("every domain TLD has at least one registrar that carries it", () => {
    for (const id of DOMAIN_IDS) {
      expect(tldPrices(id).some((p) => p.estimate !== null)).toBe(true);
    }
  });

  it("returns [] for non-domain providers", () => {
    for (const id of NON_DOMAIN_IDS) {
      expect(tldPrices(id)).toEqual([]);
    }
  });
});

describe("platformLinks", () => {
  it("covers every non-domain provider", () => {
    for (const id of NON_DOMAIN_IDS) {
      expect(platformLinks(id), `missing links for ${id}`).not.toBeNull();
    }
  });

  it("returns null for domain providers", () => {
    for (const id of DOMAIN_IDS) {
      expect(platformLinks(id)).toBeNull();
    }
  });

  it.each(NON_DOMAIN_IDS)("%s claim/profile produce valid https URLs", (id: ProviderId) => {
    const links = platformLinks(id);
    expect(links).not.toBeNull();
    expect(links!.claim("acme")).toMatch(/^https:\/\//);
    expect(links!.profile("acme")).toMatch(/^https:\/\//);
  });

  it("profile links embed the handle where the URL pattern allows it", () => {
    const handle = "acme-unique-1234";
    const profile = platformLinks("github:user")!.profile(handle);
    expect(profile).toBe(`https://github.com/${handle}`);
    expect(platformLinks("npm")!.profile(handle)).toContain(handle);
    expect(platformLinks("social:x")!.profile(handle)).toContain(handle);
    expect(platformLinks("telegram")!.profile(handle)).toBe(`https://t.me/${handle}`);
    expect(platformLinks("vercel")!.profile(handle)).toBe(`https://${handle}.vercel.app`);
    expect(platformLinks("netlify")!.profile(handle)).toBe(`https://${handle}.netlify.app`);
    expect(platformLinks("substack")!.profile(handle)).toBe(`https://${handle}.substack.com`);
  });
});
