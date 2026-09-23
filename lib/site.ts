/**
 * Canonical site identity shared by every SEO surface — layout metadata,
 * robots.txt, sitemap.xml, the web manifest, JSON-LD and the social card.
 * SITE_URL is the deployed origin; url-based metadata fields resolve
 * against it via `metadataBase`.
 */
export const SITE_NAME = "lmkurname";
export const SITE_URL = "https://name-check-mcp.vercel.app";
export const SITE_TITLE = "lmkurname — check your name everywhere";
export const SITE_DESCRIPTION =
  "Check a name's availability across domains, GitHub, npm, and social handles, and score it for brand quality. The web UI and hosted endpoint for the lmkurname MCP server.";
export const SITE_KEYWORDS = [
  "name availability checker",
  "domain availability",
  "brand name checker",
  "social handle checker",
  "github username availability",
  "npm package name",
  "mcp server",
  "model context protocol",
] as const;
export const AUTHOR_NAME = "nandodani";
export const AUTHOR_URL = "https://nandodani.dev";
