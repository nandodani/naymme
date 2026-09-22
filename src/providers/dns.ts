import type { ProviderDeps } from "../deps.js";

/**
 * Last-resort registration signal for TLDs whose WHOIS output is
 * inconclusive: a domain with delegated name servers is registered, so a
 * positive answer upgrades the verdict to `taken`. The absence of NS records
 * does NOT prove availability (registrations without delegation exist, and
 * NXDOMAIN also covers unregistered names), so anything else stays `unknown`.
 */
export async function dnsNsVerdict(fqdn: string, deps: ProviderDeps): Promise<"taken" | "unknown"> {
  try {
    const records = await deps.resolveNs(fqdn);
    return records.length > 0 ? "taken" : "unknown";
  } catch {
    return "unknown";
  }
}
