import { handleAvailabilityRequest } from "@/lib/availability.js";

/**
 * GET /api/availability?name=<name>[&providers=domain:com,github,...]
 *
 * Normalized availability across domains, developer platforms and socials.
 * Response extends the MCP tool output with a `mode` field ("live" | "demo")
 * so clients can label deterministic-fixture results honestly.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleAvailabilityRequest(request);
}
