import type { ProviderDeps } from "../deps.js";
import type { ProviderId } from "../schemas.js";
import { readTextCapped } from "../security.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";
import { invalidOutcome } from "./validation.js";

/**
 * Extended platform checks: dev/AI registries, design & creator profiles
 * and community audiences. Every adapter only claims `available`/`taken`
 * on status codes it has verified mean that — bot walls (403), redirects
 * and every other response report `unknown`, never availability.
 */

function unknown(subject: string, detail: string): ProviderOutcome {
  return { status: "unknown", subject, available: null, detail };
}

function taken(subject: string, detail: string): ProviderOutcome {
  return { status: "taken", subject, available: false, detail };
}

function available(subject: string, detail: string): ProviderOutcome {
  return { status: "available", subject, available: true, detail };
}

/** fetch wrapper: network failures → null, aborts propagate to the runner. */
async function safeFetch(
  deps: ProviderDeps,
  url: string,
  signal: AbortSignal,
  headers: Record<string, string> = {},
): Promise<Response | null> {
  try {
    return await deps.fetch(url, {
      signal,
      headers: { "user-agent": deps.userAgent, ...headers },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return null;
  }
}

interface PageCheckSpec {
  id: ProviderId;
  /** Request URL — used verbatim so subjects like `acme.substack.com` work. */
  url: (name: string) => string;
  /** The reported subject (usually the checked name or handle). */
  subject?: (name: string) => string;
  /** Stable link shown for a taken/available subject. */
  profile: (name: string) => string;
  /**
   * `free`/`busy` HTTP statuses. `busyOnly` marks endpoints whose 404 is
   * ambiguous (bot-blocked or SPA shells) — only a 200 proves the profile
   * exists, everything else is `unknown`.
   */
  free?: readonly number[];
  busy?: readonly number[];
  accept?: string;
  /** Extra rule on a 200 body — `false` downgrades 200 to `available`. */
  bodyMeansTaken?: (body: string) => boolean;
}

function createPageCheck(deps: ProviderDeps, spec: PageCheckSpec): ProviderAdapter {
  const free = spec.free ?? [404];
  const busy = spec.busy ?? [200];
  return {
    id: spec.id,
    async check(name, signal): Promise<ProviderOutcome> {
      const invalid = invalidOutcome(spec.id, name, spec.subject ? spec.subject(name) : name);
      if (invalid !== null) return invalid;
      const subject = spec.subject ? spec.subject(name) : name;
      const res = await safeFetch(deps, spec.url(name), signal, {
        accept: spec.accept ?? "text/html",
      });
      if (!res) return unknown(subject, "request failed");
      if (busy.includes(res.status)) {
        if (spec.bodyMeansTaken !== undefined) {
          const body = await readTextCapped(res).catch(() => "");
          return spec.bodyMeansTaken(body)
            ? taken(subject, spec.profile(name))
            : available(subject, spec.profile(name));
        }
        return taken(subject, spec.profile(name));
      }
      if (free.includes(res.status)) {
        return available(subject, spec.profile(name));
      }
      return unknown(subject, `${spec.id} returned HTTP ${res.status}`);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Dev & AI ecosystem                                                  */
/* ------------------------------------------------------------------ */

/** Hugging Face org/user check via the public profile page: verified
 * 200 → taken, 404 → available. */
export function createHuggingFaceAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "huggingface",
    url: (n) => `https://huggingface.co/${encodeURIComponent(n)}`,
    profile: (n) => `https://huggingface.co/${n}`,
  });
}

/** NuGet package check via the flat-container registration index: verified
 * 200 → taken, 404 → available. Ids are case-insensitive. */
export function createNuGetAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "nuget",
    url: (n) =>
      `https://api.nuget.org/v3-flatcontainer/${encodeURIComponent(n.toLowerCase())}/index.json`,
    profile: (n) => `https://www.nuget.org/packages/${n.toLowerCase()}`,
    accept: "application/json",
  });
}

/** RubyGems check via `rubygems.org/api/v1/gems/{name}.json`: verified
 * 200 → taken, 404 → available. Gem names are lowercase. */
export function createRubyGemsAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "rubygems",
    url: (n) => `https://rubygems.org/api/v1/gems/${encodeURIComponent(n)}.json`,
    profile: (n) => `https://rubygems.org/gems/${n}`,
    accept: "application/json",
  });
}

