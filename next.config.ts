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
  async headers() {
    // Baseline hardening for every route (UI + API). CSP keeps script-src
    // at 'self' + 'unsafe-inline' because Next emits inline hydration
    // scripts; nonces would need middleware on every response.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "x-content-type-options", value: "nosniff" },
          { key: "x-frame-options", value: "DENY" },
          { key: "referrer-policy", value: "strict-origin-when-cross-origin" },
          { key: "permissions-policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "strict-transport-security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "content-security-policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/mcp", destination: "/api/mcp" },
      { source: "/health", destination: "/api/mcp" },
    ];
  },
};

export default nextConfig;
