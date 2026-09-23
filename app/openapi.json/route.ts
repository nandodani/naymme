import { openApiResponse } from "@/lib/openapi.js";

/** /openapi.json — OpenAPI 3.1 description of every public endpoint. */
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return openApiResponse(request);
}
