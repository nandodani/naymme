import { handleScoreRequest } from "@/lib/score-api.js";

/** GET /api/score?name=<name> — deterministic brand score (same as the MCP tool). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return handleScoreRequest(request);
}
