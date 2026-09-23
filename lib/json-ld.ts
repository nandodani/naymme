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
        sameAs: [AUTHOR_URL],
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
          "check_availability — name availability across 61 providers: domains (25 TLDs), GitHub user/org/repo, npm, PyPI, crates, Docker Hub, JSR, deno.land, NuGet, RubyGems, Homebrew, Hugging Face, Vercel, Netlify, Cloudflare Pages, Fly.io, Railway, Supabase, app stores and social handles",
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
      {
        // The programmatic surface as its own entity so search/agent
        // crawlers can index the API itself, not just the site.
        "@type": "APIReference",
        "@id": `${SITE_URL}/#api`,
        name: `${SITE_NAME} REST + MCP API (v1)`,
        url: `${SITE_URL}/openapi.json`,
        documentation: `${SITE_URL}/docs`,
        description:
          "Public unauthenticated API: GET /api/v1/availability and /api/v1/score (REST) plus POST /api/mcp (MCP Streamable HTTP, tools check_availability and score_name). OpenAPI 3.1 spec, structured JSON errors, RFC RateLimit headers, API-Version: 1.",
        inLanguage: "en",
        isAccessibleForFree: true,
        assemblyVersion: "1",
        programmingModel:
          "REST (versioned /api/v1/*) and Model Context Protocol (JSON-RPC 2.0 over Streamable HTTP)",
        author: {
          "@type": "Person",
          name: AUTHOR_NAME,
          url: AUTHOR_URL,
        },
      },
    ],
  };
}
