import { buildMcpDiscovery } from "@/lib/mcp-discovery.js";
import { handleMcpRequest, mcpOptionsResponse } from "@/lib/mcp-web.js";

/**
 * /.well-known/mcp — MCP discovery + live handshake.
 *   GET     discovery document (tools, transport, endpoint)
 *   POST    full MCP JSON-RPC — delegates to the Streamable HTTP handler,
 *           so `initialize`/`tools/list`/`tools/call` work at this URL too.
 *   OPTIONS CORS preflight
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(): Response {
  return Response.json(buildMcpDiscovery());
}

export function OPTIONS(): Response {
  return mcpOptionsResponse();
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
