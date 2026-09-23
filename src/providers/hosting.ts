import type { ProviderDeps } from "../deps.js";
import type { ProviderId } from "../schemas.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";
import { invalidOutcome } from "./validation.js";

/**
 * Hosted-platform subdomain checks ({name}.vercel.app, {name}.netlify.app).
 * Every adapter only claims `available` when the platform's unclaimed-marker
 * is verified — an ambiguous 404 stays `unknown`, never a fabricated free.
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
): Promise<Response | null> {
  try {
    // `manual`: the platform edge's own redirect proves a deployment exists —
    // following it could land on an unrelated origin's status code.
    return await deps.fetch(url, {
      signal,
      redirect: "manual",
      headers: { "user-agent": deps.userAgent },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return null;
  }
}

interface SubdomainCheckSpec {
  id: ProviderId;
  /** Platform suffix the name is checked under, e.g. "vercel.app". */
  suffix: string;
  /** Verified "nobody holds this subdomain" marker on a 404 response. */
  unclaimedMarker: (res: Response, body: string) => boolean;
}

function createSubdomainCheck(deps: ProviderDeps, spec: SubdomainCheckSpec): ProviderAdapter {
  return {
    id: spec.id,
    async check(name, signal): Promise<ProviderOutcome> {
      const invalid = invalidOutcome(spec.id, name);
      if (invalid !== null) return invalid;
      const subject = `${name}.${spec.suffix}`;
      const url = `https://${subject}/`;
      const res = await safeFetch(deps, url, signal);
      if (!res) return unknown(subject, "request failed");
      // Any served response or edge redirect proves a deployment holds the name.
      if (res.status >= 200 && res.status < 400) return taken(subject, url);
      // Auth-gated deployments exist but can't be viewed — the name is held.
      if (res.status === 401 || res.status === 403) {
        return taken(subject, `${url} (protected deployment)`);
      }
      if (res.status === 404) {
        const body = await res.text().catch(() => "");
        return spec.unclaimedMarker(res, body)
          ? available(subject, url)
          : unknown(subject, `${spec.id} returned HTTP 404 without the unclaimed-site marker`);
      }
      if (res.status === 429) {
        return unknown(subject, `${spec.id} rate limited the check`);
      }
      return unknown(subject, `${spec.id} returned HTTP ${res.status}`);
    },
  };
}

/**
 * Vercel check via `{name}.vercel.app`: the edge answers unassigned hostnames
 * with a `DEPLOYMENT_NOT_FOUND` error (header or page body) — verified free.
 * Any other response means a project owns the subdomain.
 */
export function createVercelAdapter(deps: ProviderDeps): ProviderAdapter {
  return createSubdomainCheck(deps, {
    id: "vercel",
    suffix: "vercel.app",
    unclaimedMarker: (res, body) =>
      res.headers.get("x-vercel-error") === "DEPLOYMENT_NOT_FOUND" ||
      body.includes("DEPLOYMENT_NOT_FOUND"),
  });
}

/**
 * Netlify check via `{name}.netlify.app`: unclaimed subdomains answer 404
 * with the edge's bare `Not Found - Request ID: …` body — verified free.
 * A claimed site serves its own index (200) or redirects, never that body.
 */
export function createNetlifyAdapter(deps: ProviderDeps): ProviderAdapter {
  return createSubdomainCheck(deps, {
    id: "netlify",
    suffix: "netlify.app",
    unclaimedMarker: (_res, body) => body.trimStart().startsWith("Not Found"),
  });
}
