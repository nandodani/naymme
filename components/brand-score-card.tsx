"use client";

import { useMemo } from "react";
import { CheckCircle2, ClipboardCopy, Code2, Globe, Share2, Users } from "lucide-react";

import type { AvailabilityResponse } from "@/lib/availability.js";
import type { NameScore, ScoreComponent } from "@/src/scoring/score.js";
import { cn } from "@/lib/utils.js";
import { Button } from "./ui/button.js";

type Tier = "Flawless" | "Strong" | "Contested";

const TIER_STYLES: Record<Tier, string> = {
  Flawless: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Strong: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  Contested: "border-amber-400/30 bg-amber-400/10 text-amber-300",
};

function tierFor(rating: number): Tier {
  if (rating >= 90) return "Flawless";
  if (rating >= 75) return "Strong";
  return "Contested";
}

/**
 * Coverage sub-metrics derived from availability results.
 * - tldReach: weighted share of free domains (.com counts 3× — it's the
 *   TLD that anchors a brand).
 * - socialSweep: share of free social handles.
 * - devEcosystem: share of free developer platforms (GitHub, npm).
 */
interface Coverage {
  tldReach: number;
  socialSweep: number;
  devEcosystem: number;
  composite: number;
}

function computeCoverage(data: AvailabilityResponse | null): Coverage | null {
  if (data === null || data.results.length === 0) return null;
  let tldWeight = 0;
  let tldFree = 0;
  let socialTotal = 0;
  let socialFree = 0;
  let devTotal = 0;
  let devFree = 0;
  for (const r of data.results) {
    const free = r.status === "available";
    if (r.provider.startsWith("domain:")) {
      const w = r.provider === "domain:com" ? 3 : 1;
      tldWeight += w;
      if (free) tldFree += w;
    } else if (r.provider.startsWith("social:")) {
      socialTotal += 1;
      if (free) socialFree += 1;
    } else {
      devTotal += 1;
      if (free) devFree += 1;
    }
  }
  const tldReach = tldWeight === 0 ? 0 : tldFree / tldWeight;
  const socialSweep = socialTotal === 0 ? 0 : socialFree / socialTotal;
  const devEcosystem = devTotal === 0 ? 0 : devFree / devTotal;
  return {
    tldReach,
    socialSweep,
    devEcosystem,
    composite: 0.5 * tldReach + 0.3 * socialSweep + 0.2 * devEcosystem,
  };
}

function RatingRing({ rating }: { rating: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, rating)) / 100) * circumference;
  return (
    <div className="glow-score relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="4"
          className="stroke-zinc-800"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          className="stroke-primary transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-[16px] font-medium text-foreground">{rating}</span>
      </div>
      <span className="sr-only">Brand rating {rating} out of 100</span>
    </div>
  );
}

function SubMetric({
  icon: Icon,
  label,
  caption,
  value,
  pending,
}: {
  icon: typeof Globe;
  label: string;
  caption: string;
  /** 0..1 fraction, or null while unresolved. */
  value: number | null;
  pending: boolean;
}) {
  const pct = value === null ? null : Math.round(value * 100);
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-zinc-950/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
          <Icon aria-hidden="true" className="size-3" />
          {label}
        </span>
        {pending || pct === null ? (
          <span className="h-4 w-8 animate-pulse rounded bg-zinc-800" aria-hidden="true" />
        ) : (
          <span className="font-mono text-[13px] font-medium text-zinc-100 tabular-nums">
            {pct}%
          </span>
        )}
      </div>
      <span className="h-1 overflow-hidden rounded-full bg-zinc-800" role="presentation">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-500",
            pct !== null && pct >= 60
              ? "bg-primary"
              : pct !== null && pct >= 35
                ? "bg-amber-400"
                : "bg-zinc-500",
          )}
          style={{ width: `${pct ?? 0}%` }}
        />
      </span>
      <span className="truncate text-[10px] text-zinc-600">{caption}</span>
    </div>
  );
}

