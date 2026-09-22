"use client";

import type { NameScore, ScoreComponent } from "@/src/scoring/score.js";

const GRADE_STYLES: Record<NameScore["grade"], string> = {
  Excellent: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Strong: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  Fair: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  Weak: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  Poor: "border-red-400/30 bg-red-400/10 text-red-300",
};

function ScoreRing({ total, grade }: { total: number; grade: NameScore["grade"] }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, total)) / 100) * circumference;
  return (
    <div className="relative h-16 w-16 shrink-0">
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
          className="stroke-zinc-100 transition-[stroke-dasharray] duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-[15px] font-medium text-zinc-100">{total}</span>
      </div>
      <span className="sr-only">
        Total score {total} out of 100, grade {grade}
      </span>
    </div>
  );
}

function ComponentRow({ label, component }: { label: string; component: ScoreComponent }) {
  const pct = component.max === 0 ? 0 : Math.round((component.value / component.max) * 100);
  return (
    <li
      className="flex h-9 items-center gap-3 border-t border-hairline px-4 first:border-t-0"
      title={component.detail}
    >
      <span className="w-28 shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <span
          className="block h-full rounded-full bg-zinc-300 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-400">
        {component.value}
        <span className="text-zinc-600">/{component.max}</span>
      </span>
    </li>
  );
}

export function ScorePanel({ score }: { score: NameScore | null }) {
  return (
    <section className="rounded-xl border border-hairline bg-panel">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
          Brand score
        </h2>
        {score ? (
          <span
            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${GRADE_STYLES[score.grade]}`}
          >
            {score.grade}
          </span>
        ) : null}
      </div>

      {score === null ? (
        <p className="px-4 py-6 text-[12px] text-zinc-600">Type a name to score it out of 100.</p>
      ) : (
        <>
          <div className="flex items-center gap-4 px-4 py-3">
            <ScoreRing total={score.total} grade={score.grade} />
            <div className="min-w-0">
              <div className="truncate font-mono text-[15px] text-zinc-100">{score.normalized}</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">
                {score.syllables.count} syllable{score.syllables.count === 1 ? "" : "s"} ·{" "}
                {score.total}/100
              </div>
            </div>
          </div>
          <ul>
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
