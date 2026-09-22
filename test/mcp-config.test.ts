import { describe, expect, it } from "vitest";
import {
  buildClaudeConfig,
  buildCursorConfig,
  buildMcpConfigs,
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

  it("emits valid pretty-printed JSON for both clients", () => {
    for (const config of [configs.cursor, configs.claude]) {
      expect(() => JSON.parse(config.json)).not.toThrow();
      expect(config.json).toContain("\n  ");
      expect(config.json.endsWith("\n")).toBe(true);
    }
  });

  it("points Cursor at the hosted endpoint via url", () => {
    expect(buildCursorConfig(endpoint)).toEqual({
      mcpServers: { lmkurname: { url: endpoint } },
    });
    expect(configs.cursor.fileName).toBe("cursor_mcp.json");
    expect(configs.cursor.label).toBe("Cursor");
  });

  it("bridges Claude Desktop through mcp-remote", () => {
    expect(buildClaudeConfig(endpoint)).toEqual({
      mcpServers: { lmkurname: { command: "npx", args: ["mcp-remote", endpoint] } },
    });
    expect(configs.claude.fileName).toBe("claude_desktop_config.json");
    expect(configs.claude.label).toBe("Claude Desktop");
  });
});
