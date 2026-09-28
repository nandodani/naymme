import { describe, expect, it } from "vitest";

import { memoryReplayStore, replayStoreFromEnv, upstashReplayStore } from "../lib/oauth-store.js";

describe("memoryReplayStore", () => {
  it("allows the first consume, rejects replays, isolates keys", async () => {
    const store = memoryReplayStore();
    expect(await store.consume("a", 60_000)).toBe(true);
    expect(await store.consume("a", 60_000)).toBe(false);
    expect(await store.consume("b", 60_000)).toBe(true);
  });

  it("expires consumed keys after their TTL", async () => {
    let now = 1_000;
    const store = memoryReplayStore(() => now);
    expect(await store.consume("a", 500)).toBe(true);
    now = 1_600;
    expect(await store.consume("a", 500)).toBe(true);
  });

  it("bounds its size by evicting the oldest entry", async () => {
    const store = memoryReplayStore();
    for (let i = 0; i < 10_001; i += 1) {
      expect(await store.consume(`k${i}`, 60_000)).toBe(true);
    }
    // k0 was evicted; k10000 is still tracked.
    expect(await store.consume("k0", 60_000)).toBe(true);
    expect(await store.consume("k10000", 60_000)).toBe(false);
  });
});

describe("upstashReplayStore", () => {
  it("issues SET <key> 1 PX <ttl> NX over the Upstash REST API", async () => {
    const calls: { url: string; auth: string | null }[] = [];
    const fetchImpl: typeof fetch = (input, init) => {
      calls.push({
        url: input instanceof Request ? input.url : String(input),
        auth: new Headers(init?.headers).get("authorization"),
      });
      return Promise.resolve(Response.json({ result: "OK" }));
    };
    const store = upstashReplayStore("https://kv.example.com/", "tok-123", fetchImpl);
    expect(await store.consume("code:abc", 5_000)).toBe(true);
    expect(calls).toEqual([
      {
        url: "https://kv.example.com/set/code%3Aabc/1/PX/5000/NX",
        auth: "Bearer tok-123",
      },
    ]);
  });

  it("reports a replay when SET NX returns null", async () => {
    const store = upstashReplayStore("https://kv.example.com", "t", () =>
      Promise.resolve(Response.json({ result: null })),
    );
    expect(await store.consume("code:abc", 5_000)).toBe(false);
  });

  it("throws when the store is unreachable", async () => {
    const store = upstashReplayStore("https://kv.example.com", "t", () =>
      Promise.resolve(new Response("down", { status: 502 })),
    );
    await expect(store.consume("code:abc", 5_000)).rejects.toThrow(/502/);
  });
});

describe("replayStoreFromEnv", () => {
  it("selects a shared store from Vercel KV_REST_API_* vars", async () => {
    let used = false;
    const fetchImpl: typeof fetch = () => {
      used = true;
      return Promise.resolve(Response.json({ result: "OK" }));
    };
    const res = replayStoreFromEnv(
      { KV_REST_API_URL: "https://kv.example.com", KV_REST_API_TOKEN: "t" },
      fetchImpl,
    );
    expect(res.shared).toBe(true);
    await res.store.consume("code:a", 1_000);
    expect(used).toBe(true);
  });

  it("selects a shared store from UPSTASH_REDIS_REST_* vars", () => {
    const res = replayStoreFromEnv({
      UPSTASH_REDIS_REST_URL: "https://up.example.com",
      UPSTASH_REDIS_REST_TOKEN: "t",
    });
    expect(res.shared).toBe(true);
  });

  it("falls back to process memory when no shared store is configured", () => {
    const res = replayStoreFromEnv({});
    expect(res.shared).toBe(false);
    expect(res.store).toBeDefined();
  });

  it("ignores a partially configured store", () => {
    const res = replayStoreFromEnv({ KV_REST_API_URL: "https://kv.example.com" });
    expect(res.shared).toBe(false);
  });
});
