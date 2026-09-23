import { buildAuthMarkdown } from "@/lib/agent-discovery.js";

/**
 * /auth.md — the authentication document agents fetch to learn how to
 * authenticate: everything is public, so it documents the open tier, rate
 * limits, required headers and the (empty) OAuth story.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildAuthMarkdown(), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
