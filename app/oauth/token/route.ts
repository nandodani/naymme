import { handleTokenRequest, oauthOptionsResponse } from "@/lib/oauth.js";

/**
 * POST /oauth/token — RFC 6749 token endpoint. Exchanges authorization
 * codes (PKCE S256 verified, single-use) and rotates refresh_tokens for
 * signed Bearer tokens. Public clients authenticate with `none`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return oauthOptionsResponse();
}

export async function POST(request: Request): Promise<Response> {
  return handleTokenRequest(request);
}
