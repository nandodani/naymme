import { handleScoreRequest } from "@/lib/score-api.js";

/** Versioned alias for GET /api/score — same handler, `API-Version: 1`. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return handleScoreRequest(request);
}
