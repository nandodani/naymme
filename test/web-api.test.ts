import { describe, expect, it } from "vitest";
import {
  availabilityServiceFromEnv,
  demoAvailabilityService,
  handleAvailabilityRequest,
  type AvailabilityResponse,
  type AvailabilityService,
} from "../lib/availability.js";
import { demoCheckAvailability } from "../lib/demo.js";
import { handleScoreRequest } from "../lib/score-api.js";
import { PROVIDER_IDS } from "../src/schemas.js";

function get(path: string): Request {
  return new Request(`https://app.test${path}`);
}

describe("handleAvailabilityRequest", () => {
  it("returns the service output plus its mode", async () => {
    const service: AvailabilityService = {
      mode: "live",
      check: (name) =>
        Promise.resolve({
          name,
          results: [
            {
              provider: "domain:com",
              status: "available",
              subject: `${name}.com`,
              available: true,
              durationMs: 1,
            },
          ],
          summary: { available: 1, taken: 0, unknown: 0, invalid: 0 },
        }),
    };
    const res = await handleAvailabilityRequest(get("/api/availability?name=acme"), service);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as AvailabilityResponse;
    expect(body.mode).toBe("live");
    expect(body.name).toBe("acme");
    expect(body.summary.available).toBe(1);
  });

  it("400s on an invalid name", async () => {
    const res = await handleAvailabilityRequest(
      get("/api/availability?name="),
      demoAvailabilityService(),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; message: string; hint: string };
    };
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.message).toBe("invalid request");
    expect(body.error.hint.length).toBeGreaterThan(0);
  });

  it("400s on an unknown provider in the selection", async () => {
    const res = await handleAvailabilityRequest(
      get("/api/availability?name=acme&providers=domain:com,nope"),
      demoAvailabilityService(),
    );
    expect(res.status).toBe(400);
  });

  it("honours the providers filter", async () => {
    const res = await handleAvailabilityRequest(
      get("/api/availability?name=acme&providers=github:user,npm"),
      demoAvailabilityService(),
    );
    const body = (await res.json()) as AvailabilityResponse;
    expect(body.results.map((r) => r.provider).sort()).toEqual(["github:user", "npm"]);
  });

  it("502s when the service throws", async () => {
    const service: AvailabilityService = {
      mode: "live",
      check: () => Promise.reject(new Error("boom")),
    };
    const res = await handleAvailabilityRequest(get("/api/availability?name=acme"), service);
    expect(res.status).toBe(502);
  });
});

describe("availabilityServiceFromEnv", () => {
  it("defaults to live", () => {
    expect(availabilityServiceFromEnv({}).mode).toBe("live");
  });

  it("switches to demo on LMKURNAME_AVAILABILITY_MODE=demo", () => {
    expect(availabilityServiceFromEnv({ LMKURNAME_AVAILABILITY_MODE: "demo" }).mode).toBe("demo");
  });
});

describe("demoCheckAvailability", () => {
  it("is deterministic for a given name", async () => {
    const first = demoCheckAvailability("acme");
    const second = demoCheckAvailability("acme");
    expect(second).toEqual(first);
  });

  it("covers every provider id by default", () => {
    const { results } = demoCheckAvailability("acme");
    expect(results.map((r) => r.provider).sort()).toEqual([...PROVIDER_IDS].sort());
  });

  it("labels every result as a demo fixture and returns valid statuses", () => {
    const { results, summary } = demoCheckAvailability("acme");
    for (const r of results) {
      expect(r.detail).toContain("demo");
      expect(["available", "taken", "unknown", "invalid"]).toContain(r.status);
      if (r.status === "available") expect(r.available).toBe(true);
      if (r.status === "taken" || r.status === "invalid") expect(r.available).toBe(false);
      if (r.status === "unknown") expect(r.available).toBeNull();
    }
    expect(summary.available + summary.taken + summary.unknown + summary.invalid).toBe(
      results.length,
    );
  });

  it("shapes subjects like the real adapters", () => {
    const { results } = demoCheckAvailability("acme");
    const byId = new Map(results.map((r) => [r.provider, r]));
    expect(byId.get("domain:com")?.subject).toBe("acme.com");
    expect(byId.get("github:user")?.subject).toBe("acme");
    expect(byId.get("social:x")?.subject).toBe("@acme");
  });
});

describe("handleScoreRequest", () => {
  it("returns the deterministic score", async () => {
    const res = handleScoreRequest(get("/api/score?name=acme"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; total: number; grade: string };
    expect(body.name).toBe("acme");
    expect(body.total).toBeGreaterThanOrEqual(0);
    expect(body.total).toBeLessThanOrEqual(100);
  });

  it("400s on a missing name", async () => {
    const res = handleScoreRequest(get("/api/score"));
    expect(res.status).toBe(400);
  });
});
