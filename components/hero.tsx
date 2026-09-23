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
        </section>
      </motion.div>
    </main>
  );
}
