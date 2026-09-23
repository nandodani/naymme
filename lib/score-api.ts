import { z } from "zod";
import { apiErrorResponse, API_ERROR_CODES } from "../src/api-errors.js";
import { nameSchema } from "../src/schemas.js";
import { scoreName } from "../src/scoring/score.js";
import { API_VERSION } from "../src/api-version.js";
import {
  clientKeyFromHeaders,
  RATE_LIMITS,
  rateLimiterFromEnv,
  rateLimitHeaders,
  tooManyRequestsResponse,
  type RateLimiter,
  type RateLimitVerdict,
} from "../src/security.js";

const NO_STORE = { "cache-control": "no-store" } as const;

let sharedLimiter: RateLimiter | null = null;
function defaultLimiter(): RateLimiter {
  sharedLimiter ??= rateLimiterFromEnv(RATE_LIMITS.score, process.env);
  return sharedLimiter;
}

/** GET /api/score?name=<name> — deterministic brand score as JSON. */
export function handleScoreRequest(
  req: Request,
  limiter: Pick<RateLimiter, "allow"> = defaultLimiter(),
): Response {
  const verdict = limiter.allow(clientKeyFromHeaders(req.headers));
  if (!verdict.ok) {
    return tooManyRequestsResponse(verdict, { ...NO_STORE, "api-version": API_VERSION });
  }

  // Same header contract as /api/availability: version + remaining budget.
  const headers = (v: RateLimitVerdict): Record<string, string> => ({
    ...NO_STORE,
    "api-version": API_VERSION,
    ...rateLimitHeaders(v),
  });

  const parsed = nameSchema.safeParse(new URL(req.url).searchParams.get("name"));
  if (!parsed.success) {
    return apiErrorResponse(
      400,
      API_ERROR_CODES.invalidRequest,
      "invalid request",
      "Pass ?name=<bare name, 1-63 chars of ASCII letters/digits/./_/- > — see /openapi.json.",
      {
        headers: headers(verdict),
        details: z.treeifyError(parsed.error),
      },
    );
  }
  return Response.json(scoreName(parsed.data), { headers: headers(verdict) });
}
