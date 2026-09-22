import type { ProviderDeps } from "../deps.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";

/**
 * GitHub login rules: ≤39 chars, alphanumeric and single hyphens, may not
 * start or end with a hyphen. Usernames and organization names share one
 * namespace, so `GET /users/{name}` covers both.
 */
const GITHUB_LOGIN = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/;

export function createGitHubAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "github",
    async check(name, signal): Promise<ProviderOutcome> {
      if (!GITHUB_LOGIN.test(name)) {
        return {
          status: "invalid",
          subject: name,
          available: false,
          detail:
            "not a valid GitHub name (≤39 chars, letters/digits/single hyphens, no leading/trailing hyphen)",
        };
      }

      const url = `${deps.githubApiBase}/users/${encodeURIComponent(name)}`;
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

      if (res.status === 404) {
        return {
          status: "available",
          subject: name,
          available: true,
          detail: `${url} → 404 (username and org namespaces are shared)`,
        };
      }
      if (res.status === 200) {
        return { status: "taken", subject: name, available: false, detail: url };
      }
      return {
        status: "unknown",
        subject: name,
        available: null,
        detail:
          res.status === 403
            ? "GitHub API rate limit or forbidden (unauthenticated limit is 60 req/h per IP)"
            : `GitHub API returned HTTP ${res.status}`,
      };
    },
  };
}
