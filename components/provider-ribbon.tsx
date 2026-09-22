"use client";

import type { ComponentType, SVGProps } from "react";
import { useEffect, useRef } from "react";

import { Globe } from "lucide-react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";

import { PROVIDER_GROUPS } from "../lib/provider-meta.js";
import { BRAND_ICONS } from "./brand-icons.js";

interface RibbonEntry {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** Every platform the search covers, flattened in card order — the marquee
 * always mirrors the active provider list, so a provider can never be
 * checked without also appearing here. Domain TLDs are skipped (they're
 * extensions, not brands) and providers that only differ by a " (…)" label
 * qualifier — e.g. GitHub (User) / GitHub (Org) — collapse into one entry. */
export const RIBBON: readonly RibbonEntry[] = (() => {
  const seen = new Set<string>();
  const entries: RibbonEntry[] = [];
  for (const { id, label } of PROVIDER_GROUPS.flatMap((group) => group.providers)) {
    if (id.startsWith("domain:")) continue;
    const name = label.replace(/\s*\(.*\)$/, "");
    if (seen.has(name)) continue;
    seen.add(name);
    entries.push({ id, label: name, icon: BRAND_ICONS[id as keyof typeof BRAND_ICONS] ?? Globe });
  }
  return entries;
})();

const SCROLL_PX_PER_S = 45;

/** Wrap `v` into (-half, 0]. Because the two rows are identical, shifting by
 * exactly one row width is visually invisible — the loop never teleports. */
function wrap(v: number, half: number): number {
  return ((v % half) - half) % half;
}

function RibbonRow({
  hidden,
  rowRef,
}: {
  hidden: boolean;
  rowRef?: React.RefObject<HTMLUListElement | null>;
}) {
  return (
    <ul
      ref={rowRef}
      aria-label={hidden ? undefined : "Providers checked"}
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-8 pr-8"
    >
      {RIBBON.map(({ id, label, icon: Icon }) => (
        <li
          key={id}
          className="flex items-center gap-2 text-zinc-600 transition-colors hover:text-zinc-400"
        >
          <Icon aria-hidden="true" className="size-4" />
          <span className="text-[12px] font-medium tracking-wide">{label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Draggable provider ticker. A single motion value drives the x position so
 * auto-scroll drift, a finger/mouse drag, and flick inertia all write to the
 * same stream: the change handler wraps the offset modulo one row width
 * (seamless, since the row renders twice), flick momentum coasts via Motion's
 * inertia dragTransition, and auto-scroll resumes once the fling settles.
 * Hover pauses the drift; reduced-motion users get a static, still-draggable
 * row.
 */
export function ProviderRibbon() {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const rowRef = useRef<HTMLUListElement>(null);
  const half = useRef(0);
  const dragging = useRef(false);
  const hovered = useRef(false);
  const wrapping = useRef(false);

  useEffect(() => {
    const measure = () => {
      half.current = rowRef.current?.offsetWidth ?? 0;
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (rowRef.current !== null) observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);

  // Keep x inside (-half, 0] at all times — during drags and inertia alike.
  // Stepping by exactly `half` is visually identical, so wrapping is free.
  useMotionValueEvent(x, "change", (v) => {
    if (wrapping.current || half.current <= 0) return;
    if (v <= -half.current || v > 0) {
      wrapping.current = true;
      x.set(wrap(v, half.current));
      wrapping.current = false;
    }
  });

  useAnimationFrame((_, delta) => {
    if (reduceMotion || dragging.current || hovered.current || half.current <= 0) return;
    x.set(x.get() - (SCROLL_PX_PER_S * delta) / 1000);
  });

  return (
    <div
      className="marquee-mask mt-3 w-full max-w-xl overflow-hidden"
      onMouseEnter={() => {
        hovered.current = true;
      }}
      onMouseLeave={() => {
        hovered.current = false;
      }}
    >
      <motion.div
        className="flex w-max cursor-grab touch-pan-y select-none active:cursor-grabbing"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragTransition={{ power: 0.35, timeConstant: 200 }}
        onDragStart={() => {
          dragging.current = true;
        }}
        onDragTransitionEnd={() => {
          // Inertia has fully coasted out — hand x back to the gentle drift.
          dragging.current = false;
        }}
      >
        <RibbonRow hidden={false} rowRef={rowRef} />
        <RibbonRow hidden={true} />
      </motion.div>
    </div>
  );
}
