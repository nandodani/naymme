import type { ProviderDeps } from "../deps.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";

function invalid(subject: string, detail: string): ProviderOutcome {
  return { status: "invalid", subject, available: false, detail };
}

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

/**
 * GitLab usernames and group paths share one namespace (`gitlab.com/{name}`
 * routes to whichever holds it). Path rules: letters/digits/underscore plus
 * `-` and `.` separators, may not start or end with a separator.
 */
const GITLAB_PATH = /^[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?$/;

/**
 * GitLab check via the public REST API: `/users?username=` answers an exact
 * user match and `/groups/{path}` answers for groups. A name is `available`
 * only when both lookups miss — anything else that responds unexpectedly
 * (rate limits, auth walls) reports `unknown`.
 */
export function createGitLabAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "gitlab",
    async check(name, signal): Promise<ProviderOutcome> {
      if (!GITLAB_PATH.test(name) || name.length > 255) {
        return invalid(
          name,
          "not a valid GitLab path (letters/digits/underscore with '-' and '.' separators, no edge separators)",
        );
      }
      const usersUrl = `https://gitlab.com/api/v4/users?username=${encodeURIComponent(name)}`;
      const users = await safeFetch(deps, usersUrl, signal, { accept: "application/json" });
      if (!users) return unknown(name, "request failed");
      if (users.status === 200) {
        const body = (await users.json().catch(() => null)) as unknown;
        if (!Array.isArray(body)) return unknown(name, "unexpected /users response body");
        if (body.length > 0) return taken(name, `https://gitlab.com/${name}`);

        // No user match — a group may still hold the path.
        const groupUrl = `https://gitlab.com/api/v4/groups/${encodeURIComponent(name)}`;
        const group = await safeFetch(deps, groupUrl, signal, { accept: "application/json" });
        if (!group) return unknown(name, "request failed");
        if (group.status === 404) return available(name, `https://gitlab.com/${name}`);
        // 200 = public group; 403 = private group — the path is held either way.
        if (group.status === 200) return taken(name, `https://gitlab.com/${name}`);
        if (group.status === 403) {
          return taken(name, `https://gitlab.com/${name} (private group)`);
        }
        return unknown(name, `GitLab groups lookup returned HTTP ${group.status}`);
      }
      return unknown(name, `GitLab API returned HTTP ${users.status}`);
    },
  };
}

/**
 * PyPI package names are case-insensitive and normalize `-`, `_` and `.`
 * runs to a single `-` (PEP 503). Unscoped names only.
 */
const PYPI_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const PYPI_NORMALIZE = /[-_.]+/g;

/**
 * PyPI check via the public JSON API `pypi.org/pypi/{name}/json`:
 * 200 → taken, 404 → available, anything else → `unknown`.
 */
export function createPyPiAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "pypi",
    async check(name, signal): Promise<ProviderOutcome> {
      if (!PYPI_NAME.test(name)) {
        return invalid(
          name,
          "not a valid PyPI name (letters/digits with '-', '_' or '.' separators)",
        );
      }
      const normalized = name.toLowerCase().replaceAll(PYPI_NORMALIZE, "-");
      const url = `https://pypi.org/pypi/${encodeURIComponent(normalized)}/json`;
      const res = await safeFetch(deps, url, signal, { accept: "application/json" });
      if (!res) return unknown(normalized, "request failed");
      if (res.status === 404) {
        return available(normalized, `https://pypi.org/project/${normalized}/`);
      }
      if (res.status === 200) {
        return taken(normalized, `https://pypi.org/project/${normalized}/`);
      }
      return unknown(normalized, `PyPI returned HTTP ${res.status}`);
    },
  };
}

/**
 * crates.io package names: ≤64 chars, ASCII alphanumeric plus `-`/`_`,
 * must start with a letter or digit.
 */
const CRATES_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * crates.io check via `crates.io/api/v1/crates/{name}`: 200 → taken,
 * 404 → available. The API rejects requests without a User-Agent — the
 * shared `deps.userAgent` is sent.
 */
export function createCratesAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "crates",
    async check(name, signal): Promise<ProviderOutcome> {
      if (!CRATES_NAME.test(name)) {
        return invalid(
          name,
          "not a valid crates.io name (≤64 chars, letters/digits/hyphens/underscores, starts with a letter or digit)",
        );
      }
      const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;
      const res = await safeFetch(deps, url, signal, { accept: "application/json" });
      if (!res) return unknown(name, "request failed");
      if (res.status === 404) {
        return available(name, `https://crates.io/crates/${name}`);
      }
      if (res.status === 200) {
        return taken(name, `https://crates.io/crates/${name}`);
      }
      return unknown(name, `crates.io returned HTTP ${res.status}`);
    },
  };
}

/**
 * Docker Hub namespaces (users and orgs share it): 4-30 chars, lowercase
 * alphanumerics separated by `-`, `_` or `.`.
 */
const DOCKER_NAMESPACE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/**
 * Docker Hub check via the public repository API `hub.docker.com/v2/
 * repositories/{namespace}/`: 200 means the namespace exists and owns
 * public repositories (taken); 404 means no namespace or no public repos
 * (reported `available` — namespaces that exist but are empty or fully
 * private also answer 404, so availability is best-effort).
 */
export function createDockerHubAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "dockerhub",
    async check(name, signal): Promise<ProviderOutcome> {
      if (!DOCKER_NAMESPACE.test(name) || name.length < 4 || name.length > 30) {
        return invalid(
          name,
          "not a valid Docker Hub namespace (4-30 chars, lowercase letters/digits with '-', '_' or '.' separators)",
        );
      }
      const url = `https://hub.docker.com/v2/repositories/${encodeURIComponent(name)}/`;
      const res = await safeFetch(deps, url, signal, { accept: "application/json" });
      if (!res) return unknown(name, "request failed");
      if (res.status === 404) {
        return available(name, `https://hub.docker.com/u/${name}`);
      }
      if (res.status === 200) {
        return taken(name, `https://hub.docker.com/u/${name}`);
      }
      return unknown(name, `Docker Hub returned HTTP ${res.status}`);
    },
  };
}
