import { describe, expect, it } from "vitest";
import {
  buildClaudeConfig,
  buildCursorConfig,
  buildMcpConfigs,
  buildVsCodeConfig,
  buildWindsurfConfig,
  claudeCodeCommand,
  mcpEndpointUrl,
} from "../lib/mcp-config.js";

describe("mcpEndpointUrl", () => {
  it("appends /api/mcp and strips trailing slashes", () => {
    expect(mcpEndpointUrl("https://lmkurname.example/")).toBe("https://lmkurname.example/api/mcp");
    expect(mcpEndpointUrl("http://localhost:3000")).toBe("http://localhost:3000/api/mcp");
  });
});

describe("buildMcpConfigs", () => {
  const configs = buildMcpConfigs("https://lmkurname.example");
  const endpoint = "https://lmkurname.example/api/mcp";

  it("covers Cursor, Claude Desktop, Windsurf, VS Code and Claude Code", () => {
    expect(configs.clients.map((c) => c.id)).toEqual([
      "cursor",
      "claude-desktop",
      "windsurf",
      "vscode",
      "claude-code",
    ]);
    for (const client of configs.clients) {
      expect(client.snippet).toContain(endpoint);
      expect(client.snippet.endsWith("\n")).toBe(true);
    }
  });

  it("emits valid pretty-printed JSON for the JSON-file clients", () => {
    const jsonClients = configs.clients.filter((c) => c.language === "json");
    expect(jsonClients.length).toBe(4);
    for (const client of jsonClients) {
      expect(() => JSON.parse(client.snippet)).not.toThrow();
      expect(client.snippet).toContain("\n  ");
    }
  });

  it("points Cursor at the hosted endpoint via url", () => {
    expect(buildCursorConfig(endpoint)).toEqual({
      mcpServers: { lmkurname: { url: endpoint } },
    });
    expect(configs.clients.find((c) => c.id === "cursor")?.destination).toBe(".cursor/mcp.json");
  });

  it("bridges Claude Desktop through mcp-remote", () => {
    expect(buildClaudeConfig(endpoint)).toEqual({
      mcpServers: { lmkurname: { command: "npx", args: ["mcp-remote", endpoint] } },
    });
    expect(configs.clients.find((c) => c.id === "claude-desktop")?.destination).toBe(
      "claude_desktop_config.json",
    );
  });

  it("points Windsurf at the hosted endpoint via serverUrl", () => {
    expect(buildWindsurfConfig(endpoint)).toEqual({
      mcpServers: { lmkurname: { serverUrl: endpoint } },
    });
  });

  it("registers VS Code via the servers map in .vscode/mcp.json", () => {
    expect(buildVsCodeConfig(endpoint)).toEqual({
      servers: { lmkurname: { type: "http", url: endpoint } },
    });
    expect(configs.clients.find((c) => c.id === "vscode")?.destination).toBe(".vscode/mcp.json");
  });

  it("emits the Claude Code CLI registration command", () => {
    expect(claudeCodeCommand(endpoint)).toBe(
      `claude mcp add --transport http lmkurname ${endpoint}`,
    );
    const claudeCode = configs.clients.find((c) => c.id === "claude-code");
    expect(claudeCode?.language).toBe("shell");
    expect(claudeCode?.destination).toBe("terminal");
  });
});
