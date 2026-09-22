"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Code2, Globe, LayoutGrid, Users } from "lucide-react";

import { nameSchema } from "@/src/schemas.js";
import { scoreName, type NameScore } from "@/src/scoring/score.js";
import type { AvailabilityResponse } from "@/lib/availability.js";
import { AvailabilityGrid, type AvailabilityFilter } from "./availability-grid.js";
import { BrandScoreCard } from "./brand-score-card.js";
import { ConfigCard } from "./config-card.js";
import { CopyToast } from "./toast.js";
import { SearchInput } from "./search-input.js";
import { ContinuousTabs, type ContinuousTabItem } from "./watermelon/continuous-tabs.js";
import { TooltipProvider } from "./ui/tooltip.js";

const DEBOUNCE_MS = 320;

const FILTER_TABS: ContinuousTabItem[] = [
  { id: "all", label: "All", icon: <LayoutGrid aria-hidden="true" className="size-3.5" /> },
  {
    id: "available",
    label: "Available",
    icon: <CheckCircle2 aria-hidden="true" className="size-3.5" />,
  },
  { id: "domains", label: "Domains", icon: <Globe aria-hidden="true" className="size-3.5" /> },
  { id: "socials", label: "Socials", icon: <Users aria-hidden="true" className="size-3.5" /> },
  {
    id: "developer",
    label: "Developer",
    icon: <Code2 aria-hidden="true" className="size-3.5" />,
  },
];

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
  const [debouncedName, setDebouncedName] = useState("");
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [filter, setFilter] = useState<AvailabilityFilter>("all");
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const name = normalize(query);
  const nameValid = name.length > 0 && nameSchema.safeParse(name).success;
  const score: NameScore | null = useMemo(
    () => (nameValid ? scoreName(name) : null),
    [nameValid, name],
  );

  const notify = useCallback((text: string, label: string) => {
    void copyText(text);
    setToast(label);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Seed the query from ?q= on mount (shareable searches).
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial !== null && initial !== "") setQuery(initial);
  }, []);

  // Autofocus + ⌘K / Ctrl+K / "/" to refocus from anywhere.
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

  // Back/forward navigation re-reads ?q=.
  useEffect(() => {
    const onPopState = () => {
      setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Debounce the validated name.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(nameValid ? name : ""), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [name, nameValid]);

  // Keep ?q= in sync so searches are shareable.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (debouncedName === "") {
      url.searchParams.delete("q");
    } else {
      url.searchParams.set("q", debouncedName);
    }
    window.history.replaceState(null, "", url);
  }, [debouncedName]);

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
    <TooltipProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
            <a
              href="/"
              aria-label="lmkurname home"
              className="flex shrink-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-6 items-center justify-center rounded-md border border-border bg-zinc-900">
                <span className="size-1.5 rounded-full bg-primary" />
              </span>
              <span className="hidden text-[13px] font-semibold tracking-tight text-foreground sm:inline">
                lmkurname
              </span>
            </a>
            <div className="min-w-0 flex-1 sm:max-w-md">
              <SearchInput ref={inputRef} value={query} onChange={setQuery} valid={nameValid} />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {availability?.mode === "demo" ? (
                <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                  demo data
                </span>
              ) : null}
              <span className="hidden items-center rounded-md border border-border bg-zinc-900/60 px-2 py-1 font-mono text-[10px] text-zinc-400 md:inline-flex">
                POST /api/mcp
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-3 px-4 py-5 sm:px-6 lg:grid-cols-[400px_1fr]">
          <div className="flex flex-col gap-3">
            <BrandScoreCard
              score={score}
              availability={availability}
              checking={checking}
              name={debouncedName || name}
              onCopy={notify}
            />
            <ConfigCard onCopy={notify} />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <ContinuousTabs
                id="availability-filter"
                aria-label="Filter availability results"
                tabs={FILTER_TABS}
                value={filter}
                onChange={(id) => setFilter(id as AvailabilityFilter)}
              />
              <div className="flex shrink-0 items-center gap-2">
                {checking ? (
                  <span className="inline-flex animate-pulse items-center gap-1 text-[11px] text-zinc-500">
                    <span className="size-1.5 rounded-full bg-primary" />
                    checking…
                  </span>
                ) : availability !== null ? (
                  <span className="text-[11px] text-zinc-500 tabular-nums">
                    {availability.summary.available} free · {availability.summary.taken} taken
                  </span>
                ) : null}
              </div>
            </div>

            <AvailabilityGrid
              name={debouncedName}
              data={availability}
              checking={checking}
              error={error}
              onRetry={retry}
              filter={filter}
              onCopy={notify}
            />
          </div>
        </main>

        <footer className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-border px-4 text-[11px] text-zinc-600 sm:px-6">
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

        <CopyToast message={toast} />
      </div>
    </TooltipProvider>
  );
}
