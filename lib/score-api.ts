import { z } from "zod";
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
    return Response.json(
      { error: "invalid request", issues: z.treeifyError(parsed.error) },
      { status: 400, headers: NO_STORE },
    );
  }
  return Response.json(scoreName(parsed.data), { headers: NO_STORE });
}
