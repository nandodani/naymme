import { describe, expect, it } from "vitest";
import { ALL_PROVIDER_IDS, PROVIDER_GROUPS } from "../lib/provider-meta.js";
import { platformLinks } from "../lib/links.js";
import { defaultDeps, type ProviderDeps } from "../src/deps.js";
import { createAdapters } from "../src/providers/index.js";
import { PROVIDER_IDS, resolveProviderIds } from "../src/schemas.js";
import { runAvailabilityChecks } from "../src/tools/checkAvailability.js";

/** RequestInfo → URL string without relying on toString fallbacks. */
const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

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

async function check(providerId: string, name: string, deps: ProviderDeps) {
  const adapter = createAdapters(deps)[providerId as keyof ReturnType<typeof createAdapters>];
  return adapter.check(name, new AbortController().signal);
}

describe("github:repo adapter", () => {
  const searchDeps = (body: unknown, status = 200) =>
    makeDeps({
      fetch: async (input) => {
        if (urlOf(input).includes("/search/repositories")) return jsonResponse(body, status);
        return new Response(null, { status: 404 });
      },
    });

  it("flags an exact repository-name collision as taken", async () => {
    const r = await check(
      "github:repo",
      "acme",
      searchDeps({ items: [{ name: "acme", full_name: "someone/acme" }] }),
    );
    expect(r).toMatchObject({ status: "taken", available: false, subject: "acme" });
    expect(r.detail).toContain("https://github.com/someone/acme");
  });

  it("matches the repository name case-insensitively", async () => {
    const r = await check(
      "github:repo",
      "acme",
      searchDeps({ items: [{ name: "Acme", full_name: "someone/Acme" }] }),
    );
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("ignores fuzzy near-matches that are not the exact name", async () => {
    const r = await check(
      "github:repo",
      "acme",
      searchDeps({ items: [{ name: "acme-toolkit", full_name: "someone/acme-toolkit" }] }),
    );
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("is available when the search finds nothing", async () => {
    const r = await check("github:repo", "acme", searchDeps({ items: [] }));
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("maps rate limits to unknown", async () => {
    for (const status of [403, 429]) {
      const r = await check("github:repo", "acme", searchDeps({}, status));
      expect(r).toMatchObject({ status: "unknown", available: null });
      expect(r.detail).toMatch(/rate limit/i);
    }
  });

  it("maps unexpected statuses to unknown", async () => {
    const r = await check("github:repo", "acme", searchDeps({}, 500));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("maps malformed search bodies to unknown", async () => {
    const r = await check("github:repo", "acme", searchDeps({ nope: true }));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("maps request failures to unknown", async () => {
    const r = await check(
      "github:repo",
      "acme",
      makeDeps({
        fetch: async () => {
          throw new Error("network down");
        },
      }),
    );
    expect(r).toMatchObject({ status: "unknown", available: null });
  });
});

describe("vercel adapter", () => {
  const vercelDeps = (status: number, opts: { header?: string; body?: string } = {}) =>
    makeDeps({
      fetch: async () =>
        new Response(opts.body ?? null, {
          status,
          headers: opts.header !== undefined ? { "x-vercel-error": opts.header } : {},
        }),
    });

  it("maps a DEPLOYMENT_NOT_FOUND header to available", async () => {
    const r = await check("vercel", "acme", vercelDeps(404, { header: "DEPLOYMENT_NOT_FOUND" }));
    expect(r).toMatchObject({ status: "available", available: true, subject: "acme.vercel.app" });
  });

  it("maps a DEPLOYMENT_NOT_FOUND body marker to available", async () => {
    const r = await check(
      "vercel",
      "acme",
      vercelDeps(404, { body: "<html>error DEPLOYMENT_NOT_FOUND</html>" }),
    );
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("maps a served deployment to taken", async () => {
    for (const status of [200, 201, 301, 308]) {
      const r = await check("vercel", "acme", vercelDeps(status));
      expect(r).toMatchObject({ status: "taken", available: false });
    }
  });

  it("maps auth-gated deployments to taken", async () => {
    for (const status of [401, 403]) {
      const r = await check("vercel", "acme", vercelDeps(status));
      expect(r).toMatchObject({ status: "taken", available: false });
      expect(r.detail).toContain("protected");
    }
  });

  it("keeps a 404 without the unclaimed marker unknown", async () => {
    const r = await check("vercel", "acme", vercelDeps(404, { body: "<html>my app 404</html>" }));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("maps rate limits and edge failures to unknown", async () => {
    for (const status of [429, 500, 503]) {
      const r = await check("vercel", "acme", vercelDeps(status));
      expect(r).toMatchObject({ status: "unknown", available: null });
    }
  });

  it("rejects names that are not valid subdomains", async () => {
    expect(await check("vercel", "Acme", vercelDeps(404))).toMatchObject({
      status: "invalid",
      available: false,
    });
    expect(await check("vercel", "a_b", vercelDeps(404))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("netlify adapter", () => {
  const netlifyDeps = (status: number, body: string | null = null) =>
    makeDeps({ fetch: async () => new Response(body, { status }) });

  it("maps the unclaimed-site 404 body to available", async () => {
    const r = await check("netlify", "acme", netlifyDeps(404, "Not Found - Request ID: 01JABCXYZ"));
    expect(r).toMatchObject({ status: "available", available: true, subject: "acme.netlify.app" });
  });

  it("maps a served site to taken", async () => {
    for (const status of [200, 301]) {
      const r = await check("netlify", "acme", netlifyDeps(status, "<html>site</html>"));
      expect(r).toMatchObject({ status: "taken", available: false });
    }
  });

  it("keeps a 404 with a different body unknown", async () => {
    const r = await check("netlify", "acme", netlifyDeps(404, "<html>custom 404</html>"));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("maps rate limits and edge failures to unknown", async () => {
    for (const status of [429, 500]) {
      const r = await check("netlify", "acme", netlifyDeps(status));
      expect(r).toMatchObject({ status: "unknown", available: null });
    }
  });

  it("rejects names that are not valid subdomains", async () => {
    expect(await check("netlify", "-acme", netlifyDeps(404))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("appstore adapter", () => {
  const appstoreDeps = (body: unknown, status = 200) =>
    makeDeps({ fetch: async () => jsonResponse(body, status) });

  it("flags an exact trackName match as taken with the listing URL", async () => {
    const r = await check(
      "appstore",
      "acme",
      appstoreDeps({
        results: [{ trackName: "Acme", trackViewUrl: "https://apps.apple.com/us/app/acme/id123" }],
      }),
    );
    expect(r).toMatchObject({ status: "taken", available: false });
    expect(r.detail).toContain("https://apps.apple.com/us/app/acme/id123");
  });

  it("is available when no listing has the exact name", async () => {
    const r = await check(
      "appstore",
      "acme",
      appstoreDeps({ results: [{ trackName: "Acme Pro Tools" }] }),
    );
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("is available on an empty result set", async () => {
    const r = await check("appstore", "acme", appstoreDeps({ results: [] }));
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("maps non-200 responses to unknown", async () => {
    const r = await check("appstore", "acme", appstoreDeps({}, 503));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("maps malformed bodies to unknown", async () => {
    const r = await check("appstore", "acme", appstoreDeps({ nope: [] }));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });
});

describe("Phase 1 integration", () => {
  const PHASE1 = ["github:repo", "vercel", "netlify", "appstore", "pypi", "crates"] as const;

  it("registers every Phase 1 provider in the adapter registry", () => {
    const adapters = createAdapters(makeDeps());
    for (const id of PHASE1) {
      expect(adapters[id]?.id).toBe(id);
    }
  });

  it("selects the new providers by name and via the all alias", () => {
    expect(resolveProviderIds(["vercel", "netlify", "appstore", "github:repo"])).toEqual([
      "vercel",
      "netlify",
      "appstore",
      "github:repo",
    ]);
    for (const id of PHASE1) {
      expect(resolveProviderIds(["all"])).toContain(id);
    }
  });

  it("renders every provider in the categorized grid — no orphans", () => {
    // The grid only renders rows from PROVIDER_GROUPS, and the Overall card
    // counts them as the expected universe: an id in either list without the
    // other silently drops or ghosts a check.
    expect([...ALL_PROVIDER_IDS].sort()).toEqual([...PROVIDER_IDS].sort());
  });

  it("gives every new provider claim/profile links and a grid group", () => {
    for (const id of ["github:repo", "vercel", "netlify", "appstore"] as const) {
      expect(platformLinks(id)).not.toBeNull();
      expect(PROVIDER_GROUPS.some((g) => g.providers.some((p) => p.id === id))).toBe(true);
    }
  });

  it("runs the new providers concurrently through the runner", async () => {
    const deps = makeDeps({
      fetch: async (input) => {
        const url = urlOf(input);
        if (url.includes("/search/repositories")) return jsonResponse({ items: [] });
        if (url.includes("itunes.apple.com")) return jsonResponse({ results: [] });
        if (url.includes(".vercel.app")) {
          return new Response(null, {
            status: 404,
            headers: { "x-vercel-error": "DEPLOYMENT_NOT_FOUND" },
          });
        }
        if (url.includes(".netlify.app")) {
          return new Response("Not Found - Request ID: x", { status: 404 });
        }
        return new Response(null, { status: 404 });
      },
    });
    const results = await runAvailabilityChecks(
      "acme",
      ["github:repo", "vercel", "netlify", "appstore"],
      deps,
    );
    expect(results.map((r) => r.provider)).toEqual([
      "github:repo",
      "vercel",
      "netlify",
      "appstore",
    ]);
    expect(results.every((r) => r.status === "available")).toBe(true);
    expect(results.every((r) => typeof r.durationMs === "number")).toBe(true);
  });

  it("degrades one provider's failure without failing the rest", async () => {
    const deps = makeDeps({
      fetch: async (input) => {
        const url = urlOf(input);
        if (url.includes("itunes.apple.com")) {
          throw new Error("network down");
        }
        if (url.includes(".vercel.app")) {
          return new Response(null, {
            status: 404,
            headers: { "x-vercel-error": "DEPLOYMENT_NOT_FOUND" },
          });
        }
        return new Response(null, { status: 500 });
      },
    });
    const results = await runAvailabilityChecks("acme", ["vercel", "appstore"], deps);
    const byId = new Map(results.map((r) => [r.provider, r]));
    expect(byId.get("appstore")).toMatchObject({ status: "unknown", available: null });
    expect(byId.get("vercel")).toMatchObject({ status: "available", available: true });
  });
});
