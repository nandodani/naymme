"use client";

import { forwardRef, useId } from "react";
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
 * search glyph and a tactile text-only Search button pinned inside the bar.
 * Search only executes on explicit submit — Enter or the button — never
 * while typing. `/` and `⌘K` focus the input from anywhere (wired in
 * NameChecker).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, onSubmit, valid, variant = "compact" },
  ref,
) {
  const hero = variant === "hero";
  const hintId = useId();
  const showHint = value !== "" && !valid;
  return (
    // A <form> gives Enter-to-submit semantics for free; role="search"
    // makes the landmark discoverable by assistive tech.
    <form
      role="search"
      aria-label="Check name availability"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="w-full"
    >
      <div
        className={cn(
          "relative flex items-center border border-white/10 bg-white/[0.03] transition-all duration-200",
          "hover:border-white/15 focus-within:border-white/30 focus-within:bg-white/[0.04] focus-within:ring-2 focus-within:ring-ring",
          hero ? "h-13 rounded-2xl sm:h-14" : "h-10 rounded-xl",
        )}
      >
        <Search
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute text-zinc-400",
            hero ? "left-4 size-4.5" : "left-3 size-3.5",
          )}
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Name to check"
          aria-keyshortcuts="/ control+k meta+k"
          aria-invalid={showHint}
          aria-describedby={showHint ? hintId : undefined}
          className={cn(
            // h-full fills the shell — a 19px-tall text box inside a 40px
            // bar fails WCAG 2.5.8 target size.
            "h-full w-full bg-transparent font-mono text-foreground outline-none placeholder:text-zinc-500",
            hero
              ? "pr-24 pl-11 text-[15px] sm:pr-28 sm:pl-12 sm:text-base"
              : "pr-20 pl-9 text-[13px] sm:pr-24",
          )}
        />
        <button
          type="submit"
          className={cn(
            "absolute flex items-center justify-center rounded-md bg-zinc-100 font-medium text-zinc-950 transition-all outline-none select-none",
            "hover:bg-white active:translate-y-px focus-visible:ring-2 focus-visible:ring-ring",
            hero ? "right-2 h-9 rounded-lg px-4 text-[13px]" : "right-1.5 h-7 px-3 text-[11px]",
          )}
        >
          Search
        </button>
      </div>
      {showHint ? (
        <p role="status" id={hintId} className="mt-2 text-[11px] text-amber-300">
          letters, digits, dots, hyphens or underscores — starting with a letter or digit
        </p>
      ) : null}
    </form>
  );
});
