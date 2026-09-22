"use client";

import type { RefObject } from "react";
import { motion } from "motion/react";

import { ProviderRibbon } from "./provider-ribbon.js";
import { SearchInput } from "./search-input.js";

interface HeroProps {
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

/**
 * Zero state: headline, center-stage search and the provider ribbon — nothing
 * else renders until a search executes.
 */
export function Hero({ value, onChange, valid, inputRef }: HeroProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-full max-w-xl flex-col items-center"
      >
        <h1 className="max-w-lg text-center text-[26px] leading-tight font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Check identity availability across domains, code, and socials
        </h1>
        <div className="mt-8 w-full">
          <SearchInput
            ref={inputRef}
            value={value}
            onChange={onChange}
            valid={valid}
            variant="hero"
          />
        </div>
        <ProviderRibbon />
      </motion.div>
    </main>
  );
}