function ComponentRow({ label, component }: { label: string; component: ScoreComponent }) {
  const pct = component.max === 0 ? 0 : Math.round((component.value / component.max) * 100);
  return (
    <li
      className="flex h-8 items-center gap-3 border-t border-border px-4 first:border-t-0"
      title={component.detail}
    >
      <span className="w-24 shrink-0 text-[10px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
        {label}
      </span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <span
          className="block h-full rounded-full bg-zinc-300 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right font-mono text-[11px] text-zinc-400 tabular-nums">
        {component.value}
        <span className="text-zinc-600">/{component.max}</span>
      </span>
    </li>
  );
}

export function BrandScoreCard({
  score,
  availability,
  checking,
  name,
  onCopy,
}: {
  score: NameScore | null;
  availability: AvailabilityResponse | null;
  checking: boolean;
  name: string;
  onCopy: (text: string, label: string) => void;
}) {
  const coverage = useMemo(() => computeCoverage(availability), [availability]);
  const checkingCoverage = checking && availability === null;

  // Brand rating = 60% deterministic name heuristics + 40% availability
  // coverage; until coverage resolves the rating is the raw name score.
  const rating =
    score === null
      ? null
      : coverage === null
        ? score.total
        : Math.round(0.6 * score.total + 0.4 * coverage.composite * 100);
  const tier = rating === null ? null : tierFor(rating);

  const copyReport = () => {
    if (score === null || rating === null || tier === null) return;
    const lines = [
      `lmkurname — ${name}`,
      `Brand rating: ${rating}/100 (${tier}) · name score ${score.total}/100 (${score.grade})`,
    ];
    if (availability !== null && coverage !== null) {
      lines.push(
        `TLD reach ${Math.round(coverage.tldReach * 100)}% (.com weighted) · ` +
          `social sweep ${Math.round(coverage.socialSweep * 100)}% · ` +
          `dev ecosystem ${Math.round(coverage.devEcosystem * 100)}%`,
        `Availability: ${availability.summary.available} free, ` +
          `${availability.summary.taken} taken, ${availability.summary.unknown} unknown`,
      );
    }
    lines.push(window.location.href);
    onCopy(lines.join("\n"), "Report copied");
  };

  const shareResult = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    if (name !== "") url.searchParams.set("q", name);
    onCopy(url.toString(), "Link copied");
  };

  return (
    <section
      aria-labelledby="brand-score-title"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex h-10 items-center justify-between gap-2 border-b border-border px-4">
        <h2
          id="brand-score-title"
          className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
        >
          Brand rating
        </h2>
        {tier !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase",
              TIER_STYLES[tier],
            )}
          >
            <CheckCircle2 aria-hidden="true" className="size-3" />
            {tier}
          </span>
        ) : null}
      </div>

      {score === null || rating === null ? (
        <div className="px-4 py-6">
          <p className="text-[12px] leading-5 text-zinc-600">
            Type a name to score it out of 100 and measure its claim coverage across domains,
            developer platforms and socials.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 border-b border-border px-4 py-3.5">
            <RatingRing rating={rating} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[15px] font-medium text-foreground">
                {score.normalized}
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-500">
                {score.syllables.count} syllable{score.syllables.count === 1 ? "" : "s"} · name
                score {score.total}/100 ({score.grade})
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={copyReport}
                  aria-label="Copy brand report to clipboard"
                >
                  <ClipboardCopy aria-hidden="true" />
                  Copy report
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

          <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3">
            <SubMetric
              icon={Globe}
              label="TLD reach"
              caption=".com weighted"
              value={coverage?.tldReach ?? null}
              pending={checkingCoverage}
            />
            <SubMetric
              icon={Users}
              label="Social sweep"
              caption="clean sweep"
              value={coverage?.socialSweep ?? null}
              pending={checkingCoverage}
            />
            <SubMetric
              icon={Code2}
              label="Dev ecosystem"
              caption="github + npm"
              value={coverage?.devEcosystem ?? null}
              pending={checkingCoverage}
            />
          </div>

          <ul aria-label="Name score breakdown">
            <ComponentRow label="Punchiness" component={score.punchiness} />
            <ComponentRow label="Syllables" component={score.syllables} />
            <ComponentRow label="Pronounce" component={score.pronounceability} />
            <ComponentRow label="Uniqueness" component={score.uniqueness} />
            <ComponentRow label="Cleanliness" component={score.cleanliness} />
          </ul>
        </>
      )}
    </section>
  );
}
