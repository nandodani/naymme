/**
 * MCP client config generation for the copy buttons.
 *
 * Cursor supports remote HTTP MCP servers natively via a `url` key, and
 * Windsurf via `serverUrl` in its mcp_config.json. Claude Desktop's config
 * only speaks stdio, so it bridges through `mcp-remote` — the
 * community-standard shim — to reach the hosted /api/mcp endpoint. Claude
 * Code registers servers through its CLI instead of a JSON file.
 */

export interface McpClientConfig {
  /** Stable client id, also used as a React key. */
  id: "cursor" | "claude-desktop" | "windsurf" | "vscode" | "claude-code";
  /** Short client label for the UI. */
  label: string;
  /** Where the snippet belongs: a config file path or "terminal". */
  destination: string;
  /** Syntax the snippet is written in — drives the copy affordance. */
  language: "json" | "shell";
  /** Ready-to-paste snippet text. */
  snippet: string;
}

export interface McpConfigs {
  endpoint: string;
  clients: readonly McpClientConfig[];
}

const SERVER_KEY = "naymme";

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

export function buildWindsurfConfig(endpoint: string): Record<string, unknown> {
  return { mcpServers: { [SERVER_KEY]: { serverUrl: endpoint } } };
}

/** VS Code reads remote HTTP servers from a `servers` map in mcp.json. */
export function buildVsCodeConfig(endpoint: string): Record<string, unknown> {
  return { servers: { [SERVER_KEY]: { type: "http", url: endpoint } } };
}

/** One-liner that registers the hosted server with the Claude Code CLI. */
export function claudeCodeCommand(endpoint: string): string {
  return `claude mcp add --transport http ${SERVER_KEY} ${endpoint}`;
}

export function buildMcpConfigs(baseUrl: string): McpConfigs {
  const endpoint = mcpEndpointUrl(baseUrl);
  return {
    endpoint,
    clients: [
      {
        id: "cursor",
        label: "Cursor",
        destination: ".cursor/mcp.json",
        language: "json",
        snippet: `${JSON.stringify(buildCursorConfig(endpoint), null, 2)}\n`,
      },
      {
        id: "claude-desktop",
        label: "Claude Desktop",
        destination: "claude_desktop_config.json",
        language: "json",
        snippet: `${JSON.stringify(buildClaudeConfig(endpoint), null, 2)}\n`,
      },
      {
        id: "windsurf",
        label: "Windsurf",
        destination: "~/.codeium/windsurf/mcp_config.json",
        language: "json",
        snippet: `${JSON.stringify(buildWindsurfConfig(endpoint), null, 2)}\n`,
      },
      {
        id: "vscode",
        label: "VS Code",
        destination: ".vscode/mcp.json",
        language: "json",
        snippet: `${JSON.stringify(buildVsCodeConfig(endpoint), null, 2)}\n`,
      },
      {
        id: "claude-code",
        label: "Claude Code",
        destination: "terminal",
        language: "shell",
        snippet: `${claudeCodeCommand(endpoint)}\n`,
      },
    ],
  };
}
