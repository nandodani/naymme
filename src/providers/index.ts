import type { ProviderDeps } from "../deps.js";
import type { ProviderId } from "../schemas.js";
import type { ProviderAdapter } from "../types.js";
import { createDomainAdapter } from "./domain.js";
import { createGitHubAdapter } from "./github.js";
import { createNpmAdapter } from "./npm.js";
import { createRdapClient } from "./rdap.js";
import {
  createBlueskyAdapter,
  createInstagramAdapter,
  createRedditAdapter,
  createTikTokAdapter,
  createXAdapter,
  createYouTubeAdapter,
} from "./social.js";

/**
 * Instantiate every provider adapter against the same deps. The RDAP client
 * is shared so all TLD adapters reuse one cached bootstrap document.
 */
export function createAdapters(deps: ProviderDeps): Record<ProviderId, ProviderAdapter> {
  const rdap = createRdapClient(deps);
  return {
    "domain:com": createDomainAdapter("com", deps, rdap),
    "domain:gg": createDomainAdapter("gg", deps, rdap),
    "domain:dev": createDomainAdapter("dev", deps, rdap),
    "domain:io": createDomainAdapter("io", deps, rdap),
    "domain:ai": createDomainAdapter("ai", deps, rdap),
    "domain:app": createDomainAdapter("app", deps, rdap),
    "domain:pt": createDomainAdapter("pt", deps, rdap),
    "domain:es": createDomainAdapter("es", deps, rdap),
    "domain:de": createDomainAdapter("de", deps, rdap),
    "domain:fr": createDomainAdapter("fr", deps, rdap),
    "domain:uk": createDomainAdapter("uk", deps, rdap),
    "domain:eu": createDomainAdapter("eu", deps, rdap),
    github: createGitHubAdapter(deps),
    npm: createNpmAdapter(deps),
    "social:x": createXAdapter(deps),
    "social:bluesky": createBlueskyAdapter(deps),
    "social:instagram": createInstagramAdapter(deps),
    "social:reddit": createRedditAdapter(deps),
    "social:youtube": createYouTubeAdapter(deps),
    "social:tiktok": createTikTokAdapter(deps),
  };
}

export function selectAdapters(ids: readonly ProviderId[], deps: ProviderDeps): ProviderAdapter[] {
  const all = createAdapters(deps);
  return ids.map((id) => all[id]);
}
