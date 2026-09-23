import { handleAvailabilityRequest } from "@/lib/availability.js";

/**
 * Versioned alias for GET /api/availability — same handler, same response.
 * Both URLs are API v1; every response carries `API-Version: 1` plus the
 * caller's RFC RateLimit budget headers.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleAvailabilityRequest(request);
}
