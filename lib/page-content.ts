/**
 * Site copy as structured data — the single source of truth for the
 * human-readable pages (/docs, /about, /contact, /privacy), and the
 * `Accept: text/markdown` representation served to agents for the same
 * URLs. Author here, render twice.
 */

import { CREDIT_GROUPS } from "./credits.js";

export interface ContentLink {
  label: string;
  href: string;
}

export interface ContentSection {
  heading?: string;
  paragraphs?: readonly string[];
  list?: readonly string[];
  links?: readonly ContentLink[];
}

export interface PageContent {
  /** Route path this content backs ("" sections render without a heading). */
  path: string;
  /** h1 / markdown `# ` title. */
  title: string;
  /** Meta description and markdown lede. */
  description: string;
  sections: readonly ContentSection[];
}

export const HOME_CONTENT: PageContent = {
  path: "/",
  title: "naymme — check your name everywhere",
  description:
    "naymme checks whether a project or brand name is available across domains, developer platforms, package registries and social networks, then scores it for brand quality — from this web UI, a JSON API, or any MCP-compatible AI assistant.",
  sections: [
    {
      paragraphs: [
        "Type a candidate name once and naymme fans out to more than 55 independent providers, each queried live and reported back with its own verdict — available, taken, invalid, or unknown when the source cannot be checked. Beyond availability, it computes a deterministic 0–100 brand score covering punchiness, pronounceability, uniqueness and cleanliness.",
        "Everything the site exposes — the JSON API, the hosted MCP endpoint, the per-provider semantics and the agent surface — is documented on the docs page.",
      ],
      links: [
        { label: "Documentation — how checks run, providers, API and MCP", href: "/docs" },
        { label: "openapi.json — OpenAPI 3.1 description of the API", href: "/openapi.json" },
        { label: "llms.txt — agent quick-start", href: "/llms.txt" },
        { label: "llms-full.txt — complete agent instructions", href: "/llms-full.txt" },
        { label: ".well-known/mcp — MCP discovery document", href: "/.well-known/mcp" },
        { label: "MCP server card (SEP-1649)", href: "/.well-known/mcp/server-card.json" },
        { label: "API catalog linkset", href: "/.well-known/api-catalog" },
        { label: "auth.md — authentication and rate limits", href: "/auth.md" },
        { label: "sitemap.xml", href: "/sitemap.xml" },
      ],
    },
  ],
};

