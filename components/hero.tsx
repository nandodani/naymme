"use client";

import type { RefObject } from "react";
import { motion } from "motion/react";

import { ProviderRibbon } from "./provider-ribbon.js";
import { SearchInput } from "./search-input.js";

interface HeroProps {
  value: string;
  onChange: (value: string) => void;
  /** Runs the search — Enter or the in-bar Search button. */
  onSubmit: () => void;
  valid: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

/**
 * Zero state: headline, center-stage search and the provider ribbon.
 */
export function Hero({ value, onChange, onSubmit, valid, inputRef }: HeroProps) {
  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex min-h-[calc(100dvh-6rem)] w-full max-w-xl flex-col items-center justify-center self-center px-4 sm:px-6"
      >
        <h1 className="max-w-xl bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-center text-[28px] leading-[1.15] font-semibold tracking-tight text-balance text-transparent sm:text-[40px]">
          Check name availability across domains, code, and socials
        </h1>
        <p className="mt-4 text-center text-[14px] leading-relaxed text-zinc-400 sm:text-[15px]">
          Real-time availability across code registries, social handles, and top-level domains — one
          search fans out to 61 sources.
        </p>
        <div className="mt-8 w-full">
          <SearchInput
            ref={inputRef}
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            valid={valid}
            variant="hero"
          />
        </div>
        <h2 className="mt-12 text-[11px] font-normal tracking-wide text-zinc-400 uppercase">
          search on
        </h2>
        <ProviderRibbon />
        {/*
          Agent/screen-reader content: semantically structured description
          of the programmatic surface. Visually hidden (sr-only) — real HTML
          text for crawlers and assistive tech, zero visual footprint.
        */}
        <section aria-label="Developer and agent access" className="sr-only">
          <h2>Public API for agents and developers</h2>
          <p>
            lmkurname is also a public, unauthenticated API and MCP server. No API key or account is
            required; authentication and rate limits are documented at /auth.md.
          </p>
          <h3>REST API (version 1)</h3>
          <p>
            GET /api/availability?name=&lt;name&gt;[&amp;providers=&lt;csv&gt;] returns normalized
            per-provider verdicts — available, taken, unknown or invalid — across 61 sources. GET
            /api/score?name=&lt;name&gt; returns a deterministic 0–100 brand score. Versioned
            aliases live under /api/v1/; every response carries an API-Version header and RFC
            RateLimit headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset). Errors are
            structured JSON: {"{"}error: {"{"}code, message, hint{"}"}
            {"}"}.
          </p>
          <h3>MCP server for AI assistants</h3>
          <p>
            POST /api/mcp speaks MCP over stateless Streamable HTTP (JSON-RPC 2.0) and exposes two
            tools: check_availability and score_name. Machine-readable entry points: OpenAPI 3.1 at
            /openapi.json, the MCP discovery document at /.well-known/mcp, the SEP-1649 server card
            at /.well-known/mcp/server-card.json, the API catalog linkset at
            /.well-known/api-catalog, agent skills at /.well-known/agent-skills/index.json, and the
            AI catalog at /.well-known/ai-catalog.json. Every page is also available as markdown via
            Accept: text/markdown or /api/markdown, and llms.txt gives the agent quick-start.
          </p>
          <h3>Provider coverage</h3>
          <p>
            Domains (.com and 24 more TLDs via RDAP, WHOIS and DNS), GitHub user/org/repo and
            GitLab, package registries (npm, PyPI, crates.io, Docker Hub, JSR, deno.land, NuGet,
            RubyGems, Homebrew, Hugging Face), hosted subdomains (vercel.app, netlify.app,
            pages.dev, fly.dev, up.railway.app, supabase.co), app stores and social handles.
          </p>
          <h3>How availability is checked</h3>
          <p>
            Each candidate name is validated against the naming rules of every selected provider —
            length, character set and structure — before any lookup runs, so invalid names are
            reported as invalid rather than silently skipped. Domain checks resolve through a
            layered fallback chain: RDAP first for registries that publish it, WHOIS for the rest,
            and DNS nameserver checks as an existence signal for hosted subdomains. Registry and
            platform lookups ask the canonical source directly — the npm registry, PyPI, crates.io,
            GitHub&apos;s API, app store search — and every adapter runs under its own timeout so
            one slow provider never blocks the batch.
          </p>
          <p>
            Results come back as a uniform verdict per provider: available when the source
            verifiably reports the name unclaimed, taken when it is already registered, invalid when
            it violates the provider&apos;s naming rules, and unknown when the source could not be
            checked at all. An unknown is never reported as available — the API only claims
            availability on a verified unclaimed marker such as an RDAP 404 or a registry miss, so
            every available verdict can be independently re-checked at the source.
          </p>
          <h3>Response contract</h3>
          <p>
            The availability endpoint returns the queried name, a results array with one entry per
            provider — provider id, status, subject, availability boolean, an optional detail
            string, and the check duration in milliseconds — and a summary that tallies each status.
            The score endpoint returns a deterministic 0–100 brand score with per-component values
            for punchiness, syllables, pronounceability, uniqueness and cleanliness, so two calls
            with the same name always produce the same score and results can be compared across
            candidates without flakiness.
          </p>
          <p>
            Failures are structured JSON rather than HTML: every error response carries an error
            object with a stable machine-readable code, a human-readable message, and a hint that
            tells the caller how to recover — for example, which parameters are required or where to
            find the valid entry points. Requests to unmapped API paths return a 404 in the same
            envelope, so agents never have to parse an HTML error page to discover they took a wrong
            turn.
          </p>
          <h3>Rate limits and headers</h3>
          <p>
            Every API response — including errors and 404s — carries RFC rate-limit headers:
            RateLimit-Limit for the request budget, RateLimit-Remaining for what is left in the
            current window, RateLimit-Reset for seconds until the window rolls, and RateLimit-Policy
            declaring the limit and window size. A 429 response adds Retry-After with the same
            envelope shape, so agents can self-throttle without guessing. The public tier needs no
            API key, token or account; authentication policy and the full header convention are
            documented at /auth.md.
          </p>
          <h3>Versioning and deprecation</h3>
          <p>
            The API is version 1: /api/v1/* paths are canonical, short aliases live at /v1/*, and
            every response carries API-Version: 1 and X-API-Version: 1.0.0. Stable versions are
            never removed without notice — if a breaking v2 ever ships, v1 stays live and emits
            Deprecation, Sunset and Link headers for at least six months before removal, so
            integrations get a long, machine-readable warning runway.
          </p>
          <h3>Discovery and machine-readable files</h3>
          <p>
            Agent entry points are published as standards-based discovery documents: the OpenAPI 3.1
            description at /openapi.json, the API catalog linkset at /.well-known/api-catalog, the
            MCP server card at /.well-known/mcp/server-card.json, the agent skills index at
            /.well-known/agent-skills/index.json, and the AI catalog at
            /.well-known/ai-catalog.json. OAuth discovery stubs for the public tier live at
            /.well-known/oauth-authorization-server and /.well-known/oauth-protected-resource,
            llms.txt and llms-full.txt give the quick-start for agents, /auth.md covers auth and
            rate-limit policy, and every page serves a markdown representation to clients that send
            Accept: text/markdown.
          </p>
          <h3>MCP tool reference</h3>
          <p>
            check_availability takes a name and an optional providers array — provider ids or the
            aliases all, domains, domains:cctld, domains:all and socials — and returns the name, a
            results array, and a summary tally. score_name takes a name and returns the normalized
            form plus the five component scores, the total and the grade. Both tools are also
            described, with their live JSON input schemas, in the MCP discovery document at
            /.well-known/mcp and in the server card at /.well-known/mcp/server-card.json, so a
            client can wire them up without reading a word of prose.
          </p>
          <h3>Content negotiation and error handling</h3>
          <p>
            Clients choose their representation with the Accept header: text/html returns this site,
            text/markdown returns the same content as a markdown document, and application/json on
            an unmapped path returns the structured error envelope. That makes every page on the
            site readable by an agent without executing JavaScript — the same content a browser
            renders is available as clean, crawlable text on the same URL.
          </p>
          <p>
            The service ships in four interchangeable runtimes: this web app and its JSON API, a
            hosted MCP endpoint over Streamable HTTP, an npm-published stdio server launched with
            npx lmkurname for local assistants, and a Cloudflare Worker built from the same
            TypeScript sources — every surface speaks the same tools, the same input schemas and the
            same response contract, so an integration written against one works against all of them.
          </p>
          <h3>Agent instructions and documentation</h3>
          <p>
            Full endpoint documentation lives at /docs, the authentication and rate-limit policy at
            /auth.md, and a complete OpenAPI 3.1 description of every public endpoint — including
            request parameters, response schemas, error shapes and the headers each operation
            returns — at /openapi.json and /api/openapi.json. Packaged skills for agents are
            published at /.well-known/agent-skills/index.json with SHA-256 digests: the
            name-availability-check skill covers the availability sweep and the brand-name-scoring
            skill covers the deterministic scorer, each with concrete curl and JSON-RPC invocation
            examples. DNS discovery records for the hosted MCP endpoint are documented in DNS-AID.md
            at the repository root.
          </p>
          <h3>When to use lmkurname</h3>
          <p>
            Use it when evaluating a name for a project, product, company, package or handle before
            registering it anywhere — one call answers whether the name is free across domains, code
            registries, hosted subdomains, stores and socials, and whether it scores well as a
            brand. It is not a substitute for trademark or legal clearance, premium-domain pricing,
            or guaranteed availability: verdicts are best-effort snapshots meant to be re-confirmed
            at the registrar or platform before purchase.
          </p>
        </section>
      </motion.div>
    </main>
  );
}
