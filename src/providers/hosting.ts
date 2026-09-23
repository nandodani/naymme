import type { DnsExistence, ProviderDeps } from "../deps.js";
import type { ProviderId } from "../schemas.js";
import { readTextCapped } from "../security.js";
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
        const body = await readTextCapped(res).catch(() => "");
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

interface SubdomainDnsSpec {
  id: ProviderId;
  /**
   * Platform suffix whose names only resolve once claimed — the zone is not
   * wildcard, so NXDOMAIN is the verified "nobody holds this" marker.
   */
  suffix: string;
}

/**
 * DNS-existence check for hosted platforms that provision DNS per claim.
 * `available` requires an authoritative NXDOMAIN; NODATA (the name node
 * exists without address records) and resolver failures stay `unknown`.
 */
function createSubdomainDnsCheck(deps: ProviderDeps, spec: SubdomainDnsSpec): ProviderAdapter {
  return {
    id: spec.id,
    async check(name, _signal): Promise<ProviderOutcome> {
      const invalid = invalidOutcome(spec.id, name);
      if (invalid !== null) return invalid;
      const subject = `${name}.${spec.suffix}`;
      let dns: DnsExistence;
      try {
        dns = await deps.resolveAny(subject);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        return unknown(subject, "DNS lookup failed");
      }
      if (dns.answers.length > 0) {
        return taken(subject, `${subject} resolves to ${dns.answers[0]}`);
      }
      return dns.nxdomain
        ? available(subject, `${subject} does not resolve (NXDOMAIN)`)
        : unknown(subject, `${spec.id} answered NODATA — name exists without address records`);
    },
  };
}

/**
 * Cloudflare Pages check via `{name}.pages.dev`: Pages provisions DNS per
 * project, so NXDOMAIN → verified free, any answer → taken.
 */
export function createCloudflarePagesAdapter(deps: ProviderDeps): ProviderAdapter {
  return createSubdomainDnsCheck(deps, { id: "cloudflare", suffix: "pages.dev" });
}

/**
 * Fly.io check via `{name}.fly.dev`: Fly provisions DNS per app, so
 * NXDOMAIN → verified free, any answer → taken.
 */
export function createFlyioAdapter(deps: ProviderDeps): ProviderAdapter {
  return createSubdomainDnsCheck(deps, { id: "flyio", suffix: "fly.dev" });
}

/**
 * Supabase check via `{name}.supabase.co`: the project gateway zone has no
 * wildcard — only live project/infra subdomains resolve, so NXDOMAIN →
 * verified free, any answer → taken.
 */
export function createSupabaseAdapter(deps: ProviderDeps): ProviderAdapter {
  return createSubdomainDnsCheck(deps, { id: "supabase", suffix: "supabase.co" });
}

/**
 * Railway check via `{name}.up.railway.app`: Railway wildcard-resolves the
 * zone, so the HTTP edge answers unclaimed names with a JSON
 * `Application not found` 404 flagged `x-railway-fallback: true` — both
 * markers required for a verified free (a deployed app's own 404, or an
 * edge response missing either marker, stays `unknown`).
 */
export function createRailwayAdapter(deps: ProviderDeps): ProviderAdapter {
  return createSubdomainCheck(deps, {
    id: "railway",
    suffix: "up.railway.app",
    unclaimedMarker: (res, body) =>
      res.headers.get("x-railway-fallback") === "true" && body.includes("Application not found"),
  });
}
