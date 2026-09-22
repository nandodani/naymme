import { describe, expect, it } from "vitest";
import { defaultDeps, type ProviderDeps } from "../src/deps.js";
import { createAdapters } from "../src/providers/index.js";
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

/** RDAP bootstrap advertising the Google Registry (.app), .fr and .uk. */
const BOOTSTRAP = {
  services: [
    [["app"], ["https://pubapi.registry.google/rdap/"]],
    [["fr"], ["https://rdap.nic.fr/"]],
    [["uk"], ["https://rdap.nominet.uk/uk/"]],
  ],
};

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

/** Deps where every social/status endpoint answers with `status`. */
function statusDeps(status: number, body: string | null = null): ProviderDeps {
  return makeDeps({
    fetch: async (input) => {
      const url = urlOf(input);
      if (url.includes("iana.org")) return jsonResponse(BOOTSTRAP);
      return new Response(body, { status });
    },
  });
}

async function check(providerId: string, name: string, deps: ProviderDeps) {
  const adapter = createAdapters(deps)[providerId as keyof ReturnType<typeof createAdapters>];
  return adapter.check(name, new AbortController().signal);
}

describe("domain:app adapter — Google Registry RDAP", () => {
  it("maps RDAP 404 to available", async () => {
    const r = await check("domain:app", "acme", statusDeps(404));
    expect(r).toMatchObject({ status: "available", available: true, subject: "acme.app" });
  });

  it("maps RDAP 200 to taken", async () => {
    const r = await check("domain:app", "acme", statusDeps(200));
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("maps unexpected RDAP statuses to unknown", async () => {
    const r = await check("domain:app", "acme", statusDeps(500));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });
});

describe("european ccTLD adapters — RDAP where the IANA bootstrap lists it", () => {
  it("uses RDAP for .fr", async () => {
    const r = await check("domain:fr", "acme", statusDeps(200));
    expect(r).toMatchObject({ status: "taken", available: false, subject: "acme.fr" });
    expect(r.detail).toContain("rdap.nic.fr");
  });

  it("uses RDAP for .uk", async () => {
    const r = await check("domain:uk", "acme", statusDeps(404));
    expect(r).toMatchObject({ status: "available", available: true, subject: "acme.uk" });
  });
});

describe("european ccTLD adapters — WHOIS + DNS fallback", () => {
  const noRdapDeps = (extra: Partial<ProviderDeps>) =>
    makeDeps({
      fetch: async (input) => {
        if (urlOf(input).includes("iana.org")) return jsonResponse(BOOTSTRAP);
        return new Response(null, { status: 500 });
      },
      ...extra,
    });

  for (const id of ["domain:pt", "domain:es", "domain:de", "domain:eu"] as const) {
    it(`falls back to WHOIS for ${id}`, async () => {
      const r = await check(
        id,
        "acme",
        noRdapDeps({ whoisDomain: async () => ({ "whois.test": { __raw: "No match" } }) }),
      );
      expect(r).toMatchObject({ status: "available", available: true });
      expect(r.detail).toContain("whois fallback");
    });
  }

  it("upgrades inconclusive WHOIS to taken when NS records exist", async () => {
    const r = await check(
      "domain:pt",
      "acme",
      noRdapDeps({
        whoisDomain: async () => ({}),
        resolveNs: async () => ["ns1.example.com"],
      }),
    );
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("keeps unknown when WHOIS is inconclusive and no NS records resolve", async () => {
    const r = await check(
      "domain:eu",
      "acme",
      noRdapDeps({
        whoisDomain: async () => ({}),
        resolveNs: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
    );
    expect(r).toMatchObject({ status: "unknown", available: null });
  });
});

describe("new TLD adapters — RDAP-first with WHOIS/DNS fallback", () => {
  /** Bootstrap advertising the registries for the six new TLDs. */
  const NEW_BOOTSTRAP = {
    services: [
      [["co"], ["https://rdap.nic.co/"]],
      [["me"], ["https://rdap.identitydigital.services/rdap/"]],
      [["org"], ["https://rdap.publicinterestregistry.org/rdap/"]],
      [["sh"], ["https://rdap.identitydigital.services/rdap/"]],
      [["xyz"], ["https://rdap.centralnic.com/xyz/"]],
    ],
  };
  const rdapDeps = (status: number) =>
    makeDeps({
      fetch: async (input) => {
        if (urlOf(input).includes("iana.org")) return jsonResponse(NEW_BOOTSTRAP);
        return new Response(null, { status });
      },
    });

  for (const id of ["domain:co", "domain:me", "domain:org", "domain:sh", "domain:xyz"] as const) {
    it(`${id} maps RDAP 404 to available`, async () => {
      const r = await check(id, "acme", rdapDeps(404));
      expect(r).toMatchObject({ status: "available", available: true });
      expect(r.detail).toContain("rdap:");
    });

    it(`${id} maps RDAP 200 to taken`, async () => {
      const r = await check(id, "acme", rdapDeps(200));
      expect(r).toMatchObject({ status: "taken", available: false });
    });
  }

  it("domain:so (no RDAP service) falls back to WHOIS", async () => {
    const r = await check(
      "domain:so",
      "acme",
      makeDeps({
        fetch: async (input) => {
          if (urlOf(input).includes("iana.org")) return jsonResponse(NEW_BOOTSTRAP);
          return new Response(null, { status: 500 });
        },
        whoisDomain: async () => ({ "whois.nic.so": { __raw: "Not found" } }),
      }),
    );
    expect(r).toMatchObject({ status: "available", available: true });
    expect(r.detail).toContain("whois fallback");
  });

  it("new TLDs are registered in createAdapters", () => {
    const adapters = createAdapters(makeDeps());
    for (const id of ["co", "me", "org", "sh", "so", "xyz"]) {
      expect(adapters[`domain:${id}` as keyof typeof adapters]?.id).toBe(`domain:${id}`);
    }
  });
});

describe("social:x adapter", () => {
  it("maps 404 to available", async () => {
    expect(await check("social:x", "acme_co", statusDeps(404))).toMatchObject({
      status: "available",
      available: true,
    });
  });

  it("maps 200 to taken", async () => {
    expect(await check("social:x", "acme_co", statusDeps(200))).toMatchObject({
      status: "taken",
      available: false,
    });
  });

  it("maps rate limits and blocks to unknown", async () => {
    for (const status of [429, 403, 302]) {
      expect(await check("social:x", "acme_co", statusDeps(status))).toMatchObject({
        status: "unknown",
        available: null,
      });
    }
  });

  it("maps request failures to unknown", async () => {
    const r = await check(
      "social:x",
      "acme_co",
      makeDeps({
        fetch: async () => {
          throw new Error("network down");
        },
      }),
    );
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("rejects names X cannot host", async () => {
    expect(await check("social:x", "abc", statusDeps(404))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("social:bluesky adapter", () => {
  it("maps a resolved handle to taken", async () => {
    const r = await check(
      "social:bluesky",
      "acme",
      statusDeps(200, JSON.stringify({ did: "did:x" })),
    );
    expect(r).toMatchObject({ status: "taken", available: false, subject: "acme.bsky.social" });
  });

  it("maps an unresolved handle to available", async () => {
    const r = await check(
      "social:bluesky",
      "acme",
      statusDeps(400, JSON.stringify({ error: "InvalidRequest" })),
    );
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("maps unexpected statuses to unknown", async () => {
    expect(await check("social:bluesky", "acme", statusDeps(500))).toMatchObject({
      status: "unknown",
      available: null,
    });
  });

  it("rejects invalid handle labels", async () => {
    expect(await check("social:bluesky", "a_b", statusDeps(200))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("social:instagram adapter", () => {
  it("maps 404 to available", async () => {
    expect(await check("social:instagram", "acme", statusDeps(404))).toMatchObject({
      status: "available",
      available: true,
    });
  });

  it("maps 200 to taken", async () => {
    expect(await check("social:instagram", "acme", statusDeps(200))).toMatchObject({
      status: "taken",
      available: false,
    });
  });

  it("maps auth-required responses to unknown", async () => {
    const r = await check("social:instagram", "acme", statusDeps(401));
    expect(r).toMatchObject({ status: "unknown", available: null });
    expect(r.detail).toMatch(/authentication|blocked/i);
  });

  it("rejects handles with consecutive dots", async () => {
    expect(await check("social:instagram", "a..b", statusDeps(200))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("social:reddit adapter", () => {
  it("maps a 'true' body to available", async () => {
    expect(await check("social:reddit", "acme", statusDeps(200, "true"))).toMatchObject({
      status: "available",
      available: true,
    });
  });

  it("maps a 'false' body to taken", async () => {
    expect(await check("social:reddit", "acme", statusDeps(200, "false"))).toMatchObject({
      status: "taken",
      available: false,
    });
  });

  it("maps non-boolean bodies to unknown", async () => {
    expect(await check("social:reddit", "acme", statusDeps(200, "<html>"))).toMatchObject({
      status: "unknown",
      available: null,
    });
  });

  it("maps blocked responses to unknown", async () => {
    expect(await check("social:reddit", "acme", statusDeps(403))).toMatchObject({
      status: "unknown",
      available: null,
    });
  });

  it("rejects too-short usernames", async () => {
    expect(await check("social:reddit", "ab", statusDeps(200, "true"))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("social:youtube adapter", () => {
  it("maps 404 to available", async () => {
    expect(await check("social:youtube", "acme", statusDeps(404))).toMatchObject({
      status: "available",
      available: true,
    });
  });

  it("maps 200 to taken", async () => {
    expect(await check("social:youtube", "acme", statusDeps(200))).toMatchObject({
      status: "taken",
      available: false,
    });
  });

  it("maps other statuses to unknown", async () => {
    expect(await check("social:youtube", "acme", statusDeps(429))).toMatchObject({
      status: "unknown",
      available: null,
    });
  });

  it("rejects too-short handles", async () => {
    expect(await check("social:youtube", "ab", statusDeps(404))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("social:tiktok adapter", () => {
  it("maps statusCode 0 to taken", async () => {
    const html = '<script id="__UNIVERSAL_DATA__">{"statusCode":0,"userInfo":{}}</script>';
    expect(await check("social:tiktok", "acme", statusDeps(200, html))).toMatchObject({
      status: "taken",
      available: false,
    });
  });

  it("maps user-not-found statusCodes to available", async () => {
    for (const code of [10202, 10221, 10245]) {
      const html = `{"statusCode":${code}}`;
      expect(await check("social:tiktok", "acme", statusDeps(200, html))).toMatchObject({
        status: "available",
        available: true,
      });
    }
  });

  it("maps pages without the marker to unknown", async () => {
    expect(await check("social:tiktok", "acme", statusDeps(200, "<html></html>"))).toMatchObject({
      status: "unknown",
      available: null,
    });
  });

  it("maps non-200 responses to unknown", async () => {
    expect(await check("social:tiktok", "acme", statusDeps(503))).toMatchObject({
      status: "unknown",
      available: null,
    });
  });

  it("rejects one-character handles", async () => {
    expect(await check("social:tiktok", "a", statusDeps(200))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("gitlab adapter", () => {
  const gitlabDeps = (usersBody: string | null, usersStatus = 200, groupsStatus = 404) =>
    makeDeps({
      fetch: async (input) => {
        const url = urlOf(input);
        if (url.includes("/api/v4/users")) return new Response(usersBody, { status: usersStatus });
        if (url.includes("/api/v4/groups")) return new Response(null, { status: groupsStatus });
        return new Response(null, { status: 500 });
      },
    });

  it("maps an existing user to taken", async () => {
    const r = await check("gitlab", "acme", gitlabDeps('[{"username":"acme"}]'));
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("maps an existing group to taken", async () => {
    const r = await check("gitlab", "acme", gitlabDeps("[]", 200, 200));
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("maps a private group (403) to taken", async () => {
    const r = await check("gitlab", "acme", gitlabDeps("[]", 200, 403));
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("maps no user and no group to available", async () => {
    const r = await check("gitlab", "acme", gitlabDeps("[]"));
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("maps API errors to unknown", async () => {
    const r = await check("gitlab", "acme", gitlabDeps(null, 500));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("rejects names GitLab cannot host", async () => {
    const r = await check("gitlab", "a b", makeDeps());
    expect(r).toMatchObject({ status: "invalid", available: false });
  });
});

describe("pypi adapter", () => {
  it("maps 404 to available", async () => {
    const r = await check("pypi", "acme", statusDeps(404));
    expect(r).toMatchObject({ status: "available", available: true, subject: "acme" });
  });

  it("maps 200 to taken and normalizes separators", async () => {
    const r = await check("pypi", "Acme_Lib", statusDeps(200));
    expect(r).toMatchObject({ status: "taken", available: false, subject: "acme-lib" });
  });

  it("maps unexpected statuses to unknown", async () => {
    const r = await check("pypi", "acme", statusDeps(500));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("rejects names PyPI cannot host", async () => {
    const r = await check("pypi", "-acme", statusDeps(404));
    expect(r).toMatchObject({ status: "invalid", available: false });
  });
});

describe("crates adapter", () => {
  it("maps 404 to available", async () => {
    const r = await check("crates", "acme", statusDeps(404));
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("maps 200 to taken", async () => {
    const r = await check("crates", "acme", statusDeps(200));
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("maps unexpected statuses to unknown", async () => {
    const r = await check("crates", "acme", statusDeps(429));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("rejects names crates.io cannot host", async () => {
    const r = await check("crates", "acme.lib", statusDeps(404));
    expect(r).toMatchObject({ status: "invalid", available: false });
  });
});

describe("dockerhub adapter", () => {
  it("maps 404 to available", async () => {
    const r = await check("dockerhub", "acme", statusDeps(404));
    expect(r).toMatchObject({ status: "available", available: true });
  });

  it("maps 200 to taken", async () => {
    const r = await check("dockerhub", "acme", statusDeps(200));
    expect(r).toMatchObject({ status: "taken", available: false });
  });

  it("maps unexpected statuses to unknown", async () => {
    const r = await check("dockerhub", "acme", statusDeps(500));
    expect(r).toMatchObject({ status: "unknown", available: null });
  });

  it("rejects too-short namespaces and uppercase names", async () => {
    expect(await check("dockerhub", "abc", statusDeps(404))).toMatchObject({
      status: "invalid",
      available: false,
    });
    expect(await check("dockerhub", "Acme", statusDeps(404))).toMatchObject({
      status: "invalid",
      available: false,
    });
  });
});

describe("provider isolation across the new adapters", () => {
  it("a hung social fetch degrades to unknown inside the timeout", async () => {
    const deps = makeDeps({
      timeoutMs: 50,
      fetch: () => new Promise<Response>(() => undefined),
    });
    const results = await runAvailabilityChecks("acme", ["social:youtube"], deps);
    expect(results[0]).toMatchObject({ provider: "social:youtube", status: "unknown" });
    expect(results[0]!.detail).toMatch(/timed out/);
  });
});
