/**
 * One-time-use ("replay") store for OAuth artifacts.
 *
 * Authorization codes and refresh tokens must each be consumed exactly
 * once. On serverless deployments consecutive requests may land on
 * different instances, so a process-local Map is NOT sufficient there —
 * `replayStoreFromEnv` prefers a shared Upstash/Vercel-KV REST store and
 * `lib/oauth.ts` refuses to serve OAuth endpoints on serverless when no
 * shared store is configured (fail closed, clear error).
 *
 * Supported env pairs (either is enough):
 *   - KV_REST_API_URL + KV_REST_API_TOKEN          (Vercel KV)
 *   - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  (Upstash Redis)
 */

/** Consumes `key` once. Returns true on first use, false on any replay. */
export interface ReplayStore {
  consume(key: string, ttlMs: number): Promise<boolean>;
}

export interface ReplayStoreResolution {
  store: ReplayStore;
  /** True when the store is shared across instances (not process-local). */
  shared: boolean;
}

const MAX_ENTRIES = 10_000;

/**
 * Process-local replay store. Correct for a single long-lived process
 * (local dev, self-hosted `next start`, tests); on serverless it is a
 * fallback for non-production checks only — see lib/oauth.ts gating.
 */
export function memoryReplayStore(now: () => number = () => Date.now()): ReplayStore {
  const consumed = new Map<string, number>();
  return {
    consume(key, ttlMs) {
      const at = now();
      for (const [k, exp] of consumed) {
        if (at >= exp) consumed.delete(k);
      }
      if (consumed.has(key)) return Promise.resolve(false);
      if (consumed.size >= MAX_ENTRIES) {
        const oldest = consumed.keys().next().value;
        if (oldest !== undefined) consumed.delete(oldest);
      }
      consumed.set(key, at + Math.max(1, ttlMs));
      return Promise.resolve(true);
    },
  };
}

/**
 * Upstash-compatible REST store (works for Vercel KV, which is Upstash
 * under the hood). Uses `SET key 1 PX <ttl> NX` — atomic across instances:
 * the first writer wins and every later consume reports a replay.
 */
export function upstashReplayStore(
  url: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): ReplayStore {
  const base = url.replace(/\/+$/, "");
  return {
    async consume(key, ttlMs) {
      const ms = Math.max(1, Math.floor(ttlMs));
      const res = await fetchImpl(`${base}/set/${encodeURIComponent(key)}/1/PX/${ms}/NX`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`oauth replay store: HTTP ${res.status}`);
      }
      const body = (await res.json()) as { result?: string | null };
      return body.result === "OK";
    },
  };
}

/** Resolve the replay store from env; `shared=false` means process-local. */
export function replayStoreFromEnv(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
): ReplayStoreResolution {
  const kvUrl = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const kvToken = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (kvUrl !== undefined && kvUrl !== "" && kvToken !== undefined && kvToken !== "") {
    return { store: upstashReplayStore(kvUrl, kvToken, fetchImpl), shared: true };
  }
  return { store: memoryReplayStore(), shared: false };
}
