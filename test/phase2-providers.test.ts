import { describe, expect, it } from "vitest";
import { ALL_PROVIDER_IDS, PROVIDER_GROUPS } from "../lib/provider-meta.js";
import { platformLinks } from "../lib/links.js";
import { defaultDeps, type DnsExistence, type ProviderDeps } from "../src/deps.js";
import { createAdapters } from "../src/providers/index.js";
import { PROVIDER_IDS, resolveProviderIds } from "../src/schemas.js";
import { runAvailabilityChecks } from "../src/tools/checkAvailability.js";

/** RequestInfo → URL string without relying on toString fallbacks. */
const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

const NXDOMAIN: DnsExistence = { answers: [], nxdomain: true };
const NODATA: DnsExistence = { answers: [], nxdomain: false };

function makeDeps(overrides: Partial<ProviderDeps> = {}): ProviderDeps {
  return defaultDeps({
    fetch: async () => new Response(null, { status: 500 }),
    whoisDomain: async () => ({}),
    resolveNs: async () => [],
    resolveAny: async () => NODATA,
    npmNameAvailable: async () => true,
    timeoutMs: 50,
    ...overrides,
  });
}

async function check(providerId: string, name: string, deps: ProviderDeps) {
  const adapter = createAdapters(deps)[providerId as keyof ReturnType<typeof createAdapters>];
  return adapter.check(name, new AbortController().signal);
}

/** Deps whose DNS probe always answers `answer`. */
function dnsDeps(answer: DnsExistence): ProviderDeps {
  return makeDeps({ resolveAny: async () => answer });
}

