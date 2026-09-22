import type { ProviderDeps } from "../deps.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";
import { dnsNsVerdict } from "./dns.js";
import type { RdapClient } from "./rdap.js";
import { whoisLookup } from "./whois.js";

const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * Domain availability adapter for one TLD.
 *
 * Strategy: RDAP first (the IANA bootstrap registry tells us whether the TLD
 * has an RDAP service — e.g. .com, .dev, .app, .fr and .uk do). For TLDs
 * without RDAP (e.g. .gg, .io, .pt, .es, .de, .eu), fall back to a raw WHOIS
 * lookup via `whoiser`, which is inherently fuzzier. When WHOIS is
 * inconclusive, a DNS NS check supplies a final signal: delegated name
 * servers prove the domain is registered.
 */
export function createDomainAdapter(
  tld: string,
  deps: ProviderDeps,
  rdap: RdapClient,
): ProviderAdapter {
  return {
    id: `domain:${tld}`,
    async check(name, signal): Promise<ProviderOutcome> {
      const fqdn = `${name.toLowerCase()}.${tld}`;
      if (!DOMAIN_LABEL.test(name)) {
        return {
          status: "invalid",
          subject: fqdn,
          available: false,
          detail: "not a valid domain label (letters, digits, hyphens; no leading/trailing hyphen)",
        };
      }

      let baseUrl: string | null = null;
      try {
        baseUrl = await rdap.baseUrlForTld(tld);
      } catch {
        // Bootstrap registry unreachable — try WHOIS before giving up.
      }

      if (baseUrl !== null) {
        const verdict = await rdap.lookup(fqdn, baseUrl, signal);
        return {
          status: verdict,
          subject: fqdn,
          available: verdict === "available" ? true : verdict === "unknown" ? null : false,
          detail: `rdap: ${baseUrl}domain/${fqdn}`,
        };
      }

      let verdict = await whoisLookup(fqdn, deps);
      if (verdict === "unknown") {
        verdict = await dnsNsVerdict(fqdn, deps);
      }
      return {
        status: verdict,
        subject: fqdn,
        available: verdict === "available" ? true : verdict === "taken" ? false : null,
        detail: `whois fallback (no RDAP service for .${tld})`,
      };
    },
  };
}
