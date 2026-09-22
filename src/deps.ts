import { resolveNs } from "node:dns/promises";
import { domain as whoiserDomain } from "whoiser";
import npmName from "npm-name";

/**
 * Everything the providers need from the outside world, injected so tests can
 * substitute fakes (fetch stubs, canned WHOIS responses, small timeouts)
 * without touching the network or `vi.mock`.
 */
export interface ProviderDeps {
  fetch: typeof globalThis.fetch;
  /** WHOIS lookup. Signature matches `whoiser.domain(domain, { timeout, raw })`. */
  whoisDomain: (domain: string, options: { timeout: number; raw: boolean }) => Promise<unknown>;
  /** DNS NS-record lookup; rejects with ENOTFOUND/ENODATA when nothing resolves. */
  resolveNs: (fqdn: string) => Promise<string[]>;
  /** npm registry availability check; resolves true when the name is free. */
  npmNameAvailable: (name: string) => Promise<boolean>;
  /** IANA RDAP bootstrap document URL. */
  rdapBootstrapUrl: string;
  githubApiBase: string;
  /** Per-provider timeout. Each check gets its own AbortController. */
  timeoutMs: number;
  /** User-Agent sent to HTTP APIs that require one (GitHub). */
  userAgent: string;
}

export const DEFAULT_TIMEOUT_MS = 5000;

export function defaultDeps(overrides: Partial<ProviderDeps> = {}): ProviderDeps {
  return {
    fetch: globalThis.fetch.bind(globalThis),
    whoisDomain: (domain, options) => whoiserDomain(domain, { ...options, follow: 1 }),
    resolveNs: (fqdn) => resolveNs(fqdn),
    npmNameAvailable: (name) => npmName(name),
    rdapBootstrapUrl: "https://data.iana.org/rdap/dns.json",
    githubApiBase: "https://api.github.com",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    userAgent: "lmkurname/0.1 (+https://github.com/nandodani/name-check-mcp)",
    ...overrides,
  };
}