describe("cloudflare adapter (pages.dev DNS check)", () => {
  it("maps NXDOMAIN to available", async () => {
    const r = await check("cloudflare", "acme", dnsDeps(NXDOMAIN));
    expect(r).toMatchObject({ status: "available", available: true, subject: "acme.pages.dev" });
  });

  it("maps a resolving name to taken", async () => {
    const r = await check(
      "cloudflare",
      "acme",
      dnsDeps({ answers: ["172.66.44.172"], nxdomain: false }),
    );
    expect(r).toMatchObject({ status: "taken", available: false, subject: "acme.pages.dev" });
  });

  it("keeps NODATA answers unknown — existence without records is ambiguous", async () => {
    const r = await check("cloudflare", "acme", dnsDeps(NODATA));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("maps DNS lookup failures to unknown", async () => {
    const r = await check(
      "cloudflare",
      "acme",
      makeDeps({
        resolveAny: async () => {
          throw new Error("resolver unreachable");
        },
      }),
    );
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("rejects names that are not valid subdomains", async () => {
    expect(await check("cloudflare", "Acme", dnsDeps(NXDOMAIN))).toMatchObject({
      status: "invalid",
      available: false,
    });
    expect(await check("cloudflare", "a_b", dnsDeps(NXDOMAIN))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("flyio adapter (fly.dev DNS check)", () => {
  it("maps NXDOMAIN to available", async () => {
    const r = await check("flyio", "acme", dnsDeps(NXDOMAIN));
    expect(r).toMatchObject({ status: "available", available: true, subject: "acme.fly.dev" });
  });

  it("maps a resolving name to taken", async () => {
    const r = await check(
      "flyio",
      "acme",
      dnsDeps({ answers: ["66.241.125.127"], nxdomain: false }),
    );
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("keeps NODATA answers unknown", async () => {
    const r = await check("flyio", "acme", dnsDeps(NODATA));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("maps DNS lookup failures to unknown", async () => {
    const r = await check(
      "flyio",
      "acme",
      makeDeps({
        resolveAny: async () => {
          throw new Error("SERVFAIL");
        },
      }),
    );
    expect(r).toMatchObject({ status: "unknown", available: null });
  });
});

describe("supabase adapter (supabase.co DNS check)", () => {
  it("maps NXDOMAIN to available", async () => {
    const r = await check("supabase", "acme", dnsDeps(NXDOMAIN));
    expect(r).toMatchObject({ status: "available", available: true, subject: "acme.supabase.co" });
  });

  it("maps a resolving name to taken", async () => {
    const r = await check(
      "supabase",
      "acme",
      dnsDeps({ answers: ["166.117.242.113"], nxdomain: false }),
    );
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("keeps NODATA answers unknown", async () => {
    const r = await check("supabase", "acme", dnsDeps(NODATA));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });
});

describe("railway adapter (up.railway.app edge check)", () => {
  const railwayDeps = (status: number, opts: { fallback?: boolean; body?: string } = {}) =>
    makeDeps({
      fetch: async () =>
        new Response(opts.body ?? null, {
          status,
          headers:
            opts.fallback === true
              ? { "x-railway-fallback": "true", "x-railway-request-id": "req-1" }
              : {},
        }),
    });

  it("maps the edge fallback 404 to available", async () => {
    const r = await check(
      "railway",
      "acme",
      railwayDeps(404, {
        fallback: true,
        body: '{"status":"error","code":404,"message":"Application not found"}',
      }),
    );
    expect(r).toMatchObject({
      status: "available",
      available: true,
      subject: "acme.up.railway.app",
    });
  });

  it("maps a served app to taken", async () => {
    for (const status of [200, 301]) {
      const r = await check("railway", "acme", railwayDeps(status, { body: "<html>app</html>" }));
      expect(r).toMatchObject({ status: "taken", available: false });
    }
  });

  it("keeps a 404 missing either edge marker unknown", async () => {
    const headerOnly = await check("railway", "acme", railwayDeps(404, { fallback: true }));
    expect(headerOnly).toMatchObject({ status: "unknown", available: null });
    const bodyOnly = await check(
      "railway",
      "acme",
      railwayDeps(404, { body: '{"message":"Application not found"}' }),
    );
    expect(bodyOnly).toMatchObject({ status: "unknown", available: null });
  });

  it("maps rate limits and edge failures to unknown", async () => {
    for (const status of [429, 500, 503]) {
      const r = await check("railway", "acme", railwayDeps(status));
      expect(r).toMatchObject({ status: "unknown", available: null });
    }
  });

  it("rejects names that are not valid subdomains", async () => {
    expect(await check("railway", "-acme", railwayDeps(404))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("Phase 2 integration", () => {
  const PHASE2 = ["cloudflare", "flyio", "railway", "supabase"] as const;

  it("registers every Phase 2 provider in the adapter registry", () => {
    const adapters = createAdapters(makeDeps());
    for (const id of PHASE2) {
      expect(adapters[id]?.id).toBe(id);
    }
  });

  it("selects the new providers by name and via the all alias", () => {
    expect(resolveProviderIds([...PHASE2])).toEqual([...PHASE2]);
    for (const id of PHASE2) {
      expect(resolveProviderIds(["all"])).toContain(id);
    }
  });

  it("renders every provider in the categorized grid — no orphans", () => {
    expect([...ALL_PROVIDER_IDS].sort()).toEqual([...PROVIDER_IDS].sort());
  });

  it("gives every new provider claim/profile links and a grid group", () => {
    for (const id of PHASE2) {
      expect(platformLinks(id)).not.toBeNull();
      expect(PROVIDER_GROUPS.some((g) => g.providers.some((p) => p.id === id))).toBe(true);
    }
  });

  it("runs the new providers concurrently through the runner", async () => {
    const deps = makeDeps({
      fetch: async (input) => {
        const url = urlOf(input);
        if (url.includes(".up.railway.app")) {
          return new Response('{"status":"error","message":"Application not found"}', {
            status: 404,
            headers: { "x-railway-fallback": "true", "x-railway-request-id": "req-1" },
          });
        }
        return new Response(null, { status: 404 });
      },
      resolveAny: async () => NXDOMAIN,
    });
    const results = await runAvailabilityChecks("acme", [...PHASE2], deps);
    expect(results.map((r) => r.provider)).toEqual([...PHASE2]);
    expect(results.every((r) => r.status === "available")).toBe(true);
    expect(results.every((r) => typeof r.durationMs === "number")).toBe(true);
  });
});
