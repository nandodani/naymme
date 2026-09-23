import type { ProviderDeps } from "../deps.js";
import type { ProviderId } from "../schemas.js";
import type { ProviderAdapter } from "../types.js";
import {
  createCratesAdapter,
  createDockerHubAdapter,
  createGitLabAdapter,
  createPyPiAdapter,
} from "./devplatforms.js";
import { createDomainAdapter } from "./domain.js";
import {
  createGitHubLookup,
  createGitHubOrgAdapter,
  createGitHubRepoAdapter,
  createGitHubUserAdapter,
} from "./github.js";
import {
  createCloudflarePagesAdapter,
  createFlyioAdapter,
  createNetlifyAdapter,
  createRailwayAdapter,
  createSupabaseAdapter,
  createVercelAdapter,
} from "./hosting.js";
import { createNpmAdapter } from "./npm.js";
import {
  createBehanceAdapter,
  createCodePenAdapter,
  createDribbbleAdapter,
  createFigmaAdapter,
  createHomebrewAdapter,
  createHuggingFaceAdapter,
  createMediumAdapter,
  createNuGetAdapter,
  createProductHuntAdapter,
  createReplitAdapter,
  createRubyGemsAdapter,
  createSubstackAdapter,
  createTelegramAdapter,
} from "./platforms.js";
import { createRdapClient } from "./rdap.js";
import { createAppStoreAdapter } from "./stores.js";
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
  // One memoized /users lookup feeds both the GitHub user and org checks.
  const githubLookup = createGitHubLookup(deps);
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
    "domain:co": createDomainAdapter("co", deps, rdap),
    "domain:me": createDomainAdapter("me", deps, rdap),
    "domain:org": createDomainAdapter("org", deps, rdap),
    "domain:sh": createDomainAdapter("sh", deps, rdap),
    "domain:so": createDomainAdapter("so", deps, rdap),
    "domain:xyz": createDomainAdapter("xyz", deps, rdap),
    "domain:design": createDomainAdapter("design", deps, rdap),
    "domain:store": createDomainAdapter("store", deps, rdap),
    "domain:work": createDomainAdapter("work", deps, rdap),
    "domain:studio": createDomainAdapter("studio", deps, rdap),
    "domain:tech": createDomainAdapter("tech", deps, rdap),
    "domain:agency": createDomainAdapter("agency", deps, rdap),
    "domain:space": createDomainAdapter("space", deps, rdap),
    "github:user": createGitHubUserAdapter(githubLookup),
    "github:org": createGitHubOrgAdapter(githubLookup),
    "github:repo": createGitHubRepoAdapter(deps),
    gitlab: createGitLabAdapter(deps),
    npm: createNpmAdapter(deps),
    pypi: createPyPiAdapter(deps),
    crates: createCratesAdapter(deps),
    dockerhub: createDockerHubAdapter(deps),
    huggingface: createHuggingFaceAdapter(deps),
    nuget: createNuGetAdapter(deps),
    rubygems: createRubyGemsAdapter(deps),
    homebrew: createHomebrewAdapter(deps),
    codepen: createCodePenAdapter(deps),
    replit: createReplitAdapter(deps),
    vercel: createVercelAdapter(deps),
    netlify: createNetlifyAdapter(deps),
    cloudflare: createCloudflarePagesAdapter(deps),
    flyio: createFlyioAdapter(deps),
    railway: createRailwayAdapter(deps),
    supabase: createSupabaseAdapter(deps),
    appstore: createAppStoreAdapter(deps),
    figma: createFigmaAdapter(deps),
    dribbble: createDribbbleAdapter(deps),
    behance: createBehanceAdapter(deps),
    substack: createSubstackAdapter(deps),
    producthunt: createProductHuntAdapter(deps),
    telegram: createTelegramAdapter(deps),
    medium: createMediumAdapter(deps),
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
