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

export type RegistrarId =
  | "porkbun"
  | "cloudflare"
  | "namecheap"
  | "godaddy"
  | "vercel"
  | "spaceship"
  | "dynadot"
  | "gandi"
  | "hover";

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
  {
    id: "vercel",
    label: "Vercel",
    searchUrl: (domain) => `https://vercel.com/domains?query=${encodeURIComponent(domain)}`,
  },
  {
    id: "spaceship",
    label: "Spaceship",
    searchUrl: (domain) =>
      `https://www.spaceship.com/domain-search/?query=${encodeURIComponent(domain)}`,
  },
  {
    id: "dynadot",
    label: "Dynadot",
    searchUrl: (domain) =>
      `https://www.dynadot.com/domain/search.html?domain=${encodeURIComponent(domain)}`,
  },
  {
    id: "gandi",
    label: "Gandi",
    searchUrl: (domain) =>
      `https://shop.gandi.net/en/domain/suggest?search=${encodeURIComponent(domain)}`,
  },
  {
    id: "hover",
    label: "Hover",
    searchUrl: (domain) => `https://www.hover.com/domains/results?q=${encodeURIComponent(domain)}`,
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
  "domain:com": {
    porkbun: 11,
    cloudflare: 10,
    namecheap: 11,
    godaddy: 13,
    vercel: 20,
    spaceship: 10,
    dynadot: 10,
    gandi: 16,
    hover: 15,
  },
  "domain:dev": {
    porkbun: 12,
    cloudflare: 13,
    namecheap: 13,
    godaddy: 17,
    vercel: 20,
    spaceship: 11,
    dynadot: 12,
    gandi: 15,
    hover: 15,
  },
  "domain:io": {
    porkbun: 34,
    cloudflare: null,
    namecheap: 33,
    godaddy: 45,
    vercel: 65,
    spaceship: 45,
    dynadot: 50,
    gandi: 45,
    hover: 50,
  },
  "domain:ai": {
    porkbun: 68,
    cloudflare: null,
    namecheap: 68,
    godaddy: 100,
    vercel: null,
    spaceship: 70,
    dynadot: 65,
    gandi: 95,
    hover: 115,
  },
  "domain:gg": {
    porkbun: 68,
    cloudflare: null,
    namecheap: 70,
    godaddy: 90,
    vercel: null,
    spaceship: 70,
    dynadot: 75,
    gandi: 85,
    hover: 90,
  },
  "domain:app": {
    porkbun: 14,
    cloudflare: 15,
    namecheap: 13,
    godaddy: 20,
    vercel: 14,
    spaceship: 13,
    dynadot: 13,
    gandi: 18,
    hover: 19,
  },
  "domain:pt": {
    porkbun: 12,
    cloudflare: null,
    namecheap: 14,
    godaddy: 25,
    vercel: null,
    spaceship: 15,
    dynadot: 20,
    gandi: 25,
    hover: 30,
  },
  "domain:es": {
    porkbun: 9,
    cloudflare: null,
    namecheap: 10,
    godaddy: 12,
    vercel: null,
    spaceship: 10,
    dynadot: 12,
    gandi: 14,
    hover: 15,
  },
  "domain:de": {
    porkbun: 8,
    cloudflare: null,
    namecheap: 9,
    godaddy: 10,
    vercel: null,
    spaceship: 8,
    dynadot: 9,
    gandi: 10,
    hover: 12,
  },
  "domain:fr": {
    porkbun: 10,
    cloudflare: null,
    namecheap: 12,
    godaddy: 13,
    vercel: null,
    spaceship: 10,
    dynadot: 12,
    gandi: 12,
    hover: 15,
  },
  "domain:uk": {
    porkbun: 8,
    cloudflare: null,
    namecheap: 9,
    godaddy: 10,
    vercel: null,
    spaceship: 8,
    dynadot: 9,
    gandi: 9,
    hover: 11,
  },
  "domain:eu": {
    porkbun: 9,
    cloudflare: null,
    namecheap: 9,
    godaddy: 10,
    vercel: null,
    spaceship: 9,
    dynadot: 9,
    gandi: 10,
    hover: 12,
  },
  "domain:co": {
    porkbun: 12,
    cloudflare: 12,
    namecheap: 12,
    godaddy: 15,
    vercel: null,
    spaceship: 12,
    dynadot: 15,
    gandi: 25,
    hover: 25,
  },
  "domain:me": {
    porkbun: 13,
    cloudflare: 12,
    namecheap: 10,
    godaddy: 14,
    vercel: null,
    spaceship: 10,
    dynadot: 9,
    gandi: 15,
    hover: 20,
  },
  "domain:org": {
    porkbun: 10,
    cloudflare: 11,
    namecheap: 8,
    godaddy: 10,
    vercel: 20,
    spaceship: 9,
    dynadot: 10,
    gandi: 17,
    hover: 16,
  },
  "domain:sh": {
    porkbun: 45,
    cloudflare: null,
    namecheap: 50,
    godaddy: 80,
    vercel: null,
    spaceship: 40,
    dynadot: 55,
    gandi: 75,
    hover: 80,
  },
  "domain:so": {
    porkbun: 60,
    cloudflare: null,
    namecheap: 60,
    godaddy: 90,
    vercel: null,
    spaceship: 45,
    dynadot: 50,
    gandi: 80,
    hover: 85,
  },
  "domain:xyz": {
    porkbun: 10,
    cloudflare: 12,
    namecheap: 10,
    godaddy: 13,
    vercel: 15,
    spaceship: 2,
    dynadot: 3,
    gandi: 16,
    hover: 15,
  },
  "domain:design": {
    porkbun: 35,
    cloudflare: 36,
    namecheap: 38,
    godaddy: 40,
    vercel: null,
    spaceship: 35,
    dynadot: 36,
    gandi: 45,
    hover: 50,
  },
  "domain:store": {
    porkbun: 6,
    cloudflare: 9,
    namecheap: 6,
    godaddy: 10,
    vercel: null,
    spaceship: 5,
    dynadot: 7,
    gandi: 10,
    hover: 10,
  },
  "domain:work": {
    porkbun: 7,
    cloudflare: 7,
    namecheap: 7,
    godaddy: 9,
    vercel: null,
    spaceship: 5,
    dynadot: 5,
    gandi: 9,
    hover: 8,
  },
  "domain:studio": {
    porkbun: 23,
    cloudflare: 22,
    namecheap: 20,
    godaddy: 25,
    vercel: null,
    spaceship: 20,
    dynadot: 20,
    gandi: 30,
    hover: 30,
  },
  "domain:tech": {
    porkbun: 45,
    cloudflare: 48,
    namecheap: 40,
    godaddy: 60,
    vercel: null,
    spaceship: 40,
    dynadot: 45,
    gandi: 60,
    hover: 65,
  },
  "domain:agency": {
    porkbun: 7,
    cloudflare: 8,
    namecheap: 6,
    godaddy: 9,
    vercel: null,
    spaceship: 5,
    dynadot: 5,
    gandi: 10,
    hover: 10,
  },
  "domain:space": {
    porkbun: 7,
    cloudflare: 8,
    namecheap: 6,
    godaddy: 9,
    vercel: null,
    spaceship: 4,
    dynadot: 5,
    gandi: 9,
    hover: 10,
  },
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
  "github:repo": {
    claim: () => "https://github.com/new",
    profile: (name) =>
      `https://github.com/search?q=${encodeURIComponent(`${name} in:name`)}&type=repositories`,
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
  vercel: {
    claim: () => "https://vercel.com/new",
    profile: (name) => `https://${name}.vercel.app`,
  },
  netlify: {
    claim: () => "https://app.netlify.com/start",
    profile: (name) => `https://${name}.netlify.app`,
  },
  cloudflare: {
    claim: () => "https://dash.cloudflare.com/sign-up?to=/:account/pages",
    profile: (name) => `https://${name}.pages.dev`,
  },
  flyio: {
    claim: () => "https://fly.io/app/sign-up",
    profile: (name) => `https://${name}.fly.dev`,
  },
  railway: {
    claim: () => "https://railway.com/new",
    profile: (name) => `https://${name}.up.railway.app`,
  },
  supabase: {
    claim: () => "https://supabase.com/dashboard/sign-up",
    profile: (name) => `https://${name}.supabase.co`,
  },
  appstore: {
    claim: () => "https://developer.apple.com/",
    profile: (name) => `https://apps.apple.com/us/search?term=${encodeURIComponent(name)}`,
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
