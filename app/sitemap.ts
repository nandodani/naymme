import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site.js";

/**
 * Single-route app: the root is the only indexable page (search states
 * live behind ?q= and resolve client-side, so they are not separate
 * sitemap entries).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
