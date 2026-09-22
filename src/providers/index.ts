import type { ProviderDeps } from "../deps.js";
import type { ProviderId } from "../schemas.js";
import type { ProviderAdapter } from "../types.js";
import { createDomainAdapter } from "./domain.js";
import { createGitHubAdapter } from "./github.js";
import { createNpmAdapter } from "./npm.js";
import { createRdapClient } from "./rdap.js";

/**
 * Instantiate every provider adapter against the same deps. The RDAP client
 * is shared so all four TLD adapters reuse one cached bootstrap document.
 */
export function createAdapters(deps: ProviderDeps): Record<ProviderId, ProviderAdapter> {
  const rdap = createRdapClient(deps);
  return {
    "domain:com": createDomainAdapter("com", deps, rdap),
    "domain:gg": createDomainAdapter("gg", deps, rdap),
    "domain:dev": createDomainAdapter("dev", deps, rdap),
    "domain:io": createDomainAdapter("io", deps, rdap),
    github: createGitHubAdapter(deps),
    npm: createNpmAdapter(deps),
  };
}

export function selectAdapters(ids: readonly ProviderId[], deps: ProviderDeps): ProviderAdapter[] {
  const all = createAdapters(deps);
  return ids.map((id) => all[id]);
}
