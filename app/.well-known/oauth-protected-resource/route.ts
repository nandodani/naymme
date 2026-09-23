import { buildOauthProtectedResource } from "@/lib/agent-discovery.js";

/**
 * /.well-known/oauth-protected-resource — RFC 9728 metadata stub. The API
 * is public and unauthenticated, so the document advertises the resource
 * with an empty authorization_servers list: a compliant way to state
 * "no token tier" rather than omitting the discovery endpoint.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(buildOauthProtectedResource());
}
