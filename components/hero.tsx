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
          search fans out to 61 sources. lmkurname also ships a public REST API (/api/availability,
          /api/score), an MCP server for AI agents, OpenAPI 3.1 docs at /openapi.json, and markdown
          copies of every page for LLM crawlers.
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
      </motion.div>
    </main>
  );
}
