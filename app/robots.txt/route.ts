import { buildRobotsTxt } from "@/lib/agent-discovery.js";

/**
 * /robots.txt — route handler instead of the metadata API so the file can
 * carry Content-Signal directives (ai-train=no, search=yes, ai-input=no),
 * which MetadataRoute.Robots cannot express.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildRobotsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
