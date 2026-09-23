import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site.js";

/**
 * The indexable pages: the checker root plus the static content pages.
 * Search states live behind ?q= and resolve client-side, and the
 * machine-readable files (llms.txt, /.well-known/mcp, API routes) are
 * endpoints, not indexable content — so neither is listed here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/credits`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    { url: `${SITE_URL}/docs`, lastModified: new Date(), changeFrequency: "monthly" },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly" },
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly" },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "monthly" },
  ];
}
