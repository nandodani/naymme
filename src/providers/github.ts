import type { ProviderDeps } from "../deps.js";
import { readJsonCapped } from "../security.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";
import { invalidOutcome } from "./validation.js";

/**
 * GitHub login rules (≤39 chars, letters/digits/hyphens, no edge or
 * consecutive hyphens) live in PROVIDER_NAME_RULES — user and org share
 * one namespace, so `GET /users/{name}` covers both: the `type` field in
 * the response says which of the two actually holds the name.
 */

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
        const body = (await readJsonCapped(res)) as { type?: unknown } | null;
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

/** Personal-account check — the name is unusable when anything holds it. */
export function createGitHubUserAdapter(
  lookup: ReturnType<typeof createGitHubLookup>,
): ProviderAdapter {
  return {
    id: "github:user",
    async check(name, signal): Promise<ProviderOutcome> {
      const invalid = invalidOutcome("github:user", name);
      if (invalid !== null) return invalid;
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

interface GitHubSearchItem {
  name?: unknown;
  full_name?: unknown;
}

/**
 * Repository-name collision check via the unauthenticated Search API —
 * answers whether a repo already carries this name under any owner
 * (`{owner}/{repo}`), independent of the user/org login check. The search is
 * fuzzy (`in:name` ranks near matches), so only an exact `name` match
 * (case-insensitive) counts as a collision. Unauthenticated search is
 * limited to 10 req/min per IP — a 403/429 degrades to `unknown`.
 */
export function createGitHubRepoAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "github:repo",
    async check(name, signal): Promise<ProviderOutcome> {
      const invalid = invalidOutcome("github:repo", name);
      if (invalid !== null) return invalid;
      const url = `${deps.githubApiBase}/search/repositories?q=${encodeURIComponent(`${name} in:name`)}&per_page=10`;
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
        return { status: "unknown", subject: name, available: null, detail: "request failed" };
      }
      if (res.status === 200) {
        const body = (await readJsonCapped(res)) as {
          items?: unknown;
        } | null;
        if (body === null || !Array.isArray(body.items)) {
          return {
            status: "unknown",
            subject: name,
            available: null,
            detail: "unexpected GitHub search response body",
          };
        }
        const hit = (body.items as GitHubSearchItem[]).find(
          (item) =>
            typeof item?.name === "string" && item.name.toLowerCase() === name.toLowerCase(),
        );
        if (hit !== undefined) {
          const fullName = typeof hit.full_name === "string" ? hit.full_name : `search?q=${name}`;
          return {
            status: "taken",
            subject: name,
            available: false,
            detail: `https://github.com/${fullName} — a repository already carries this name`,
          };
        }
        return {
          status: "available",
          subject: name,
          available: true,
          detail: `no repository named '${name}' — create one at https://github.com/new`,
        };
      }
      return {
        status: "unknown",
        subject: name,
        available: null,
        detail:
          res.status === 403 || res.status === 429
            ? "GitHub search rate limit (unauthenticated limit is 10 req/min per IP)"
            : `GitHub search returned HTTP ${res.status}`,
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
      const invalid = invalidOutcome("github:org", name);
      if (invalid !== null) return invalid;
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
