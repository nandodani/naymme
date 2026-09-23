import { openApiResponse } from "@/lib/openapi.js";

/** /api/openapi.json — alias for /openapi.json, with the API header contract. */
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return openApiResponse(request);
}
