import { resolve4, resolve6, resolveCname, resolveNs } from "node:dns/promises";
import { domain as whoiserDomain } from "whoiser";
import npmName from "npm-name";

/**
 * Result of a DNS existence probe: every address/alias answer (A, AAAA,
 * CNAME) the resolver returned, plus whether the name authoritatively does
 * not exist. `nxdomain` is only true when every probe answered ENOTFOUND —
 * a NODATA response (name exists, no matching records) stays ambiguous.
 */
export interface DnsExistence {
  answers: string[];
  nxdomain: boolean;
}

/** errno-style code out of an arbitrary caught value, or undefined. */
function errnoCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err && typeof err.code === "string"
    ? err.code
    : undefined;
}

/** Run one resolver, converting failures into a captured errno code. */
async function dnsProbe(
  fqdn: string,
  fn: (hostname: string) => Promise<string[]>,
): Promise<{ answers: string[]; code?: string }> {
  try {
    return { answers: await fn(fqdn) };
  } catch (err) {
    return { answers: [], code: errnoCode(err) };
  }
}

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
  /** DNS existence probe (A/AAAA/CNAME); NXDOMAIN only on unanimous ENOTFOUND. */
  resolveAny: (fqdn: string) => Promise<DnsExistence>;
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
    resolveAny: async (fqdn) => {
      const probes = await Promise.all([
        dnsProbe(fqdn, resolve4),
        dnsProbe(fqdn, resolve6),
        dnsProbe(fqdn, resolveCname),
      ]);
      const answers = probes.flatMap((p) => p.answers);
      const nxdomain = answers.length === 0 && probes.every((p) => p.code === "ENOTFOUND");
      return { answers, nxdomain };
    },
    npmNameAvailable: (name) => npmName(name),
    rdapBootstrapUrl: "https://data.iana.org/rdap/dns.json",
    githubApiBase: "https://api.github.com",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    userAgent: "naymme/0.1 (+https://naymme.vercel.app)",
    ...overrides,
  };
}
