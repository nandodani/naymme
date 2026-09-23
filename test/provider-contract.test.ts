import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { z } from "zod";
import { defaultDeps, type ProviderDeps } from "../src/deps.js";
import { createAdapters } from "../src/providers/index.js";
import { PROVIDER_NAME_RULES } from "../src/providers/validation.js";
import { PROVIDER_IDS, type ProviderId } from "../src/schemas.js";
import type { ProviderOutcome } from "../src/types.js";

/**
 * Contract matrix across every registered provider. Each adapter is driven
 * through createAdapters() exactly as the runner drives it, with all external
 * HTTP traffic intercepted by MSW — the suite never touches a live network:
 *   - IANA RDAP bootstrap → static services doc pointing at rdap.test
 *   - every other URL → HTTP 404 (the "nothing here" response most adapters
 *     map to `available`)
 * Non-HTTP deps (WHOIS TCP :43, DNS NS lookups) are stubbed; npm-name reaches
 * the mocked registry through real fetch like any other adapter.
 */

const ALL_TLDS = PROVIDER_IDS.filter((id) => id.startsWith("domain:")).map((id) => id.slice(7));

const BOOTSTRAP = { services: [[ALL_TLDS, ["https://rdap.test/"]]] };

const server = setupServer(
  http.get("https://data.iana.org/rdap/dns.json", () => HttpResponse.json(BOOTSTRAP)),
  http.all("*", () => new HttpResponse(null, { status: 404 })),
);

const outcomeSchema = z
  .object({
    status: z.enum(["available", "taken", "unknown", "invalid"]),
    subject: z.string().min(1),
    available: z.boolean().nullable(),
    detail: z.string().optional(),
  })
  .strict();

const deps: ProviderDeps = defaultDeps({
  whoisDomain: async () => ({}),
  resolveNs: async () => [],
  timeoutMs: 10_000,
});

const adapters = createAdapters(deps);

const check = (id: ProviderId, name: string): Promise<ProviderOutcome> =>
  adapters[id].check(name, new AbortController().signal);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

describe("provider contract — rule registry", () => {
  it.each(PROVIDER_IDS)("%s has a coherent NameRule", (id) => {
    const rule = PROVIDER_NAME_RULES[id];
    expect(rule.minLength).toBeGreaterThanOrEqual(1);
    expect(rule.maxLength).toBeGreaterThanOrEqual(rule.minLength);
    expect(rule.charset.flags).not.toContain("g"); // per-char test must be stateless
    expect(rule.label.length).toBeGreaterThan(0);
    expect(rule.charsetLabel.length).toBeGreaterThan(0);
  });
});

describe("provider contract — outcome shape", () => {
  it.each(PROVIDER_IDS)("%s returns a schema-valid ProviderOutcome", async (id) => {
    const rule = PROVIDER_NAME_RULES[id];
    const outcome = await check(id, "a".repeat(rule.minLength));
    expect(() => outcomeSchema.parse(outcome)).not.toThrow();
    // available must agree with status for decisive verdicts
    if (outcome.status === "available") expect(outcome.available).toBe(true);
    if (outcome.status === "taken") expect(outcome.available).toBe(false);
    if (outcome.status === "unknown") expect(outcome.available).toBeNull();
    if (outcome.status === "invalid") expect(outcome.available).toBe(false);
  });
});

describe("provider contract — length boundaries", () => {
  it.each(PROVIDER_IDS)("%s accepts a name of exactly minLength", async (id) => {
    const rule = PROVIDER_NAME_RULES[id];
    const outcome = await check(id, "a".repeat(rule.minLength));
    expect(outcome.status).not.toBe("invalid");
  });

  it.each(PROVIDER_IDS)("%s accepts a name of exactly maxLength", async (id) => {
    const rule = PROVIDER_NAME_RULES[id];
    const outcome = await check(id, "a".repeat(rule.maxLength));
    expect(outcome.status).not.toBe("invalid");
  });

  it.each(PROVIDER_IDS)("%s rejects a name of minLength - 1", async (id) => {
    const rule = PROVIDER_NAME_RULES[id];
    const outcome = await check(id, "a".repeat(rule.minLength - 1));
    expect(outcome.status).toBe("invalid");
    expect(outcome.available).toBe(false);
    expect(outcome.detail).toContain("too short");
    expect(outcome.detail).toContain(`not a valid ${rule.label}`);
  });

  it.each(PROVIDER_IDS)("%s rejects a name of maxLength + 1", async (id) => {
    const rule = PROVIDER_NAME_RULES[id];
    const outcome = await check(id, "a".repeat(rule.maxLength + 1));
    expect(outcome.status).toBe("invalid");
    expect(outcome.available).toBe(false);
    expect(outcome.detail).toContain("too long");
    expect(outcome.detail).toContain(`not a valid ${rule.label}`);
  });
});

describe("provider contract — forbidden characters", () => {
  it.each(PROVIDER_IDS)(
    "%s rejects a non-ASCII character inside a length-valid name",
    async (id) => {
      const rule = PROVIDER_NAME_RULES[id];
      const name = "a".repeat(rule.minLength - 1) + "☃"; // exactly minLength chars
      const outcome = await check(id, name);
      expect(outcome.status).toBe("invalid");
      expect(outcome.detail).toContain("disallowed character '☃'");
      expect(outcome.detail).toContain(rule.charsetLabel);
    },
  );

  it.each(PROVIDER_IDS)("%s rejects whitespace inside a length-valid name", async (id) => {
    const rule = PROVIDER_NAME_RULES[id];
    const name = "a".repeat(rule.minLength - 1) + " ";
    const outcome = await check(id, name);
    // appstore's charset deliberately admits spaces — every other provider must reject
    if (id === "appstore") {
      expect(outcome.status).not.toBe("invalid");
    } else {
      expect(outcome.status).toBe("invalid");
    }
  });
});
