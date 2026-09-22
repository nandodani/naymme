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
 * Zero state: headline, center-stage search and the provider ribbon — nothing
 * else renders until a search executes.
 */
export function Hero({ value, onChange, onSubmit, valid, inputRef }: HeroProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-full max-w-xl flex-col items-center"
      >
        <h1 className="max-w-xl bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-center text-[28px] leading-[1.15] font-semibold tracking-tight text-balance text-transparent sm:text-[40px]">
          Check name availability across domains, code, and socials
        </h1>
        <p className="mt-4 text-center text-[14px] leading-relaxed text-zinc-500 sm:text-[15px]">
          Real-time availability across code registries, social handles, and top-level domains.
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
        <ProviderRibbon />
      </motion.div>
    </main>
  );
}
