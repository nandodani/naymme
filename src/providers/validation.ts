import type { ProviderId } from "../schemas.js";
import type { ProviderOutcome } from "../types.js";

type StripDomainPrefix<P> = P extends `domain:${infer S}` ? S : never;

/** TLD suffix of every `domain:*` provider id (e.g. "com", "gg", "pt"). */
export type DomainTld = StripDomainPrefix<ProviderId>;

/**
 * One whole-name constraint a per-character charset cannot express —
 * edge characters, repeats or casing. `pattern` must match for the name
 * to be valid; `reason` is the invalid detail when it does not.
 */
export interface NameConstraint {
  readonly pattern: RegExp;
  readonly reason: string;
}

/**
 * Declarative naming rules for one provider. Every registered provider id
 * has an entry in {@link PROVIDER_NAME_RULES} — `Record<ProviderId, ...>`
 * makes missing coverage a compile-time error.
 */
export interface NameRule {
  /** Human label interpolated into invalid details, e.g. "npm package name". */
  readonly label: string;
  /** Inclusive length bounds in characters. */
  readonly minLength: number;
  readonly maxLength: number;
  /** Per-character allow set, tested one character at a time (no /g flag). */
  readonly charset: RegExp;
  /** Description of the allowed characters used in invalid details. */
  readonly charsetLabel: string;
  readonly constraints: readonly NameConstraint[];
}

const START_ALNUM: NameConstraint = {
  pattern: /^[A-Za-z0-9]/,
  reason: "must start with a letter or digit",
};
const END_ALNUM: NameConstraint = {
  pattern: /[A-Za-z0-9]$/,
  reason: "must end with a letter or digit",
};
const START_LETTER: NameConstraint = {
  pattern: /^[A-Za-z]/,
  reason: "must start with a letter",
};
const NO_DOUBLE_HYPHEN: NameConstraint = {
  pattern: /^(?!.*--)/,
  reason: "must not contain consecutive hyphens",
};
const NO_DOUBLE_DOT: NameConstraint = {
  pattern: /^(?!.*\.\.)/,
  reason: "must not contain consecutive dots",
};
const NO_DOUBLE_SEPARATOR: NameConstraint = {
  pattern: /^(?!.*[._-]{2})/,
  reason: "must not contain consecutive separators",
};
const NO_LEADING_DOT: NameConstraint = {
  pattern: /^[^.]/,
  reason: "must not start with a period",
};
const NO_TRAILING_DOT: NameConstraint = {
  pattern: /[^.]$/,
  reason: "must not end with a period",
};

/**
 * First rule violation found in `name`, as a ready-to-show reason string —
 * length bounds first, then the charset, then the whole-name constraints.
 * `null` means the name satisfies every rule.
 */
export function validateName(name: string, rule: NameRule): string | null {
  if (name.length < rule.minLength) {
    return `too short: must be at least ${rule.minLength} characters (got ${name.length})`;
  }
  if (name.length > rule.maxLength) {
    return `too long: must be at most ${rule.maxLength} characters (got ${name.length})`;
  }
  const bad = Array.from(name).find((ch) => !rule.charset.test(ch));
  if (bad !== undefined) {
    return `disallowed character '${bad}' (allowed: ${rule.charsetLabel})`;
  }
  for (const constraint of rule.constraints) {
    if (!constraint.pattern.test(name)) return constraint.reason;
  }
  return null;
}

const GENERIC_HANDLE_LABEL = "letters, digits, '.', '_' or '-'";
const UNDERSCORE_HANDLE_LABEL = "letters, digits, '_' or '-'";
const ALNUM_HYPHEN_LABEL = "letters, digits and hyphens";

const DOMAIN_LABEL_RULE: NameRule = {
  label: "domain label",
  minLength: 1,
  maxLength: 63,
  charset: /[a-z0-9-]/i,
  charsetLabel: "letters, digits and hyphens",
  constraints: [START_ALNUM, END_ALNUM],
};

/** ccTLD label minimums differ per registry — verified rules below. */
function domainLabelRule(minLength: number): NameRule {
  return { ...DOMAIN_LABEL_RULE, minLength };
}

function handleRule(
  label: string,
  minLength: number,
  maxLength: number,
  charset: RegExp,
  charsetLabel: string,
  constraints: readonly NameConstraint[] = [],
): NameRule {
  return { label, minLength, maxLength, charset, charsetLabel, constraints };
}

