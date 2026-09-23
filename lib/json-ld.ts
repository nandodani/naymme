import {
  AUTHOR_NAME,
  AUTHOR_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "./site.js";

/**
 * JSON-LD graph embedded in the home page: a WebSite entity plus the
 * WebApplication describing the checker engine — what it checks, the MCP
 * integration surface, and that it is free. Rendered via a
 * `type="application/ld+json"` script in app/page.tsx.
 */
export function jsonLdGraph(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: SITE_TITLE,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        sameAs: ["https://github.com/nandodani/name-check-mcp"],
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        inLanguage: "en",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        author: {
          "@type": "Person",
          name: AUTHOR_NAME,
          url: AUTHOR_URL,
        },
        featureList: [
          "check_availability — name availability across 55+ providers: domains (25+ TLDs), GitHub user/org/repo, npm, PyPI, crates, Docker Hub, NuGet, RubyGems, Homebrew, Hugging Face, Vercel, Netlify, app stores and social handles",
          "score_name — deterministic brand-quality score (punchiness, pronounceability, uniqueness, cleanliness)",
          "Model Context Protocol (MCP) server for AI assistants — stdio, Streamable HTTP and SSE transports",
        ],
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/?q={name}`,
          },
          "query-input": "required name=name",
        },
      },
    ],
  };
}
