import { handleMcpRequest, handleMcpStatusRequest, mcpOptionsResponse } from "@/lib/mcp-web.js";

/**
 * /v1/mcp — root-level versioned alias for /api/mcp (canonical:
 * /api/v1/mcp). Same stateless Streamable HTTP transport.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(request: Request): Response {
  return handleMcpStatusRequest(request);
}

export function OPTIONS(): Response {
  return mcpOptionsResponse();
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
