import { handleAvailabilityRequest } from "@/lib/availability.js";

/**
 * GET /v1/check?name=<name>[&providers=...] — root-level versioned alias
 * for GET /api/availability (canonical: /api/v1/availability).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleAvailabilityRequest(request);
}
