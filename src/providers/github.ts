import type { ProviderDeps } from "../deps.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";

/**
 * GitHub login rules: ≤39 chars, alphanumeric and single hyphens, may not
 * start or end with a hyphen. Usernames and organization names share one
 * namespace, so `GET /users/{name}` covers both — the `type` field in the
 * response says which of the two actually holds the name.
 */
const GITHUB_LOGIN = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/;

export type GitHubLookup =
  { kind: "absent" } | { kind: "user" | "org"; url: string } | { kind: "unknown"; detail: string };

/**
 * Memoized `/users/{name}` lookup shared by the user and org adapters so one
 * search costs a single GitHub API call (unauthenticated limit: 60 req/h).
 * Entries evict on rejection so a failed lookup can be retried.
 */
export function createGitHubLookup(deps: ProviderDeps) {
  const cache = new Map<string, Promise<GitHubLookup>>();
  return function lookup(name: string, signal: AbortSignal): Promise<GitHubLookup> {
    const cached = cache.get(name);
    if (cached !== undefined) return cached;
    const url = `${deps.githubApiBase}/users/${encodeURIComponent(name)}`;
    const promise = (async (): Promise<GitHubLookup> => {
      let res: Response;
      try {
        res = await deps.fetch(url, {
          signal,
          headers: {
            accept: "application/vnd.github+json",
            "user-agent": deps.userAgent,
          },
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        return { kind: "unknown", detail: "request failed" };
      }
      if (res.status === 404) return { kind: "absent" };
      if (res.status === 200) {
        const body = (await res.json().catch(() => null)) as { type?: unknown } | null;
        const kind = body?.type === "Organization" ? "org" : "user";
        return { kind, url };
      }
      return {
        kind: "unknown",
        detail:
          res.status === 403
            ? "GitHub API rate limit or forbidden (unauthenticated limit is 60 req/h per IP)"
            : `GitHub API returned HTTP ${res.status}`,
      };
    })();
    cache.set(name, promise);
    promise.catch(() => cache.delete(name));
    return promise;
  };
}

function invalidName(name: string): ProviderOutcome {
  return {
    status: "invalid",
    subject: name,
    available: false,
    detail:
      "not a valid GitHub name (≤39 chars, letters/digits/single hyphens, no leading/trailing hyphen)",
  };
}

/** Personal-account check — the name is unusable when anything holds it. */
export function createGitHubUserAdapter(
  lookup: ReturnType<typeof createGitHubLookup>,
): ProviderAdapter {
  return {
    id: "github:user",
    async check(name, signal): Promise<ProviderOutcome> {
      if (!GITHUB_LOGIN.test(name)) return invalidName(name);
      const hit = await lookup(name, signal);
      if (hit.kind === "absent") {
        return {
          status: "available",
          subject: name,
          available: true,
          detail: `https://github.com/${name} is free for a personal account`,
        };
      }
      if (hit.kind === "unknown") {
        return { status: "unknown", subject: name, available: null, detail: hit.detail };
      }
      return {
        status: "taken",
        subject: name,
        available: false,
        detail:
          hit.kind === "org"
            ? `${hit.url} — held by an organization`
            : `${hit.url} — held by a personal account`,
      };
    },
  };
}

/** Organization check — org names share the user namespace on GitHub. */
export function createGitHubOrgAdapter(
  lookup: ReturnType<typeof createGitHubLookup>,
): ProviderAdapter {
  return {
    id: "github:org",
    async check(name, signal): Promise<ProviderOutcome> {
      if (!GITHUB_LOGIN.test(name)) return invalidName(name);
      const hit = await lookup(name, signal);
      if (hit.kind === "absent") {
        return {
          status: "available",
          subject: name,
          available: true,
          detail: `https://github.com/${name} is free — create the org at github.com/account/organizations/new`,
        };
      }
      if (hit.kind === "unknown") {
        return { status: "unknown", subject: name, available: null, detail: hit.detail };
      }
      return {
        status: "taken",
        subject: name,
        available: false,
        detail:
          hit.kind === "org"
            ? `${hit.url} — held by an organization`
            : `${hit.url} — held by a personal account`,
      };
    },
  };
}
