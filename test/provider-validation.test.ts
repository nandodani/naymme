import { describe, expect, it } from "vitest";
import { defaultDeps, type ProviderDeps } from "../src/deps.js";
import { createAdapters } from "../src/providers/index.js";
import { PROVIDER_NAME_RULES, validateName, type NameRule } from "../src/providers/validation.js";
import { PROVIDER_IDS, type ProviderId } from "../src/schemas.js";

/** RequestInfo → URL string without relying on toString fallbacks. */
const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** RDAP bootstrap with only .com/.dev/.io services — other TLDs hit WHOIS. */
const BOOTSTRAP = {
  services: [
    [["com"], ["https://rdap.test/com/v1/"]],
    [["dev"], ["https://rdap.test/dev/v1/"]],
    [["io"], ["https://rdap.test/io/v1/"]],
  ],
};

interface CountingDeps {
  deps: ProviderDeps;
  fetchCalls: () => number;
  npmCalls: () => number;
}

function makeDeps(overrides: Partial<ProviderDeps> = {}): CountingDeps {
  let fetches = 0;
  let npm = 0;
  const deps = defaultDeps({
    fetch: async (input) => {
      fetches += 1;
      if (urlOf(input).includes("iana.org")) return jsonResponse(BOOTSTRAP);
      // 404: most adapters read it as "available"; a few (bluesky, telegram,
      // replit, tiktok) stay `unknown` — either way it is not `invalid`.
      return new Response(null, { status: 404 });
    },
    whoisDomain: async () => ({}),
    resolveNs: async () => [],
    npmNameAvailable: async () => {
      npm += 1;
      return true;
    },
    timeoutMs: 50,
    ...overrides,
  });
  return { deps, fetchCalls: () => fetches, npmCalls: () => npm };
}

async function check(providerId: ProviderId, name: string, deps: ProviderDeps) {
  const adapter = createAdapters(deps)[providerId];
  return adapter.check(name, new AbortController().signal);
}

const TOO_SHORT = /too short/i;
const TOO_LONG = /too long/i;
const DISALLOWED = /disallowed character/i;
const START_LETTER_OR_DIGIT = /must start with a letter or digit/i;
const START_LETTER = /must start with a letter/i;
const END_LETTER_OR_DIGIT = /must end with a letter or digit/i;

interface ProviderCases {
  /** Names satisfying every rule — validation must let them through. */
  readonly valid: readonly string[];
  readonly invalid: readonly { name: string; reason: RegExp }[];
}

/**
 * Boundary matrix: per provider, names that must pass validation plus
 * names violating each rule class (length bounds, charset, constraints)
 * with the reason class expected in the invalid detail.
 */
