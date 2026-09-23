import { buildOauthProtectedResource } from "@/lib/agent-discovery.js";

/**
 * /.well-known/oauth-protected-resource — RFC 9728 Protected Resource
 * Metadata, cross-origin readable. The API is public: the document points
 * authorization_servers at this origin, whose RFC 8414 stub declares that
 * issuer grants no tokens — the definitive "no token tier" answer.
 */
export const dynamic = "force-static";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
} as const;

export function GET(): Response {
  return Response.json(buildOauthProtectedResource(), {
    headers: { "access-control-allow-origin": "*" },
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
