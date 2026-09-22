"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils.js";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Runs the search — wired to Enter and the in-bar Search button. */
  onSubmit: () => void;
  valid: boolean;
  /** `hero` is the large center-stage control; `compact` sits atop results. */
  variant?: "hero" | "compact";
}

/**
 * The name search control: a single hairline-bordered shell with a leading
 * search glyph, trailing ⌘K / "/" shortcut badges, and a tactile Search
 * button. Search only executes on explicit submit — Enter or the button —
 * never while typing. `/` and `⌘K` focus the input from anywhere (wired in
 * NameChecker).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, onSubmit, valid, variant = "compact" },
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
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
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
              ? "pr-24 pl-11 text-[15px] sm:pr-40 sm:pl-12 sm:text-base"
              : "pr-24 pl-9 text-[13px] sm:pr-36",
          )}
        />
        <span
          className={cn("absolute flex items-center", hero ? "right-2 gap-2" : "right-1.5 gap-1.5")}
        >
          <kbd className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500 sm:block">
            ⌘K
          </kbd>
          <kbd
            className={cn(
              "rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500",
              "hidden sm:block",
              !hero && "sm:hidden",
            )}
          >
            /
          </kbd>
          <button
            type="button"
            onClick={onSubmit}
            aria-label="Search"
            className={cn(
              "flex items-center gap-1.5 rounded-md bg-zinc-100 font-medium text-zinc-950 transition-all outline-none select-none",
              "hover:bg-white active:translate-y-px focus-visible:ring-2 focus-visible:ring-ring",
              hero ? "h-9 rounded-lg px-3.5 text-[12px]" : "h-7 px-2.5 text-[11px]",
            )}
          >
            <Search aria-hidden="true" className={hero ? "size-3.5" : "size-3"} />
            Search
          </button>
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
