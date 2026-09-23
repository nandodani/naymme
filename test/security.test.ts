import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { demoAvailabilityService, handleAvailabilityRequest } from "../lib/availability.js";
import { handleMcpRequest } from "../lib/mcp-web.js";
import { handleScoreRequest } from "../lib/score-api.js";
import { defaultDeps } from "../src/deps.js";
import { createHttpServer } from "../src/http.js";
import {
  BodyTooLargeError,
  clientKeyFromHeaders,
  contentLengthExceeded,
  MAX_REQUEST_BODY_BYTES,
  RateLimiter,
  readJsonCapped,
  readTextCapped,
} from "../src/security.js";

describe("RateLimiter", () => {
  it("allows up to max within the window, then denies with a retry hint", () => {
    const limiter = new RateLimiter({ windowMs: 60_000, max: 2 });
    expect(limiter.allow("a", 1_000).ok).toBe(true);
    expect(limiter.allow("a", 2_000).ok).toBe(true);
    const denied = limiter.allow("a", 3_000);
    expect(denied).toEqual({
      ok: false,
      retryAfterSeconds: 58,
      limit: 2,
      remaining: 0,
      resetSeconds: 58,
      windowSeconds: 60,
    });
  });

  it("keys are independent and the window slides", () => {
    const limiter = new RateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.allow("a", 0).ok).toBe(true);
    expect(limiter.allow("b", 0).ok).toBe(true);
    expect(limiter.allow("a", 1).ok).toBe(false);
    expect(limiter.allow("a", 60_001).ok).toBe(true);
  });

  it("prunes the keyspace instead of growing without bound", () => {
    const limiter = new RateLimiter({ windowMs: 60_000, max: 1, maxKeys: 4 });
    for (let i = 0; i < 8; i++) limiter.allow(`ip-${i}`, 1_000 + i);
    // Later windows evict stale buckets — a recycled ip is allowed again.
    expect(limiter.allow("ip-0", 62_000).ok).toBe(true);
  });
});

describe("readTextCapped / readJsonCapped", () => {
  it("reads bodies under the cap", async () => {
    expect(await readTextCapped(new Response("hello"))).toBe("hello");
    expect(await readJsonCapped(new Response('{"a":1}'))).toEqual({ a: 1 });
  });

  it("rejects bodies over the cap", async () => {
    const big = new Response("x".repeat(2048));
    await expect(readTextCapped(big, 1024)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("returns null on malformed JSON and empty bodies", async () => {
    expect(await readJsonCapped(new Response("not json"))).toBeNull();
    expect(await readTextCapped(new Response(null))).toBe("");
  });
});

describe("clientKeyFromHeaders", () => {
  it("prefers cf-connecting-ip, then the first x-forwarded-for hop", () => {
    expect(
      clientKeyFromHeaders(
        new Headers({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }),
      ),
    ).toBe("1.2.3.4");
    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": " 8.8.8.8 , 7.7.7.7" }))).toBe(
      "8.8.8.8",
    );
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("contentLengthExceeded", () => {
  it("flags declared bodies over the cap", () => {
    const over = new Request("https://x.test", {
      method: "POST",
      headers: { "content-length": String(MAX_REQUEST_BODY_BYTES + 1) },
    });
    expect(contentLengthExceeded(over, MAX_REQUEST_BODY_BYTES)).toBe(true);
    const under = new Request("https://x.test", { method: "POST" });
    expect(contentLengthExceeded(under, MAX_REQUEST_BODY_BYTES)).toBe(false);
  });
});

describe("endpoint rate limiting", () => {
  const maxOne = () => new RateLimiter({ windowMs: 60_000, max: 1 });

  it("429s /api/availability once the bucket is spent", async () => {
    const limiter = maxOne();
    const url = "https://app.test/api/availability?name=acme";
    const first = await handleAvailabilityRequest(
      new Request(url),
      demoAvailabilityService(),
      limiter,
    );
    expect(first.status).toBe(200);
    const second = await handleAvailabilityRequest(
      new Request(url),
      demoAvailabilityService(),
      limiter,
    );
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).not.toBeNull();
  });

  it("429s /api/score once the bucket is spent", () => {
    const limiter = maxOne();
    expect(
      handleScoreRequest(new Request("https://app.test/api/score?name=acme"), limiter).status,
    ).toBe(200);
    expect(
      handleScoreRequest(new Request("https://app.test/api/score?name=acme"), limiter).status,
    ).toBe(429);
  });

  it("429s the MCP POST handler", async () => {
    const limiter = maxOne();
    const mk = () =>
      new Request("https://app.test/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      });
    expect((await handleMcpRequest(mk(), defaultDeps(), limiter)).status).toBe(200);
    expect((await handleMcpRequest(mk(), defaultDeps(), limiter)).status).toBe(429);
  });
});

describe("Node HTTP server hardening", () => {
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = createHttpServer({
      limiter: new RateLimiter({ windowMs: 60_000, max: 1_000 }),
      maxSseSessions: 1,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("413s an oversized /mcp body without buffering it", async () => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: "x".repeat(MAX_REQUEST_BODY_BYTES + 1),
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("too large");
  });

  it("caps concurrent legacy-SSE sessions", async () => {
    const first = await fetch(`${base}/sse`, { headers: { accept: "text/event-stream" } });
    expect(first.status).toBe(200);
    const second = await fetch(`${base}/sse`, { headers: { accept: "text/event-stream" } });
    expect(second.status).toBe(503);
    await first.body?.cancel();
    await second.body?.cancel();
  });

  it("rate-limits POST /mcp with an injected limiter", async () => {
    const limited = createHttpServer({
      limiter: new RateLimiter({ windowMs: 60_000, max: 1 }),
    });
    await new Promise<void>((resolve) => limited.listen(0, "127.0.0.1", resolve));
    const port = (limited.address() as AddressInfo).port;
    try {
      const mk = () =>
        fetch(`http://127.0.0.1:${port}/mcp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
        });
      expect((await mk()).status).toBe(200);
      const second = await mk();
      expect(second.status).toBe(429);
      expect(second.headers.get("retry-after")).not.toBeNull();
    } finally {
      await new Promise<void>((resolve) => limited.close(() => resolve()));
    }
  });
});
