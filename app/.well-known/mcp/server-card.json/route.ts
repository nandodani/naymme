import { buildMcpServerCard } from "@/lib/agent-discovery.js";

/**
 * /.well-known/mcp/server-card.json — SEP-1649 MCP server card: static
 * metadata (serverInfo, transport, capabilities, tools) so an agent can
 * evaluate the server before opening a connection.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(buildMcpServerCard());
}
