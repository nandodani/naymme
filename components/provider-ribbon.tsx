import type { ComponentType, SVGProps } from "react";

import { Globe } from "lucide-react";

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

function RibbonRow({ hidden }: { hidden: boolean }) {
  return (
    <ul
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
 * Muted, infinitely-sliding ticker of every registry the search covers — the
 * only element below the hero input before a search runs. The row is rendered
 * twice and translated by -50% so the loop is seamless; the edges fade out
 * via .marquee-mask and the animation honors prefers-reduced-motion.
 */
export function ProviderRibbon() {
  return (
    <div className="marquee-mask mt-12 w-full max-w-xl overflow-hidden">
      <div className="animate-marquee flex w-max hover:[animation-play-state:paused]">
        <RibbonRow hidden={false} />
        <RibbonRow hidden={true} />
      </div>
    </div>
  );
}
