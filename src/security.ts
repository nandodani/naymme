/**
 * Shared defensive hardening for every runtime this codebase ships to
 * (Node HTTP server, Next.js route handlers, Cloudflare Worker). Everything
 * here is web-standard API only — no `node:*` imports — so the same guards
 * run identically in all three places.
 */

/** Largest JSON-RPC/HTTP request body accepted: 1 MiB. */
export const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

/**
 * Largest upstream (registry/platform) response body read into memory:
 * 4 MiB. Legit profile/markup pages can reach ~1-2 MiB, so this bound only
 * trips on abusive or misbehaving endpoints.
 */
export const MAX_UPSTREAM_BODY_BYTES = 4 * 1024 * 1024;

/** Thrown when a request or upstream body exceeds its byte cap. */
export class BodyTooLargeError extends Error {
  constructor(limit: number) {
    super(`body exceeds the ${limit}-byte limit`);
    this.name = "BodyTooLargeError";
  }
}

/**
 * Read a response body as text with a hard byte cap — `res.text()` buffers
 * the whole body, so an unbounded read lets a hostile/misbehaving upstream
 * exhaust memory. Over-limit content rejects with `BodyTooLargeError`.
 */
export async function readTextCapped(
  res: Response,
  maxBytes: number = MAX_UPSTREAM_BODY_BYTES,
): Promise<string> {
  const body = res.body;
  if (body === null) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

/** `readTextCapped` + `JSON.parse`. Returns `null` on malformed JSON. */
export async function readJsonCapped(
  res: Response,
  maxBytes: number = MAX_UPSTREAM_BODY_BYTES,
): Promise<unknown> {
  const text = await readTextCapped(res, maxBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export interface RateLimitOptions {
  /** Sliding-window length in milliseconds. */
  windowMs: number;
  /** Requests allowed per key inside the window. */
  max: number;
  /** Maximum tracked keys — the map self-prunes beyond this. */
  maxKeys?: number;
}

export type RateLimitVerdict = { ok: true } | { ok: false; retryAfterSeconds: number };

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window limiter keyed by caller (usually a client IP).
 * On serverless each warm instance holds its own map, so the limit is a
 * per-instance best effort — still the right first line against
 * request-budget abuse; stricter global limiting belongs in front
 * (CDN edge rules) when the deployment needs it.
 */
export class RateLimiter {
  private readonly windowMs: number;
  private readonly max: number;
  private readonly maxKeys: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.maxKeys = options.maxKeys ?? 10_000;
  }

  allow(key: string, now: number = Date.now()): RateLimitVerdict {
    const bucket = this.buckets.get(key);
    if (bucket === undefined || now >= bucket.resetAt) {
      this.prune(now);
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true };
    }
    if (bucket.count >= this.max) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }
    bucket.count += 1;
    return { ok: true };
  }

  private prune(now: number): void {
    if (this.buckets.size < this.maxKeys) return;
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key);
    }
    // Still full of live buckets — drop the oldest windows.
    while (this.buckets.size >= this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
  }
}

/** Requests-per-minute limits per endpoint, tunable via `LMKURNAME_RATE_LIMIT_RPM`. */
export const RATE_LIMITS = {
  /** Fans out up to ~60 upstream calls per request — the expensive one. */
  availability: 30,
  /** Pure compute — generous but bounded. */
  score: 60,
  /** JSON-RPC posts to the MCP transports. */
  mcp: 60,
} as const;

/**
 * Build a limiter from the environment. `LMKURNAME_RATE_LIMIT_RPM` overrides
 * the per-endpoint default; a non-positive value disables limiting (the
 * returned limiter allows everything).
 */
export function rateLimiterFromEnv(
  defaultRpm: number,
  env: Record<string, string | undefined>,
): RateLimiter {
  const override = Number(env.LMKURNAME_RATE_LIMIT_RPM);
  const rpm = Number.isFinite(override) && override > 0 ? override : defaultRpm;
  return new RateLimiter({ windowMs: 60_000, max: Math.max(1, Math.floor(rpm)) });
}

/**
 * Caller key from proxy headers: Cloudflare's `cf-connecting-ip` when
 * present, else the first `x-forwarded-for` hop, else a shared bucket.
 * Used by the web-standard runtimes; the Node server keys off
 * `req.socket.remoteAddress` unless it is told to trust the proxy headers.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf !== null && cf.trim() !== "") return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff !== null) {
    const first = xff.split(",")[0]?.trim();
    if (first !== undefined && first !== "") return first;
  }
  return "unknown";
}

/** 429 JSON body with `Retry-After`. CORS headers are applied by the caller. */
export function tooManyRequestsResponse(
  retryAfterSeconds: number,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error: "rate limit exceeded", retryAfterSeconds },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds), ...headers } },
  );
}

/** 413 response for a declared content-length over the request body cap. */
export function contentLengthExceeded(request: Request, maxBytes: number): boolean {
  const declared = Number(request.headers.get("content-length"));
  return Number.isFinite(declared) && declared > maxBytes;
}
