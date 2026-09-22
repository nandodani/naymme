import { describe, expect, it } from "vitest";

import { buildMcpConfigs, claudeCodeCommand } from "../lib/mcp-config.js";
import { buildClientGuides } from "../lib/mcp-guides.js";

const ENDPOINT = "https://lmkurname.vercel.app/api/mcp";

describe("client guides", () => {
  it("covers every supported client plus the catch-all 'other' tab", () => {
    const guideIds = buildClientGuides(ENDPOINT).map((g) => g.id);
    const configIds = buildMcpConfigs("https://lmkurname.vercel.app").clients.map((c) => c.id);
    expect(new Set(guideIds).size).toBe(guideIds.length);
    for (const id of configIds) {
      expect(guideIds).toContain(id);
    }
    expect(guideIds.filter((id) => id === "other")).toHaveLength(1);
    // "other" is the trailing tab.
    expect(guideIds[guideIds.length - 1]).toBe("other");
  });

  it("copies the bare endpoint URL for http-native clients", () => {
    for (const guide of buildClientGuides(ENDPOINT)) {
      if (guide.id === "claude-code") continue;
      expect(guide.copyLabel).toBe("Server URL");
      expect(guide.copyValue).toBe(ENDPOINT);
    }
  });

  it("gives claude-code the CLI registration command", () => {
    const guide = buildClientGuides(ENDPOINT).find((g) => g.id === "claude-code");
    expect(guide?.copyLabel).toBe("Command");
    expect(guide?.copyValue).toBe(claudeCodeCommand(ENDPOINT));
  });

  it("offers a simple one-step Server URL view for other clients", () => {
    const guide = buildClientGuides(ENDPOINT).find((g) => g.id === "other");
    expect(guide?.mode).toBe("simple");
    expect(guide?.copyLabel).toBe("Server URL");
    expect(guide?.copyValue).toBe(ENDPOINT);
    expect(guide?.openSettings).toBe("Paste this URL into any MCP-compatible client or inspector.");
  });
});
