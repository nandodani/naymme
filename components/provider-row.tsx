"use client";

import { CheckCircle2, Clock, Globe, XCircle } from "lucide-react";

import { BRAND_ICONS } from "./brand-icons.js";
import { RegistrarIcon } from "./registrar-icons.js";
import { cn } from "@/lib/utils.js";
import { platformLinks, REGISTRARS, tldPrices } from "@/lib/links.js";
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

/** Brand-icon tint keyed off availability — green glow when free, muted
 * red/zinc otherwise. */
const ICON_TINTS: Record<AvailabilityStatus, string> = {
  available: "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]",
  taken: "text-red-400/60",
  unknown: "text-amber-400/60",
  invalid: "text-zinc-600",
};

/**
 * Platform brand mark that is tinted by availability and, on row
 * hover/focus, morphs into the status glyph — a performant opacity/scale
 * crossfade, disabled under prefers-reduced-motion.
 */
function RowIcon({ id, status }: { id: string; status: AvailabilityStatus | undefined }) {
  if (id.startsWith("domain:")) {
    return <Globe aria-hidden="true" className="size-3.5 shrink-0 text-zinc-500" />;
  }
  const Icon = BRAND_ICONS[id as keyof typeof BRAND_ICONS];
  const tinted = status !== undefined;
  const tint = status === undefined ? "text-zinc-500" : ICON_TINTS[status];
  const Glyph = status === undefined ? null : STATUS_STYLES[status].icon;
  const GlyphComponent = Glyph ?? CheckCircle2;
  const brand =
    Icon === undefined ? (
      <Globe aria-hidden="true" className={cn("size-3.5", tint)} />
    ) : (
      <Icon aria-hidden="true" className={cn("size-3.5", tint)} />
    );
  if (!tinted) {
    return <span className="flex size-3.5 shrink-0 items-center">{brand}</span>;
  }
  return (
    <span className="relative flex size-3.5 shrink-0 items-center">
      <span className="absolute inset-0 flex items-center justify-center transition-all duration-150 motion-safe:group-hover:scale-75 motion-safe:group-hover:opacity-0 motion-safe:group-focus-within:scale-75 motion-safe:group-focus-within:opacity-0 motion-reduce:transition-none">
        {brand}
      </span>
      <span className="absolute inset-0 flex scale-75 items-center justify-center opacity-0 transition-all duration-150 motion-safe:group-hover:scale-100 motion-safe:group-hover:opacity-100 motion-safe:group-focus-within:scale-100 motion-safe:group-focus-within:opacity-100 motion-reduce:transition-none">
        <GlyphComponent aria-hidden="true" className={cn("size-3.5", tint)} />
      </span>
    </span>
  );
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

/**
 * Compact per-registrar first-year price estimate for one TLD. Each chip is
 * a real link to that registrar's domain search; `—` means the registrar
 * doesn't carry the TLD. Prices are static estimates — no live pricing API.
 */
function PriceChips({ provider, subject }: { provider: string; subject: string }) {
  const prices = tldPrices(provider as Parameters<typeof tldPrices>[0]);
  if (prices.length === 0) return null;
  return (
    <span className="hidden items-center gap-1 lg:flex" aria-label="First-year price estimates">
      {prices.map(({ registrar, estimate }) =>
        estimate === null ? (
          <span
            key={registrar.id}
            title={`${registrar.label} does not carry this TLD`}
            className="inline-flex h-5 items-center gap-1 rounded border border-zinc-800/60 px-1.5 font-mono text-[9px] text-zinc-600"
          >
            <RegistrarIcon id={registrar.id} className="text-zinc-600" />—
          </span>
        ) : (
          <a
            key={registrar.id}
            href={registrar.searchUrl(subject)}
            target="_blank"
            rel="noreferrer noopener"
            title={`~$${estimate}/yr at ${registrar.label} (estimate)`}
            aria-label={`Register ${subject} at ${registrar.label}, estimated ~$${estimate} per year`}
            className="inline-flex h-5 items-center gap-1 rounded border border-zinc-700/40 bg-zinc-800/40 px-1.5 font-mono text-[9px] text-zinc-400 transition-colors outline-none hover:border-zinc-500/60 hover:text-zinc-200 focus-visible:border-zinc-500/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RegistrarIcon id={registrar.id} />
            ~${estimate}
          </a>
        ),
      )}
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
}

/**
 * One result line. The whole row is the action — an anchor when the status
 * yields a target (register/claim for free names, live site/profile for
 * taken ones), static text otherwise. Developer/social rows carry an
 * explicit platform label and an availability-tinted brand icon that morphs
 * into the status glyph on hover; the status chip floats with a soft
 * trailing shadow. Available domains link to the first registrar carrying
 * the TLD while the price chips offer every registrar.
 */
export function ProviderRow({ meta, name, result, pending }: ProviderRowProps) {
  const isDomain = meta.id.startsWith("domain:");
  const subject =
    result?.subject ??
    (isDomain ? `${name}${meta.label}` : meta.id.startsWith("social:") ? `@${name}` : name);
  const status = result?.status;
  const links = platformLinks(meta.id);
  const prices = isDomain && status === "available" ? tldPrices(meta.id) : [];

  // The row's link target and its accessible label.
  let href: string | null = null;
  let actionLabel: string | null = null;
  if (status === "available") {
    if (isDomain) {
      const carrier = prices.find((p) => p.estimate !== null)?.registrar ?? REGISTRARS[0];
      href = carrier.searchUrl(subject);
      actionLabel = `Register ${subject} at ${carrier.label}`;
    } else if (links !== null) {
      href = links.claim(name);
      actionLabel = `Claim ${subject} on ${meta.label}`;
    }
  } else if (status === "taken") {
    if (isDomain) {
      href = `https://${subject}`;
      actionLabel = `Visit ${subject}`;
    } else if (links !== null) {
      href = links.profile(name);
      actionLabel = `Open the ${meta.label} page for ${subject}`;
    }
  }

  const sharedRowClasses = cn(
    "group relative flex h-10 items-center border-t border-border transition-colors first:border-t-0",
    href !== null && "cursor-pointer hover:bg-zinc-900/50",
  );
  const mainAreaClasses = cn(
    "flex min-w-0 flex-1 items-center gap-2.5 self-stretch px-3 text-left outline-none",
    href !== null &&
      "focus-visible:bg-zinc-900/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
  );

  const statusBadge = (
    <span className="flex items-center transition-all duration-200 motion-safe:group-hover:-translate-x-0.5 motion-safe:group-hover:drop-shadow-[-6px_0_10px_rgba(0,0,0,0.55)] motion-safe:group-focus-within:-translate-x-0.5 motion-safe:group-focus-within:drop-shadow-[-6px_0_10px_rgba(0,0,0,0.55)] motion-reduce:transition-none">
      {pending || status === undefined ? (
        <span className="inline-flex h-5 animate-pulse items-center gap-1 rounded-full border border-zinc-700/40 bg-zinc-800/40 px-1.5 text-[10px] font-medium text-zinc-500">
          <Clock aria-hidden="true" className="size-3" />
          checking…
        </span>
      ) : (
        <StatusBadge status={status} />
      )}
    </span>
  );

  const identity = (
    <>
      <RowIcon id={meta.id} status={pending ? undefined : status} />
      {isDomain ? null : (
        <span className="shrink-0 text-[10px] font-medium text-zinc-600">{meta.label}</span>
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-300">{subject}</span>
    </>
  );

  return (
    <li className={sharedRowClasses}>
      {href !== null ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={actionLabel ?? undefined}
          className={mainAreaClasses}
        >
          {identity}
        </a>
      ) : (
        <div className={mainAreaClasses}>{identity}</div>
      )}

      <span className="flex shrink-0 items-center gap-1.5 pr-3">
        {prices.length > 0 ? <PriceChips provider={meta.id} subject={subject} /> : null}
        {statusBadge}
      </span>
    </li>
  );
}