const SUBDOMAIN_RULE = (suffix: string): NameRule => ({
  label: `${suffix} subdomain`,
  minLength: 1,
  maxLength: 63,
  charset: /[a-z0-9-]/,
  charsetLabel: "lowercase letters, digits and hyphens",
  constraints: [START_ALNUM, END_ALNUM],
});

/**
 * Validation rules for every registered provider. Bounds and charsets
 * follow each platform's documented naming policy; constraints cover the
 * rules a charset cannot express (edge characters, repeats, letter-only
 * starts).
 */
export const PROVIDER_NAME_RULES: Readonly<Record<ProviderId, NameRule>> = {
  // Domains — label rules; registries with stricter minimums differ.
  "domain:com": DOMAIN_LABEL_RULE,
  "domain:gg": DOMAIN_LABEL_RULE,
  "domain:dev": DOMAIN_LABEL_RULE,
  "domain:io": DOMAIN_LABEL_RULE,
  "domain:ai": DOMAIN_LABEL_RULE,
  "domain:app": DOMAIN_LABEL_RULE,
  "domain:pt": domainLabelRule(2), // dominios.pt: 2-63 chars
  "domain:es": domainLabelRule(3), // dominios.es: 3-63 chars at 2nd level
  "domain:de": DOMAIN_LABEL_RULE,
  "domain:fr": DOMAIN_LABEL_RULE,
  "domain:uk": DOMAIN_LABEL_RULE,
  "domain:eu": domainLabelRule(2), // EURid: 2-63 chars
  "domain:co": DOMAIN_LABEL_RULE,
  "domain:me": domainLabelRule(3), // doMEn: 3-63 chars at 2nd level
  "domain:org": DOMAIN_LABEL_RULE,
  "domain:sh": DOMAIN_LABEL_RULE,
  "domain:so": DOMAIN_LABEL_RULE,
  "domain:xyz": DOMAIN_LABEL_RULE,
  "domain:design": DOMAIN_LABEL_RULE,
  "domain:store": DOMAIN_LABEL_RULE,
  "domain:work": DOMAIN_LABEL_RULE,
  "domain:studio": DOMAIN_LABEL_RULE,
  "domain:tech": DOMAIN_LABEL_RULE,
  "domain:agency": DOMAIN_LABEL_RULE,
  "domain:space": DOMAIN_LABEL_RULE,
  "github:user": handleRule("GitHub name", 1, 39, /[A-Za-z0-9-]/, ALNUM_HYPHEN_LABEL, [
    START_ALNUM,
    END_ALNUM,
    NO_DOUBLE_HYPHEN,
  ]),
  "github:org": handleRule("GitHub name", 1, 39, /[A-Za-z0-9-]/, ALNUM_HYPHEN_LABEL, [
    START_ALNUM,
    END_ALNUM,
    NO_DOUBLE_HYPHEN,
  ]),
  "github:repo": handleRule(
    "GitHub repository name",
    1,
    100,
    /[A-Za-z0-9._-]/,
    GENERIC_HANDLE_LABEL,
    [START_ALNUM],
  ),
  gitlab: handleRule("GitLab path", 2, 255, /[A-Za-z0-9._-]/, GENERIC_HANDLE_LABEL, [
    { pattern: /^[A-Za-z0-9_]/, reason: "must not start with a separator" },
    { pattern: /[A-Za-z0-9_-]$/, reason: "must not end with a period" },
  ]),
  npm: handleRule(
    "npm package name",
    1,
    214,
    /[a-z0-9._-]/,
    "lowercase letters, digits, '.', '_' or '-'",
    [{ pattern: /^[a-z0-9]/, reason: "must not start with a period or underscore" }],
  ),
  pypi: handleRule("PyPI name", 1, 255, /[A-Za-z0-9._-]/, GENERIC_HANDLE_LABEL, [
    START_ALNUM,
    END_ALNUM,
  ]),
  crates: handleRule("crates.io name", 1, 64, /[A-Za-z0-9_-]/, UNDERSCORE_HANDLE_LABEL, [
    START_LETTER,
  ]),
  dockerhub: handleRule(
    "Docker Hub namespace",
    4,
    30,
    /[a-z0-9._-]/,
    "lowercase letters, digits, '.', '_' or '-'",
    [START_ALNUM, END_ALNUM, NO_DOUBLE_SEPARATOR],
  ),
  huggingface: handleRule("Hugging Face name", 2, 64, /[A-Za-z0-9_-]/, UNDERSCORE_HANDLE_LABEL, [
    START_ALNUM,
  ]),
  nuget: handleRule("NuGet package id", 1, 128, /[A-Za-z0-9._-]/, GENERIC_HANDLE_LABEL, [
    START_ALNUM,
  ]),
  rubygems: handleRule(
    "RubyGems name",
    1,
    128,
    /[a-z0-9_-]/,
    "lowercase letters, digits, '_' or '-'",
    [START_LETTER],
  ),
  homebrew: handleRule(
    "Homebrew formula name",
    1,
    64,
    /[a-z0-9-]/,
    "lowercase letters, digits and hyphens",
    [START_ALNUM],
  ),
  codepen: handleRule("CodePen username", 1, 30, /[A-Za-z0-9_-]/, UNDERSCORE_HANDLE_LABEL),
  replit: handleRule("Replit username", 2, 64, /[A-Za-z0-9_-]/, UNDERSCORE_HANDLE_LABEL),
  vercel: SUBDOMAIN_RULE("vercel.app"),
  netlify: SUBDOMAIN_RULE("netlify.app"),
  cloudflare: SUBDOMAIN_RULE("pages.dev"),
  flyio: SUBDOMAIN_RULE("fly.dev"),
  railway: SUBDOMAIN_RULE("up.railway.app"),
  supabase: SUBDOMAIN_RULE("supabase.co"),
  appstore: handleRule(
    "App Store app name",
    2,
    30,
    /[A-Za-z0-9 ._!?&+'"(),:;@#%&*-]/,
    "alphanumeric characters and standard punctuation",
  ),
  figma: handleRule("Figma handle", 1, 50, /[A-Za-z0-9_-]/, UNDERSCORE_HANDLE_LABEL, [START_ALNUM]),
  dribbble: handleRule("Dribbble username", 1, 30, /[A-Za-z0-9_-]/, UNDERSCORE_HANDLE_LABEL, [
    START_ALNUM,
  ]),
  behance: handleRule("Behance username", 3, 30, /[A-Za-z0-9_-]/, UNDERSCORE_HANDLE_LABEL, [
    START_ALNUM,
  ]),
  substack: handleRule("Substack subdomain", 1, 63, /[A-Za-z0-9-]/, ALNUM_HYPHEN_LABEL, [
    START_ALNUM,
    END_ALNUM,
  ]),
  producthunt: handleRule("Product Hunt username", 2, 30, /[A-Za-z0-9_-]/, UNDERSCORE_HANDLE_LABEL),
  telegram: handleRule(
    "Telegram handle",
    5,
    32,
    /[A-Za-z0-9_]/,
    "letters, digits and underscores",
    [START_LETTER],
  ),
  medium: handleRule("Medium username", 3, 30, /[A-Za-z0-9._-]/, GENERIC_HANDLE_LABEL, [
    START_ALNUM,
  ]),
  "social:x": handleRule("X handle", 4, 15, /[A-Za-z0-9_]/, "letters, digits and underscores"),
  "social:bluesky": handleRule("Bluesky handle", 3, 20, /[A-Za-z0-9-]/, ALNUM_HYPHEN_LABEL, [
    START_ALNUM,
    END_ALNUM,
  ]),
  "social:instagram": handleRule(
    "Instagram handle",
    1,
    30,
    /[a-z0-9._]/i,
    "letters, digits, '.' or '_'",
    [NO_LEADING_DOT, NO_TRAILING_DOT, NO_DOUBLE_DOT],
  ),
  "social:reddit": handleRule("Reddit username", 3, 20, /[A-Za-z0-9_-]/, UNDERSCORE_HANDLE_LABEL),
  "social:youtube": handleRule("YouTube handle", 3, 30, /[A-Za-z0-9._-]/, GENERIC_HANDLE_LABEL),
  "social:tiktok": handleRule("TikTok handle", 2, 24, /[a-z0-9._]/i, "letters, digits, '.' or '_'"),
};

/**
 * Validate `name` against the provider's registered rule. Returns a
 * ready-made `invalid` outcome — status `invalid`, `available: false` and
 * a detail naming the violated rule — or `null` when the name passes and
 * the adapter should proceed to its availability check.
 */
export function invalidOutcome(
  providerId: ProviderId,
  name: string,
  subject: string = name,
): ProviderOutcome | null {
  const rule = PROVIDER_NAME_RULES[providerId];
  const reason = validateName(name, rule);
  if (reason === null) return null;
  return {
    status: "invalid",
    subject,
    available: false,
    detail: `not a valid ${rule.label}: ${reason}`,
  };
}
