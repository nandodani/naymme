"use client";

import { useState } from "react";
import { SearchX } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { AvailabilityResponse } from "@/lib/availability.js";
import { ALL_PROVIDER_IDS, providerGroup } from "@/lib/provider-meta.js";
import { resultCounts, type ResultFilter } from "@/lib/result-filter.js";
import { cn } from "@/lib/utils.js";
import type { AvailabilityResult } from "@/src/types.js";
import { BrandScoreCard } from "./brand-score-card.js";
import { ProviderCard } from "./provider-card.js";
import { Button } from "./ui/button.js";

interface ResultsGridProps {
  name: string;
  data: AvailabilityResponse | null;
  checking: boolean;
  error: string | null;
  onRetry: () => void;
  onCopy: (text: string, label: string) => void;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

const FILTERS: readonly { id: ResultFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available only" },
];

/** Every provider id the four grid groups render — the count denominator. */
const EXPECTED_PROVIDER_IDS = ALL_PROVIDER_IDS;

/**
 * The searched state: a bento grid of the brand score card plus one card per
 * provider group. DOM order is the same as reading order at every
 * breakpoint — score, Developer, Socials, Domains, Community — so the
 * stagger, tab order and screen-reader order all agree. On xl the score
 * anchors the left column, Developer and Socials fill out row one, Domains
 * spans underneath and Community fills the bottom-right slot.
 */
export function ResultsGrid({ name, data, checking, error, onRetry, onCopy }: ResultsGridProps) {
  const [filter, setFilter] = useState<ResultFilter>("all");
  const reduceMotion = useReducedMotion();
  const resultsByProvider = new Map<string, AvailabilityResult>(
    (data?.results ?? []).map((r) => [r.provider, r]),
  );
  const pending = checking;
  // Expected providers = every row the grid renders; free + taken +
  // unresolved + pending always reconcile to it — no ghost items.
  const counts = resultCounts(data?.results ?? [], EXPECTED_PROVIDER_IDS);
  const emptyFiltered = filter === "available" && counts.available === 0 && !checking;

  const domains = providerGroup("domains");
  const developer = providerGroup("developer");
  const socials = providerGroup("socials");
  const community = providerGroup("community");

  return (
    <div className="flex flex-col gap-3">
      {error !== null ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-400/25 bg-red-400/5 px-4 py-2.5"
        >
          <p className="text-[12px] text-red-300">Availability check failed — {error}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-zinc-500">
          <span className="truncate">
            results for <span className="text-zinc-300">{name}</span>
          </span>
          {data !== null ? (
            <span
              className="shrink-0 tabular-nums"
              title={`${counts.settled} settled of ${counts.expected} checked`}
            >
              {counts.available} free · {counts.taken} taken
              {counts.unresolved > 0 ? (
                <span className="text-amber-400/80"> · {counts.unresolved} unresolved</span>
              ) : null}
              {counts.pending > 0 ? (
                <span className={checking ? "animate-pulse" : undefined}>
                  {" "}
                  · {counts.pending} pending
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        <div
          role="tablist"
          aria-label="Filter results by availability"
          className="inline-flex w-fit shrink-0 items-center rounded-full border border-zinc-800 bg-zinc-950/80 p-0.5"
        >
          {FILTERS.map(({ id, label }) => {
            const active = filter === id;
            const count = id === "all" ? counts.expected : counts.available;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(id)}
                className="relative rounded-full px-3 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              >
                {active ? (
                  <motion.span
                    layoutId="activeFilter"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", bounce: 0.2, duration: 0.4 }
                    }
                    className="absolute inset-0 rounded-full border border-zinc-700 bg-white/10"
                  />
                ) : null}
                <span className={cn("relative", active ? "text-zinc-100" : "text-zinc-500")}>
                  {label} ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <motion.div variants={item} className="md:col-span-2 xl:col-span-1 xl:col-start-1">
          <BrandScoreCard
            availability={data}
            checking={checking}
            name={name}
            onCopy={onCopy}
            className="h-full"
          />
        </motion.div>

        {emptyFiltered ? (
          <motion.div
            variants={item}
            className="flex items-center justify-center gap-2.5 rounded-xl border border-zinc-800 bg-card px-4 py-10 md:col-span-2 xl:col-span-2"
          >
            <SearchX aria-hidden="true" className="size-4 text-zinc-600" />
            <p className="text-[12px] text-zinc-500">No available handles found for this search.</p>
          </motion.div>
        ) : (
          <>
            <motion.div
              variants={item}
              className="md:col-start-1 md:row-start-2 xl:col-start-2 xl:row-start-1"
            >
              <ProviderCard
                group={developer}
                name={name}
                resultsByProvider={resultsByProvider}
                pending={pending}
                filter={filter}
                className="h-full"
              />
            </motion.div>

            <motion.div
              variants={item}
              className="md:col-start-2 md:row-start-2 xl:col-start-3 xl:row-start-1"
            >
              <ProviderCard
                group={socials}
                name={name}
                resultsByProvider={resultsByProvider}
                pending={pending}
                filter={filter}
                className="h-full"
              />
            </motion.div>

            <motion.div
              variants={item}
              className="md:col-start-1 md:row-start-3 xl:col-span-2 xl:col-start-1 xl:row-start-2"
            >
              <ProviderCard
                group={domains}
                name={name}
                resultsByProvider={resultsByProvider}
                pending={pending}
                filter={filter}
                className="h-full"
              />
            </motion.div>

            <motion.div
              variants={item}
              className="md:col-start-2 md:row-start-3 xl:col-start-3 xl:row-start-2"
            >
              <ProviderCard
                group={community}
                name={name}
                resultsByProvider={resultsByProvider}
                pending={pending}
                filter={filter}
                className="h-full"
              />
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
