import type { ProviderId } from "../src/schemas.js";

/**
 * Smart routing for the availability matrix: where each provider's
 * register/claim and view-profile actions should deep-link, plus rough
 * first-year price hints for domains (badge only — real prices live at the
 * registrar and change constantly).
 */

export type RegistrarId = "porkbun" | "cloudflare" | "namecheap";

export interface Registrar {
  id: RegistrarId;
  label: string;
  /** Registrar domain-search URL for a full domain like `acme.com`. */
  searchUrl: (domain: string) => string;
}

export const REGISTRARS: readonly [Registrar, ...Registrar[]] = [
  {
    id: "porkbun",
    label: "Porkbun",
    searchUrl: (domain) => `https://porkbun.com/checkout/search?q=${encodeURIComponent(domain)}`,
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    searchUrl: (domain) => `https://domains.cloudflare.com/?domain=${encodeURIComponent(domain)}`,
  },
  {
    id: "namecheap",
    label: "Namecheap",
    searchUrl: (domain) =>
      `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(domain)}`,
  },
] as const;

export const DEFAULT_REGISTRAR: RegistrarId = "porkbun";

/** Rough first-year USD price hints per TLD, shown as an `~$/yr` badge. */
const TLD_PRICE_ESTIMATE: Partial<Record<ProviderId, string>> = {
  "domain:com": "~$11",
  "domain:dev": "~$12",
  "domain:io": "~$34",
  "domain:gg": "~$68",
  "domain:app": "~$14",
  "domain:pt": "~$12",
  "domain:es": "~$9",
  "domain:de": "~$8",
  "domain:fr": "~$10",
  "domain:uk": "~$8",
  "domain:eu": "~$9",
};

export function tldPriceEstimate(provider: ProviderId): string | null {
  return TLD_PRICE_ESTIMATE[provider] ?? null;
}

interface PlatformLinks {
  /** Where an available handle/package name can be claimed. */
  claim: (name: string) => string;
  /** Where a taken handle/package/user can be viewed. */
  profile: (name: string) => string;
}

const PLATFORM_LINKS: Partial<Record<ProviderId, PlatformLinks>> = {
  github: {
    claim: () => "https://github.com/signup",
    profile: (name) => `https://github.com/${name}`,
  },
  npm: {
    claim: () => "https://www.npmjs.com/signup",
    profile: (name) => `https://www.npmjs.com/package/${name}`,
  },
  "social:x": {
    claim: () => "https://x.com/i/flow/signup",
    profile: (name) => `https://x.com/${name}`,
  },
  "social:bluesky": {
    claim: () => "https://bsky.app/",
    profile: (name) => `https://bsky.app/profile/${name}`,
  },
  "social:instagram": {
    claim: () => "https://www.instagram.com/accounts/emailsignup/",
    profile: (name) => `https://www.instagram.com/${name}`,
  },
  "social:reddit": {
    claim: () => "https://www.reddit.com/register/",
    profile: (name) => `https://www.reddit.com/user/${name}`,
  },
  "social:youtube": {
    claim: () => "https://studio.youtube.com/",
    profile: (name) => `https://www.youtube.com/@${name}`,
  },
  "social:tiktok": {
    claim: () => "https://www.tiktok.com/signup",
    profile: (name) => `https://www.tiktok.com/@${name}`,
  },
};

export function platformLinks(provider: ProviderId): PlatformLinks | null {
  return PLATFORM_LINKS[provider] ?? null;
}
