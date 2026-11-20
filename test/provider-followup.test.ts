import { describe, expect, it, vi, afterEach } from "vitest";
import { defaultDeps, type ProviderDeps } from "../src/deps.js";
import { createAdapters } from "../src/providers/index.js";
import { runAvailabilityChecks } from "../src/tools/checkAvailability.js";

const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

function deps(overrides: Partial<ProviderDeps> = {}): ProviderDeps {
  return defaultDeps({
    fetch: async () => Response.json({ services: [] }),
    resolveNs: async () => [],
    whoisDomain: async () => ({}),
    ...overrides,
  });
}

async function check(id: string, overrides: Partial<ProviderDeps> = {}) {
  const [result] = await runAvailabilityChecks("microsoft", [id], deps(overrides));
  return result;
}

describe("domain fallback reliability", () => {
  it(".pt explains registry CAPTCHA limits without treating a page shell as available", async () => {
    const result = await check("domain:pt", {
      fetch: async (input) =>
        urlOf(input).includes("pt.pt/")
          ? new Response('<div class="connection-limit-captcha">Por questões de segurança</div>')
          : Response.json({ services: [] }),
    });
    expect(result).toMatchObject({ status: "unknown", available: null });
    expect(result?.detail).toMatch(/rate.limit.*captcha/i);
  });
  it.each(["domain:es", "domain:pt", "domain:sh"])(
    "%s uses delegation before a hanging WHOIS lookup",
    async (id) => {
      expect(
        await check(id, {
          timeoutMs: 50,
          resolveNs: async () => ["ns1.example.com"],
          whoisDomain: () => new Promise(() => undefined),
        }),
      ).toMatchObject({ status: "taken" });
    },
  );

  it(".es fails fast without pretending absent DNS means free", async () => {
    const whois = vi.fn(async () => "No match");
    const result = await check("domain:es", { whoisDomain: whois });
    expect(result).toMatchObject({ status: "unknown", available: null });
    expect(result?.detail).toMatch(/no reliable.*availability/i);
    expect(whois).not.toHaveBeenCalled();
  });

  it.each(["available", "unavailable"])(
    "uses the .pt registry's exact %s result",
    async (status) => {
      expect(
        await check("domain:pt", {
          fetch: async (input) =>
            urlOf(input).includes("pt.pt/pt/dominios/?site=microsoft")
              ? new Response(
                  `<div class="status ${status}">O domínio <span>"<span class="coloured">microsoft.pt</span>"</span> está disponível!</div>`,
                )
              : Response.json({ services: [] }),
        }),
      ).toMatchObject({ status: status === "available" ? "available" : "taken" });
    },
  );

  it.each([
    "",
    '<div class="status available">O domínio <span>"<span class="coloured">other.pt</span>"</span></div>',
  ])(".pt rejects missing or mismatched registry results", async (body) => {
    expect(
      await check("domain:pt", {
        fetch: async (input) =>
          urlOf(input).includes("pt.pt/") ? new Response(body) : Response.json({ services: [] }),
      }),
    ).toMatchObject({ status: "unknown", available: null });
  });

  it.each(["network", "503"])(
    ".pt keeps %s errors unknown without attempting TCP WHOIS",
    async (failure) => {
      const whois = vi.fn(async () => "No match");
      expect(
        await check("domain:pt", {
          whoisDomain: whois,
          resolveNs: async () => {
            throw new Error("ENOTFOUND");
          },
          fetch: async (input) => {
            if (!urlOf(input).includes("pt.pt/")) return Response.json({ services: [] });
            if (failure === "network") throw new TypeError("fetch failed");
            return new Response(null, { status: 503 });
          },
        }),
      ).toMatchObject({ status: "unknown", available: null });
      expect(whois).not.toHaveBeenCalled();
    },
  );

  it("uses the IANA-listed .co WHOIS host rather than whoiser's stale host", async () => {
    expect(
      await check("domain:co", {
        whoisDomain: async (_name, options) =>
          "host" in options && options.host === "whois.registry.co"
            ? "The queried object does not exist: DOMAIN NOT FOUND"
            : { error: "getaddrinfo ENOTFOUND whois.nic.co" },
      }),
    ).toMatchObject({ status: "available" });
  });

  it.each([
    [{ "Domain Name": "MICROSOFT.CO" }, "taken"],
    [{}, "unknown"],
  ] as const)(
    ".co requires positive registration or unclaimed evidence: %j",
    async (payload, status) => {
      expect(await check("domain:co", { whoisDomain: async () => payload })).toMatchObject({
        status,
      });
    },
  );

  it("retries an inconclusive .sh WHOIS lookup once without inventing a verdict", async () => {
    let calls = 0;
    expect(
      await check("domain:sh", {
        whoisDomain: async () =>
          ++calls === 1 ? { error: "Timeout" } : { "Domain Name": "microsoft.sh" },
      }),
    ).toMatchObject({ status: "taken" });
    expect(calls).toBe(2);
  });

  it("keeps repeated .sh failures unknown with bounded attempts", async () => {
    const whois = vi.fn<ProviderDeps["whoisDomain"]>(async () => {
      throw new Error("connection reset");
    });
    expect(await check("domain:sh", { whoisDomain: whois })).toMatchObject({
      status: "unknown",
      available: null,
    });
    expect(whois).toHaveBeenCalledTimes(2);
    expect(whois.mock.calls[0]?.[1].timeout).toBeLessThanOrEqual(1500);
  });

  it(".sh retries empty WHOIS output but does not retry a verified unclaimed response", async () => {
    const whois = vi.fn().mockResolvedValueOnce({}).mockResolvedValue("Domain not found.");
    expect(await check("domain:sh", { whoisDomain: whois })).toMatchObject({ status: "available" });
    expect(whois).toHaveBeenCalledTimes(2);
    whois.mockClear();
    expect(await check("domain:sh", { whoisDomain: whois })).toMatchObject({ status: "available" });
    expect(whois).toHaveBeenCalledTimes(1);
  });
});

