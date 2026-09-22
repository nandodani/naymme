"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Clock, Copy, ExternalLink, Globe, XCircle } from "lucide-react";

import { BRAND_ICONS } from "./brand-icons.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip.js";
import { cn } from "@/lib/utils.js";
import { platformLinks, tldPriceEstimate, type Registrar } from "@/lib/links.js";
import type { ProviderMeta } from "@/lib/provider-meta.js";
import type { AvailabilityResult, AvailabilityStatus } from "@/src/types.js";

const STATUS_STYLES: Record<
  AvailabilityStatus,
  { badge: string; icon: typeof CheckCircle2; label: string }
> = {
  available: {
    badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    icon: CheckCircle2,
    label: "available",
  },
  taken: {
    badge: "border-zinc-500/25 bg-zinc-500/10 text-zinc-400",
    icon: XCircle,
    label: "taken",
  },
  unknown: {
    badge: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    icon: Clock,
    label: "unknown",
  },
  invalid: {
    badge: "border-zinc-700/25 bg-zinc-700/10 text-zinc-500",
    icon: XCircle,
    label: "invalid",
  },
};

function ProviderIcon({ id }: { id: string }) {
  if (id.startsWith("domain:")) {
    return <Globe aria-hidden="true" className="size-3.5 text-zinc-500" />;
  }
  const Icon = BRAND_ICONS[id as keyof typeof BRAND_ICONS];
  if (Icon === undefined) {
    return <Globe aria-hidden="true" className="size-3.5 text-zinc-500" />;
  }
  return <Icon aria-hidden="true" className="size-3.5 text-zinc-400" />;
}

function StatusBadge({ status }: { status: AvailabilityStatus }) {
  const style = STATUS_STYLES[status];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium",
        style.badge,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {style.label}
    </span>
  );
}

interface ProviderRowProps {
  meta: ProviderMeta;
  /** The normalized name being checked — used for the prospective subject
   * while the real result is still in flight. */
  name: string;
  result: AvailabilityResult | undefined;
  /** A check is in flight and no (or stale) result exists for this row. */
  pending: boolean;
  /** Registrar chosen for the current session (domains only). */
  registrar: Registrar;
  /** Copy `subject` to the clipboard and fire the shared toast. */
  onCopy: (text: string, label: string) => void;
}

export function ProviderRow({ meta, name, result, pending, registrar, onCopy }: ProviderRowProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    },
    [],
  );

  const isDomain = meta.id.startsWith("domain:");
  const subject =
    result?.subject ??
    (isDomain ? `${name}${meta.label}` : meta.id.startsWith("social:") ? `@${name}` : name);
  const status = result?.status;
  const links = platformLinks(meta.id);

  const copy = () => {
    onCopy(subject, `Copied ${subject}`);
    setCopied(true);
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1400);
  };

  let action: { href: string; label: string; primary: boolean } | null = null;
  if (status === "available") {
    if (isDomain) {
      action = { href: registrar.searchUrl(subject), label: "Register", primary: true };
    } else if (links !== null) {
      action = { href: links.claim(name), label: "Claim", primary: true };
    }
  } else if (status === "taken") {
    if (isDomain) {
      action = { href: `https://${subject}`, label: "Visit", primary: false };
    } else if (links !== null) {
      action = { href: links.profile(name), label: "Profile", primary: false };
    }
  }

  const price = status === "available" && isDomain ? tldPriceEstimate(meta.id) : null;

  return (
    <li
      className={cn(
        "group relative flex h-9 items-center gap-1.5 border-t border-border transition-colors first:border-t-0",
        "hover:bg-zinc-900/50 hover:ring-1 hover:ring-inset hover:ring-zinc-700/60",
      )}
    >
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${subject}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch px-3 text-left outline-none transition-colors focus-visible:bg-zinc-900/60"
      >
        <ProviderIcon id={meta.id} />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-300">
          {subject}
        </span>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded transition-all",
            copied ? "text-emerald-300" : "text-zinc-600 opacity-0 group-hover:opacity-100",
          )}
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3" />
          ) : (
            <Copy aria-hidden="true" className="size-3" />
          )}
        </span>
      </button>

      <span className="flex shrink-0 items-center gap-1.5 pr-3">
        {price !== null ? (
          <span
            className="hidden rounded border border-zinc-700/40 bg-zinc-800/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline"
            title="Estimated first-year price at the selected registrar"
          >
            {price}/yr
          </span>
        ) : null}

        {pending || status === undefined ? (
          <span className="inline-flex h-5 animate-pulse items-center gap-1 rounded-full border border-zinc-700/40 bg-zinc-800/40 px-1.5 text-[10px] font-medium text-zinc-500">
            <Clock aria-hidden="true" className="size-3" />
            checking…
          </span>
        ) : (
          <StatusBadge status={status} />
        )}

        {action !== null ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href={action.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${action.label} ${subject}`}
                  onClick={(event) => event.stopPropagation()}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    action.primary
                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                      : "border-border bg-zinc-900/40 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100",
                  )}
                >
                  {action.label}
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              }
            />
            <TooltipContent side="top">
              {action.label === "Register"
                ? `Register on ${registrar.label}`
                : action.label === "Visit"
                  ? `Open ${subject}`
                  : `Open ${action.label.toLowerCase()} page`}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </span>
    </li>
  );
}
