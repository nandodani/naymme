"use client";

import { useState } from "react";
import { Check, ChevronDown, Store } from "lucide-react";

import { PROVIDER_GROUPS, type ProviderGroup, type ProviderGroupId } from "@/lib/provider-meta.js";
import type { AvailabilityResponse } from "@/lib/availability.js";
import { DEFAULT_REGISTRAR, REGISTRARS, type RegistrarId } from "@/lib/links.js";
import { cn } from "@/lib/utils.js";
import { ProviderRow } from "./provider-row.js";
import { Button } from "./ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.js";
import { Skeleton } from "./ui/skeleton.js";

export type AvailabilityFilter = "all" | "available" | ProviderGroupId;

interface AvailabilityGridProps {
  name: string;
  data: AvailabilityResponse | null;
  checking: boolean;
  error: string | null;
  onRetry: () => void;
  filter: AvailabilityFilter;
  onCopy: (text: string, label: string) => void;
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <ul aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex h-9 items-center gap-2.5 border-t border-border px-3 first:border-t-0"
        >
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto h-5 w-16 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

function RegistrarSelect({
  registrarId,
  onChange,
}: {
  registrarId: RegistrarId;
  onChange: (id: RegistrarId) => void;
}) {
  const current = REGISTRARS.find((r) => r.id === registrarId) ?? REGISTRARS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Register domains via ${current.label} — change registrar`}
          >
            <Store aria-hidden="true" className="size-3" />
            <span className="hidden sm:inline">via {current.label}</span>
            <span className="sm:hidden">{current.label}</span>
            <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Registrar</DropdownMenuLabel>
        {REGISTRARS.map((registrar) => (
          <DropdownMenuItem
            key={registrar.id}
            onClick={() => onChange(registrar.id)}
            className={cn(registrar.id === registrarId && "text-foreground")}
          >
            <span className="flex-1">{registrar.label}</span>
            {registrar.id === registrarId ? (
              <Check aria-hidden="true" className="size-3.5 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AvailabilitySection({
  group,
  name,
  resultsByProvider,
  pending,
  filter,
  registrar,
  onRegistrarChange,
  onCopy,
}: {
  group: ProviderGroup;
  name: string;
  resultsByProvider: Map<string, import("@/src/types.js").AvailabilityResult>;
  pending: boolean;
  filter: AvailabilityFilter;
  registrar: (typeof REGISTRARS)[number];
  onRegistrarChange: (id: RegistrarId) => void;
  onCopy: (text: string, label: string) => void;
}) {
  const providers =
    filter === "available"
      ? group.providers.filter((meta) => resultsByProvider.get(meta.id)?.status === "available")
      : group.providers;

  const available = group.providers.filter(
    (meta) => resultsByProvider.get(meta.id)?.status === "available",
  ).length;
  const resolved = group.providers.filter((meta) => resultsByProvider.has(meta.id)).length;

  return (
    <section
      aria-labelledby={`availability-${group.id}`}
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex h-10 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h3
            id={`availability-${group.id}`}
            className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
          >
            {group.title}
          </h3>
          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
            {pending && resolved === 0 ? (
              <span className="animate-pulse">checking…</span>
            ) : (
              `${available}/${group.providers.length} free`
            )}
          </span>
        </div>
        {group.id === "domains" ? (
          <RegistrarSelect registrarId={registrar.id} onChange={onRegistrarChange} />
        ) : null}
      </div>

      {pending && resolved === 0 ? (
        <SkeletonRows count={group.providers.length} />
      ) : providers.length === 0 ? (
        <p className="px-4 py-5 text-[12px] text-zinc-600">
          No {group.title.toLowerCase()} match this filter.
        </p>
      ) : (
        <ul>
          {providers.map((meta) => (
            <ProviderRow
              key={meta.id}
              meta={meta}
              name={name}
              result={resultsByProvider.get(meta.id)}
              pending={pending && !resultsByProvider.has(meta.id)}
              registrar={registrar}
              onCopy={onCopy}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function AvailabilityGrid({
  name,
  data,
  checking,
  error,
  onRetry,
  filter,
  onCopy,
}: AvailabilityGridProps) {
  const [registrarId, setRegistrarId] = useState<RegistrarId>(DEFAULT_REGISTRAR);
  const registrar = REGISTRARS.find((r) => r.id === registrarId) ?? REGISTRARS[0];

  const resultsByProvider = new Map((data?.results ?? []).map((r) => [r.provider, r]));
  const pending = checking;

  const visibleGroups =
    filter === "all" || filter === "available"
      ? PROVIDER_GROUPS
      : PROVIDER_GROUPS.filter((group) => group.id === filter);

  if (name === "" && data === null) {
    return (
      <section className="rounded-xl border border-border bg-card">
        <p className="px-4 py-8 text-center text-[12px] text-zinc-600">
          Type a name to check availability across {PROVIDER_GROUPS.length} registries and{" "}
          {PROVIDER_GROUPS.reduce((n, g) => n + g.providers.length, 0)} platforms.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error !== null ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5"
        >
          <p className="text-[12px] text-red-300">Availability check failed — {error}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}

      {visibleGroups.map((group) => (
        <AvailabilitySection
          key={group.id}
          group={group}
          name={name}
          resultsByProvider={resultsByProvider}
          pending={pending}
          filter={filter}
          registrar={registrar}
          onRegistrarChange={setRegistrarId}
          onCopy={onCopy}
        />
      ))}
    </div>
  );
}
