"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils.js";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
  /** `hero` is the large center-stage control; `compact` sits atop results. */
  variant?: "hero" | "compact";
}

/**
 * The name search control: a single hairline-bordered shell with a leading
 * search glyph and trailing ⌘K / "/" shortcut badges. `/` and `⌘K` focus it
 * from anywhere (wired in NameChecker).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, valid, variant = "compact" },
  ref,
) {
  const hero = variant === "hero";
  return (
    <div className="w-full">
      <div
        className={cn(
          "relative flex items-center border border-white/10 bg-white/[0.03] transition-all duration-200",
          "hover:border-white/15 focus-within:border-white/25 focus-within:bg-white/[0.04] focus-within:ring-4 focus-within:ring-white/[0.06]",
          hero ? "h-13 rounded-2xl sm:h-14" : "h-10 rounded-xl",
        )}
      >
        <Search
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute text-zinc-500",
            hero ? "left-4 size-4.5" : "left-3 size-3.5",
          )}
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="check a name…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Name to check"
          aria-keyshortcuts="/ control+k meta+k"
          className={cn(
            "w-full bg-transparent font-mono text-foreground outline-none placeholder:text-zinc-600",
            hero
              ? "pr-24 pl-11 text-[15px] sm:pr-28 sm:pl-12 sm:text-base"
              : "pr-20 pl-9 text-[13px]",
          )}
        />
        <span className="pointer-events-none absolute right-3 flex items-center gap-1">
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500">
            ⌘K
          </kbd>
          <kbd
            className={cn(
              "rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500",
              hero ? "hidden sm:block" : "hidden",
            )}
          >
            /
          </kbd>
        </span>
      </div>
      {value !== "" && !valid ? (
        <p role="status" className="mt-2 text-[11px] text-amber-300/90">
          letters, digits, dots, hyphens or underscores — starting with a letter or digit
        </p>
      ) : null}
    </div>
  );
});