export const DOCS_CONTENT: PageContent = {
  path: "/docs",
  title: "Documentation",
  description:
    "How naymme checks a name, what the verdicts mean, and how to call it from the JSON API or an MCP-compatible AI assistant.",
  sections: [
    {
      heading: "What a check covers",
      paragraphs: [
        "Type a candidate name once and naymme fans out to more than 55 independent providers, each queried live and reported back with its own verdict — available, taken, invalid, or unknown when the source cannot be checked. Nothing is fabricated: a provider only reports available after seeing a verified unclaimed marker such as an RDAP 404, a registry not-found response, or a WHOIS no-match phrase.",
      ],
      list: [
        "Core domains — .com, .net, .org, .io, .dev, .app, .ai, .gg and more, resolved through the RDAP → WHOIS → DNS nameserver chain.",
        "European ccTLDs — .pt, .es, .de, .fr, .uk, .eu and neighbours for regional launches.",
        "Code registries — npm, PyPI, crates.io, Docker Hub, NuGet, RubyGems, Homebrew and Hugging Face.",
        "Developer platforms — GitHub user and organization namespaces plus repository-name collisions, GitLab, CodePen and Replit.",
        "Hosted subdomains — <name>.vercel.app and <name>.netlify.app, verified against unclaimed markers rather than guesswork.",
        "Stores and publishing — the Apple App Store, Substack, Medium, Product Hunt, and design communities such as Figma, Dribbble and Behance.",
        "Social handles — X, Bluesky, Instagram, Reddit, YouTube, TikTok and Telegram.",
      ],
    },
    {
      heading: "How a check runs",
      list: [
        "Enter a bare name — 1 to 63 characters, starting with a letter or digit, using only ASCII letters, digits, dots, underscores and hyphens.",
        "naymme validates the name against each provider's own rules before any network call, so an illegal handle shows as invalid instead of a false 'taken'.",
        "All providers run concurrently, each with its own 5-second timeout. A provider that fails or stays inconclusive degrades to 'unknown' — it never fails the batch or invents a verdict.",
        "Available domains surface registrar deep links with rough price estimates; taken subjects link out so you can see who holds them.",
      ],
    },
    {
      heading: "Brand scoring",
      paragraphs: [
        "Beyond availability, naymme computes a deterministic score out of 100 for how a name works as a brand. Punchiness rewards the 5–8 character sweet spot, pronounceability weighs familiar English bigrams and estimated syllables, uniqueness rewards novel coinages over common words, and cleanliness penalizes digits, separators and repeated characters. Same input, same score — every time, with no lookups.",
      ],
    },
    {
      heading: "Use it from your AI assistant",
      paragraphs: [
        "naymme is a Model Context Protocol server first. Point any MCP client at the hosted Streamable HTTP endpoint — POST /api/mcp on this origin — and it exposes two tools: check_availability(name, providers?) for the live 55-provider sweep, and score_name(name) for the deterministic brand score. Cursor, Windsurf and VS Code speak HTTP natively; Claude Desktop bridges through mcp-remote; Claude Code registers the endpoint with one CLI command. The Connect MCP button on the homepage generates the exact config for each client.",
      ],
      list: [
        "check_availability — { name, providers? } → { name, results, summary }. Each result reports provider, status (available | taken | unknown | invalid), subject, available flag, optional detail and durationMs.",
        "score_name — { name } → deterministic score payload: total 0–100, letter grade and per-component breakdown.",
      ],
    },
    {
      heading: "HTTP API",
      paragraphs: [
        'Everything the UI does is also a plain JSON endpoint — no auth, CORS-open for browser use. The API is version 1: /api/v1/* is canonical, while the unversioned /api/* paths and root-level /v1/* aliases (/v1/check, /v1/score, /v1/mcp, plus GET /v1 for the version index) hit the same handlers. Before any future breaking release, the older version would emit Deprecation, Sunset and a Link rel="deprecation" pointer for at least 6 months.',
        "Every response on every /api/* and /v1/* endpoint — successes, errors and 404s alike — carries the same convention headers: API-Version: 1, X-API-Version: 1.0.0 and the RFC RateLimit quartet RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, RateLimit-Policy (e.g. 60;w=60). Exhausting a limit returns 429 with Retry-After and the structured {error:{code,message,hint}} envelope.",
      ],
      list: [
        "GET /api/availability?name=<name>&providers=<csv> — normalized availability results; providers accepts ids or the aliases all, domains, domains:cctld, domains:all and socials.",
        "GET /api/score?name=<name> — the deterministic brand score breakdown.",
        "POST /api/mcp — MCP Streamable HTTP transport (JSON-RPC 2.0; SSE-framed responses).",
        "GET /api/mcp (also /mcp and /health) — status document for the hosted endpoint.",
      ],
    },
    {
      heading: "For agents and crawlers",
      paragraphs: [
        "This site negotiates content: send Accept: text/markdown to any page URL — including this one — and you get a markdown document instead of HTML. Unknown URLs return a markdown 404 that points back here.",
      ],
      links: [
        { label: "llms.txt — agent quick-start", href: "/llms.txt" },
        { label: "llms-full.txt — complete agent instructions", href: "/llms-full.txt" },
        { label: "openapi.json — OpenAPI 3.1 description of the API", href: "/openapi.json" },
        { label: ".well-known/mcp — MCP discovery document", href: "/.well-known/mcp" },
        { label: "MCP server card (SEP-1649)", href: "/.well-known/mcp/server-card.json" },
        { label: "AI catalog manifest", href: "/.well-known/ai-catalog.json" },
        { label: "agent-skills index", href: "/.well-known/agent-skills/index.json" },
        { label: "auth.md — authentication and rate limits", href: "/auth.md" },
        { label: "sitemap.xml", href: "/sitemap.xml" },
      ],
    },
    {
      heading: "What the verdicts mean",
      paragraphs: [
        "Every provider reports one of four statuses, and the words are precise — they describe evidence, not guesses.",
      ],
      list: [
        "available — the provider confirmed an unclaimed marker: an RDAP 404, a registry not-found response, or a WHOIS no-match phrase. Free to register, subject to a final re-check before you buy.",
        "taken — the name resolves to an existing registration, account, package or listing; the result links out so you can see exactly who holds it.",
        "invalid — the name breaks that provider's own rules on length, characters or reserved patterns, so it was rejected before any network call.",
        "unknown — the source timed out, rate-limited the request, or answered ambiguously. Unknown is never treated as available: re-check it later before relying on it.",
      ],
    },
    {
      heading: "An agent session, verbatim",
      paragraphs: [
        "The hosted MCP endpoint at POST /api/mcp is stateless Streamable HTTP — the whole handshake is two ordinary JSON-RPC 2.0 messages over POST, and responses arrive SSE-framed as event: message events.",
      ],
      list: [
        'initialize — {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"my-agent","version":"1.0"}}} returns the server card and tool capabilities.',
        'tools/call — {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_availability","arguments":{"name":"acme"}}} runs the sweep and returns the results payload inline.',
        "Any HTTP client can drive it — no SDK, session state or authentication is required; send Accept: application/json, text/event-stream.",
      ],
    },
    {
      heading: "Run it locally or self-host",
      paragraphs: [
        "The same codebase ships as the npm package naymme: `npx naymme` runs the full MCP server over stdio with zero configuration — the setup Claude Desktop and other local agents use when they should not depend on the hosted endpoint. A Cloudflare Worker build exposes the identical tools at the edge; deployment notes live in the deployment doc.",
      ],
    },
    {
      heading: "Who this is for",
      paragraphs: [
        "Founders picking a company or product name before filing paperwork: confirm the .com and the socials are actually reachable in one sweep instead of a dozen browser tabs.",
        "Developers naming a package, CLI or repository: check npm, PyPI, crates.io, Docker Hub and GitHub at once, and avoid publishing under a name that collides on the registry that matters most.",
        "AI assistants helping a user brainstorm: call check_availability and score_name as tools so suggestions come back with real availability data attached, not plausible-sounding guesses.",
        "Brand and naming reviewers comparing candidates: the deterministic score ranks shortlists on punchiness, pronounceability, uniqueness and cleanliness — the same rubric every time, so two names compare fairly.",
      ],
    },
    {
      heading: "Common questions",
      list: [
        "Why 'unknown'? Timeouts, rate limits and inconclusive upstream answers degrade to unknown by design — it is a 'check again later', never a silent pass.",
        "Is the API free to call? The JSON endpoints are open and CORS-enabled for browser use; a per-client rate limit throttles abuse and nothing more.",
        "Does a search commit me to anything? No — the app sets no cookies, stores no results, and the only persistence is the ?q= URL parameter you can share or bookmark.",
        "Where do the links lead? Available domains deep-link to registrars with rough price estimates; taken subjects link to the current holder's page.",
      ],
    },
    {
      heading: "Accuracy and limits",
      paragraphs: [
        "Availability is a best-effort snapshot of public registration state, not a guarantee: names can be registered between the check and your purchase, premium domains may report oddly, and some providers rate-limit. 'unknown' always means the source could not be checked — re-confirm anything important at the registrar or platform before committing. The web UI runs without accounts and without tracking; see the privacy page for exactly what leaves your browser.",
        "Two practical notes before relying on a green row. Domain availability flips the moment someone registers, so treat an 'available' verdict as a starting point and complete the purchase promptly rather than bookmarking it for later. And a handful of providers — app stores and social networks in particular — can only be checked through their public surface, so their verdicts carry a little more uncertainty than a registry lookup; when a name really matters, spot-check those providers directly.",
      ],
    },
  ],
};

