import { handleMcpRequest, mcpOptionsResponse, mcpStatusResponse } from "@/lib/mcp-web.js";

/**
 * Hosted MCP endpoint — stateless Streamable HTTP (spec 2025-03-26+):
 *   POST   JSON-RPC; SSE-framed response unless the client asks for JSON only.
 *   GET    status document (also serves the /health and /mcp aliases).
 *   OPTIONS CORS preflight.
 * Stateless mode intentionally has no standalone GET SSE stream — see
 * src/mcp-http.ts for the same contract on the standalone Node server.
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
