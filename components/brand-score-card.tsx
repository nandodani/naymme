"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, Gem, Globe, Share2, Type } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { AvailabilityResponse } from "@/lib/availability.js";
import { PROVIDER_GROUPS } from "@/lib/provider-meta.js";
import { coverageRatio, verdictTone, type VerdictTone } from "@/lib/score-display.js";
import { brandScore, type BrandScore } from "@/src/scoring/brand.js";
import { cn } from "@/lib/utils.js";
import { Button } from "./ui/button.js";
import { Skeleton } from "./ui/skeleton.js";

const TONE_STYLES: Record<VerdictTone, { badge: string; dot: string }> = {
  uncontested: {
    badge: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  strong: { badge: "border-sky-400/40 bg-sky-400/10 text-sky-300", dot: "bg-sky-400" },
  contested: {
    badge: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    dot: "bg-amber-400",
  },
  crowded: { badge: "border-rose-400/40 bg-rose-400/10 text-rose-300", dot: "bg-rose-400" },
};

/**
 * Ease-out count-up for the headline score. Returns `null` while the
 * checks are in flight so no partial score ever paints; once a score
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

/** High-density stat row: icon, label, and a compact value. */
function StatPill({
  icon: Icon,
  label,
  children,
  title,
}: {
  icon: typeof Globe;
  label: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div
      title={title}
      className="flex min-w-0 items-center gap-2.5 rounded-lg border border-zinc-800 bg-white/[0.02] px-3 py-2.5"
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-zinc-500" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
          {label}
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[12px] text-zinc-200 tabular-nums">
          {children}
        </div>
      </div>
    </div>
  );
}

/** One dot per crown jewel: filled when free, hollow when taken/unchecked. */
function CrownDots({ brand }: { brand: BrandScore }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {brand.crownJewels.slots.map((jewel) => (
        <span
          key={jewel.label}
          className={cn(
            "size-1.5 rounded-full",
            jewel.free ? "bg-emerald-400" : "border border-zinc-600 bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

/** Thin availability bar: emerald fill on a zinc-800 track. */
function AvailabilityBar({ ratio }: { ratio: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <span
      role="img"
      aria-label={`${Math.round(ratio * 100)}% available`}
      className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-800"
    >
      <motion.span
        className="block h-full rounded-full bg-emerald-400/70"
        style={{ transformOrigin: "left" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: ratio }}
        transition={
          reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }
        }
      />
    </span>
  );
}

function markdownSummary(
  name: string,
  brand: BrandScore,
  availability: AvailabilityResponse,
  url: string,
): string {
  const lines = [
    `## lmkurname — ${name}`,
    `**${brand.score}/100** — ${brand.verdict}`,
    `Crown jewels ${brand.crownJewels.free} of ${brand.crownJewels.slots.length} free (${brand.crownJewels.slots
      .map((j) => `${j.label} ${j.free ? "free" : "taken"}`)
      .join(", ")}) · total availability ${brand.availability.free}/${brand.availability.total}`,
    `Base ${Math.round(brand.baseScore)} × linguistic ${brand.multiplier.toFixed(2)} — ${brand.trait}`,
    "",
    "| Provider | Subject | Status |",
    "| --- | --- | --- |",
  ];
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
function ScoreSkeleton() {
  return (
    <div className="px-5 pt-5 pb-4" aria-hidden="true">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-12 w-28" />
        <Skeleton className="h-6 w-40 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-32" />
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    </div>
  );
}

export function BrandScoreCard({
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
  // The brand score only resolves once the checks finish — while any are in
  // flight it stays null and the card renders a skeleton rather than paint a
  // partial or stale number.
  const brand = useMemo(
    () =>
      name === "" || checking || availability === null
        ? null
        : brandScore(name, availability.results),
    [name, checking, availability],
  );
  const display = useCountUp(brand?.score ?? null);
  const tone = brand === null ? null : verdictTone(brand.verdict);

  const copyReport = () => {
    if (brand === null || availability === null) return;
    onCopy(
      markdownSummary(name, brand, availability, window.location.href),
      "Markdown summary copied",
    );
  };

  const shareResult = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    if (name !== "") url.searchParams.set("q", name);
    onCopy(url.toString(), "Link copied");
  };

  const jewelTitle =
    brand === null
      ? undefined
      : brand.crownJewels.slots
          .map((j) => `${j.label}: ${j.checked ? (j.free ? "free" : "taken") : "not checked"}`)
          .join(" · ");

  return (
    <section
      aria-labelledby="brand-score-title"
      aria-busy={brand === null && name !== ""}
      className={cn("overflow-hidden rounded-xl border border-zinc-800 bg-black", className)}
    >
      <div className="flex h-10 items-center justify-between gap-2 border-b border-zinc-800 px-4">
        <h2
          id="brand-score-title"
          className="text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase"
        >
          Brand score
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
            disabled={brand === null}
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
          <p className="text-[12px] leading-5 text-zinc-600">
            Search a name to score it out of 100 across crown jewels, core web and long-tail
            platforms.
          </p>
        </div>
      ) : brand === null ? (
        <ScoreSkeleton />
      ) : (
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[44px] leading-none font-semibold tracking-tight text-foreground tabular-nums">
                {display ?? brand.score}
              </span>
              <span className="font-mono text-[13px] text-zinc-600 tabular-nums">/ 100</span>
            </div>
            {tone !== null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.06em] uppercase",
                  TONE_STYLES[tone].badge,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 rounded-full", TONE_STYLES[tone].dot)}
                />
                {brand.verdict}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 truncate font-mono text-[13px] text-zinc-400">
            {brand.normalized}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <StatPill icon={Gem} label="Crown Jewels" title={jewelTitle}>
              <span>
                {brand.crownJewels.free} of {brand.crownJewels.slots.length} free
              </span>
              <CrownDots brand={brand} />
            </StatPill>
            <StatPill icon={Globe} label="Total Availability">
              <span>
                {brand.availability.free} of {brand.availability.total} free
              </span>
              <AvailabilityBar
                ratio={coverageRatio(brand.availability.free, brand.availability.total)}
              />
            </StatPill>
            <StatPill icon={Type} label="Name Trait" title={brand.trait}>
              <span className="truncate font-sans text-[12px] font-medium">{brand.trait}</span>
            </StatPill>
          </div>
        </div>
      )}
    </section>
  );
}
