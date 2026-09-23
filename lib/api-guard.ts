import { apiErrorResponse, API_ERROR_CODES } from "../src/api-errors.js";
import { apiVersionHeaders } from "../src/api-version.js";
import {
  clientKeyFromHeaders,
  RATE_LIMITS,
  rateLimiterFromEnv,
  rateLimitHeaders,
  tooManyRequestsResponse,
  type RateLimiter,
  type RateLimitVerdict,
} from "../src/security.js";

/**
 * Shared request-budget guard for the cheap auxiliary API surfaces that
 * have no endpoint-specific limiter: /api/markdown, /api/openapi.json,
 * /openapi.json, the /api/* and /v1/* 404 catch-alls and the /v1 version
 * index. Consuming a real budget here keeps the RateLimit-* headers on
 * these endpoints truthful — and means even a 404 answer is rate-limited,
 * so scanning arbitrary paths can't be free.
 */

let sharedLimiter: RateLimiter | null = null;
function defaultLimiter(): RateLimiter {
  sharedLimiter ??= rateLimiterFromEnv(RATE_LIMITS.aux, process.env);
  return sharedLimiter;
}

/**
 * Consume one request's aux budget. On success returns the header block to
 * merge into the response (version + RFC RateLimit fields); on exhaustion
 * returns the ready-to-send 429 envelope.
 */
export function guardAuxRequest(
  request: Request,
  limiter: Pick<RateLimiter, "allow"> = defaultLimiter(),
): { ok: true; headers: Record<string, string> } | { ok: false; response: Response } {
  const verdict: RateLimitVerdict = limiter.allow(clientKeyFromHeaders(request.headers));
  if (!verdict.ok) {
    return { ok: false, response: tooManyRequestsResponse(verdict, apiVersionHeaders()) };
  }
  return { ok: true, headers: { ...apiVersionHeaders(), ...rateLimitHeaders(verdict) } };
}

/**
 * Structured JSON 404 for unmapped API paths — agents always get the
 * {error:{code,message,hint}} envelope instead of the HTML 404 page.
 */
export function apiNotFound(request: Request): Response {
  const { pathname } = new URL(request.url);
  const guard = guardAuxRequest(request);
  if (!guard.ok) return guard.response;
  return apiErrorResponse(
    404,
    API_ERROR_CODES.notFound,
    `${pathname} not found`,
    "No API endpoint is published at this path — real entry points: /api/availability, /api/score, /api/mcp (and /v1/check, /v1/score, /v1/mcp, /api/v1/* aliases), /api/markdown, /api/openapi.json. See /openapi.json.",
    { headers: guard.headers },
  );
}