/** Homebrew formula check via `formulae.brew.sh/api/formula/{name}.json`:
 * verified 200 → taken, 404 → available. Formula names are lowercase. */
export function createHomebrewAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "homebrew",
    url: (n) => `https://formulae.brew.sh/api/formula/${encodeURIComponent(n)}.json`,
    profile: (n) => `https://formulae.brew.sh/formula/${n}`,
    accept: "application/json",
  });
}

/** CodePen profile check via `codepen.io/{name}`: 200 → taken,
 * 404 → available. The endpoint sits behind a bot wall (403 for
 * non-browser clients), which reports `unknown` rather than faking a
 * verdict. */
export function createCodePenAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "codepen",
    url: (n) => `https://codepen.io/${encodeURIComponent(n)}`,
    profile: (n) => `https://codepen.io/${n}`,
  });
}

/** Replit profile check via `replit.com/@{name}`. The SPA answers a
 * generic 404 shell for both existing and missing usernames, so only a
 * 200 proves the profile is taken — everything else stays `unknown`
 * (availability is never fabricated). */
export function createReplitAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "replit",
    url: (n) => `https://replit.com/@${encodeURIComponent(n)}`,
    profile: (n) => `https://replit.com/@${n}`,
    free: [],
    busy: [200],
  });
}

/* ------------------------------------------------------------------ */
/* Design & creator platforms                                          */
/* ------------------------------------------------------------------ */

/** Figma profile check via `figma.com/@{name}`: verified 200 → taken,
 * 404 → available. */
export function createFigmaAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "figma",
    url: (n) => `https://www.figma.com/@${encodeURIComponent(n)}`,
    profile: (n) => `https://www.figma.com/@${n}`,
  });
}

/** Dribbble profile check via `dribbble.com/{name}`: verified 200 →
 * taken, 404 → available. */
export function createDribbbleAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "dribbble",
    url: (n) => `https://dribbble.com/${encodeURIComponent(n)}`,
    profile: (n) => `https://dribbble.com/${n}`,
  });
}

/** Behance profile check via `behance.net/{name}`: verified 200 → taken,
 * 404 → available. */
export function createBehanceAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "behance",
    url: (n) => `https://www.behance.net/${encodeURIComponent(n)}`,
    profile: (n) => `https://www.behance.net/${n}`,
  });
}

/* ------------------------------------------------------------------ */
/* Audience & community                                                */
/* ------------------------------------------------------------------ */

/** Substack publication check via `{name}.substack.com`: verified 200 →
 * taken, 404 → available (Substack serves a real 404 for absent
 * publications). */
export function createSubstackAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "substack",
    url: (n) => `https://${encodeURIComponent(n)}.substack.com`,
    subject: (n) => `${n}.substack.com`,
    profile: (n) => `https://${n}.substack.com`,
  });
}

/** Product Hunt profile check via `producthunt.com/@{name}`: 200 →
 * taken, 404 → available. The site is Cloudflare-walled for non-browser
 * clients (403), which reports `unknown`. */
export function createProductHuntAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "producthunt",
    url: (n) => `https://www.producthunt.com/@${encodeURIComponent(n)}`,
    profile: (n) => `https://www.producthunt.com/@${n}`,
  });
}

/** Telegram public handle check via `t.me/{name}`: the page always answers
 * 200, so the marker `tgme_page_title` decides — present → taken, absent
 * → available. Non-200 responses report `unknown`. */
export function createTelegramAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "telegram",
    url: (n) => `https://t.me/${encodeURIComponent(n)}`,
    subject: (n) => `@${n}`,
    profile: (n) => `https://t.me/${n}`,
    bodyMeansTaken: (body) => body.includes("tgme_page_title"),
  });
}

/** Medium profile check via the public RSS feed `medium.com/feed/@{name}`:
 * verified 200 → taken, 404 → available (the profile page itself is
 * bot-walled, the feed is not). */
export function createMediumAdapter(deps: ProviderDeps): ProviderAdapter {
  return createPageCheck(deps, {
    id: "medium",
    url: (n) => `https://medium.com/feed/@${encodeURIComponent(n)}`,
    subject: (n) => `@${n}`,
    profile: (n) => `https://medium.com/@${n}`,
    accept: "application/rss+xml",
  });
}
