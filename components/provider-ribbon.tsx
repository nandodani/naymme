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

/**
 * Muted horizontal ribbon of every registry the search covers — the only
 * element below the hero input before a search runs.
 */
export function ProviderRibbon() {
  return (
    <ul
      aria-label="Providers checked"
      className="mt-10 flex max-w-full flex-wrap items-center justify-center gap-x-6 gap-y-3"
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