const CASES: Record<ProviderId, ProviderCases> = {
  "domain:com": {
    valid: ["acme", "ac-me", "Acme", "a", "a".repeat(63)],
    invalid: [
      { name: "ac_me", reason: DISALLOWED },
      { name: "ac.me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
      { name: "a".repeat(64), reason: TOO_LONG },
    ],
  },
  "domain:gg": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:dev": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:io": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:ai": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:app": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:pt": {
    valid: ["acme", "ab"],
    invalid: [
      { name: "a", reason: TOO_SHORT },
      { name: "a".repeat(64), reason: TOO_LONG },
      { name: "ac_me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
    ],
  },
  "domain:es": {
    valid: ["acme", "abc"],
    invalid: [
      { name: "ab", reason: TOO_SHORT },
      { name: "ac_me", reason: DISALLOWED },
    ],
  },
  "domain:de": {
    valid: ["acme", "a"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:fr": {
    valid: ["acme", "a"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:uk": {
    valid: ["acme", "a"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:eu": {
    valid: ["acme", "ab"],
    invalid: [
      { name: "a", reason: TOO_SHORT },
      { name: "ac_me", reason: DISALLOWED },
    ],
  },
  "domain:co": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:me": {
    valid: ["acme", "abc"],
    invalid: [
      { name: "ab", reason: TOO_SHORT },
      { name: "ac_me", reason: DISALLOWED },
    ],
  },
  "domain:org": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:sh": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:so": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:xyz": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:design": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:store": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:work": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:studio": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:tech": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:agency": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "domain:space": {
    valid: ["acme"],
    invalid: [{ name: "ac_me", reason: DISALLOWED }],
  },
  "github:user": {
    valid: ["acme", "ac-me", "a".repeat(39)],
    invalid: [
      { name: "a".repeat(40), reason: TOO_LONG },
      { name: "ac_me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
      { name: "a--b", reason: /consecutive hyphens/i },
    ],
  },
  "github:org": {
    valid: ["acme", "ac-me"],
    invalid: [
      { name: "ac_me", reason: DISALLOWED },
      { name: "a--b", reason: /consecutive hyphens/i },
    ],
  },
  "github:repo": {
    valid: ["acme", "ac.me_lib-1", "a".repeat(100)],
    invalid: [
      { name: "a".repeat(101), reason: TOO_LONG },
      { name: "ac me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
    ],
  },
  gitlab: {
    valid: ["acme", "ac.me_lib-1", "_acme", "acme-"],
    invalid: [
      { name: "a", reason: TOO_SHORT },
      { name: "a".repeat(256), reason: TOO_LONG },
      { name: "ac me", reason: DISALLOWED },
      { name: "-acme", reason: /must not start with a separator/i },
      { name: "acme.", reason: /must not end with a period/i },
    ],
  },
  npm: {
    valid: ["acme", "ac.me-lib_x1", "a".repeat(214)],
    invalid: [
      { name: "Acme", reason: DISALLOWED },
      { name: ".acme", reason: /must not start with a period or underscore/i },
      { name: "_acme", reason: /must not start with a period or underscore/i },
      { name: "a".repeat(215), reason: TOO_LONG },
    ],
  },
  pypi: {
    valid: ["acme", "Acme.Lib_1-x", "a".repeat(255)],
    invalid: [
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
      { name: "a".repeat(256), reason: TOO_LONG },
      { name: "ac me", reason: DISALLOWED },
    ],
  },
  crates: {
    valid: ["acme", "Acme-1_x", "a".repeat(64)],
    invalid: [
      { name: "9abc", reason: START_LETTER },
      { name: "-acme", reason: START_LETTER },
      { name: "ac.me", reason: DISALLOWED },
      { name: "a".repeat(65), reason: TOO_LONG },
    ],
  },
  dockerhub: {
    valid: ["acme", "ac-me.1_x", "a".repeat(30)],
    invalid: [
      { name: "abc", reason: TOO_SHORT },
      { name: "a".repeat(31), reason: TOO_LONG },
      { name: "Acme", reason: DISALLOWED },
      { name: "a--b", reason: /consecutive separators/i },
      { name: "-abc", reason: START_LETTER_OR_DIGIT },
      { name: "abc-", reason: END_LETTER_OR_DIGIT },
    ],
  },
  huggingface: {
    valid: ["acme", "ac-me_1", "a".repeat(64)],
    invalid: [
      { name: "a", reason: TOO_SHORT },
      { name: "a".repeat(65), reason: TOO_LONG },
      { name: "ac.me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
    ],
  },
  jsr: {
    valid: ["acme", "a1", "ac-me", "a".repeat(20)],
    invalid: [
      { name: "a", reason: TOO_SHORT },
      { name: "a".repeat(21), reason: TOO_LONG },
      { name: "Acme", reason: DISALLOWED },
      { name: "ac_me", reason: DISALLOWED },
      { name: "9abc", reason: START_LETTER },
      { name: "-acme", reason: START_LETTER },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
      { name: "a--b", reason: /consecutive hyphens/i },
    ],
  },
  denoland: {
    valid: ["acme", "ac_me_1", "a".repeat(40)],
    invalid: [
      { name: "ab", reason: TOO_SHORT },
      { name: "a".repeat(41), reason: TOO_LONG },
      { name: "Acme", reason: DISALLOWED },
      { name: "ac-me", reason: DISALLOWED },
      { name: "ac.me", reason: DISALLOWED },
    ],
  },
  nuget: {
    valid: ["acme", "ac.me_1-x", "a".repeat(128)],
    invalid: [
      { name: "a".repeat(129), reason: TOO_LONG },
      { name: "ac me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
    ],
  },
  rubygems: {
    valid: ["acme", "ac-me_x1", "a".repeat(128)],
    invalid: [
      { name: "a".repeat(129), reason: TOO_LONG },
      { name: "Acme", reason: DISALLOWED },
      { name: "ac.me", reason: DISALLOWED },
      { name: "1abc", reason: START_LETTER },
    ],
  },
  homebrew: {
    valid: ["acme", "ac-me1", "a".repeat(64)],
    invalid: [
      { name: "a".repeat(65), reason: TOO_LONG },
      { name: "Acme", reason: DISALLOWED },
      { name: "ac.me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
    ],
  },
  codepen: {
    valid: ["a", "acme", "ac-me_1", "a".repeat(30)],
    invalid: [
      { name: "a".repeat(31), reason: TOO_LONG },
      { name: "ac.me", reason: DISALLOWED },
    ],
  },
  replit: {
    valid: ["ab", "ac-me_x", "a".repeat(64)],
    invalid: [
      { name: "a", reason: TOO_SHORT },
      { name: "a".repeat(65), reason: TOO_LONG },
      { name: "ac.me", reason: DISALLOWED },
    ],
  },
  vercel: {
    valid: ["acme", "ac-me1", "a".repeat(63)],
    invalid: [
      { name: "a".repeat(64), reason: TOO_LONG },
      { name: "Acme", reason: DISALLOWED },
      { name: "ac_me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
    ],
  },
  netlify: {
    valid: ["acme", "ac-me1"],
    invalid: [
      { name: "Acme", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
    ],
  },
  cloudflare: {
    valid: ["acme", "ac-me1"],
    invalid: [
      { name: "a".repeat(64), reason: TOO_LONG },
      { name: "Acme", reason: DISALLOWED },
      { name: "ac_me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
    ],
  },
  flyio: {
    valid: ["acme", "ac-me1"],
    invalid: [
      { name: "Acme", reason: DISALLOWED },
      { name: "ac_me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
    ],
  },
  railway: {
    valid: ["acme", "ac-me1"],
    invalid: [
      { name: "Acme", reason: DISALLOWED },
      { name: "ac_me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
    ],
  },
  supabase: {
    valid: ["acme", "ac-me1"],
    invalid: [
      { name: "Acme", reason: DISALLOWED },
      { name: "ac_me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
    ],
  },
  appstore: {
    valid: ["ab", "Acme X!", "a".repeat(30)],
    invalid: [
      { name: "a", reason: TOO_SHORT },
      { name: "a".repeat(31), reason: TOO_LONG },
      { name: "ac$me", reason: DISALLOWED },
    ],
  },
  figma: {
    valid: ["acme", "ac_me-1", "a".repeat(50)],
    invalid: [
      { name: "a".repeat(51), reason: TOO_LONG },
      { name: "ac.me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
    ],
  },
  dribbble: {
    valid: ["acme", "ac_me-1", "a".repeat(30)],
    invalid: [
      { name: "a".repeat(31), reason: TOO_LONG },
      { name: "ac.me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
    ],
  },
  behance: {
    valid: ["abc", "ac_me-1", "a".repeat(30)],
    invalid: [
      { name: "ab", reason: TOO_SHORT },
      { name: "a".repeat(31), reason: TOO_LONG },
      { name: "ac.me", reason: DISALLOWED },
      { name: "-abc", reason: START_LETTER_OR_DIGIT },
    ],
  },
  substack: {
    valid: ["acme", "ac-me1", "a".repeat(63)],
    invalid: [
      { name: "a".repeat(64), reason: TOO_LONG },
      { name: "ac_me", reason: DISALLOWED },
      { name: "-acme", reason: START_LETTER_OR_DIGIT },
      { name: "acme-", reason: END_LETTER_OR_DIGIT },
    ],
  },
  producthunt: {
    valid: ["ab", "ac_me-x", "a".repeat(30)],
    invalid: [
      { name: "a", reason: TOO_SHORT },
      { name: "a".repeat(31), reason: TOO_LONG },
      { name: "ac.me", reason: DISALLOWED },
    ],
  },
  telegram: {
    valid: ["abcde", "Acme_x9", "a".repeat(32)],
    invalid: [
      { name: "abcd", reason: TOO_SHORT },
      { name: "a".repeat(33), reason: TOO_LONG },
      { name: "ac-me", reason: DISALLOWED },
      { name: "1abcd", reason: START_LETTER },
    ],
  },
  medium: {
    valid: ["abc", "ac.me_x-1", "a".repeat(30)],
    invalid: [
      { name: "ab", reason: TOO_SHORT },
      { name: "a".repeat(31), reason: TOO_LONG },
      { name: "ac me", reason: DISALLOWED },
      { name: "-abc", reason: START_LETTER_OR_DIGIT },
    ],
  },
  "social:x": {
    valid: ["abcd", "ac_me123", "a".repeat(15)],
    invalid: [
      { name: "abc", reason: TOO_SHORT },
      { name: "a".repeat(16), reason: TOO_LONG },
      { name: "ac-me", reason: DISALLOWED },
    ],
  },
  "social:bluesky": {
    valid: ["abc", "ac-me12", "a".repeat(20)],
    invalid: [
      { name: "ab", reason: TOO_SHORT },
      { name: "a".repeat(21), reason: TOO_LONG },
      { name: "ac_me", reason: DISALLOWED },
      { name: "-abc", reason: START_LETTER_OR_DIGIT },
      { name: "abc-", reason: END_LETTER_OR_DIGIT },
    ],
  },
  "social:instagram": {
    valid: ["acme", "ac.me_1", "_acme", "a".repeat(30)],
    invalid: [
      { name: "a".repeat(31), reason: TOO_LONG },
      { name: "ac-me", reason: DISALLOWED },
      { name: ".acme", reason: /must not start with a period/i },
      { name: "acme.", reason: /must not end with a period/i },
      { name: "a..b", reason: /consecutive dots/i },
    ],
  },
  "social:reddit": {
    valid: ["abc", "ac-me_1", "a".repeat(20)],
    invalid: [
      { name: "ab", reason: TOO_SHORT },
      { name: "a".repeat(21), reason: TOO_LONG },
      { name: "ac.me", reason: DISALLOWED },
    ],
  },
  "social:youtube": {
    valid: ["abc", "ac.me_1-x", "a".repeat(30)],
    invalid: [
      { name: "ab", reason: TOO_SHORT },
      { name: "a".repeat(31), reason: TOO_LONG },
      { name: "ac me", reason: DISALLOWED },
    ],
  },
  "social:tiktok": {
    valid: ["ab", "ac.me_1", "a".repeat(24)],
    invalid: [
      { name: "a", reason: TOO_SHORT },
      { name: "a".repeat(25), reason: TOO_LONG },
      { name: "ac-me", reason: DISALLOWED },
    ],
  },
};

describe("PROVIDER_NAME_RULES — registry", () => {
  it("covers every registered provider id", () => {
    expect(Object.keys(PROVIDER_NAME_RULES).sort()).toEqual([...PROVIDER_IDS].sort());
  });

  it("declares sane bounds and a charset for every rule", () => {
    for (const id of PROVIDER_IDS) {
      const rule = PROVIDER_NAME_RULES[id];
      expect(rule.minLength).toBeGreaterThanOrEqual(1);
      expect(rule.maxLength).toBeGreaterThanOrEqual(rule.minLength);
      expect(rule.charset).toBeInstanceOf(RegExp);
      expect(rule.charsetLabel.length).toBeGreaterThan(0);
    }
  });
});

describe("validateName — reason classes", () => {
  const rule: NameRule = {
    label: "test handle",
    minLength: 2,
    maxLength: 5,
    charset: /[a-z-]/,
    charsetLabel: "lowercase letters and hyphens",
    constraints: [{ pattern: /^[a-z]/, reason: "must start with a letter" }],
  };

  it("reports names under the minimum length", () => {
    expect(validateName("a", rule)).toMatch(/too short.*at least 2/);
  });

  it("reports names over the maximum length", () => {
    expect(validateName("abcdef", rule)).toMatch(/too long.*at most 5/);
  });

  it("names the disallowed character", () => {
    expect(validateName("a_b", rule)).toContain("disallowed character '_'");
    expect(validateName("aB", rule)).toContain("disallowed character 'B'");
  });

  it("applies constraints after the charset check", () => {
    expect(validateName("-ab", rule)).toBe("must start with a letter");
  });

  it("returns null for names satisfying every rule", () => {
    expect(validateName("a-b", rule)).toBeNull();
    expect(validateName("ab", rule)).toBeNull();
  });
});

describe("provider adapters — invalid names", () => {
  for (const id of PROVIDER_IDS) {
    describe(id, () => {
      for (const { name, reason } of CASES[id].invalid) {
        it(`marks ${JSON.stringify(name)} invalid with a reason`, async () => {
          const { deps, fetchCalls, npmCalls } = makeDeps();
          const r = await check(id, name, deps);
          expect(r.status).toBe("invalid");
          expect(r.available).toBe(false);
          expect(r.detail).toMatch(/^not a valid /);
          expect(r.detail).toMatch(reason);
          // Validation precedes any network or registry call.
          expect(fetchCalls()).toBe(0);
          expect(npmCalls()).toBe(0);
        });
      }
      for (const name of CASES[id].valid) {
        it(`lets ${JSON.stringify(name)} through validation`, async () => {
          const { deps } = makeDeps();
          const r = await check(id, name, deps);
          expect(r.status).not.toBe("invalid");
        });
      }
    });
  }
});

describe("provider adapters — invalid subjects", () => {
  it("domain invalid results carry the fqdn subject", async () => {
    const { deps } = makeDeps();
    const r = await check("domain:com", "ac_me", deps);
    expect(r).toMatchObject({ status: "invalid", subject: "ac_me.com" });
  });

  it("bluesky invalid results carry the full handle subject", async () => {
    const { deps } = makeDeps();
    const r = await check("social:bluesky", "a_b", deps);
    expect(r).toMatchObject({ status: "invalid", subject: "a_b.bsky.social" });
  });

  it("substack invalid results carry the subdomain subject", async () => {
    const { deps } = makeDeps();
    const r = await check("substack", "-acme", deps);
    expect(r).toMatchObject({ status: "invalid", subject: "-acme.substack.com" });
  });
});
