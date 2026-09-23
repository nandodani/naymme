import type { ProviderDeps } from "../deps.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";

/**
 * Store listing checks. Phase 1 covers the Apple App Store; the remaining
 * storefronts (Google Play, Chrome Web Store, Raycast Store) slot in here as
 * additional `create*Adapter` factories — one public endpoint per store,
 * same outcome contract.
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
    return await deps.fetch(url, {
      signal,
      headers: { accept: "application/json", "user-agent": deps.userAgent },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return null;
  }
}

interface AppStoreSearchResult {
  trackName?: unknown;
  trackViewUrl?: unknown;
}

interface AppStoreSearchBody {
  results?: unknown;
}

/**
 * Apple App Store name check via the public iTunes Search API — one GET,
 * no key required. The search is fuzzy, so only an exact `trackName` match
 * (case-insensitive) counts as a collision: a listing with the identical
 * name → `taken`, anything else → `available`. US storefront, which the
 * `country=US` parameter pins.
 */
export function createAppStoreAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "appstore",
    async check(name, signal): Promise<ProviderOutcome> {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=software&country=US&limit=50`;
      const res = await safeFetch(deps, url, signal);
      if (!res) return unknown(name, "request failed");
      if (res.status !== 200) {
        return unknown(name, `App Store search returned HTTP ${res.status}`);
      }
      const body = (await res.json().catch(() => null)) as AppStoreSearchBody | null;
      if (body === null || !Array.isArray(body.results)) {
        return unknown(name, "unexpected App Store response body");
      }
      const hit = (body.results as AppStoreSearchResult[]).find(
        (r) =>
          typeof r?.trackName === "string" &&
          r.trackName.trim().toLowerCase() === name.toLowerCase(),
      );
      if (hit !== undefined) {
        const link =
          typeof hit.trackViewUrl === "string"
            ? hit.trackViewUrl
            : `https://apps.apple.com/us/search?term=${encodeURIComponent(name)}`;
        return taken(name, `${link} — an App Store app is already named '${name}'`);
      }
      return available(name, `no US App Store app named '${name}'`);
    },
  };
}