export const ABOUT_CONTENT: PageContent = {
  path: "/about",
  title: "About naymme",
  description:
    "What naymme is, who maintains it, and how the availability engine works under the hood.",
  sections: [
    {
      paragraphs: [
        "naymme is a name-availability checker built for the moment every project starts with: you have a candidate name, and you need to know whether you can actually have it — as a domain, a package, a repository, a handle — before you fall in love with it.",
        "One input fans out to more than 55 providers across domain TLDs, developer platforms, package registries, hosted subdomains, app stores, publishing platforms and social networks, then distills the sweep into a per-provider grid plus a deterministic brand-quality score. The point is not just 'is it free' but 'is it free where it matters, and is it any good'.",
      ],
    },
    {
      heading: "One codebase, four surfaces",
      paragraphs: ["Everything runs from a single strict TypeScript codebase:"],
      list: [
        "This web app — the Next.js UI you are reading, plus the JSON API under /api.",
        "A hosted MCP server at /api/mcp (Streamable HTTP, stateless) so AI assistants can call the checks as tools.",
        "An npm package — the naymme bin is a stdio MCP server for fully local use.",
        "A Cloudflare Worker edge deployment exposing the same tools over web-standard fetch APIs.",
      ],
    },
    {
      heading: "How the checks work",
      paragraphs: [
        "Each provider is a small adapter behind one contract: validate the name against that platform's rules before touching the network, return a uniform outcome, honor cancellation, and only claim 'available' on a verified unclaimed marker. Domains resolve through the RDAP → WHOIS → DNS nameserver fallback chain; registries and platforms check their canonical endpoints. Providers run concurrently with a 5-second timeout each, and a failure degrades to 'unknown' rather than failing the whole sweep.",
        "The brand score is fully deterministic — punchiness, pronounceability, uniqueness and cleanliness — so the same name always earns the same grade.",
      ],
    },
    {
      heading: "Maintainer",
      paragraphs: [
        "naymme is maintained by @nandodani as an independent project. It is not affiliated with, endorsed by, or associated with any of the brands, platforms or registries it checks.",
      ],
      links: [
        { label: "nandodani.dev", href: "https://nandodani.dev" },
        { label: "Documentation", href: "/docs" },
        { label: "llms.txt", href: "/llms.txt" },
      ],
    },
  ],
};

