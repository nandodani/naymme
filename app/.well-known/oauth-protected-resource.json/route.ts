import { buildOauthProtectedResource } from "@/lib/agent-discovery.js";

/**
 * /.well-known/oauth-protected-resource.json — explicit .json alias for
 * the RFC 9728 Protected Resource Metadata document (same payload as the
 * extensionless path), cross-origin readable.
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
