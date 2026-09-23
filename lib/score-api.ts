import { z } from "zod";
import { apiErrorResponse, API_ERROR_CODES } from "../src/api-errors.js";
import { nameSchema } from "../src/schemas.js";
import { scoreName } from "../src/scoring/score.js";
import {
  clientKeyFromHeaders,
  RATE_LIMITS,
  rateLimiterFromEnv,
  tooManyRequestsResponse,
  type RateLimiter,
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
  if (!verdict.ok) return tooManyRequestsResponse(verdict.retryAfterSeconds, NO_STORE);

  const parsed = nameSchema.safeParse(new URL(req.url).searchParams.get("name"));
  if (!parsed.success) {
    return apiErrorResponse(
      400,
      API_ERROR_CODES.invalidRequest,
      "invalid request",
      "Pass ?name=<bare name, 1-63 chars of ASCII letters/digits/./_/- > — see /openapi.json.",
      {
        headers: NO_STORE,
        details: z.treeifyError(parsed.error),
      },
    );
  }
  return Response.json(scoreName(parsed.data), { headers: NO_STORE });
}
