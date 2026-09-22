import type { ComponentType, SVGProps } from "react";

import {
  BlueskyIcon,
  GitHubIcon,
  InstagramIcon,
  NpmIcon,
  PorkbunIcon,
  RedditIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon,
} from "./brand-icons.js";

interface RibbonEntry {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const RIBBON: readonly RibbonEntry[] = [
  { label: "GitHub", icon: GitHubIcon },
  { label: "npm", icon: NpmIcon },
  { label: "X", icon: XIcon },
  { label: "Instagram", icon: InstagramIcon },
  { label: "Bluesky", icon: BlueskyIcon },
  { label: "Reddit", icon: RedditIcon },
  { label: "Porkbun", icon: PorkbunIcon },
  { label: "YouTube", icon: YouTubeIcon },
  { label: "TikTok", icon: TikTokIcon },
];

function RibbonRow({ hidden }: { hidden: boolean }) {
  return (
    <ul
      aria-label={hidden ? undefined : "Providers checked"}
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-8 pr-8"
    >
      {RIBBON.map(({ label, icon: Icon }) => (
        <li
          key={label}
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
