/**
 * MCP client config generation for the Copy buttons.
 *
 * Cursor supports remote HTTP MCP servers natively via a `url` key. Claude
 * Desktop's config only speaks stdio, so it bridges through `mcp-remote` —
 * the community-standard shim — to reach the hosted /api/mcp endpoint.
 */

export interface McpClientConfig {
  /** Config file the snippet belongs in. */
  fileName: "cursor_mcp.json" | "claude_desktop_config.json";
  /** Short client label for the UI. */
  label: "Cursor" | "Claude Desktop";
  /** Ready-to-paste pretty-printed JSON. */
  json: string;
}

export interface McpConfigs {
  endpoint: string;
  cursor: McpClientConfig;
  claude: McpClientConfig;
}

const SERVER_KEY = "lmkurname";

/** Strip trailing slashes and append the endpoint path exactly once. */
export function mcpEndpointUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/mcp`;
}

export function buildCursorConfig(endpoint: string): Record<string, unknown> {
  return { mcpServers: { [SERVER_KEY]: { url: endpoint } } };
}

export function buildClaudeConfig(endpoint: string): Record<string, unknown> {
  return {
    mcpServers: { [SERVER_KEY]: { command: "npx", args: ["mcp-remote", endpoint] } },
  };
}

export function buildMcpConfigs(baseUrl: string): McpConfigs {
  const endpoint = mcpEndpointUrl(baseUrl);
  return {
    endpoint,
    cursor: {
      fileName: "cursor_mcp.json",
      label: "Cursor",
      json: `${JSON.stringify(buildCursorConfig(endpoint), null, 2)}\n`,
    },
    claude: {
      fileName: "claude_desktop_config.json",
      label: "Claude Desktop",
      json: `${JSON.stringify(buildClaudeConfig(endpoint), null, 2)}\n`,
    },
  };
}
