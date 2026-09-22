"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { nameSchema } from "@/src/schemas.js";
import { scoreName, type NameScore } from "@/src/scoring/score.js";
import type { AvailabilityResponse } from "@/lib/availability.js";
import { Hero } from "./hero.js";
import { Navbar } from "./navbar.js";
import { ResultsGrid } from "./results-grid.js";
import { SearchInput } from "./search-input.js";
import { CopyToast } from "./toast.js";
import { TooltipProvider } from "./ui/tooltip.js";

function normalize(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Write the clipboard with an execCommand fallback for non-secure contexts. */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }
}

export function NameChecker() {
  const [query, setQuery] = useState("");
  /** The name a search was explicitly run for (Enter / Search button / ?q=). */
  const [searchedName, setSearchedName] = useState("");
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const name = normalize(query);
  const nameValid = name.length > 0 && nameSchema.safeParse(name).success;
  // The score tracks the explicitly searched name so the bento stays
  // consistent while the user drafts their next query.
  const score: NameScore | null = useMemo(
    () => (searchedName === "" ? null : scoreName(searchedName)),
    [searchedName],
  );

  const searched = searchedName !== "";

  /** Explicit search — fires on Enter or the Search button, never on typing. */
  const submitSearch = useCallback(() => {
    if (!nameValid) {
      setSearchedName("");
      return;
    }
    if (name === searchedName) {
      // Re-submitting the same name re-runs the check (fresh availability).
      setReloadTick((tick) => tick + 1);
      return;
    }
    setSearchedName(name);
  }, [name, nameValid, searchedName]);

  const notify = useCallback((text: string, label: string) => {
    void copyText(text);
    setToast(label);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Seed the query from ?q= on mount and run it (shareable searches).
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial === null || initial === "") return;
    setQuery(initial);
    const normalized = normalize(initial);
    if (nameSchema.safeParse(normalized).success) setSearchedName(normalized);
  }, []);

  // Autofocus, ⌘K / Ctrl+K / "/" to refocus, and keep focus across the
  // hero → results transition (the input remounts into the compact variant).
  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target instanceof HTMLSelectElement)
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [searched]);

  // Back/forward navigation re-reads ?q=.
  useEffect(() => {
    const onPopState = () => {
      const raw = new URLSearchParams(window.location.search).get("q") ?? "";
      setQuery(raw);
      const normalized = normalize(raw);
      setSearchedName(nameSchema.safeParse(normalized).success ? normalized : "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Keep ?q= in sync so executed searches are shareable.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (searchedName === "") {
      url.searchParams.delete("q");
    } else {
      url.searchParams.set("q", searchedName);
    }
    window.history.replaceState(null, "", url);
  }, [searchedName]);

  // Fetch availability whenever the explicitly searched name changes.
  useEffect(() => {
    if (searchedName === "") {
      setAvailability(null);
      setChecking(false);
      setError(null);
      return;
    }
    const seq = ++requestSeq.current;
    const controller = new AbortController();
    setChecking(true);
    setError(null);

    fetch(`/api/availability?name=${encodeURIComponent(searchedName)}`, {
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
  }, [searchedName, reloadTick]);

  const retry = useCallback(() => setReloadTick((tick) => tick + 1), []);

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar onCopy={notify} />

        <AnimatePresence mode="wait" initial={false}>
          {searched ? (
            <motion.main
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6"
            >
              <div className="mx-auto max-w-xl pt-7 pb-8">
                <SearchInput
                  ref={inputRef}
                  value={query}
                  onChange={setQuery}
                  onSubmit={submitSearch}
                  valid={nameValid}
                  variant="compact"
                />
              </div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-zinc-500">
                  results for <span className="text-zinc-300">{searchedName}</span>
                </span>
                {checking ? (
                  <span className="inline-flex animate-pulse items-center gap-1.5 text-[11px] text-zinc-500">
                    <span className="size-1.5 rounded-full bg-primary" />
                    checking…
                  </span>
                ) : availability !== null ? (
                  <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                    {availability.summary.available} free · {availability.summary.taken} taken
                  </span>
                ) : null}
              </div>
              <ResultsGrid
                name={searchedName}
                score={score}
                data={availability}
                checking={checking}
                error={error}
                onRetry={retry}
                onCopy={notify}
              />
            </motion.main>
          ) : (
            <motion.div
              key="hero"
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-1 flex-col"
            >
              <Hero
                value={query}
                onChange={setQuery}
                onSubmit={submitSearch}
                valid={nameValid}
                inputRef={inputRef}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="flex min-h-10 shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-white/5 px-4 py-2 text-[11px] text-zinc-600 sm:px-6">
          <span className="text-center">
            Scores are deterministic heuristics · availability is a best-effort snapshot, not a
            guarantee.
          </span>
          <span aria-hidden="true" className="text-zinc-800">
            ·
          </span>
          <a
            href="https://nandodani.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 transition-colors hover:text-zinc-300"
          >
            crafted by nandodani
          </a>
        </footer>

        <CopyToast message={toast} />
      </div>
    </TooltipProvider>
  );
}
