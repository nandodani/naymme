import type { ProviderDeps } from "../deps.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";
import { invalidOutcome } from "./validation.js";

/**
 * npm package name rules (unscoped, ≤214 chars, lowercase, no leading dot
 * or underscore) live in PROVIDER_NAME_RULES.
 */
export function createNpmAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "npm",
    async check(name): Promise<ProviderOutcome> {
      const invalid = invalidOutcome("npm", name);
      if (invalid !== null) return invalid;

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
