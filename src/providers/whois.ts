import type { ProviderDeps } from "../deps.js";

export type WhoisVerdict = "available" | "taken" | "unknown";

/**
 * Phrases registries use to report a free domain. WHOIS has no standard
 * schema, so availability is inferred by text matching — inherently fuzzy,
 * which is why WHOIS is only a fallback when a TLD has no RDAP service.
 */
const NOT_FOUND_PATTERNS = [
  /no match/i,
  /not found/i,
  /no entries found/i,
  /no data found/i,
  /nothing found/i,
  /domain not found/i,
  /status:\s*(free|available)/i,
  /is available/i,
  /available for registration/i,
];

/** Fields that indicate a real registration record came back. */
const TAKEN_PATTERNS = [
  /domain name/i,
  /registrar/i,
  /name server/i,
  /creation date/i,
  /expiry|expires|expiration/i,
];

function stringify(response: unknown): string {
  if (typeof response === "string") return response;
  try {
    return JSON.stringify(response);
  } catch {
    return String(response);
  }
}

/**
 * WHOIS availability check via `whoiser`. Returns `unknown` when the response
 * contains neither a clear "not found" marker nor registration fields —
 * different registries phrase things differently.
 */
export async function whoisLookup(fqdn: string, deps: ProviderDeps): Promise<WhoisVerdict> {
  const response = await deps.whoisDomain(fqdn, {
    timeout: Math.max(1_000, deps.timeoutMs - 250),
    raw: true,
  });
  const text = stringify(response);
  if (NOT_FOUND_PATTERNS.some((p) => p.test(text))) return "available";
  if (TAKEN_PATTERNS.some((p) => p.test(text))) return "taken";
  return "unknown";
}
