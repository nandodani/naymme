import type { ProviderId } from "../src/schemas.js";

/**
 * Smart routing for the availability matrix: where each provider's
 * register/claim and view-profile targets deep-link, plus per-registrar
 * first-year price estimates for domains.
 *
 * Prices are static published-rate estimates in USD — there is no live
 * registrar pricing API wired in, so every chip renders `~` and is labelled
 * an estimate. A `null` entry means the registrar does not offer that TLD
 * (or no published rate is tracked), shown as `—` rather than invented.
 */

export type RegistrarId = "porkbun" | "cloudflare" | "namecheap" | "godaddy";

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
  {
    id: "godaddy",
    label: "GoDaddy",
    searchUrl: (domain) =>
      `https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(domain)}`,
  },
] as const;

/**
 * Rough first-year USD estimate per TLD and registrar. `null` = registrar
 * does not carry the TLD (Cloudflare Registrar, for example, only supports
 * a subset of gTLDs and no ccTLDs) — rendered as an honest `—`.
 */
const TLD_PRICE_ESTIMATES: Partial<
  Record<ProviderId, Partial<Record<RegistrarId, number | null>>>
> = {
  "domain:com": { porkbun: 11, cloudflare: 10, namecheap: 11, godaddy: 13 },
  "domain:dev": { porkbun: 12, cloudflare: 13, namecheap: 13, godaddy: 17 },
  "domain:io": { porkbun: 34, cloudflare: null, namecheap: 33, godaddy: 45 },
  "domain:ai": { porkbun: 68, cloudflare: null, namecheap: 68, godaddy: 100 },
  "domain:gg": { porkbun: 68, cloudflare: null, namecheap: 70, godaddy: 90 },
  "domain:app": { porkbun: 14, cloudflare: 15, namecheap: 13, godaddy: 20 },
  "domain:pt": { porkbun: 12, cloudflare: null, namecheap: 14, godaddy: 25 },
  "domain:es": { porkbun: 9, cloudflare: null, namecheap: 10, godaddy: 12 },
  "domain:de": { porkbun: 8, cloudflare: null, namecheap: 9, godaddy: 10 },
  "domain:fr": { porkbun: 10, cloudflare: null, namecheap: 12, godaddy: 13 },
  "domain:uk": { porkbun: 8, cloudflare: null, namecheap: 9, godaddy: 10 },
  "domain:eu": { porkbun: 9, cloudflare: null, namecheap: 9, godaddy: 10 },
};

export interface RegistrarPrice {
  registrar: Registrar;
  /** USD first-year estimate, or null when the TLD is not carried. */
  estimate: number | null;
}

/**
 * Every registrar's estimate for a TLD, in REGISTRARS order. Returns `[]`
 * for non-domain providers or TLDs with no tracked pricing.
 */
export function tldPrices(provider: ProviderId): readonly RegistrarPrice[] {
  const table = TLD_PRICE_ESTIMATES[provider];
  if (table === undefined) return [];
  return REGISTRARS.map((registrar) => ({
    registrar,
    estimate: table[registrar.id] ?? null,
  }));
}

interface PlatformLinks {
  /** Where an available handle/package name can be claimed. */
  claim: (name: string) => string;
  /** Where a taken handle/package/user can be viewed. */
  profile: (name: string) => string;
}

const PLATFORM_LINKS: Partial<Record<ProviderId, PlatformLinks>> = {
  "github:user": {
    claim: () => "https://github.com/signup",
    profile: (name) => `https://github.com/${name}`,
  },
  "github:org": {
    claim: () => "https://github.com/account/organizations/new",
    profile: (name) => `https://github.com/${name}`,
  },
  gitlab: {
    claim: () => "https://gitlab.com/users/sign_up",
    profile: (name) => `https://gitlab.com/${name}`,
  },
  npm: {
    claim: () => "https://www.npmjs.com/signup",
    profile: (name) => `https://www.npmjs.com/package/${name}`,
  },
  pypi: {
    claim: () => "https://pypi.org/account/register/",
    profile: (name) => `https://pypi.org/project/${name}`,
  },
  crates: {
    claim: () => "https://crates.io/login",
    profile: (name) => `https://crates.io/crates/${name}`,
  },
  dockerhub: {
    claim: () => "https://hub.docker.com/signup",
    profile: (name) => `https://hub.docker.com/u/${name}`,
  },
  huggingface: {
    claim: () => "https://huggingface.co/join",
    profile: (name) => `https://huggingface.co/${name}`,
  },
  nuget: {
    claim: () => "https://www.nuget.org/packages/manage/upload",
    profile: (name) => `https://www.nuget.org/packages/${name}`,
  },
  rubygems: {
    claim: () => "https://rubygems.org/sign_up",
    profile: (name) => `https://rubygems.org/gems/${name}`,
  },
  homebrew: {
    claim: () => "https://docs.brew.sh/How-To-Open-a-Homebrew-Pull-Request",
    profile: (name) => `https://formulae.brew.sh/formula/${name}`,
  },
  codepen: {
    claim: () => "https://codepen.io/accounts/signup",
    profile: (name) => `https://codepen.io/${name}`,
  },
  replit: {
    claim: () => "https://replit.com/signup",
    profile: (name) => `https://replit.com/@${name}`,
  },
  figma: {
    claim: () => "https://www.figma.com/signup",
    profile: (name) => `https://www.figma.com/@${name}`,
  },
  dribbble: {
    claim: () => "https://dribbble.com/signup/new",
    profile: (name) => `https://dribbble.com/${name}`,
  },
  behance: {
    claim: () => "https://www.behance.net/signup",
    profile: (name) => `https://www.behance.net/${name}`,
  },
  bento: {
    claim: () => "https://bento.me/en/home",
    profile: (name) => `https://bento.me/${name}`,
  },
  substack: {
    claim: () => "https://substack.com/signup",
    profile: (name) => `https://${name}.substack.com`,
  },
  producthunt: {
    claim: () => "https://www.producthunt.com/newsletters",
    profile: (name) => `https://www.producthunt.com/@${name}`,
  },
  telegram: {
    claim: () => "https://telegram.org/",
    profile: (name) => `https://t.me/${name}`,
  },
  medium: {
    claim: () => "https://medium.com/",
    profile: (name) => `https://medium.com/@${name}`,
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
