import type { ProviderId } from "../src/schemas.js";

/**
 * Display metadata for the availability matrix — ordering, grouping and
 * labels. Kept separate from the provider ids so the UI stays a dumb view
 * over the API's normalized results.
 */
export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** What the result's `subject` looks like, for tooltip/honest display. */
  hint?: string;
}

export type ProviderGroupId = "domains" | "developer" | "socials" | "community";

export interface ProviderGroup {
  id: ProviderGroupId;
  title: string;
  providers: readonly ProviderMeta[];
}

export const PROVIDER_GROUPS: readonly ProviderGroup[] = [
  {
    id: "domains",
    title: "Domains",
    providers: [
      { id: "domain:com", label: ".com" },
      { id: "domain:dev", label: ".dev" },
      { id: "domain:io", label: ".io" },
      { id: "domain:ai", label: ".ai" },
      { id: "domain:gg", label: ".gg" },
      { id: "domain:app", label: ".app" },
      { id: "domain:pt", label: ".pt" },
      { id: "domain:es", label: ".es" },
      { id: "domain:de", label: ".de" },
      { id: "domain:fr", label: ".fr" },
      { id: "domain:uk", label: ".uk" },
      { id: "domain:eu", label: ".eu" },
      { id: "domain:co", label: ".co" },
      { id: "domain:me", label: ".me" },
      { id: "domain:org", label: ".org" },
      { id: "domain:sh", label: ".sh" },
      { id: "domain:so", label: ".so" },
      { id: "domain:xyz", label: ".xyz" },
      { id: "domain:design", label: ".design" },
      { id: "domain:store", label: ".store" },
      { id: "domain:work", label: ".work" },
      { id: "domain:studio", label: ".studio" },
      { id: "domain:tech", label: ".tech" },
      { id: "domain:agency", label: ".agency" },
      { id: "domain:space", label: ".space" },
    ],
  },
  {
    id: "developer",
    title: "Developer platforms",
    providers: [
      { id: "github:user", label: "GitHub (User)" },
      { id: "github:org", label: "GitHub (Org)" },
      { id: "gitlab", label: "GitLab" },
      { id: "npm", label: "npm" },
      { id: "pypi", label: "PyPI" },
      { id: "crates", label: "crates.io" },
      { id: "dockerhub", label: "Docker Hub" },
      { id: "huggingface", label: "Hugging Face" },
      { id: "nuget", label: "NuGet" },
      { id: "rubygems", label: "RubyGems" },
      { id: "homebrew", label: "Homebrew" },
      { id: "codepen", label: "CodePen" },
      { id: "replit", label: "Replit" },
    ],
  },
  {
    id: "socials",
    title: "Social media",
    providers: [
      { id: "social:x", label: "X" },
      { id: "social:bluesky", label: "Bluesky" },
      { id: "social:instagram", label: "Instagram" },
      { id: "social:reddit", label: "Reddit" },
      { id: "social:youtube", label: "YouTube" },
      { id: "social:tiktok", label: "TikTok" },
    ],
  },
  {
    id: "community",
    title: "Creator & community",
    providers: [
      { id: "figma", label: "Figma" },
      { id: "dribbble", label: "Dribbble" },
      { id: "behance", label: "Behance" },
      { id: "substack", label: "Substack" },
      { id: "producthunt", label: "Product Hunt" },
      { id: "telegram", label: "Telegram" },
      { id: "medium", label: "Medium" },
    ],
  },
];

/** Every provider id across the four grid groups — the expected universe
 * used to count in-flight checks against. */
export const ALL_PROVIDER_IDS: readonly ProviderId[] = PROVIDER_GROUPS.flatMap((g) =>
  g.providers.map((p) => p.id),
);

/** Look up a group by id — throws for unknown ids (ids are compile-time constants). */
export function providerGroup(id: ProviderGroupId): ProviderGroup {
  const group = PROVIDER_GROUPS.find((g) => g.id === id);
  if (group === undefined) throw new Error(`unknown provider group: ${id}`);
  return group;
}
