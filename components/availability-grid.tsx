"use client";

import type { AvailabilityResponse } from "@/lib/availability.js";
import { PROVIDER_GROUPS, type ProviderMeta } from "@/lib/provider-meta.js";
import type { AvailabilityResult, AvailabilityStatus } from "@/src/types.js";

const STATUS_STYLES: Record<AvailabilityStatus, { dot: string; text: string; label: string }> = {
  available: { dot: "bg-emerald-400", text: "text-emerald-300", label: "available" },
  taken: { dot: "bg-zinc-500", text: "text-zinc-400", label: "taken" },
  unknown: { dot: "bg-amber-400", text: "text-amber-300", label: "unknown" },
  invalid: { dot: "bg-zinc-700", text: "text-zinc-500", label: "invalid" },
};

function StatusChip({ status }: { status: AvailabilityStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${style.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

function ProviderCell({
  meta,
  result,
  pending,
}: {
  meta: ProviderMeta;
  result: AvailabilityResult | undefined;
  pending: boolean;
}) {
  const title =
    result === undefined ? undefined : [result.subject, result.detail].filter(Boolean).join(" — ");
  return (
    <li
      title={title}
      className="flex h-9 items-center justify-between gap-2 border-t border-hairline px-4 first:border-t-0"
    >
      <span className="font-mono text-[12px] text-zinc-300">{meta.label}</span>
      {pending || result === undefined ? (
        <span className="loading-shimmer text-[11px] text-zinc-500">checking…</span>
      ) : (
        <StatusChip status={result.status} />
      )}
    </li>
  );
}

interface AvailabilityGridProps {
  name: string;
  data: AvailabilityResponse | null;
  checking: boolean;
  error: string | null;
  onRetry: () => void;
}

export function AvailabilityGrid({ name, data, checking, error, onRetry }: AvailabilityGridProps) {
  const resultsByProvider = new Map((data?.results ?? []).map((r) => [r.provider, r]));
  const pending = checking && data === null;

  return (
    <section className="rounded-xl border border-hairline bg-panel">
      <div className="flex h-10 items-center justify-between border-b border-hairline px-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
          Availability
        </h2>
        <div className="flex items-center gap-2">
          {data?.mode === "demo" ? (
            <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">
              demo
            </span>
          ) : null}
          {checking ? (
            <span className="loading-shimmer text-[11px] text-zinc-500">checking…</span>
          ) : null}
          {data ? (
            <span className="text-[11px] tabular-nums text-zinc-500">
              {data.summary.available} free · {data.summary.taken} taken
            </span>
          ) : null}
        </div>
      </div>

      {error !== null ? (
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
          <p className="text-[12px] text-red-300">Availability check failed — {error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="h-7 rounded-md border border-hairline px-2.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      {name === "" && data === null ? (
        <p className="px-4 py-6 text-[12px] text-zinc-600">
          Type a name to check availability across {PROVIDER_GROUPS.length} registries.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3">
          {PROVIDER_GROUPS.map((group) => (
            <div
              key={group.title}
              className="border-b border-hairline last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
            >
              <h3 className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-600">
                {group.title}
              </h3>
              <ul>
                {group.providers.map((meta) => (
                  <ProviderCell
                    key={meta.id}
                    meta={meta}
                    result={resultsByProvider.get(meta.id)}
                    pending={pending}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
