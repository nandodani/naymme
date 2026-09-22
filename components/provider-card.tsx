"use client";

import { useState } from "react";
import { Check, ChevronDown, Store } from "lucide-react";

import { REGISTRARS, DEFAULT_REGISTRAR, type RegistrarId } from "@/lib/links.js";
import type { ProviderGroup } from "@/lib/provider-meta.js";
import { cn } from "@/lib/utils.js";
import type { AvailabilityResult } from "@/src/types.js";
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
  onCopy,
  className,
}: {
  group: ProviderGroup;
  name: string;
  resultsByProvider: Map<string, AvailabilityResult>;
  pending: boolean;
  onCopy: (text: string, label: string) => void;
  className?: string;
}) {
  const [registrarId, setRegistrarId] = useState<RegistrarId>(DEFAULT_REGISTRAR);
  const registrar = REGISTRARS.find((r) => r.id === registrarId) ?? REGISTRARS[0];

  const available = group.providers.filter(
    (meta) => resultsByProvider.get(meta.id)?.status === "available",
  ).length;
  const resolved = group.providers.filter((meta) => resultsByProvider.has(meta.id)).length;
  const showSkeleton = pending && resolved === 0;

  return (
    <section
      aria-labelledby={`providers-${group.id}`}
      className={cn("overflow-hidden rounded-xl border border-white/10 bg-card", className)}
    >
      <div className="flex h-10 items-center justify-between gap-2 border-b border-white/5 px-4">
        <div className="flex min-w-0 items-baseline gap-2.5">
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
        {group.id === "domains" ? (
          <RegistrarSelect registrarId={registrar.id} onChange={setRegistrarId} />
        ) : null}
      </div>

      {showSkeleton ? (
        <SkeletonRows count={group.providers.length} />
      ) : (
        <ul>
          {group.providers.map((meta) => (
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
