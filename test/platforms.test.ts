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

/** Deps where every request answers with `status` and an optional body. */
function statusDeps(status: number, body: string | null = null): ProviderDeps {
  return makeDeps({ fetch: async () => new Response(body, { status }) });
}

/** Deps that report the URL of the (single) request made. */
async function fetchUrl(providerId: string, name: string): Promise<string> {
  let seen = "";
  const deps = makeDeps({
    fetch: async (input) => {
      seen = urlOf(input);
      return new Response(null, { status: 404 });
    },
  });
  await check(providerId, name, deps);
  return seen;
}

async function check(providerId: string, name: string, deps: ProviderDeps) {
  const adapter = createAdapters(deps)[providerId as keyof ReturnType<typeof createAdapters>];
  return adapter.check(name, new AbortController().signal);
}

describe("simple page checks — 200 taken / 404 available / else unknown", () => {
  for (const id of [
    "huggingface",
    "nuget",
    "rubygems",
    "homebrew",
    "codepen",
    "figma",
    "dribbble",
    "behance",
    "substack",
    "producthunt",
    "medium",
  ] as const) {
    it(`${id}: 404 → available`, async () => {
      const r = await check(id, "acme", statusDeps(404));
      expect(r.status).toBe("available");
      expect(r.available).toBe(true);
    });

    it(`${id}: 200 → taken`, async () => {
      const r = await check(id, "acme", statusDeps(200));
      expect(r.status).toBe("taken");
      expect(r.available).toBe(false);
    });

    it(`${id}: 403/500 → unknown, never available`, async () => {
      for (const status of [403, 500, 503]) {
        const r = await check(id, "acme", statusDeps(status));
        expect(r.status).toBe("unknown");
        expect(r.available).not.toBe(true);
      }
    });
  }
});

describe("platform endpoints hit the right URL", () => {
  it("huggingface checks the profile page", async () => {
    expect(await fetchUrl("huggingface", "acme")).toBe("https://huggingface.co/acme");
  });

  it("nuget queries the flat-container registration index, lowercased", async () => {
    expect(await fetchUrl("nuget", "AcmePkg")).toBe(
      "https://api.nuget.org/v3-flatcontainer/acmepkg/index.json",
    );
  });

  it("rubygems queries the gems API", async () => {
    expect(await fetchUrl("rubygems", "acme")).toBe("https://rubygems.org/api/v1/gems/acme.json");
  });

  it("homebrew queries the formula JSON API", async () => {
    expect(await fetchUrl("homebrew", "acme")).toBe(
      "https://formulae.brew.sh/api/formula/acme.json",
    );
  });

  it("substack checks the publication subdomain", async () => {
    expect(await fetchUrl("substack", "acme")).toBe("https://acme.substack.com");
    const r = await check("substack", "acme", statusDeps(200));
    expect(r.subject).toBe("acme.substack.com");
  });

  it("medium checks the public RSS feed for the handle", async () => {
    expect(await fetchUrl("medium", "acme")).toBe("https://medium.com/feed/@acme");
    const r = await check("medium", "acme", statusDeps(200));
    expect(r.subject).toBe("@acme");
  });

  it("producthunt checks the profile page", async () => {
    expect(await fetchUrl("producthunt", "acme")).toBe("https://www.producthunt.com/@acme");
  });
});

describe("telegram — t.me is always 200, discriminate on the body", () => {
  it("page with tgme_page_title → taken", async () => {
    const r = await check(
      "telegram",
      "acmechannel",
      statusDeps(200, '<html><title class="tgme_page_title">Acme</title></html>'),
    );
    expect(r.status).toBe("taken");
    expect(r.subject).toBe("@acmechannel");
  });

  it("200 without the title marker → available", async () => {
    const r = await check(
      "telegram",
      "acmechannel",
      statusDeps(200, "<html>tgme_username_link</html>"),
    );
    expect(r.status).toBe("available");
  });

  it("rejects handles under 5 chars or starting with a digit", async () => {
    for (const name of ["ab1d", "1abcde"]) {
      const r = await check("telegram", name, statusDeps(404));
      expect(r.status).toBe("invalid");
    }
  });
});

describe("replit — undecidable server-side", () => {
  it("200 → taken", async () => {
    const r = await check("replit", "acme", statusDeps(200));
    expect(r.status).toBe("taken");
  });

  it("404 → unknown, never faked as available", async () => {
    const r = await check("replit", "acme", statusDeps(404));
    expect(r.status).toBe("unknown");
    expect(r.available).not.toBe(true);
  });
});

describe("pattern validation", () => {
  it("nuget rejects names over 128 chars", async () => {
    const r = await check("nuget", "a".repeat(129), statusDeps(404));
    expect(r.status).toBe("invalid");
  });

  it("rubygems rejects uppercase and invalid characters", async () => {
    const r = await check("rubygems", "Acme$", statusDeps(404));
    expect(r.status).toBe("invalid");
  });

  it("substack rejects leading-hyphen subdomains", async () => {
    const r = await check("substack", "-acme", statusDeps(404));
    expect(r.status).toBe("invalid");
  });

  it("producthunt rejects handles under 2 chars", async () => {
    const r = await check("producthunt", "a", statusDeps(404));
    expect(r.status).toBe("invalid");
  });
});

describe("registration wiring", () => {
  it("all 14 new provider ids are registered", () => {
    const adapters = createAdapters(makeDeps()) as Record<string, { id: string; check: unknown }>;
    for (const id of [
      "huggingface",
      "nuget",
      "rubygems",
      "homebrew",
      "codepen",
      "replit",
      "figma",
      "dribbble",
      "behance",
      "substack",
      "producthunt",
      "telegram",
      "medium",
    ]) {
      expect(adapters[id]?.id).toBe(id);
    }
  });
});
