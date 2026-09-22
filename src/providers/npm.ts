import type { ProviderDeps } from "../deps.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";

/**
 * npm package name rules (unscoped): ≤214 chars, lowercase, may not start
 * with a dot or underscore, url-safe characters only.
 */
const NPM_NAME = /^[a-z0-9][a-z0-9._-]*$/;
const NPM_MAX_LENGTH = 214;

export function createNpmAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "npm",
    async check(name): Promise<ProviderOutcome> {
      if (name.length > NPM_MAX_LENGTH || !NPM_NAME.test(name) || name !== name.toLowerCase()) {
        return {
          status: "invalid",
          subject: name,
          available: false,
          detail:
            "not a valid npm package name (lowercase, url-safe, ≤214 chars, no leading dot/underscore)",
        };
      }

      let available: boolean;
      try {
        available = await deps.npmNameAvailable(name);
      } catch {
        return {
          status: "unknown",
          subject: name,
          available: null,
          detail: "npm registry check failed",
        };
      }

      return available
        ? {
            status: "available",
            subject: name,
            available: true,
            detail: `https://www.npmjs.com/package/${name}`,
          }
        : {
            status: "taken",
            subject: name,
            available: false,
            detail: `https://www.npmjs.com/package/${name}`,
          };
    },
  };
}
