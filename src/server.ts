import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ProviderDeps } from "./deps.js";
import { scoreName } from "./scoring/score.js";
import {
  checkAvailabilityInputSchema,
  checkAvailabilityOutputSchema,
  scoreNameInputSchema,
  scoreNameOutputSchema,
} from "./schemas.js";
import { checkAvailability } from "./tools/checkAvailability.js";

export const SERVER_NAME = "naymme";
export const SERVER_VERSION = "0.1.0";

/**
 * Build a configured MCP server. One instance is created per transport —
 * and in stateless HTTP mode, per request.
 */
export function createNaymmeServer(deps: ProviderDeps): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "check_availability",
    {
      title: "Check name availability",
      description:
        "Check whether a bare name is available across domain TLDs (.com, .gg, .dev, .io, .app " +
        "and the European ccTLDs .pt/.es/.de/.fr/.uk/.eu), GitHub (user/org namespace plus " +
        "repository-name collisions), dev registries (npm, PyPI, crates.io, Docker Hub, " +
        "Hugging Face, NuGet, RubyGems, Homebrew), hosted subdomains (.vercel.app, " +
        ".netlify.app), the Apple App Store, creator platforms and " +
        "social handles (X, Bluesky, Instagram, Reddit, YouTube, TikTok). Providers run " +
        "concurrently with an independent " +
        "5-second timeout each; a provider that fails or is inconclusive reports status " +
        "'unknown' rather than failing the request. 'available'/'taken' are best-effort " +
        "registrations snapshots — always re-confirm before buying or registering.",
      inputSchema: checkAvailabilityInputSchema,
      outputSchema: checkAvailabilityOutputSchema,
    },
    async (input) => {
      const result = await checkAvailability(input, deps);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "score_name",
    {
      title: "Score a name for brand quality",
      description:
        "Deterministically score a name out of 100 for brand quality: punchiness (length), " +
        "estimated syllables, pronounceability, uniqueness and cleanliness. Pure heuristic — " +
        "no lookups, same input always gives the same score.",
      inputSchema: scoreNameInputSchema,
      outputSchema: scoreNameOutputSchema,
    },
    async (input) => {
      const result = scoreName(input.name);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  return server;
}