describe("Telegram transient failures", () => {
  it.each(["network", "503"])(
    "retries a %s failure and verifies a public profile",
    async (failure) => {
      let calls = 0;
      expect(
        await check("telegram", {
          fetch: async () => {
            if (++calls === 1) {
              if (failure === "network") throw new TypeError("fetch failed");
              return new Response(null, { status: 503 });
            }
            return new Response('<div class="tgme_page_title">Microsoft</div>');
          },
        }),
      ).toMatchObject({ status: "taken" });
      expect(calls).toBe(2);
    },
  );

  it("never turns persistent network failures into available", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await check("telegram", { fetch: fetcher })).toMatchObject({
      status: "unknown",
      available: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retries an incomplete page before accepting a public profile", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(""))
      .mockResolvedValue(new Response('<div class="tgme_page_title">Microsoft</div>'));
    expect(await check("telegram", { fetch: fetcher })).toMatchObject({ status: "taken" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([403, 429])("does not retry HTTP %s denials", async (status) => {
    const fetcher = vi.fn(async () => new Response(null, { status }));
    expect(await check("telegram", { fetch: fetcher })).toMatchObject({ status: "unknown" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("Replit evidence", () => {
  it("does not follow a profile login redirect and misread the login shell", async () => {
    expect(
      await check("replit", {
        fetch: async (_url, init) =>
          init?.redirect === "manual"
            ? new Response(null, {
                status: 302,
                headers: {
                  location: "https://replit.com/login?source=root-profile&goto=%2F%40microsoft",
                },
              })
            : new Response("login shell"),
      }),
    ).toMatchObject({ status: "taken" });
  });
  it("explains why a generic Replit 404 is not an availability marker", async () => {
    const result = await check("replit", {
      fetch: async () => new Response("Resource not found", { status: 404 }),
    });
    expect(result).toMatchObject({ status: "unknown", available: null });
    expect(result?.detail).toMatch(/no verified.*availability/i);
  });
  it("does not mistake an unrelated login or success shell for a profile", async () => {
    expect(await check("replit", { fetch: async () => new Response("login shell") })).toMatchObject(
      { status: "unknown" },
    );
  });

  it.each([
    "https://example.com/login?source=root-profile&goto=%2F%40microsoft",
    "https://replit.com/login?goto=%2F%40microsoft",
    "https://replit.com/login?source=root-profile&goto=%2F%40other",
  ])("rejects unrelated login redirects: %s", async (location) => {
    expect(
      await check("replit", {
        fetch: async () => new Response(null, { status: 302, headers: { location } }),
      }),
    ).toMatchObject({ status: "unknown" });
  });

  it("keeps network errors unknown", async () => {
    expect(
      await check("replit", {
        fetch: async () => {
          throw new TypeError("fetch failed");
        },
      }),
    ).toMatchObject({ status: "unknown" });
  });
});

it.each(["domain:pt", "domain:sh", "telegram", "replit"] as const)(
  "%s propagates abort errors without retrying",
  async (id) => {
    const error = new DOMException("aborted", "AbortError");
    const fail = vi.fn(async () => {
      throw error;
    });
    const adapters = createAdapters(
      deps({
        fetch: async (input) =>
          urlOf(input).includes("iana.org") ? Response.json({ services: [] }) : fail(),
        whoisDomain: fail,
      }),
    );
    await expect(adapters[id].check("microsoft", new AbortController().signal)).rejects.toBe(error);
    expect(fail).toHaveBeenCalledTimes(1);
  },
);

describe("optional GitHub authentication", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reads GITHUB_TOKEN into Node deps without requiring it", () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    expect(defaultDeps()).toHaveProperty("githubToken", "test-token");
  });
  it("does not require a token or send an empty Authorization header", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    expect(defaultDeps().githubToken).toBe("");
    const adapters = createAdapters(
      deps({
        fetch: async (_url, init) => {
          expect(new Headers(init?.headers).has("authorization")).toBe(false);
          return new Response(null, { status: 404 });
        },
      }),
    );
    expect(
      await adapters["github:user"].check("microsoft", new AbortController().signal),
    ).toMatchObject({ status: "available" });
  });
  it.each(["github:user", "github:org", "github:repo"] as const)(
    "%s authenticates when configured",
    async (id) => {
      vi.stubEnv("GITHUB_TOKEN", "test-token");
      const adapters = createAdapters(
        defaultDeps({
          fetch: async (_url, init) => {
            if (new Headers(init?.headers).get("authorization") !== "Bearer test-token")
              return new Response(null, { status: 403 });
            return Response.json(
              id === "github:repo"
                ? { items: [{ name: "microsoft", full_name: "example/microsoft" }] }
                : { type: "Organization" },
            );
          },
        }),
      );
      expect(await adapters[id]?.check("microsoft", new AbortController().signal)).toMatchObject({
        status: "taken",
      });
    },
  );
  it("does not leak a rejected credential into the outcome", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    const result = await check("github:user", {
      fetch: async () => new Response(null, { status: 401 }),
    });
    expect(result).toMatchObject({ status: "unknown", available: null });
    expect(JSON.stringify(result)).not.toContain("test-token");
  });
});
