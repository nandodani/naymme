import { describe, expect, it } from "vitest";
import { defaultDeps, type ProviderDeps } from "../src/deps.js";
import { createAdapters } from "../src/providers/index.js";
import { checkAvailability, runAvailabilityChecks } from "../src/tools/checkAvailability.js";

/** RequestInfo → URL string without relying on toString fallbacks. */
const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** RDAP bootstrap with only .com/.dev/.io services — .gg exercises WHOIS. */
const BOOTSTRAP = {
  services: [
    [["com"], ["https://rdap.test/com/v1/"]],
    [["dev"], ["https://rdap.test/dev/v1/"]],
    [["io"], ["https://rdap.test/io/"]],
  ],
};

function makeDeps(overrides: Partial<ProviderDeps> = {}): ProviderDeps {
  return defaultDeps({
    fetch: async () => new Response(null, { status: 500 }),
    whoisDomain: async () => ({}),
    npmNameAvailable: async () => true,
    timeoutMs: 50,
    ...overrides,
  });
}

function rdapDeps(rdapStatus: number): ProviderDeps {
  return makeDeps({
    fetch: async (input) => {
      const url = urlOf(input);
      if (url.includes("iana.org")) return jsonResponse(BOOTSTRAP);
      if (url.includes("rdap.test")) return new Response(null, { status: rdapStatus });
      return new Response(null, { status: 500 });
    },
  });
}

async function check(providerId: string, name: string, deps: ProviderDeps) {
  const adapter = createAdapters(deps)[providerId as keyof ReturnType<typeof createAdapters>];
  return adapter.check(name, new AbortController().signal);
}

describe("domain adapter — RDAP path", () => {
  it("maps RDAP 404 to available", async () => {
    const r = await check("domain:com", "acme", rdapDeps(404));
    expect(r).toMatchObject({ status: "available", available: true, subject: "acme.com" });
  });

  it("maps RDAP 200 to taken", async () => {
    const r = await check("domain:com", "acme", rdapDeps(200));
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("maps unexpected statuses to unknown", async () => {
    const r = await check("domain:com", "acme", rdapDeps(500));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("rejects invalid domain labels", async () => {
    const r = await check("domain:com", "ac_me", rdapDeps(404));
    expect(r).toMatchObject({ status: "invalid", available: false });
  });
});

describe("domain adapter — WHOIS fallback", () => {
  const noRdapDeps = (whoisDomain: ProviderDeps["whoisDomain"]) =>
    makeDeps({
      fetch: async (input) => {
        if (urlOf(input).includes("iana.org")) return jsonResponse(BOOTSTRAP);
        return new Response(null, { status: 500 });
      },
      whoisDomain,
    });

  it("maps 'no match' WHOIS text to available", async () => {
    const r = await check(
      "domain:gg",
      "acme",
      noRdapDeps(async () => ({ "whois.gg": { __raw: 'No match for "ACME.GG".' } })),
    );
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("maps a registration record to taken", async () => {
    const r = await check(
      "domain:gg",
      "acme",
      noRdapDeps(async () => ({
        "whois.gg": { "Domain Name": "acme.gg", Registrar: "Example Registrar" },
      })),
    );
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("maps inconclusive WHOIS output to unknown", async () => {
    const r = await check(
      "domain:gg",
      "acme",
      noRdapDeps(async () => ({})),
    );
    expect(r).toMatchObject({ status: "unknown", available: null });
  });
});

describe("github adapter", () => {
  const deps = (status: number) => makeDeps({ fetch: async () => new Response(null, { status }) });

  it("maps 404 to available", async () => {
    expect(await check("github", "acme", deps(404))).toMatchObject({
      status: "available",
      available: true,
    });
  });

  it("maps 200 to taken", async () => {
    expect(await check("github", "acme", deps(200))).toMatchObject({
      status: "taken",
      available: false,
    });
  });

  it("maps rate-limit 403 to unknown", async () => {
    const r = await check("github", "acme", deps(403));
    expect(r).toMatchObject({ status: "unknown", available: null });
    expect(r.detail).toMatch(/rate limit/i);
  });

  it("rejects names GitHub cannot host", async () => {
    const r = await check("github", "a--b", deps(404));
    expect(r).toMatchObject({ status: "invalid", available: false });
  });
});

describe("npm adapter", () => {
  it("maps true to available", async () => {
    const r = await check("npm", "acme", makeDeps({ npmNameAvailable: async () => true }));
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("maps false to taken", async () => {
    const r = await check("npm", "acme", makeDeps({ npmNameAvailable: async () => false }));
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("maps registry errors to unknown", async () => {
    const r = await check(
      "npm",
      "acme",
      makeDeps({
        npmNameAvailable: async () => {
          throw new Error("registry down");
        },
      }),
    );
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("rejects names npm cannot host", async () => {
    const r = await check("npm", "Acme", makeDeps());
    expect(r).toMatchObject({ status: "invalid", available: false });
  });
});

describe("runAvailabilityChecks — timeout & failure isolation", () => {
  it("turns hung providers into 'unknown' after the timeout", async () => {
    const deps = makeDeps({
      timeoutMs: 50,
      fetch: () => new Promise<Response>(() => undefined), // never resolves
      whoisDomain: () => new Promise(() => undefined),
    });
    const results = await runAvailabilityChecks("acme", ["domain:com"], deps);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ provider: "domain:com", status: "unknown" });
    expect(results[0]!.detail).toMatch(/timed out/);
  });

  it("a throwing provider does not affect the others", async () => {
    const deps = makeDeps({
      fetch: async (input) => {
        const url = urlOf(input);
        if (url.includes("github.com") || url.includes("api.github")) throw new Error("boom");
        if (url.includes("iana.org")) return jsonResponse(BOOTSTRAP);
        if (url.includes("rdap.test")) return new Response(null, { status: 404 });
        return new Response(null, { status: 500 });
      },
      npmNameAvailable: async () => true,
    });
    const results = await runAvailabilityChecks("acme", ["github", "npm", "domain:com"], deps);
    expect(results).toHaveLength(3);
    expect(results.find((r) => r.provider === "github")).toMatchObject({ status: "unknown" });
    expect(results.find((r) => r.provider === "npm")).toMatchObject({ status: "available" });
    expect(results.find((r) => r.provider === "domain:com")).toMatchObject({
      status: "available",
    });
  });
});

describe("checkAvailability", () => {
  it("returns results for each selected provider plus a summary", async () => {
    const out = await checkAvailability(
      { name: "acme", providers: ["github", "npm"] },
      makeDeps({
        fetch: async () => new Response(null, { status: 404 }),
        npmNameAvailable: async () => false,
      }),
    );
    expect(out.results.map((r) => r.provider)).toEqual(["github", "npm"]);
    expect(out.summary).toEqual({ available: 1, taken: 1, unknown: 0, invalid: 0 });
  });
});
