import type { NextConfig } from "next";

/**
 * The Next.js app serves both the web UI (/) and the hosted MCP endpoint
 * (/api/mcp). The /mcp and /health aliases keep the URLs documented for the
 * standalone Vercel function this app replaces.
 */
const nextConfig: NextConfig = {
  // whoiser opens raw TCP (node:net) and npm-name reads local npm config —
  // neither can be bundled; the SDK stays external for consistency.
  serverExternalPackages: ["whoiser", "npm-name", "@modelcontextprotocol/sdk"],
  async rewrites() {
    return [
      { source: "/mcp", destination: "/api/mcp" },
      { source: "/health", destination: "/api/mcp" },
    ];
  },
};

export default nextConfig;
