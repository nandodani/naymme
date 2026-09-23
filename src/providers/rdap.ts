import type { ProviderDeps } from "../deps.js";
import { readJsonCapped } from "../security.js";

export type RdapVerdict = "available" | "taken" | "unknown" | "invalid";

interface RdapBootstrap {
  services?: Array<[tlds: string[], urls: string[]]>;
}

export interface RdapClient {
  /** RDAP base URL for a TLD, or null when the IANA bootstrap lists none. */
  baseUrlForTld(tld: string): Promise<string | null>;
  /** Query `base + "domain/" + fqdn` and normalize the HTTP status. */
  lookup(fqdn: string, baseUrl: string, signal: AbortSignal): Promise<RdapVerdict>;
}

/**
 * RDAP client backed by the IANA bootstrap registry
 * (https://data.iana.org/rdap/dns.json). The bootstrap document is fetched
 * lazily and cached for the lifetime of the client; failures are not cached.
 */
export function createRdapClient(deps: ProviderDeps): RdapClient {
  let bootstrap: Promise<Map<string, string>> | null = null;

  function loadBootstrap(): Promise<Map<string, string>> {
    bootstrap ??= (async () => {
      const res = await deps.fetch(deps.rdapBootstrapUrl, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`IANA RDAP bootstrap returned HTTP ${res.status}`);
      }
      const doc = (await readJsonCapped(res)) as RdapBootstrap | null;
      if (doc === null) throw new Error("IANA RDAP bootstrap returned unreadable JSON");
      const map = new Map<string, string>();
      for (const [tlds, urls] of doc.services ?? []) {
        const base = urls[0];
        if (!base) continue;
        for (const tld of tlds) map.set(tld.toLowerCase(), base);
      }
      return map;
    })().catch((err: unknown) => {
      // A rejected bootstrap must not be cached — the next lookup retries.
      bootstrap = null;
      throw err;
    });
    return bootstrap;
  }

  return {
    async baseUrlForTld(tld) {
      const map = await loadBootstrap();
      return map.get(tld.toLowerCase()) ?? null;
    },

    async lookup(fqdn, baseUrl, signal) {
      const url = `${baseUrl.replace(/\/+$/, "")}/domain/${encodeURIComponent(fqdn)}`;
      let res: Response;
      try {
        res = await deps.fetch(url, {
          signal,
          headers: { accept: "application/rdap+json, application/json" },
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        return "unknown";
      }
      if (res.status === 404) return "available";
      if (res.status === 200) return "taken";
      if (res.status === 400 || res.status === 422) return "invalid";
      return "unknown"; // other 4xx/5xx, 429 — inconclusive
    },
  };
}
