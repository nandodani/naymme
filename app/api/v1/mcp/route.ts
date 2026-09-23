import { handleMcpRequest, mcpOptionsResponse, mcpStatusResponse } from "@/lib/mcp-web.js";

/**
 * Versioned alias for /api/mcp — the hosted MCP Streamable HTTP endpoint.
 * GET returns the status document; POST speaks JSON-RPC 2.0; OPTIONS is
 * the CORS preflight. Same handler, `API-Version: 1` on every response.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(): Response {
  return mcpStatusResponse();
}

export function OPTIONS(): Response {
  return mcpOptionsResponse();
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
