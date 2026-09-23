import { z } from "zod";

/** Canonical provider identifiers. */
export const PROVIDER_IDS = [
  "domain:com",
  "domain:gg",
  "domain:dev",
  "domain:io",
  "domain:ai",
  "domain:app",
  "domain:pt",
  "domain:es",
  "domain:de",
  "domain:fr",
  "domain:uk",
  "domain:eu",
  "domain:co",
  "domain:me",
  "domain:org",
  "domain:sh",
  "domain:so",
  "domain:xyz",
  "domain:design",
  "domain:store",
  "domain:work",
  "domain:studio",
  "domain:tech",
  "domain:agency",
  "domain:space",
  "github:user",
  "github:org",
  "github:repo",
  "gitlab",
  "npm",
  "pypi",
  "crates",
  "dockerhub",
  "huggingface",
  "nuget",
  "rubygems",
  "homebrew",
  "codepen",
  "replit",
  "vercel",
  "netlify",
  "appstore",
  "figma",
  "dribbble",
  "behance",
  "substack",
  "producthunt",
  "telegram",
  "medium",
  "social:x",
  "social:bluesky",
  "social:instagram",
  "social:reddit",
  "social:youtube",
  "social:tiktok",
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Convenience aliases accepted in `providers`. */
export const PROVIDER_ALIASES = [
  "all",
  "domains",
  "domains:cctld",
  "domains:all",
  "socials",
] as const;
export type ProviderAlias = (typeof PROVIDER_ALIASES)[number];

/** The original four TLDs covered by the `domains` alias. */
export const DOMAIN_PROVIDER_IDS = [
  "domain:com",
  "domain:gg",
  "domain:dev",
  "domain:io",
] as const satisfies readonly ProviderId[];

/** Country-code TLD providers covered by the `domains:cctld` alias. */
export const DOMAIN_CCTLD_PROVIDER_IDS = [
  "domain:gg",
  "domain:io",
  "domain:pt",
  "domain:es",
  "domain:de",
  "domain:fr",
  "domain:uk",
  "domain:eu",
  "domain:co",
  "domain:me",
  "domain:sh",
  "domain:so",
] as const satisfies readonly ProviderId[];

/** Every domain provider, covered by the `domains:all` alias. */
export const DOMAIN_ALL_PROVIDER_IDS = [
  "domain:com",
  "domain:gg",
  "domain:dev",
  "domain:io",
  "domain:ai",
  "domain:app",
  "domain:pt",
  "domain:es",
  "domain:de",
  "domain:fr",
  "domain:uk",
  "domain:eu",
  "domain:co",
  "domain:me",
  "domain:org",
  "domain:sh",
  "domain:so",
  "domain:xyz",
  "domain:design",
  "domain:store",
  "domain:work",
  "domain:studio",
  "domain:tech",
  "domain:agency",
  "domain:space",
] as const satisfies readonly ProviderId[];

/** Social-media handle providers covered by the `socials` alias. */
export const SOCIAL_PROVIDER_IDS = [
  "social:x",
  "social:bluesky",
  "social:instagram",
  "social:reddit",
  "social:youtube",
  "social:tiktok",
] as const satisfies readonly ProviderId[];

/** @public */ export const providerIdSchema = z.enum(PROVIDER_IDS);
export const providerSelectionSchema = z.enum([...PROVIDER_IDS, ...PROVIDER_ALIASES]);

/**
 * The bare candidate name (no TLD, no scope, no spaces). Kept intentionally
 * permissive — each provider applies its own stricter rules and reports
 * `invalid` when the name cannot exist on it (e.g. uppercase on npm).
 */
export const nameSchema = z
  .string()
  .trim()
  .min(1, "name must not be empty")
  .max(63, "name must be at most 63 characters")
  .regex(
    /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62})$/,
    "name must start with a letter or digit and contain only letters, digits, dots, hyphens or underscores",
  );

export const checkAvailabilityInputSchema = z.object({
  name: nameSchema.describe(
    "Bare name to check, e.g. 'acme'. Checked as acme.com/acme.app/..., GitHub user/org 'acme' plus repository-name collisions, GitLab, npm/PyPI/crates.io/Docker Hub, Hugging Face, NuGet, RubyGems, Homebrew, CodePen, Replit, acme.vercel.app, acme.netlify.app, the Apple App Store, Figma, Dribbble, Behance, Substack, Product Hunt, Telegram, Medium and social handle 'acme'.",
  ),
  providers: z
    .array(providerSelectionSchema)
    // 60 ids + 5 aliases; anything longer is redundant — cap it.
    .max(65)
    .optional()
    .describe(
      "Providers to query. Defaults to all. Aliases: 'all' (everything), 'domains' (.com/.gg/.dev/.io), 'domains:all' (every TLD), 'domains:cctld' (ccTLDs), 'socials' (all social handles).",
    ),
});

export const availabilityStatusSchema = z.enum(["available", "taken", "unknown", "invalid"]);

export const availabilityResultSchema = z.object({
  provider: z.string(),
  status: availabilityStatusSchema,
  subject: z.string(),
  available: z.boolean().nullable(),
  detail: z.string().optional(),
  durationMs: z.number(),
});

export const checkAvailabilityOutputSchema = z.object({
  name: z.string(),
  results: z.array(availabilityResultSchema),
  summary: z.object({
    available: z.number(),
    taken: z.number(),
    unknown: z.number(),
    invalid: z.number(),
  }),
});

export const scoreNameInputSchema = z.object({
  name: nameSchema.describe("Name to score for brand quality."),
});

export const scoreComponentSchema = z.object({
  value: z.number(),
  max: z.number(),
  detail: z.string(),
});

export const scoreNameOutputSchema = z.object({
  name: z.string(),
  normalized: z.string(),
  punchiness: scoreComponentSchema,
  syllables: z.object({
    count: z.number(),
    value: z.number(),
    max: z.number(),
    detail: z.string(),
  }),
  pronounceability: scoreComponentSchema,
  uniqueness: scoreComponentSchema,
  cleanliness: scoreComponentSchema,
  total: z.number().describe("Brand rating 0-100, sum of components."),
  grade: z.enum(["Excellent", "Strong", "Fair", "Weak", "Poor"]),
});

export type CheckAvailabilityInput = z.infer<typeof checkAvailabilityInputSchema>;
export type CheckAvailabilityOutput = z.infer<typeof checkAvailabilityOutputSchema>;
/** @public */ export type ScoreNameInput = z.infer<typeof scoreNameInputSchema>;
/** @public */ export type ScoreNameOutput = z.infer<typeof scoreNameOutputSchema>;

const ALIAS_EXPANSIONS: Record<ProviderAlias, readonly ProviderId[]> = {
  all: PROVIDER_IDS,
  domains: DOMAIN_PROVIDER_IDS,
  "domains:cctld": DOMAIN_CCTLD_PROVIDER_IDS,
  "domains:all": DOMAIN_ALL_PROVIDER_IDS,
  socials: SOCIAL_PROVIDER_IDS,
};

function isAlias(item: string): item is ProviderAlias {
  return (PROVIDER_ALIASES as readonly string[]).includes(item);
}

/** Expand aliases and de-duplicate, preserving first-seen order. */
export function resolveProviderIds(selection?: readonly string[]): ProviderId[] {
  const source = selection && selection.length > 0 ? selection : (["all"] as const);
  const out: ProviderId[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    const ids: readonly ProviderId[] = isAlias(item)
      ? ALIAS_EXPANSIONS[item]
      : [item as ProviderId];
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}
