/**
 * Plain-English setup guides for the "Connect MCP" dialog — the friendly
 * step-by-step flow layered over the raw config data in mcp-config.ts.
 * Pure data so it can be unit-tested without a DOM.
 */

import { claudeCodeCommand, type McpClientConfig } from "./mcp-config.js";

/** "other" is a guide-only tab for nonstandard MCP clients — it has no raw
 * config entry, just the bare endpoint. */
export type ClientGuideId = McpClientConfig["id"] | "other";

export interface ClientGuide {
  id: ClientGuideId;
  /** Tab label shown under the client icon. */
  label: string;
  /** Guided (3-step) or simple (single copy field) layout. */
  mode: "guided" | "simple";
  /** Step 1 — where to go in the client's UI. */
  openSettings: string;
  /** Label for the copyable value. */
  copyLabel: "Server URL" | "Command";
  /** The copyable value itself: the endpoint URL or a shell command. */
  copyValue: string;
  /** Toast text when the value is copied. */
  copyToast: string;
  /** Step 3 — what to do with the copied value (guided mode only). */
  pasteAndSave: string;
}

/**
 * One guide per client tab, in display order. HTTP-native clients copy the
 * bare endpoint URL; Claude Code copies its one-line CLI registration
 * command; "other" hands over the raw endpoint for arbitrary clients.
 */
export function buildClientGuides(endpoint: string): readonly ClientGuide[] {
  return [
    {
      id: "claude-desktop",
      label: "Claude Desktop",
      mode: "guided",
      openSettings: "Open Claude Desktop → Settings → Connectors → “Add custom connector”.",
      copyLabel: "Server URL",
      copyValue: endpoint,
      copyToast: "Copied server URL",
      pasteAndSave:
        "Paste the URL into the remote server field and click Add — restart Claude Desktop if it doesn't appear.",
    },
    {
      id: "cursor",
      label: "Cursor",
      mode: "guided",
      openSettings: "Open Cursor → Settings → MCP (or search “MCP” in settings).",
      copyLabel: "Server URL",
      copyValue: endpoint,
      copyToast: "Copied server URL",
      pasteAndSave:
        "Add a new MCP server and paste the URL — Cursor saves it to your mcp.json automatically.",
    },
    {
      id: "windsurf",
      label: "Windsurf",
      mode: "guided",
      openSettings: "Open Windsurf → Settings → Cascade → MCP servers → “Add server”.",
      copyLabel: "Server URL",
      copyValue: endpoint,
      copyToast: "Copied server URL",
      pasteAndSave:
        "Paste the URL as the server address and save — Windsurf loads the tools on next refresh.",
    },
    {
      id: "vscode",
      label: "VS Code",
      mode: "guided",
      openSettings: "Open VS Code → Command Palette → “MCP: Add Server” (or your mcp.json).",
      copyLabel: "Server URL",
      copyValue: endpoint,
      copyToast: "Copied server URL",
      pasteAndSave: "Choose the HTTP transport, paste the URL, and save — no restart needed.",
    },
    {
      id: "claude-code",
      label: "Claude Code",
      mode: "guided",
      openSettings: "Open a terminal in any folder where you use Claude Code.",
      copyLabel: "Command",
      copyValue: claudeCodeCommand(endpoint),
      copyToast: "Copied command",
      pasteAndSave: "Run the command — it registers the server instantly, no restart needed.",
    },
    {
      id: "other",
      label: "Other",
      mode: "simple",
      openSettings: "Paste this URL into any MCP-compatible client or inspector.",
      copyLabel: "Server URL",
      copyValue: endpoint,
      copyToast: "Copied server URL",
      pasteAndSave: "",
    },
  ];
}
