import { handleClientRegistration, oauthOptionsResponse } from "@/lib/oauth.js";

/**
 * POST /oauth/register — RFC 7591 Dynamic Client Registration. Issues a
 * signed, self-contained client_id (the registered redirect_uris travel
 * inside it), so no server-side store is needed on serverless. Required by
 * remote-MCP connectors that insist on DCR before starting OAuth.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return oauthOptionsResponse();
}

export async function POST(request: Request): Promise<Response> {
  return handleClientRegistration(request);
}
