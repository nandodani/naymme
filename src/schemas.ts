import { z } from "zod";

/** Canonical provider identifiers. */
export const PROVIDER_IDS = [
  "domain:com",
  "domain:gg",
  "domain:dev",
  "domain:io",
  "github",
  "npm",
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Convenience aliases accepted in `providers`. */
export const PROVIDER_ALIASES = ["all", "domains"] as const;
export type ProviderAlias = (typeof PROVIDER_ALIASES)[number];

export const DOMAIN_PROVIDER_IDS = [
  "domain:com",
  "domain:gg",
  "domain:dev",
  "domain:io",
] as const satisfies readonly ProviderId[];

export const providerIdSchema = z.enum(PROVIDER_IDS);
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
    "Bare name to check, e.g. 'acme'. Checked as acme.com/acme.gg/..., GitHub user 'acme', npm package 'acme'.",
  ),
  providers: z
    .array(providerSelectionSchema)
    .optional()
    .describe(
      "Providers to query. Defaults to all. Aliases: 'all' (everything), 'domains' (all four TLDs).",
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
export type ScoreNameInput = z.infer<typeof scoreNameInputSchema>;
export type ScoreNameOutput = z.infer<typeof scoreNameOutputSchema>;

/** Expand aliases and de-duplicate, preserving first-seen order. */
export function resolveProviderIds(selection?: readonly string[]): ProviderId[] {
  const source = selection && selection.length > 0 ? selection : (["all"] as const);
  const out: ProviderId[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    const ids: readonly ProviderId[] =
      item === "all"
        ? PROVIDER_IDS
        : item === "domains"
          ? DOMAIN_PROVIDER_IDS
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
