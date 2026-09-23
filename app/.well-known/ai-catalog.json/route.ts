import { buildAiCatalog } from "@/lib/agent-discovery.js";

/**
 * /.well-known/ai-catalog.json — typed manifest of the AI-facing resources
 * this host publishes (ai-catalog.io spec), cross-origin readable.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(buildAiCatalog(), {
    headers: { "access-control-allow-origin": "*" },
  });
}
