import type { ProviderId } from "../src/schemas.js";

/**
 * Display metadata for the availability grid — ordering, grouping and
 * labels. Kept separate from the provider ids so the UI stays a dumb view
 * over the API's normalized results.
 */
export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** What the result's `subject` looks like, for tooltip/honest display. */
  hint?: string;
}

export interface ProviderGroup {
  title: string;
  providers: readonly ProviderMeta[];
}

export const PROVIDER_GROUPS: readonly ProviderGroup[] = [
  {
    title: "Domains",
    providers: [
      { id: "domain:com", label: ".com" },
      { id: "domain:dev", label: ".dev" },
      { id: "domain:io", label: ".io" },
      { id: "domain:gg", label: ".gg" },
      { id: "domain:app", label: ".app" },
      { id: "domain:pt", label: ".pt" },
      { id: "domain:es", label: ".es" },
      { id: "domain:de", label: ".de" },
      { id: "domain:fr", label: ".fr" },
      { id: "domain:uk", label: ".uk" },
      { id: "domain:eu", label: ".eu" },
    ],
  },
  {
    title: "Developer",
    providers: [
      { id: "github", label: "GitHub" },
      { id: "npm", label: "npm" },
    ],
  },
  {
    title: "Socials",
    providers: [
      { id: "social:x", label: "X" },
      { id: "social:bluesky", label: "Bluesky" },
      { id: "social:instagram", label: "Instagram" },
      { id: "social:reddit", label: "Reddit" },
      { id: "social:youtube", label: "YouTube" },
      { id: "social:tiktok", label: "TikTok" },
    ],
  },
];
