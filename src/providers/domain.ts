import type { ProviderDeps } from "../deps.js";
import { readTextCapped } from "../security.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";
import { dnsNsVerdict } from "./dns.js";
import type { RdapClient } from "./rdap.js";
import { type DomainTld, invalidOutcome } from "./validation.js";
import { whoisLookup } from "./whois.js";

const MAX_DOMAIN_LENGTH = 253;

async function lookupPtDomain(
  name: string,
  fqdn: string,
  deps: ProviderDeps,
  signal: AbortSignal,
): Promise<ProviderOutcome> {
  const url = `https://www.pt.pt/pt/dominios/?site=${encodeURIComponent(name.toLowerCase())}`;
  let status: "available" | "taken" | "unknown" = "unknown";
  try {
    const res = await deps.fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(Math.min(2500, deps.timeoutMs))]),
      headers: { accept: "text/html", "user-agent": deps.userAgent },
    });
    if (res.status === 200) {
      const body = await readTextCapped(res);
      if (body.includes('class="connection-limit-captcha"')) {
        return {
          status: "unknown",
          subject: fqdn,
          available: null,
          detail: ".pt registry search rate-limited (CAPTCHA); availability cannot be verified",
        };
      }
      const match =
        /<div class="status (available|unavailable)">O domínio <span>"<span class="coloured">([^<]+)<\/span>/.exec(
          body,
        );
      if (match?.[2]?.toLowerCase() === fqdn) {
        status = match[1] === "available" ? "available" : "taken";
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    signal.throwIfAborted();
  }
  return {
    status,
    subject: fqdn,
    available: status === "unknown" ? null : status === "available",
    detail:
      status === "unknown"
        ? ".pt registry search unavailable or missing the exact domain availability marker; WHOIS is not reliable"
        : `registry search: ${url}`,
  };
}

/**
 * Domain availability adapter for one TLD.
 *
 * Strategy: RDAP first (the IANA bootstrap registry tells us whether the TLD
 * has an RDAP service — e.g. .com, .dev, .app, .fr and .uk do). For TLDs
 * without RDAP, fall back to raw WHOIS. For .pt/.es/.sh, check delegation
 * first so an unreliable WHOIS service cannot hide a registered domain.
 * .pt uses the registry's HTTPS search; .es has no verified public
 * unclaimed marker. Missing delegation never proves availability.
 */
export function createDomainAdapter(
  tld: DomainTld,
  deps: ProviderDeps,
  rdap: RdapClient,
): ProviderAdapter {
  const providerId = `domain:${tld}` as const;
  return {
    id: providerId,
    async check(name, signal): Promise<ProviderOutcome> {
      const fqdn = `${name.toLowerCase()}.${tld}`;
      const invalid = invalidOutcome(providerId, name, fqdn);
      if (invalid !== null) return invalid;
      if (fqdn.length > MAX_DOMAIN_LENGTH) {
        return {
          status: "invalid",
          subject: fqdn,
          available: false,
          detail: `domain name exceeds the ${MAX_DOMAIN_LENGTH}-character limit`,
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

      if (tld === "pt" || tld === "es" || tld === "sh") {
        if ((await dnsNsVerdict(fqdn, deps)) === "taken") {
          return {
            status: "taken",
            subject: fqdn,
            available: false,
            detail: "DNS delegation proves registration",
          };
        }
        signal.throwIfAborted();
        if (tld === "pt") return lookupPtDomain(name, fqdn, deps, signal);
        if (tld === "es") {
          return {
            status: "unknown",
            subject: fqdn,
            available: null,
            detail:
              "No reliable public .es availability source: no RDAP service or verified WHOIS unclaimed marker; absent DNS does not prove availability",
          };
        }
      }

      const whoisTimeout =
        tld === "sh" ? Math.max(1, Math.min(1500, Math.floor(deps.timeoutMs / 3))) : undefined;
      let verdict = await whoisLookup(fqdn, deps, whoisTimeout);
      if (tld === "sh" && verdict === "unknown") {
        signal.throwIfAborted();
        verdict = await whoisLookup(fqdn, deps, whoisTimeout);
      }
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
