import { openApiResponse } from "@/lib/openapi.js";

/** /openapi.json — OpenAPI 3.1 description of every public endpoint. */
export const dynamic = "force-static";

export function GET(): Response {
  return openApiResponse();
}
