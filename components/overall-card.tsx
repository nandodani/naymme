"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, Share2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { AvailabilityResponse } from "@/lib/availability.js";
import { ALL_PROVIDER_IDS, PROVIDER_GROUPS } from "@/lib/provider-meta.js";
import { availabilityLegend, availabilitySegments } from "@/lib/overall-display.js";
import { cn } from "@/lib/utils.js";
import {
  categoryTally,
  overallScore,
  type AvailabilityTally,
  type OverallScore,
} from "@/src/scoring/overall.js";
import { Button } from "./ui/button.js";
import { Skeleton } from "./ui/skeleton.js";

/** Segment fills: free glows emerald, taken is zinc, unresolved warns
 * amber, and in-flight checks pulse dim zinc. */
const SEGMENT_STYLES: Record<string, string> = {
  free: "bg-emerald-400/70",
  taken: "bg-zinc-600",
  unresolved: "bg-amber-400/60",
  pending: "animate-pulse bg-zinc-800",
};

/**
 * Ease-out count-up for the headline percentage. Returns `null` while the
 * checks are in flight so no partial score ever paints; once the run
 * settles it rolls on a 700ms cubic ease — skipped entirely under
 * prefers-reduced-motion.
 */
function useCountUp(target: number | null): number | null {
  const [display, setDisplay] = useState<number | null>(target);
  const previous = useRef(0);
  useEffect(() => {
    if (target === null) {
      setDisplay(null);
      return;
    }
    const from = previous.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from === target) {
      previous.current = target;
      setDisplay(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        previous.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return display;
}

/**
 * Segmented availability bar — one slice per bucket, each sized by its
 * share of the expected universe. The track is a real block element with
 * explicit height + overflow-hidden so fills can never clip or overlap
 * text; labels always live outside the bar.
 */
function SegmentedBar({
  availability,
  className,
}: {
  availability: AvailabilityTally;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const segments = availabilitySegments(availability);
  return (
    <div
      role="img"
      aria-label={availabilityLegend(availability)}
      className={cn(
        "flex h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-zinc-900",
        className,
      )}
    >
      {segments.map((segment) => (
        <motion.span
          key={segment.key}
          className={cn("block h-full", SEGMENT_STYLES[segment.key])}
          initial={{ width: 0 }}
          animate={{ width: `${segment.share * 100}%` }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }
          }
        />
      ))}
    </div>
  );
}

/** One category row: title + "X/Y free · Z%" on top, thin bar below. */
function CategoryRow({ availability }: { availability: AvailabilityTally & { title: string } }) {
  const { title, free, checked, pending } = availability;
  const pct = checked === 0 ? null : Math.round((free / checked) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[11px] font-medium tracking-[0.08em] text-zinc-400 uppercase">
          {title}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-zinc-300 tabular-nums">
          {checked === 0 && pending > 0 ? (
            <span className="animate-pulse text-zinc-400">checking…</span>
          ) : (
            <>
              {free}/{checked} free
              <span className="text-zinc-400"> · {pct ?? "—"}%</span>
            </>
          )}
        </span>
      </div>
      <SegmentedBar availability={availability} className="h-1" />
    </div>
  );
}

function markdownSummary(
  name: string,
  overall: OverallScore,
  categories: readonly (AvailabilityTally & { title: string })[],
  availability: AvailabilityResponse,
  url: string,
): string {
  const a = overall.availability;
  const lines = [
    `## naymme — ${name}`,
    `**${overall.score}% overall availability** — ${a.free}/${a.checked} free${a.unresolved > 0 ? ` · ${a.unresolved} unresolved` : ""}${a.pending > 0 ? ` · ${a.pending} checking` : ""}`,
    "",
    "| Category | Free | Checked | % |",
    "| --- | --- | --- | --- |",
  ];
  for (const c of categories) {
    const pct = c.checked === 0 ? 0 : Math.round((c.free / c.checked) * 100);
    lines.push(`| ${c.title} | ${c.free} | ${c.checked} | ${pct}% |`);
  }
  lines.push("", "| Provider | Subject | Status |", "| --- | --- | --- |");
  const labelOf = new Map<string, string>(
    PROVIDER_GROUPS.flatMap((g) => g.providers.map((p) => [p.id, p.label] as const)),
  );
  for (const r of availability.results) {
    lines.push(`| ${labelOf.get(r.provider) ?? r.provider} | ${r.subject} | ${r.status} |`);
  }
  lines.push("", url);
  return lines.join("\n");
}

/** Skeleton shown while availability checks are resolving. */
function OverallSkeleton() {
  return (
    <div className="px-5 pt-5 pb-4" aria-hidden="true">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-12 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </div>
  );
}

export function OverallCard({
  availability,
  checking,
  name,
  onCopy,
  className,
}: {
  availability: AvailabilityResponse | null;
  checking: boolean;
  name: string;
  onCopy: (text: string, label: string) => void;
  className?: string;
}) {
  // The overall number only resolves once the checks finish — while any
  // are in flight it stays null and the card renders a skeleton rather
  // than paint a partial or stale percentage.
  const overall = useMemo(
    () =>
      name === "" || checking || availability === null
        ? null
        : overallScore(name, availability.results, ALL_PROVIDER_IDS),
    [name, checking, availability],
  );
  const categories = useMemo(
    () =>
      overall === null || availability === null
        ? []
        : PROVIDER_GROUPS.map((group) => categoryTally(availability.results, group)),
    [overall, availability],
  );
  const display = useCountUp(overall?.score ?? null);

  const copyReport = () => {
    if (overall === null || availability === null) return;
    onCopy(
      markdownSummary(name, overall, categories, availability, window.location.href),
      "Markdown summary copied",
    );
  };

  const shareResult = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    if (name !== "") url.searchParams.set("q", name);
    onCopy(url.toString(), "Link copied");
  };

  return (
    <section
      aria-labelledby="overall-title"
      aria-busy={overall === null && name !== ""}
      className={cn("overflow-hidden rounded-xl border border-white/10 bg-card", className)}
    >
      <div className="flex h-10 items-center justify-between gap-2 border-b border-white/5 px-4">
        <h2
          id="overall-title"
          className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
        >
          Overall
        </h2>
        <div className="flex items-center gap-1.5">
          {availability?.mode === "demo" ? (
            <span className="rounded border border-zinc-700 bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              demo data
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="xs"
            onClick={copyReport}
            disabled={overall === null}
            aria-label="Copy markdown summary to clipboard"
          >
            <ClipboardCopy aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={shareResult}
            aria-label="Copy shareable result link"
          >
            <Share2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      {name === "" ? (
        <div className="px-5 py-6">
          <p className="text-[12px] leading-5 text-zinc-400">
            Search a name to see its overall availability across the checked providers.
          </p>
        </div>
      ) : overall === null ? (
        <OverallSkeleton />
      ) : (
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[44px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
                {display ?? overall.score}
              </span>
              <span className="font-mono text-[13px] text-zinc-400 tabular-nums">% available</span>
            </div>
            <span className="font-mono text-[12px] text-zinc-400 tabular-nums">
              {overall.availability.free}/{overall.availability.checked} free
            </span>
          </div>
          <div className="mt-1.5 truncate font-mono text-[13px] text-zinc-400">
            {overall.normalized}
          </div>

          <div className="mt-4">
            <SegmentedBar availability={overall.availability} />
            <p className="mt-2 font-mono text-[11px] text-zinc-400 tabular-nums">
              {availabilityLegend(overall.availability)}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-white/5 pt-4">
            {categories.map((category) => (
              <CategoryRow key={category.id} availability={category} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
