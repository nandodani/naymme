import { openApiResponse } from "@/lib/openapi.js";

/** /api/openapi.json — alias for /openapi.json. */
export const dynamic = "force-static";

export function GET(): Response {
  return openApiResponse();
}
