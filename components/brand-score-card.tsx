"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, Code2, Globe, Share2, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { AvailabilityResponse } from "@/lib/availability.js";
import { availabilityStats, type AvailabilityStats } from "@/lib/stats.js";
import { providerGroup, PROVIDER_GROUPS } from "@/lib/provider-meta.js";
import { coverageRatio, ratingTier, syllableBand, type RatingTier } from "@/lib/score-display.js";
import type { NameScore, ScoreComponent, SyllableComponent } from "@/src/scoring/score.js";
import { cn } from "@/lib/utils.js";
import { Button } from "./ui/button.js";
import { Skeleton } from "./ui/skeleton.js";

const TIER_STYLES: Record<RatingTier, { badge: string; ring: string }> = {
  Excellent: {
    badge: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
    ring: "stroke-emerald-400",
  },
  Strong: {
    badge: "border-sky-400/40 bg-sky-400/15 text-sky-200",
    ring: "stroke-sky-400",
  },
  Fair: {
    badge: "border-amber-400/40 bg-amber-400/15 text-amber-200",
    ring: "stroke-amber-400",
  },
  Contested: {
    badge: "border-rose-400/40 bg-rose-400/15 text-rose-200",
    ring: "stroke-rose-400",
  },
};

/**
 * Ease-out count-up for the headline rating. Returns `null` while the
 * checks are in flight so no partial score ever paints; once a rating
 * resolves it rolls from the previous value on a 700ms cubic ease —
 * skipped entirely under prefers-reduced-motion.
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
 * Circular rating gauge. `rating === null` means the availability checks
 * are still in flight — the gauge renders an indeterminate `--` pulse and
 * no arc fill rather than a misleading partial number. The arc is driven
 * by the same eased count-up as the number, so it draws on as the score
 * settles and is tinted by the resolved tier.
 */
function RatingGauge({ rating, tier }: { rating: number | null; tier: RatingTier | null }) {
  const display = useCountUp(rating);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const filled = display === null ? 0 : (Math.min(100, Math.max(0, display)) / 100) * circumference;
  return (
    <div className="glow-score relative size-24 shrink-0" aria-busy={rating === null}>
      <svg viewBox="0 0 96 96" className="size-24 -rotate-90" aria-hidden="true">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          strokeWidth="5"
          className="stroke-zinc-800"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className={cn(
            "transition-[stroke-dasharray] duration-700",
            tier === null ? "stroke-zinc-500" : TIER_STYLES[tier].ring,
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-mono text-[26px] leading-none font-semibold tracking-tight",
            display === null ? "animate-pulse text-zinc-600" : "text-foreground",
          )}
        >
          {display ?? "--"}
        </span>
        <span className="mt-0.5 text-[9px] font-medium tracking-[0.12em] text-zinc-600 uppercase">
          / 100
        </span>
      </div>
      <span className="sr-only">
        {rating === null ? "checking availability…" : `Brand rating ${rating} out of 100`}
      </span>
    </div>
  );
}

/** Thin available-vs-taken meter: emerald fill on a zinc track. */
function MiniMeter({ ratio, pending, label }: { ratio: number; pending: boolean; label: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <span
      role="img"
      aria-label={label}
      className="h-1 min-w-16 flex-1 overflow-hidden rounded-full bg-zinc-800"
    >
      {pending ? null : (
        <motion.span
          className="block h-full rounded-full bg-emerald-400/70"
          style={{ transformOrigin: "left" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: ratio }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }
          }
        />
      )}
    </span>
  );
}

function CoverageRow({
  icon: Icon,
  label,
  free,
  total,
  noun,
  pending,
}: {
  icon: typeof Globe;
  label: string;
  free: number | null;
  total: number;
  /** Status noun shown after the fraction, e.g. "Free" for TLDs. */
  noun: string;
  pending: boolean;
}) {
  return (
    <div className="flex h-10 items-center gap-3 border-t border-white/5 px-4 first:border-t-0">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-zinc-500" />
      <span className="w-24 shrink-0 text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
        {label}
      </span>
      {pending ? (
        <Skeleton className="h-1 flex-1" />
      ) : free === null ? (
        <span className="font-mono text-[11px] text-zinc-600 tabular-nums">—</span>
      ) : (
        <>
          <MiniMeter
            ratio={coverageRatio(free, total)}
            pending={pending}
            label={`${free} of ${total} ${noun.toLowerCase()}`}
          />
          <span className="shrink-0 font-mono text-[11px] text-zinc-300 tabular-nums">
            {free}/{total} <span className="text-zinc-500">{noun.toLowerCase()}</span>
          </span>
        </>
      )}
    </div>
  );
}

/** Compact metric tile with a spring micro-meter for continuous scores. */
function MetricTile({ label, component }: { label: string; component: ScoreComponent }) {
  const reduceMotion = useReducedMotion();
  const pct = component.max === 0 ? 0 : component.value / component.max;
  return (
    <li
      title={component.detail}
      className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-white/[0.02] p-3"
    >
      <span className="text-[10px] font-medium tracking-[0.1em] text-zinc-500 uppercase">
        {label}
      </span>
      <span className="font-mono text-[14px] leading-none font-medium text-zinc-200 tabular-nums">
        {component.value}
        <span className="text-[11px] text-zinc-600">/{component.max}</span>
      </span>
      <span className="h-1 overflow-hidden rounded-full bg-zinc-800">
        <motion.span
          className="block h-full rounded-full bg-zinc-300"
          style={{ transformOrigin: "left" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }
          }
        />
      </span>
    </li>
  );
}

