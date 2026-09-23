"use client";

import type { ComponentType, SVGProps } from "react";
import { useEffect, useRef, useState } from "react";

import { Globe, Pause, Play } from "lucide-react";
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

/** Wrap `v` into (-rowWidth, 0] — Motion's `wrap(-w, 0, v)` written so it
 * survives any magnitude: a multi-row overshoot in one frame (fast flicks)
 * still lands back inside the valid range. Because every row copy is
 * identical, stepping by exactly one row width is visually invisible. */
export function wrapTrackX(v: number, rowWidth: number): number {
  // `+ 0` normalizes -0 so exact multiples land on clean 0.
  return (((v % rowWidth) - rowWidth) % rowWidth) + 0;
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
          <Icon
            aria-hidden="true"
            className="size-4 opacity-70 transition-opacity duration-200 hover:opacity-100"
          />
          <span className="text-[12px] font-medium tracking-wide text-zinc-400">{label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Draggable provider ticker. A single motion value drives the x position so
 * auto-scroll drift, a finger/mouse drag, and flick inertia all write to the
 * same stream: the change handler wraps the offset modulo one row width
 * (seamless — the row renders three times), flick momentum coasts via Motion's
 * inertia dragTransition, and auto-scroll resumes once the fling settles.
 * Hover pauses the drift; reduced-motion users get a static, still-draggable
 * row.
 */
export function ProviderRibbon() {
  const reduceMotion = useReducedMotion();
  // WCAG 2.2.2: auto-moving content needs a user-operable pause.
  const [paused, setPaused] = useState(false);
  const x = useMotionValue(0);
  const rowRef = useRef<HTMLUListElement>(null);
  const rowWidth = useRef(0);
  const dragging = useRef(false);
  const hovered = useRef(false);
  const wrapping = useRef(false);

  useEffect(() => {
    const measure = () => {
      rowWidth.current = rowRef.current?.offsetWidth ?? 0;
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (rowRef.current !== null) observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);

  // Keep x inside (-rowWidth, 0] at all times — during drags and inertia
  // alike. With three identical copies of the row there is always a full
  // buffered set on both sides of the viewport, so wrapping by exactly one
  // row width is invisible and a hard flick can never run the track dry.
  useMotionValueEvent(x, "change", (v) => {
    if (wrapping.current || rowWidth.current <= 0) return;
    if (v <= -rowWidth.current || v > 0) {
      wrapping.current = true;
      x.set(wrapTrackX(v, rowWidth.current));
      wrapping.current = false;
    }
  });

  useAnimationFrame((_, delta) => {
    if (paused || reduceMotion || dragging.current || hovered.current || rowWidth.current <= 0)
      return;
    x.set(x.get() - (SCROLL_PX_PER_S * delta) / 1000);
  });

  return (
    <div
      className="marquee-mask relative mt-3 w-full max-w-xl overflow-hidden"
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
        <RibbonRow hidden={true} />
      </motion.div>
      {/* Pause/play for the auto-drift — draggable state is unaffected, so
          the ticker stays operable while paused. */}
      <button
        type="button"
        aria-pressed={paused}
        aria-label={paused ? "Resume provider ticker" : "Pause provider ticker"}
        onClick={() => setPaused((p) => !p)}
        className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-800 bg-black/80 text-zinc-400 backdrop-blur transition-colors outline-none hover:border-zinc-700 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {paused ? (
          <Play aria-hidden="true" className="size-3" />
        ) : (
          <Pause aria-hidden="true" className="size-3" />
        )}
      </button>
    </div>
  );
}
