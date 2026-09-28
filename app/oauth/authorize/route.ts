import { handleAuthorizationRequest, oauthOptionsResponse } from "@/lib/oauth.js";

/**
 * GET /oauth/authorize — OAuth 2.0 authorization endpoint (RFC 6749 §4.1).
 * Auto-approves: the resource is already public, so there is no consent
 * interstitial — a valid request immediately 302s back with a signed,
 * PKCE-bound, 5-minute authorization code.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return oauthOptionsResponse();
}

export async function GET(request: Request): Promise<Response> {
  return handleAuthorizationRequest(request);
}
