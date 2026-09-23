import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site.js";

/**
 * The root is the primary indexable page (search states live behind ?q=
 * and resolve client-side, so they are not separate sitemap entries);
 * /credits is the second static route.
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
  ];
}
