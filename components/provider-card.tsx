"use client";

import { AnimatePresence } from "motion/react";

import type { ProviderGroup } from "@/lib/provider-meta.js";
import { rowVisible, type ResultFilter } from "@/lib/result-filter.js";
import { cn } from "@/lib/utils.js";
import type { AvailabilityResult } from "@/src/types.js";
import { ProviderRow } from "./provider-row.js";
import { Skeleton } from "./ui/skeleton.js";

function SkeletonRows({ count }: { count: number }) {
  return (
    <ul aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex h-10 items-center gap-2.5 border-t border-white/5 px-4 first:border-t-0"
        >
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto h-5 w-16 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

/**
 * One bento card per provider group (Domains / Developer / Socials): an
 * 11px tracked header, 40px provider rows and skeleton pulses while the
 * async RDAP/WHOIS/registry checks are in flight.
 */
export function ProviderCard({
  group,
  name,
  resultsByProvider,
  pending,
  filter,
  className,
}: {
  group: ProviderGroup;
  name: string;
  resultsByProvider: Map<string, AvailabilityResult>;
  pending: boolean;
  /** "available" hides taken/unknown/pending rows with an exit animation. */
  filter: ResultFilter;
  className?: string;
}) {
  const available = group.providers.filter(
    (meta) => resultsByProvider.get(meta.id)?.status === "available",
  ).length;
  const resolved = group.providers.filter((meta) => resultsByProvider.has(meta.id)).length;
  const showSkeleton = pending && resolved === 0;
  const visibleProviders = group.providers.filter((meta) =>
    rowVisible(resultsByProvider.get(meta.id), filter),
  );

  return (
    <section
      aria-labelledby={`providers-${group.id}`}
      className={cn("overflow-hidden rounded-xl border border-white/10 bg-card", className)}
    >
      <div className="flex h-10 items-center gap-2.5 border-b border-white/5 px-4">
        <h3
          id={`providers-${group.id}`}
          className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
        >
          {group.title}
        </h3>
        <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
          {showSkeleton ? (
            <span className="animate-pulse">checking…</span>
          ) : (
            `${available}/${group.providers.length} free`
          )}
        </span>
      </div>

      {showSkeleton ? (
        <SkeletonRows count={group.providers.length} />
      ) : (
        <ul>
          <AnimatePresence initial={false}>
            {visibleProviders.map((meta) => (
              <ProviderRow
                key={meta.id}
                meta={meta}
                name={name}
                result={resultsByProvider.get(meta.id)}
                pending={pending && !resultsByProvider.has(meta.id)}
              />
            ))}
          </AnimatePresence>
          {visibleProviders.length === 0 ? (
            <li className="px-4 py-6 text-[12px] text-zinc-600">
              {pending ? "Checking…" : `No available ${group.title.toLowerCase()} found.`}
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
