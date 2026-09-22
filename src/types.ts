/**
 * Normalized availability outcomes. `unknown` means the provider could not
 * give a definitive answer (network error, rate limit, inconclusive WHOIS,
 * timeout) — it is NOT the same as `taken`.
 */
export type AvailabilityStatus = "available" | "taken" | "unknown" | "invalid";

export interface AvailabilityResult {
  /** Provider identifier, e.g. "domain:com", "github", "npm". */
  provider: string;
  status: AvailabilityStatus;
  /** The concrete identifier that was checked, e.g. "acme.com" or "acme". */
  subject: string;
  /** true = available, false = taken/invalid, null = unknown. */
  available: boolean | null;
  /** Human-readable note: registry URL, error reason, etc. */
  detail?: string;
  durationMs: number;
}

/**
 * The check an adapter performs, before the runner adds `provider` and
 * `durationMs`.
 */
export type ProviderOutcome = Omit<AvailabilityResult, "provider" | "durationMs">;

export interface ProviderAdapter {
  readonly id: string;
  /**
   * Check whether `name` is available on this provider.
   * Must resolve to a ProviderOutcome — never reject for "taken" answers.
   * Rejecting is acceptable only for unexpected infrastructure failures; the
   * runner converts rejections into `unknown` results.
   */
  check(name: string, signal: AbortSignal): Promise<ProviderOutcome>;
}