export const CONTACT_CONTENT: PageContent = {
  path: "/contact",
  title: "Contact",
  description: "How to reach the maintainer of naymme — bugs, provider issues, feature ideas.",
  sections: [
    {
      paragraphs: [
        "naymme is maintained by @nandodani. The way to reach out is through the contact links on nandodani.dev — every message is read, and concrete reports are what keep the provider checks honest.",
      ],
      links: [{ label: "nandodani.dev", href: "https://nandodani.dev" }],
    },
    {
      heading: "Report a bug or a wrong result",
      paragraphs: [
        "Availability checks depend on third-party sources, so the more concrete the report the faster it lands: include the name you searched, the provider that looked wrong (for example domain:com or github), the verdict naymme showed, and what you expected instead. A URL or registry lookup showing the real state is ideal.",
      ],
      links: [
        { label: "Documentation", href: "/docs" },
        { label: "Back to the checker", href: "/" },
      ],
    },
    {
      heading: "Request a provider or a feature",
      paragraphs: [
        "New providers land through a small adapter contract — if a platform has a deterministic way to confirm a name is free, it can usually be added. Send the platform name and how availability can be verified through the contact links on nandodani.dev.",
      ],
      links: [
        { label: "Documentation", href: "/docs" },
        { label: "nandodani.dev", href: "https://nandodani.dev" },
      ],
    },
    {
      heading: "Everything else",
      paragraphs: [
        "There is no support SLA — this is an independent project — but real-world reports are what keep the provider checks honest.",
      ],
    },
  ],
};

export const PRIVACY_CONTENT: PageContent = {
  path: "/privacy",
  title: "Privacy",
  description:
    "What naymme sends where: no accounts, no tracking, and exactly which third parties see your search.",
  sections: [
    {
      paragraphs: [
        "naymme is designed to need almost nothing from you. There are no accounts, no sign-in, no cookies set by this app, no analytics or advertising trackers, and no client-side persistent storage — a search lives in the page's ?q= parameter and nowhere else.",
      ],
    },
    {
      heading: "What a search sends",
      paragraphs: [
        "When you run a check, your browser sends the candidate name to this site's API, and the server queries the relevant third-party sources on your behalf: RDAP and WHOIS servers and DNS for domains, the public endpoints of registries like npm, PyPI and crates.io, platforms like GitHub, and social networks. That means the name string itself — nothing else about you — is necessarily visible to those providers, exactly as if you had checked each site yourself.",
      ],
    },
    {
      heading: "Server-side handling",
      paragraphs: [
        "The API applies per-client rate limits keyed on the client IP address conveyed by standard proxy headers (cf-connecting-ip or x-forwarded-for); the key is used only to throttle abuse and is not persisted as an identity. The app is hosted on Vercel, whose infrastructure may keep standard request logs — see Vercel's privacy policy for that layer. No search results or names are stored server-side by this application.",
      ],
    },
    {
      heading: "What a result links to",
      paragraphs: [
        "Result rows link out to the providers themselves — registrar checkout pages, profile URLs, package pages. Following those links takes you to third-party sites with their own privacy practices, which this policy does not cover.",
      ],
    },
    {
      heading: "Changes",
      paragraphs: [
        "This policy describes the deployed site at naymme.vercel.app. If the data handling changes, this page changes with it. Questions about privacy are welcome via the contact page.",
      ],
      links: [
        { label: "Documentation", href: "/docs" },
        { label: "Contact", href: "/contact" },
      ],
    },
  ],
};

export const CREDITS_CONTENT: PageContent = {
  path: "/credits",
  title: "Credits",
  description:
    "Credits and attributions — the open-source libraries, fonts, and creative assets naymme is built on.",
  sections: [
    {
      paragraphs: [
        "naymme stands on the work of open-source projects. These are the libraries, fonts, and creative assets that make it work — each links to its project.",
      ],
    },
    ...CREDIT_GROUPS.map((group) => ({
      heading: group.title,
      links: group.entries.map((entry) => ({
        label: `${entry.name} (${entry.license}) — ${entry.usedFor}`,
        href: entry.href,
      })),
    })),
  ],
};

export const PAGE_CONTENTS: Readonly<Record<string, PageContent>> = {
  "/": HOME_CONTENT,
  "/docs": DOCS_CONTENT,
  "/about": ABOUT_CONTENT,
  "/contact": CONTACT_CONTENT,
  "/privacy": PRIVACY_CONTENT,
  "/credits": CREDITS_CONTENT,
};

/** Pages that answer `Accept: text/markdown` with a markdown body. */
export const MARKDOWN_PAGE_PATHS: readonly string[] = Object.keys(PAGE_CONTENTS);

/** Collapse a trailing slash so "/about/" resolves to the same page. */
export function normalizePagePath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}
