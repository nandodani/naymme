import { describe, expect, it } from "vitest";

import { buildMcpConfigs, claudeCodeCommand } from "../lib/mcp-config.js";
import { buildClientGuides } from "../lib/mcp-guides.js";

const ENDPOINT = "https://lmkurname.vercel.app/api/mcp";

describe("client guides", () => {
  it("covers every supported client exactly once", () => {
    const guideIds = buildClientGuides(ENDPOINT)
      .map((g) => g.id)
      .sort();
    const configIds = buildMcpConfigs("https://lmkurname.vercel.app")
      .clients.map((c) => c.id)
      .sort();
    expect(guideIds).toEqual(configIds);
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
});
