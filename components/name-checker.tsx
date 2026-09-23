"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Atom } from "loading-dev";

import { nameSchema } from "@/src/schemas.js";
import type { AvailabilityResponse } from "@/lib/availability.js";
import { Hero } from "./hero.js";
import { Navbar } from "./navbar.js";
import { ResultsGrid } from "./results-grid.js";
import { SearchInput } from "./search-input.js";
import Silk from "./silk.js";
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

  const searched = searchedName !== "";
  const reduceMotion = useReducedMotion();
  /** hero → atom loader → sharp results; the loader replaces the view while
   * checks are in flight so old results never peek through. */
  const phase = !searched ? "hero" : checking ? "loading" : "results";
  const blurOut = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: "blur(16px)" };
  const blurIn = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: "blur(12px)" };
  const sharp = reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" };

  /** Explicit search — fires on Enter or the Search button, never on typing. */
  const submitSearch = useCallback(() => {
    if (!nameValid) {
      setSearchedName("");
      return;
    }
    // Flip to the loading phase in the same commit so the outgoing view
    // blurs straight into the atom loader.
    setChecking(true);
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
  }, [searched, phase]);

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
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
          <Silk speed={5.4} scale={0.5} color="#262626" noiseIntensity={2.7} rotation={0} />
        </div>
        {/* Skip link: first tab stop, jumps straight to the main landmark
            (hero search or results, whichever is mounted). Kept at full
            size off-screen — a 1px sr-only clip fails target size. */}
        <a
          href="#main-content"
          className="fixed top-0 left-3 z-60 -translate-y-[150%] rounded-md bg-zinc-100 px-4 py-2 text-[12px] font-medium text-black outline-none motion-safe:transition-transform focus-visible:translate-y-3 focus-visible:ring-2 focus-visible:ring-ring"
        >
          Skip to main content
        </a>
        <Navbar onCopy={notify} />

        <AnimatePresence mode="wait" initial={false}>
          {phase === "hero" ? (
            <motion.div
              key="hero"
              exit={blurOut}
              transition={{ duration: 0.2, ease: "easeInOut" }}
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
          ) : phase === "loading" ? (
            <motion.div
              key="loading"
              role="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black"
            >
              <Atom size={44} className="text-zinc-300" />
              <span className="sr-only">Checking availability…</span>
            </motion.div>
          ) : (
            <motion.main
              key="results"
              id="main-content"
              tabIndex={-1}
              initial={blurIn}
              animate={sharp}
              exit={blurOut}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 outline-none sm:px-6"
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
              <ResultsGrid
                name={searchedName}
                data={availability}
                checking={checking}
                error={error}
                onRetry={retry}
                onCopy={notify}
              />
            </motion.main>
          )}
        </AnimatePresence>

        <footer className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-t border-white/5 px-4 py-2.5 text-center text-[11px] text-zinc-400 sm:px-6">
          <span>
            Independent project. Not affiliated with, endorsed by, or associated with any brands,
            platforms, or registries displayed.
          </span>
          <span>
            Scores are deterministic heuristics · availability is a best-effort snapshot, not a
            guarantee.
          </span>
        </footer>

        <CopyToast message={toast} />
      </div>
    </TooltipProvider>
  );
}