/** Syllables render discrete data — a crisp badge, not a progress bar. */
function SyllableTile({ component }: { component: SyllableComponent }) {
  const band = syllableBand(component);
  return (
    <li
      title={component.detail}
      className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-white/[0.02] p-3"
    >
      <span className="text-[10px] font-medium tracking-[0.1em] text-zinc-500 uppercase">
        Syllables
      </span>
      <span className="inline-flex w-fit items-center rounded-full border border-zinc-700 bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-200 tabular-nums">
        {component.count} · {band}
      </span>
      <span className="font-mono text-[10px] text-zinc-600 tabular-nums">
        {component.value}/{component.max} pts
      </span>
    </li>
  );
}

function markdownSummary(
  name: string,
  score: NameScore,
  rating: number,
  tier: RatingTier,
  stats: AvailabilityStats | null,
  availability: AvailabilityResponse | null,
  url: string,
): string {
  const lines = [
    `## lmkurname — ${name}`,
    `**${rating}/100** (${tier}) · name score ${score.total}/100 (${score.grade})`,
  ];
  if (stats !== null) {
    lines.push(
      `Coverage: TLDs ${stats.tld.free}/${stats.tld.total} free · ` +
        `socials ${stats.social.free}/${stats.social.total} clean · ` +
        `dev ${stats.dev.free}/${stats.dev.total} clean`,
    );
  }
  if (availability !== null) {
    lines.push("", "| Provider | Subject | Status |", "| --- | --- | --- |");
    const labelOf = new Map<string, string>(
      PROVIDER_GROUPS.flatMap((g) => g.providers.map((p) => [p.id, p.label] as const)),
    );
    for (const r of availability.results) {
      const label = labelOf.get(r.provider) ?? r.provider;
      lines.push(`| ${label} | ${r.subject} | ${r.status} |`);
    }
  }
  lines.push("", url);
  return lines.join("\n");
}

export function BrandScoreCard({
  score,
  availability,
  checking,
  name,
  onCopy,
  className,
}: {
  score: NameScore | null;
  availability: AvailabilityResponse | null;
  checking: boolean;
  name: string;
  onCopy: (text: string, label: string) => void;
  className?: string;
}) {
  const stats = useMemo(() => availabilityStats(availability), [availability]);
  const pendingCoverage = checking;

  // Brand rating = 60% deterministic name heuristics + 40% availability
  // coverage. While any checks are in flight the rating stays null (the
  // gauge shows "--") so it never paints a partial score or jumps mid-load.
  // If the availability request fails outright, the rating degrades to the
  // deterministic name score rather than treating unknown as available.
  const rating =
    score === null || checking
      ? null
      : stats === null
        ? score.total
        : Math.round(0.6 * score.total + 0.4 * stats.composite * 100);
  const tier = rating === null ? null : ratingTier(rating);

  const copyReport = () => {
    if (score === null || rating === null || tier === null) return;
    onCopy(
      markdownSummary(name, score, rating, tier, stats, availability, window.location.href),
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
      aria-labelledby="brand-score-title"
      className={cn("overflow-hidden rounded-xl border border-white/10 bg-card", className)}
    >
      <div className="flex h-10 items-center justify-between gap-2 border-b border-white/5 px-4">
        <h2
          id="brand-score-title"
          className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
        >
          Brand score
        </h2>
        {availability?.mode === "demo" ? (
          <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
            demo data
          </span>
        ) : null}
      </div>

      {score === null ? (
        <div className="px-4 py-6">
          <p className="text-[12px] leading-5 text-zinc-600">
            Search a name to score it out of 100 and measure its claim coverage across domains,
            developer platforms and socials.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 border-b border-white/5 px-4 py-4">
            <RatingGauge rating={rating} tier={tier} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[16px] font-medium text-foreground">
                {score.normalized}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                {tier !== null ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase",
                      TIER_STYLES[tier].badge,
                    )}
                  >
                    {tier}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-zinc-600 uppercase">
                    Scoring
                  </span>
                )}
              </div>
              <div className="mt-2 text-[11px] font-medium tracking-[0.08em] text-zinc-600 uppercase">
                deterministic heuristic · name score {score.total}/100 ({score.grade})
              </div>
              <div className="mt-2.5 flex gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={copyReport}
                  disabled={checking}
                  aria-label="Copy markdown summary to clipboard"
                >
                  <ClipboardCopy aria-hidden="true" />
                  Copy Markdown
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={shareResult}
                  aria-label="Copy shareable result link"
                >
                  <Share2 aria-hidden="true" />
                  Share
                </Button>
              </div>
            </div>
          </div>

          <div className="border-b border-white/5" aria-label="Availability coverage">
            <CoverageRow
              icon={Globe}
              label="TLDs"
              free={stats?.tld.free ?? null}
              total={stats?.tld.total ?? providerGroup("domains").providers.length}
              noun="Free"
              pending={pendingCoverage}
            />
            <CoverageRow
              icon={Users}
              label="Socials"
              free={stats?.social.free ?? null}
              total={stats?.social.total ?? providerGroup("socials").providers.length}
              noun="Clean"
              pending={pendingCoverage}
            />
            <CoverageRow
              icon={Code2}
              label="Dev"
              free={stats?.dev.free ?? null}
              total={stats?.dev.total ?? providerGroup("developer").providers.length}
              noun="Clean"
              pending={pendingCoverage}
            />
          </div>

          <ul
            aria-label="Name score breakdown"
            className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-3"
          >
            <MetricTile label="Punchiness" component={score.punchiness} />
            <SyllableTile component={score.syllables} />
            <MetricTile label="Pronounce" component={score.pronounceability} />
            <MetricTile label="Uniqueness" component={score.uniqueness} />
            <MetricTile label="Cleanliness" component={score.cleanliness} />
          </ul>
        </>
      )}
    </section>
  );
}
