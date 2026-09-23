import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site.js";

/**
 * Everything is crawlable except the API surface — the JSON routes under
 * /api (and the /mcp, /health aliases that rewrite to them) are machine
 * endpoints, not indexable content.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
