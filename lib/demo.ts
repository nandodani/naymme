import type { CheckAvailabilityOutput } from "../src/schemas.js";
import { resolveProviderIds } from "../src/schemas.js";
import type { AvailabilityResult } from "../src/types.js";

/**
 * Deterministic demo availability provider.
 *
 * Used when live registry lookups are unavailable or unwanted (offline dev,
 * previews without network egress). Every answer is a pure function of
 * `provider + name` — the same input always yields the same result — and each
 * result is labelled `demo` so the UI can flag it honestly. Swap it out by
 * pointing `NAYMME_AVAILABILITY_MODE` back at `live` (the default).
 */

/** FNV-1a 32-bit hash — small, dependency-free, stable across runtimes. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Subject conventions mirror the real adapters: domains carry the TLD. */
function demoSubject(provider: string, name: string): string {
  if (provider.startsWith("domain:")) return `${name}.${provider.slice("domain:".length)}`;
  if (provider.startsWith("social:") || provider === "jsr") return `@${name}`;
  if (provider === "vercel") return `${name}.vercel.app`;
  if (provider === "netlify") return `${name}.netlify.app`;
  if (provider === "cloudflare") return `${name}.pages.dev`;
  if (provider === "flyio") return `${name}.fly.dev`;
  if (provider === "railway") return `${name}.up.railway.app`;
  if (provider === "supabase") return `${name}.supabase.co`;
  return name;
}

export function demoCheckAvailability(
  name: string,
  providers?: readonly string[],
): CheckAvailabilityOutput {
  const ids = resolveProviderIds(providers);
  const results: AvailabilityResult[] = ids.map((id) => {
    const bucket = fnv1a(`${id}:${name.toLowerCase()}`) % 20;
    // ~55% available, 25% taken, 15% unknown, 5% invalid.
    const status: AvailabilityResult["status"] =
      bucket < 11 ? "available" : bucket < 16 ? "taken" : bucket < 19 ? "unknown" : "invalid";
    return {
      provider: id,
      status,
      subject: demoSubject(id, name.toLowerCase()),
      available:
        status === "available" ? true : status === "taken" || status === "invalid" ? false : null,
      detail: "demo provider — deterministic fixture, not a live lookup",
      durationMs: 40 + (fnv1a(`${name}:${id}`) % 360),
    };
  });

  const summary = { available: 0, taken: 0, unknown: 0, invalid: 0 };
  for (const r of results) summary[r.status] += 1;
  return { name, results, summary };
}
