import { buildApiCatalogLinkset } from "@/lib/agent-discovery.js";

/**
 * /.well-known/api-catalog — RFC 9264 linkset anchored at the site origin,
 * pointing agents at the OpenAPI service description, the HTML service
 * documentation and the status endpoint.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(buildApiCatalogLinkset(), {
    headers: { "content-type": "application/linkset+json" },
  });
}
