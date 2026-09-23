"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Clock, Globe, XCircle } from "lucide-react";

import { BRAND_ICONS } from "./brand-icons.js";
import { RegistrarIcon } from "./registrar-icons.js";
import { cn } from "@/lib/utils.js";
import { platformLinks, REGISTRARS, tldPrices } from "@/lib/links.js";
import type { ProviderMeta } from "@/lib/provider-meta.js";
import type { AvailabilityResult, AvailabilityStatus } from "@/src/types.js";

const STATUS_GLYPHS: Record<AvailabilityStatus, typeof CheckCircle2> = {
  available: CheckCircle2,
  taken: XCircle,
  unknown: Clock,
  invalid: XCircle,
};

/** Brand-icon tint keyed off availability — green glow when free, muted
 * red/amber/zinc otherwise. Color is never the only signal: each row also
 * carries a sr-only status text and the anchors include it in their
 * aria-label. */
const ICON_TINTS: Record<AvailabilityStatus, string> = {
  available: "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]",
  taken: "text-red-400/70",
  unknown: "text-amber-400/70",
  invalid: "text-zinc-600",
};

/** Floating availability chip tint — matches the icon's status color. */
const CHIP_TINTS: Record<AvailabilityStatus, string> = {
  available: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  taken: "border-red-400/30 bg-red-400/10 text-red-300",
  unknown: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  invalid: "border-zinc-700/60 bg-zinc-800/60 text-zinc-400",
};

const MORPH_SPRING = { type: "spring", stiffness: 500, damping: 30 } as const;
const CHIP_SPRING = { type: "spring", stiffness: 420, damping: 28 } as const;

/**
 * Platform brand mark tinted by availability. While the icon's own hover /
 * focus target is engaged (`revealed`) it springs out of the way — the
 * status chip carries the glyph instead. Composited opacity/scale only,
 * reduced to a plain fade under prefers-reduced-motion. During a pending
 * check it pulses zinc.
 */
function RowIcon({
  id,
  status,
  pending,
  revealed,
}: {
  id: string;
  status: AvailabilityStatus | undefined;
  pending: boolean;
  revealed: boolean;
}) {
  const reduce = useReducedMotion();
  const Icon = BRAND_ICONS[id as keyof typeof BRAND_ICONS] ?? Globe;
  if (pending || status === undefined) {
    return (
      <Icon
        aria-hidden="true"
        className={cn("size-3.5 shrink-0 text-zinc-600", pending && "animate-pulse")}
      />
    );
  }
  const tint = ICON_TINTS[status];
  return (
    <span className="relative flex size-3.5 shrink-0 items-center" aria-hidden="true">
      <motion.span
        className="absolute inset-0 flex items-center justify-center"
        initial={false}
        animate={{
          opacity: revealed ? 0 : 1,
          scale: reduce ? 1 : revealed ? 0.75 : 1,
        }}
        transition={reduce ? { duration: 0.15 } : MORPH_SPRING}
      >
        <Icon className={cn("size-3.5", tint)} />
      </motion.span>
    </span>
  );
}

/**
 * Floating availability pill — status glyph + label as one unified chip.
 * It swaps in at the icon slot when the icon target is hovered/focused,
 * staying local to the start of the row on a z-raised layer with a 1px
 * border and soft shadow. A marquee-style black gradient shade trails
 * ~90px to the right, fading the row text behind it into the OLED
 * background instead of blurring. pointer-events-none — it never
 * intercepts the row's own click target; status stays in the a11y tree
 * via sr-only text.
 */
function StatusChip({ status, visible }: { status: AvailabilityStatus; visible: boolean }) {
  const reduce = useReducedMotion();
  const Glyph = STATUS_GLYPHS[status];
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-2 z-10 -translate-y-1/2"
    >
      <AnimatePresence>
        {visible
          ? [
              <motion.span
                key="shade"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeOut" } }}
                transition={CHIP_SPRING}
                className="absolute top-0 -left-2 h-9 w-44 -translate-y-1/2 bg-gradient-to-r from-black via-black/70 to-transparent"
              />,
              <motion.span
                key="chip"
                initial={{
                  opacity: 0,
                  x: reduce ? 0 : -4,
                  scale: reduce ? 1 : 0.9,
                }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  x: reduce ? 0 : -4,
                  scale: reduce ? 1 : 0.95,
                  transition: { duration: 0.15, ease: "easeOut" },
                }}
                transition={reduce ? { duration: 0.15 } : CHIP_SPRING}
                style={{ translate: "0 -50%", transformOrigin: "left center" }}
                className={cn(
                  "absolute top-0 left-0 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
                  "text-[10px] font-medium tracking-[0.08em] uppercase",
                  "shadow-2xl shadow-black backdrop-blur-md",
                  CHIP_TINTS[status],
                )}
              >
                <Glyph className="size-3" />
                {status}
              </motion.span>,
            ]
          : null}
      </AnimatePresence>
    </span>
  );
}

/**
 * Compact per-registrar first-year price estimate for one TLD. Each chip is
 * a real link to that registrar's domain search; `—` means the registrar
 * doesn't carry the TLD. Prices are static estimates — no live pricing API.
 * Cheapest carriers come first; the strip clips at ~3.5 chips so the
 * half-visible chip advertises horizontal scroll for the rest, and the
 * right-edge fade keeps the cut from looking like a bug.
 */
