import { handleScoreRequest } from "@/lib/score-api.js";

/**
 * GET /v1/score?name=<name> — root-level versioned alias for
 * GET /api/score (canonical: /api/v1/score).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return handleScoreRequest(request);
}
