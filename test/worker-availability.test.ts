import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import worker from "../worker/index.js";

/**
 * Drives check_availability through the Worker's fetch handler end-to-end.
 * The Worker-side deps differ from Node's: DNS NS lookups go through
 * Cloudflare DoH JSON and npm availability is a HEAD probe plus punctuation
 * variants — all intercepted by MSW, no live network.
 */

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

interface AvailabilityRow {
  provider: string;
  status: string;
  subject: string;
  detail?: string;
}

const server = setupServer(
  // Only .com gets an RDAP service — domain:gg exercises the WHOIS→DoH path.
  http.get("https://data.iana.org/rdap/dns.json", () =>
    HttpResponse.json({ services: [[["com"], ["https://rdap.test/"]]] }),
  ),
  http.get("https://rdap.test/*", () => new HttpResponse(null, { status: 404 })),
  http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
    const name = new URL(request.url).searchParams.get("name");
    const answer = name === "taken.gg" ? [{ type: 2, data: "ns1.dynadot.com." }] : [];
    return HttpResponse.json({ Answer: answer });
  }),
  http.head("https://registry.npmjs.org/:name", ({ params }) => {
    const taken = new Set(["takenpkg", "foobar"]);
    return new HttpResponse(null, { status: taken.has(params.name as string) ? 200 : 404 });
  }),
  http.all(
    "https://*.vercel.app/*",
    () =>
      new HttpResponse(null, {
        status: 404,
        headers: { "x-vercel-error": "DEPLOYMENT_NOT_FOUND" },
      }),
  ),
  http.all("https://*.netlify.app/*", () =>
    HttpResponse.text("Not Found - Request ID: abc", { status: 404 }),
  ),
  http.all("*", () => new HttpResponse(null, { status: 404 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

async function checkAvailability(name: string, providers: string[]): Promise<AvailabilityRow[]> {
  const res = await worker.fetch(
    new Request("https://worker.test/mcp", {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "check_availability", arguments: { name, providers } },
      }),
    }),
  );
  expect(res.status).toBe(200);
  const text = await res.text();
  const message = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()))
    .find((m) => m.result !== undefined);
  const content = message?.result?.structuredContent as { results: AvailabilityRow[] };
  return content.results;
}

describe("worker check_availability — mocked egress", () => {
  it("reports available across RDAP, hosting, GitHub and npm providers", async () => {
    const results = await checkAvailability("acme", [
      "domain:com",
      "vercel",
      "netlify",
      "github:user",
      "npm",
    ]);
    const byProvider = new Map(results.map((r) => [r.provider, r]));
    expect(byProvider.get("domain:com")?.status).toBe("available");
    expect(byProvider.get("domain:com")?.subject).toBe("acme.com");
    expect(byProvider.get("vercel")?.status).toBe("available");
    expect(byProvider.get("netlify")?.status).toBe("available");
    expect(byProvider.get("github:user")?.status).toBe("available");
    expect(byProvider.get("npm")?.status).toBe("available");
  });

  it("reports taken when the npm registry HEAD probe answers 200", async () => {
    const results = await checkAvailability("takenpkg", ["npm"]);
    expect(results[0]?.status).toBe("taken");
  });

  it("reports taken when only an npm punctuation variant exists", async () => {
    // foo.bar itself is free, but npm blocks it because 'foobar' is taken.
    const results = await checkAvailability("foo.bar", ["npm"]);
    expect(results[0]?.status).toBe("taken");
  });

  it("falls through WHOIS to DoH NS records for TLDs without RDAP", async () => {
    const taken = await checkAvailability("taken", ["domain:gg"]);
    expect(taken[0]?.status).toBe("taken");
    expect(taken[0]?.detail).toContain("whois fallback");

    const inconclusive = await checkAvailability("free", ["domain:gg"]);
    expect(inconclusive[0]?.status).toBe("unknown");
  });

  it("reports per-provider invalid verdicts for names that break provider rules", async () => {
    // "a" passes the request schema but is below telegram/social:x minimums.
    const results = await checkAvailability("a", ["telegram", "social:x", "npm"]);
    const byProvider = new Map(results.map((r) => [r.provider, r]));
    expect(byProvider.get("telegram")?.status).toBe("invalid");
    expect(byProvider.get("telegram")?.detail).toContain("too short");
    expect(byProvider.get("social:x")?.status).toBe("invalid");
    expect(byProvider.get("npm")?.status).toBe("available");
  });
});
