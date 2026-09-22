"use client";

import { forwardRef } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, valid },
  ref,
) {
  return (
    <div className="relative">
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
        className="h-11 w-full rounded-lg border border-hairline bg-zinc-950/60 px-3 font-mono text-[15px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
      />
      {value !== "" && !valid ? (
        <p className="mt-2 text-[11px] text-amber-300/90">
          letters, digits, dots, hyphens or underscores — starting with a letter or digit
        </p>
      ) : null}
    </div>
  );
});
