import { buildOauthAuthorizationServer } from "@/lib/agent-discovery.js";

/**
 * /.well-known/oauth-authorization-server — RFC 8414 Authorization Server
 * Metadata. A stub: this host runs no authorization server, so the
 * document declares the issuer and empty capability lists — a definitive
 * "public/no-token tier" answer for agents probing the standard path.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(buildOauthAuthorizationServer(), {
    headers: { "access-control-allow-origin": "*" },
  });
}
