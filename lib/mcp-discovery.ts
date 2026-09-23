import { z } from "zod";

import { checkAvailabilityInputSchema, scoreNameInputSchema } from "../src/schemas.js";
import { SERVER_NAME, SERVER_VERSION } from "../src/server.js";
import { SITE_URL } from "./site.js";

/**
 * Discovery document served at /.well-known/mcp: describes the hosted MCP
 * server — name, transport, endpoint and tools with live input schemas — so
 * agents can find and use it without reading the docs. POST to the same URL
 * performs a real JSON-RPC handshake (delegated to the MCP transport).
 */
export function buildMcpDiscovery(): Record<string, unknown> {
  const endpoint = `${SITE_URL}/api/mcp`;
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description:
      "Check a name's availability across 55+ providers (domains, GitHub, npm, socials and more) and score it for brand quality.",
    homepage: SITE_URL,
    mcp: {
      transport: "streamable-http",
      endpoint,
      method: "POST",
      session: "stateless",
      note: "POST JSON-RPC 2.0 with Accept: application/json, text/event-stream. SSE-framed responses. POST to /.well-known/mcp performs the same handshake.",
    },
    tools: [
      {
        name: "check_availability",
        title: "Check name availability",
        description:
          "Check whether a bare name is available across domain TLDs, GitHub, dev registries (npm, PyPI, crates.io, Docker Hub, Hugging Face, NuGet, RubyGems, Homebrew), hosted subdomains, app stores, creator platforms and social handles.",
        inputSchema: z.toJSONSchema(checkAvailabilityInputSchema),
      },
      {
        name: "score_name",
        title: "Score a name for brand quality",
        description:
          "Deterministically score a name out of 100 for brand quality: punchiness, pronounceability, uniqueness and cleanliness. No lookups — same input always gives the same score.",
        inputSchema: z.toJSONSchema(scoreNameInputSchema),
      },
    ],
    api: {
      availability: `${SITE_URL}/api/availability?name=<name>`,
      score: `${SITE_URL}/api/score?name=<name>`,
    },
    links: {
      llms: `${SITE_URL}/llms.txt`,
      llmsFull: `${SITE_URL}/llms-full.txt`,
      sitemap: `${SITE_URL}/sitemap.xml`,
      documentation: "https://github.com/nandodani/name-check-mcp/tree/main/docs",
      source: "https://github.com/nandodani/name-check-mcp",
    },
  };
}
