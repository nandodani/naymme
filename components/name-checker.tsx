"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nameSchema } from "@/src/schemas.js";
import { scoreName, type NameScore } from "@/src/scoring/score.js";
import type { AvailabilityResponse } from "@/lib/availability.js";
import { AvailabilityGrid } from "./availability-grid.js";
import { ConfigCard } from "./config-card.js";
import { ScorePanel } from "./score-panel.js";
import { SearchInput } from "./search-input.js";

const DEBOUNCE_MS = 320;

function normalize(raw: string): string {
  return raw.trim().toLowerCase();
}

export function NameChecker() {
  const [query, setQuery] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);

  const name = normalize(query);
  const nameValid = name.length > 0 && nameSchema.safeParse(name).success;
  const score: NameScore | null = useMemo(
    () => (nameValid ? scoreName(name) : null),
    [nameValid, name],
  );

  // Autofocus + ⌘K / Ctrl+K to refocus from anywhere.
  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounce the validated name.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(nameValid ? name : ""), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [name, nameValid]);

  // Fetch availability whenever the debounced name changes.
  useEffect(() => {
    if (debouncedName === "") {
      setAvailability(null);
      setChecking(false);
      setError(null);
      return;
    }
    const seq = ++requestSeq.current;
    const controller = new AbortController();
    setChecking(true);
    setError(null);

    fetch(`/api/availability?name=${encodeURIComponent(debouncedName)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = (await res.json()) as AvailabilityResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (seq === requestSeq.current) setAvailability(body);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || seq !== requestSeq.current) return;
        setError(err instanceof Error ? err.message : "request failed");
        setAvailability(null);
      })
      .finally(() => {
        if (seq === requestSeq.current && !controller.signal.aborted) setChecking(false);
      });

    return () => controller.abort();
  }, [debouncedName, reloadTick]);

  const retry = useCallback(() => setReloadTick((tick) => tick + 1), []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-hairline px-4 sm:px-6">
        <div className="flex h-5 w-5 items-center justify-center rounded-[5px] border border-hairline bg-zinc-900">
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-200" />
        </div>
        <span className="text-[13px] font-medium tracking-tight text-zinc-100">lmkurname</span>
        <span className="hidden text-[12px] text-zinc-500 sm:inline">
          name availability + brand score
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center rounded-md border border-hairline bg-zinc-900/60 px-2 py-1 font-mono text-[11px] text-zinc-400 md:inline-flex">
            POST /api/mcp
          </span>
          <kbd className="inline-flex items-center gap-1 rounded-md border border-hairline bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-400">
            ⌘K
          </kbd>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-3 px-4 py-5 sm:px-6 lg:grid-cols-[400px_1fr]">
        <div className="flex flex-col gap-3">
          <section className="rounded-xl border border-hairline bg-panel">
            <div className="border-b border-hairline px-4 py-2.5">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                Search
              </h2>
            </div>
            <div className="px-4 py-3">
              <SearchInput ref={inputRef} value={query} onChange={setQuery} valid={nameValid} />
              <p className="mt-2.5 text-[11px] leading-4 text-zinc-500">
                Checks domains, developer platforms and social handles for the bare name.
              </p>
            </div>
          </section>

          <ScorePanel score={score} />
        </div>

        <div className="flex flex-col gap-3">
          <AvailabilityGrid
            name={debouncedName}
            data={availability}
            checking={checking}
            error={error}
            onRetry={retry}
          />
          <ConfigCard />
        </div>
      </main>

      <footer className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-hairline px-4 text-[11px] text-zinc-600 sm:px-6">
        <span>
          Scores are deterministic heuristics · availability is a best-effort snapshot, not a
          guarantee.
        </span>
        {availability?.mode === "demo" ? (
          <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-medium text-amber-300">
            demo data
          </span>
        ) : null}
      </footer>
    </div>
  );
}
