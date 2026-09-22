/**
 * Plain-English setup guides for the "Connect MCP" dialog — the friendly
 * step-by-step flow layered over the raw config data in mcp-config.ts.
 * Pure data so it can be unit-tested without a DOM.
 */

import { claudeCodeCommand, type McpClientConfig } from "./mcp-config.js";

export interface ClientGuide {
  /** Matches McpClientConfig.id so each guide pairs with its raw config. */
  id: McpClientConfig["id"];
  /** Step 1 — where to go in the client's UI. */
  openSettings: string;
  /** Label for the step-2 value the user copies. */
  copyLabel: "Server URL" | "Command";
  /** The step-2 value itself: the endpoint URL or a shell command. */
  copyValue: string;
  /** Toast text when the step-2 value is copied. */
  copyToast: string;
  /** Step 3 — what to do with the copied value. */
  pasteAndSave: string;
}

/**
 * One guided flow per supported client. HTTP-native clients copy the bare
 * endpoint URL; Claude Code copies its one-line CLI registration command.
 */
export function buildClientGuides(endpoint: string): readonly ClientGuide[] {
  return [
    {
      id: "claude-desktop",
      openSettings: "Open Claude Desktop → Settings → Connectors → “Add custom connector”.",
      copyLabel: "Server URL",
      copyValue: endpoint,
      copyToast: "Copied server URL",
      pasteAndSave:
        "Paste the URL into the remote server field and click Add — restart Claude Desktop if it doesn't appear.",
    },
    {
      id: "cursor",
      openSettings: "Open Cursor → Settings → MCP (or search “MCP” in settings).",
      copyLabel: "Server URL",
      copyValue: endpoint,
      copyToast: "Copied server URL",
      pasteAndSave:
        "Add a new MCP server and paste the URL — Cursor saves it to your mcp.json automatically.",
    },
    {
      id: "windsurf",
      openSettings: "Open Windsurf → Settings → Cascade → MCP servers → “Add server”.",
      copyLabel: "Server URL",
      copyValue: endpoint,
      copyToast: "Copied server URL",
      pasteAndSave:
        "Paste the URL as the server address and save — Windsurf loads the tools on next refresh.",
    },
    {
      id: "claude-code",
      openSettings: "Open a terminal in any folder where you use Claude Code.",
      copyLabel: "Command",
      copyValue: claudeCodeCommand(endpoint),
      copyToast: "Copied command",
      pasteAndSave: "Run the command — it registers the server instantly, no restart needed.",
    },
  ];
}
