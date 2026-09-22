"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils.js";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
}

/**
 * The hero search control for the sticky bar: Watermelon `Input`-styled shell
 * with a leading search glyph and trailing shortcut hints. `/` and `⌘K`
 * focus it from anywhere (wired in NameChecker).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, valid },
  ref,
) {
  return (
    <div className="w-full">
      <div className="relative flex items-center">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 size-3.5 text-zinc-500"
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="find a name…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Name to check"
          aria-keyshortcuts="/ control+k meta+k"
          className={cn(
            "h-9 w-full rounded-lg border border-input bg-zinc-950/60 pr-16 pl-9 font-mono text-[13px] text-foreground outline-none transition-colors",
            "placeholder:text-zinc-600 hover:border-zinc-600/80",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
          )}
        />
        <span className="pointer-events-none absolute right-2.5 flex items-center gap-1">
          <kbd className="rounded border border-border bg-zinc-900/70 px-1.5 py-0.5 text-[10px] text-zinc-500">
            /
          </kbd>
          <kbd className="rounded border border-border bg-zinc-900/70 px-1.5 py-0.5 text-[10px] text-zinc-500">
            ⌘K
          </kbd>
        </span>
      </div>
      {value !== "" && !valid ? (
        <p role="status" className="mt-1.5 text-[11px] text-amber-300/90">
          letters, digits, dots, hyphens or underscores — starting with a letter or digit
        </p>
      ) : null}
    </div>
  );
});
