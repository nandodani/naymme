import { describe, expect, it } from "vitest";
import { defaultDeps, type ProviderDeps } from "../src/deps.js";
import { createAdapters } from "../src/providers/index.js";

/** RequestInfo → URL string without relying on toString fallbacks. */
const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

function makeDeps(overrides: Partial<ProviderDeps> = {}): ProviderDeps {
  return defaultDeps({
    fetch: async () => new Response(null, { status: 500 }),
    whoisDomain: async () => ({}),
    resolveNs: async () => [],
    npmNameAvailable: async () => true,
    timeoutMs: 50,
    ...overrides,
  });
}

async function check(providerId: "jsr" | "denoland", name: string, deps: ProviderDeps) {
  const adapter = createAdapters(deps)[providerId];
  return adapter.check(name, new AbortController().signal);
}

describe("jsr adapter", () => {
  const scopeDeps = (status: number) =>
    makeDeps({
      fetch: async (input) => {
        if (urlOf(input).startsWith("https://api.jsr.io/scopes/")) {
          return new Response(null, { status });
        }
        return new Response(null, { status: 404 });
      },
    });

  it("maps a 200 scope to taken", async () => {
    const r = await check("jsr", "acme", scopeDeps(200));
    expect(r).toMatchObject({ status: "taken", available: false, subject: "@acme" });
    expect(r.detail).toContain("https://jsr.io/@acme");
  });

  it("maps a 404 scope to available", async () => {
    const r = await check("jsr", "acme", scopeDeps(404));
    expect(r).toMatchObject({ status: "available", available: true, subject: "@acme" });
    expect(r.detail).toContain("https://jsr.io/@acme");
  });

  it("maps unexpected statuses to unknown", async () => {
    const r = await check("jsr", "acme", scopeDeps(429));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("maps a network failure to unknown", async () => {
    const r = await check(
      "jsr",
      "acme",
      makeDeps({ fetch: async () => Promise.reject(new Error("boom")) }),
    );
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("rejects invalid scope names before fetching", async () => {
    let calls = 0;
    const deps = makeDeps({
      fetch: async () => {
        calls += 1;
        return new Response(null, { status: 404 });
      },
    });
    for (const name of ["a", "Abc", "-abc", "abc-", "a--b", "a".repeat(21)]) {
      const r = await check("jsr", name, deps);
      expect(r.status, name).toBe("invalid");
    }
    expect(calls).toBe(0);
  });
});

describe("denoland adapter", () => {
  const moduleDeps = (status: number) =>
    makeDeps({
      fetch: async (input) => {
        if (urlOf(input).startsWith("https://cdn.deno.land/")) {
          return new Response(null, { status });
        }
        return new Response(null, { status: 404 });
      },
    });

  it("maps a 200 versions manifest to taken", async () => {
    const r = await check("denoland", "acme_mod", moduleDeps(200));
    expect(r).toMatchObject({ status: "taken", available: false, subject: "acme_mod" });
    expect(r.detail).toContain("https://deno.land/x/acme_mod");
  });

  it("maps a 404 versions manifest to available", async () => {
    const r = await check("denoland", "acme_mod", moduleDeps(404));
    expect(r).toMatchObject({ status: "available", available: true, subject: "acme_mod" });
    expect(r.detail).toContain("https://deno.land/x/acme_mod");
  });

  it("maps unexpected statuses to unknown", async () => {
    const r = await check("denoland", "acme_mod", moduleDeps(500));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("maps a network failure to unknown", async () => {
    const r = await check(
      "denoland",
      "acme_mod",
      makeDeps({ fetch: async () => Promise.reject(new Error("boom")) }),
    );
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("rejects invalid module names before fetching", async () => {
    let calls = 0;
    const deps = makeDeps({
      fetch: async () => {
        calls += 1;
        return new Response(null, { status: 404 });
      },
    });
    for (const name of ["ab", "Abcd", "a-b-c", "a".repeat(41)]) {
      const r = await check("denoland", name, deps);
      expect(r.status, name).toBe("invalid");
    }
    expect(calls).toBe(0);
  });
});