function PriceChips({ provider, subject }: { provider: string; subject: string }) {
  const prices = tldPrices(provider as Parameters<typeof tldPrices>[0]);
  if (prices.length === 0) return null;
  const sorted = [...prices].sort(
    (a, b) => (a.estimate ?? Number.POSITIVE_INFINITY) - (b.estimate ?? Number.POSITIVE_INFINITY),
  );
  return (
    <span
      className="scrollbar-none marquee-mask mr-3 hidden min-w-0 shrink basis-42 items-center gap-1 overflow-x-auto overscroll-x-contain xl:flex"
      aria-label="First-year price estimates"
    >
      {sorted.map(({ registrar, estimate }) =>
        estimate === null ? (
          <span
            key={registrar.id}
            title={`${registrar.label} does not carry this TLD`}
            className="inline-flex h-5 shrink-0 items-center gap-1 rounded border border-zinc-800/60 px-1.5 font-mono text-[9px] text-zinc-600"
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
            className="inline-flex h-5 shrink-0 items-center gap-1 rounded border border-zinc-700/40 bg-zinc-800/40 px-1.5 font-mono text-[9px] text-zinc-400 transition-colors outline-none hover:border-zinc-500/60 hover:text-zinc-200 focus-visible:border-zinc-500/60 focus-visible:ring-2 focus-visible:ring-ring"
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
 * taken ones), static text otherwise. Availability is expressed purely by
 * icon tint (status text stays in the a11y tree via sr-only/aria-label).
 * Only the icon is the status trigger: hovering/focusing it morphs the
 * brand mark into the status glyph and pops the status chip right next to
 * it — the rest of the row never triggers it. Available domains link to
 * the first registrar carrying the TLD while the price chips offer every
 * registrar.
 */
export function ProviderRow({ meta, name, result, pending }: ProviderRowProps) {
  const [revealed, setRevealed] = useState(false);
  const reduceMotion = useReducedMotion();
  const isDomain = meta.id.startsWith("domain:");
  const subject =
    result?.subject ??
    (isDomain ? `${name}${meta.label}` : meta.id.startsWith("social:") ? `@${name}` : name);
  const status = result?.status;
  const statusText = pending || status === undefined ? "checking" : status;
  const links = platformLinks(meta.id);
  const prices = isDomain && status === "available" ? tldPrices(meta.id) : [];

  // The row's link target and its accessible label.
  let href: string | null = null;
  let actionLabel: string | null = null;
  if (status === "available") {
    if (isDomain) {
      const carriers = prices.filter(
        (p): p is (typeof prices)[number] & { estimate: number } => p.estimate !== null,
      );
      const carrier =
        carriers.sort((a, b) => a.estimate - b.estimate)[0]?.registrar ?? REGISTRARS[0];
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

  const identity = (
    <>
      {isDomain ? null : (
        <span className="shrink-0 text-[10px] font-medium text-zinc-600">{meta.label}</span>
      )}
      <span
        title={subject}
        className="shrink-0 font-mono text-[12px] whitespace-nowrap text-zinc-300"
      >
        {subject}
      </span>
      <span className="sr-only">{statusText}</span>
    </>
  );

  return (
    // motion.li so the "Available only" filter can blur+scale+fade rows in
    // and out (AnimatePresence in ProviderCard). Deliberately no `layout`:
    // positional slides made re-entering rows collide with rows already at
    // their final spot — fading in place can never overlap.
    <motion.li
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: "blur(3px)" }}
      animate={
        reduceMotion
          ? { opacity: 1, transition: { duration: 0.12 } }
          : {
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
              transition: { duration: 0.18, ease: "easeOut" },
            }
      }
      exit={
        reduceMotion
          ? { opacity: 0, transition: { duration: 0.12 } }
          : { opacity: 0, scale: 0.96, filter: "blur(4px)", transition: { duration: 0.16 } }
      }
      className={`${sharedRowClasses} overflow-hidden`}
      title={isDomain ? undefined : statusText}
    >
      {/* Icon-scoped status trigger: hover/focus on this target alone
          reveals the chip — the rest of the row never does. */}
      <span
        tabIndex={0}
        aria-label={`${meta.label} ${subject} — ${statusText}`}
        onMouseEnter={() => setRevealed(true)}
        onMouseLeave={() => setRevealed(false)}
        onFocus={() => setRevealed(true)}
        onBlur={() => setRevealed(false)}
        className="flex shrink-0 cursor-default items-center self-stretch pr-1 pl-3 outline-none focus-visible:bg-zinc-900/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <RowIcon id={meta.id} status={status} pending={pending} revealed={revealed} />
      </span>

      {href !== null ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`${actionLabel ?? subject} — ${statusText}`}
          className="flex min-w-0 grow basis-auto shrink-[0.1] items-center gap-2.5 self-stretch overflow-x-auto scrollbar-none pr-3 pl-1.5 text-left outline-none focus-visible:bg-zinc-900/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {identity}
        </a>
      ) : (
        <div className="flex min-w-0 grow basis-auto shrink-[0.1] items-center gap-2.5 self-stretch overflow-x-auto scrollbar-none pr-3 pl-1.5 text-left">
          {identity}
        </div>
      )}

      {status !== undefined && !pending ? <StatusChip status={status} visible={revealed} /> : null}

      {/* Space priority: subject (anchor) sized to content — grow +
            basis-auto + near-zero shrink — so the chip strip absorbs ~90%
            of any squeeze and collapses to nothing before a pathological
            subject scrolls inside its own container. */}
      {prices.length > 0 ? <PriceChips provider={meta.id} subject={subject} /> : null}
    </motion.li>
  );
}
