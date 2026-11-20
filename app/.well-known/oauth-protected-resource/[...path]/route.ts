import { buildOauthProtectedResource } from "@/lib/agent-discovery.js";

/**
 * /.well-known/oauth-protected-resource/<path> — RFC 9728 §3.1 resource-path
 * discovery. A client protecting https://host/api/mcp probes
 * /.well-known/oauth-protected-resource/api/mcp; the document is the same
 * public-tier metadata, with `resource` reflecting the requested path.
 */
export const runtime = "nodejs";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
} as const;

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return Response.json(buildOauthProtectedResource(`/${path.join("/")}`), {
    headers: { "access-control-allow-origin": "*" },
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
