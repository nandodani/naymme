import type { ProviderDeps } from "../deps.js";
import type { CheckAvailabilityInput, CheckAvailabilityOutput } from "../schemas.js";
import { resolveProviderIds } from "../schemas.js";
import { selectAdapters } from "../providers/index.js";
import type { AvailabilityResult, ProviderAdapter, ProviderOutcome } from "../types.js";

/**
 * Error text for the public `detail` field: single line, no control
 * characters, capped length — an upstream/library message should never
 * smuggle markup or internals into the tool output.
 */
function errorMessage(err: unknown): string {
  const raw =
    err instanceof Error ? (err.name === "AbortError" ? "timed out" : err.message) : String(err);
  return raw
    .replace(/\p{C}+/gu, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Run one adapter under its own AbortController-backed deadline. Abortable
 * operations (fetch-based) receive the signal; the race guarantees the call
 * resolves even for providers that can't observe cancellation (WHOIS socket).
 */
async function checkWithTimeout(
  adapter: ProviderAdapter,
  name: string,
  deps: ProviderDeps,
): Promise<AvailabilityResult> {
  const started = Date.now();
  const controller = new AbortController();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`timed out after ${deps.timeoutMs}ms`));
    }, deps.timeoutMs);
  });

  let outcome: ProviderOutcome;
  try {
    outcome = await Promise.race([adapter.check(name, controller.signal), deadline]);
  } catch (err) {
    outcome = {
      status: "unknown",
      subject: name,
      available: null,
      detail: errorMessage(err),
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  return { provider: adapter.id, durationMs: Date.now() - started, ...outcome };
}

/**
 * Fan out the selected providers concurrently. `Promise.allSettled` plus the
 * per-provider timeout guarantee one provider's failure can never fail the
 * whole request — it degrades to an `unknown` result instead.
 */
export async function runAvailabilityChecks(
  name: string,
  adapterSelection: readonly string[] | undefined,
  deps: ProviderDeps,
): Promise<AvailabilityResult[]> {
  const adapters = selectAdapters(resolveProviderIds(adapterSelection), deps);
  const settled = await Promise.allSettled(
    adapters.map((adapter) => checkWithTimeout(adapter, name, deps)),
  );
  return settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      provider: adapters[i]?.id ?? "unknown",
      status: "unknown",
      subject: name,
      available: null,
      detail: errorMessage(result.reason),
      durationMs: 0,
    };
  });
}

export async function checkAvailability(
  input: CheckAvailabilityInput,
  deps: ProviderDeps,
): Promise<CheckAvailabilityOutput> {
  const results = await runAvailabilityChecks(input.name, input.providers, deps);
  const summary = { available: 0, taken: 0, unknown: 0, invalid: 0 };
  for (const r of results) summary[r.status] += 1;
  return { name: input.name, results, summary };
}
