# Architecture & extension guide

How `lmkurname` is structured, the adapter contract, how MCP tools reach the
engine, and exactly how to add a provider.

## Surfaces — one engine, four runtimes

The same `src/` code serves four entry points:

| Surface           | Entry                                                                 | Transport                                                                                                                          | Deps                                 |
| ----------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| MCP stdio server  | [`src/index.ts`](../src/index.ts)                                     | `StdioServerTransport` (local MCP clients: Claude Desktop, Cursor)                                                                 | `defaultDeps()` — full Node          |
| Node HTTP         | [`src/http.ts`](../src/http.ts) + [`mcp-http.ts`](../src/mcp-http.ts) | Streamable HTTP `POST /mcp` + legacy SSE `GET /sse` + `POST /messages` + `/health`                                                 | `defaultDeps()`                      |
| Next.js app       | [`app/`](../app/), [`lib/`](../lib/)                                  | UI `/` + `POST /api/mcp` (stateless Streamable HTTP; `/mcp`, `/health` rewrite to it) + `GET /api/availability` + `GET /api/score` | `defaultDeps()` via `lib/mcp-web.ts` |
| Cloudflare Worker | [`worker/index.ts`](../worker/index.ts)                               | Stateless Streamable HTTP `/mcp` + `/health`                                                                                       | `workerDeps()` — web-standard only   |

`createNameCheckServer(deps)` ([`src/server.ts`](../src/server.ts)) registers
the two tools on a fresh `McpServer`. Stateless transports create a server +
`StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` **per
request** — safe on serverless, with no session state and no standalone GET
SSE stream.

Worker constraint ([`worker/index.ts`](../worker/index.ts)): no `node:*`
APIs — `whoisDomain` is a no-op (raw TCP :43 impossible), `resolveNs` is
Cloudflare DoH JSON, `npmNameAvailable` is `HEAD` against
`registry.npmjs.org`. Shared logic stays in `src/`; runtime differences live
entirely in the deps object.

## Module map (engine)

| File                                                                  | Role                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/schemas.ts`](../src/schemas.ts)                                 | `PROVIDER_IDS` (55 ids), aliases (`all`, `domains`, `domains:cctld`, `domains:all`, `socials`), `resolveProviderIds()` expansion+dedup, all zod IO schemas                                                                                                                                                                                                          |
| [`src/types.ts`](../src/types.ts)                                     | `AvailabilityStatus`, `AvailabilityResult`, `ProviderOutcome`, `ProviderAdapter`                                                                                                                                                                                                                                                                                    |
| [`src/deps.ts`](../src/deps.ts)                                       | `ProviderDeps` DI (`fetch`, `whoisDomain`, `resolveNs`, `npmNameAvailable`, `rdapBootstrapUrl`, `githubApiBase`, `timeoutMs`, `userAgent`) + `defaultDeps()`                                                                                                                                                                                                        |
| [`src/providers/`](../src/providers/)                                 | One module per adapter family — see [providers.md](providers.md)                                                                                                                                                                                                                                                                                                    |
| [`src/providers/validation.ts`](../src/providers/validation.ts)       | `PROVIDER_NAME_RULES`, `validateName`, `invalidOutcome`                                                                                                                                                                                                                                                                                                             |
| [`src/tools/checkAvailability.ts`](../src/tools/checkAvailability.ts) | `checkWithTimeout` (per-adapter `AbortController` + deadline race) and `runAvailabilityChecks` (`Promise.allSettled`)                                                                                                                                                                                                                                               |
| [`src/scoring/`](../src/scoring/)                                     | `score.ts` (deterministic 0–100 brand score), `overall.ts` (UI tallies)                                                                                                                                                                                                                                                                                             |
| [`lib/`](../lib/)                                                     | Web-side services: `availability.ts` (live vs `LMKURNAME_AVAILABILITY_MODE=demo`), `links.ts` (registrar links + `TLD_PRICE_ESTIMATES`), `provider-meta.ts` (grid groups), `mcp-web.ts` (web-standard MCP handler), `mcp-config.ts`/`mcp-guides.ts` (client-config snippets), `score-api.ts`, `demo.ts` (FNV-1a fixtures), `result-filter.ts`, `overall-display.ts` |

## The adapter contract

[`src/types.ts`](../src/types.ts):

```ts
export interface ProviderAdapter {
  readonly id: string;
  check(name: string, signal: AbortSignal): Promise<ProviderOutcome>;
}

export type ProviderOutcome = Omit<AvailabilityResult, "provider" | "durationMs">;
// = { status, subject, available, detail? }
```

The runner adds `provider` and `durationMs`. Rules (pinned by
[`test/provider-contract.test.ts`](../test/provider-contract.test.ts)):

1. `available` agrees with `status`: `available`→`true`, `taken`/`invalid`→`false`, `unknown`→`null`.
2. `invalidOutcome(providerId, name, subject?)` runs **before** any network call; detail is `not a valid ${rule.label}: ${reason}`.
3. Boundary lengths accepted; `min−1`/`max+1` rejected.
4. Charsets are ASCII-only (`appstore` also allows spaces/punctuation).
5. Honor the `AbortSignal` — abort errors propagate (the runner maps them to `unknown`/timeout); all other failures degrade to `unknown`, never a fabricated `available`. An adapter may only claim `available` on a verified unclaimed marker (RDAP 404, `DEPLOYMENT_NOT_FOUND`, `username_available.json === true`, …).
6. `check` must resolve — never reject for a `taken` answer. Rejection is only for unexpected infrastructure failure.

`invalid` is a distinct status, not an error: it means the name cannot exist
on that provider (e.g. uppercase on npm) and is reported **without** a
network call.

## Engine flow for `check_availability`

```
input { name, providers? }
  → checkAvailabilityInputSchema (nameSchema: 1–63, [A-Za-z0-9._-], starts alnum)
  → resolveProviderIds(providers)   // alias expansion, dedup, default ["all"]
  → selectAdapters(ids, deps)       // Record<ProviderId, ProviderAdapter> lookup
  → checkWithTimeout(adapter)       // AbortController + 5s deadline race
  → Promise.allSettled              // one failure → unknown, never fails batch
  → { name, results[], summary{available,taken,unknown,invalid} }
```

`score_name` bypasses the engine entirely — `scoreName(name)` in
[`src/scoring/score.ts`](../src/scoring/score.ts) is a pure function (no
network): punchiness (25) + syllables (15) + pronounceability (25) +
uniqueness (20) + cleanliness (15) → `total` 0–100 + `grade`
(≥85 Excellent, ≥70 Strong, ≥55 Fair, ≥40 Weak, else Poor).

## Caching & rate-limit stance (implemented)

Deliberately minimal — three process-local caches, no result cache:

- **RDAP bootstrap** — the IANA `dns.json` TLD map is fetched once per
  `RdapClient` and memoized for its lifetime; failures are _not_ cached
  ([`rdap.ts`](../src/providers/rdap.ts)).
- **GitHub `/users` lookup** — `github:user` and `github:org` share one
  memoized call per `createGitHubLookup` instance; rejections evict so a
  failed lookup can retry ([`github.ts`](../src/providers/github.ts)).
- **Per-request caches** — stateless transports rebuild server + deps per
  request, so both of the above are effectively per-request caches.

**Not implemented:** caching of availability answers across requests, retry
with backoff, request queues or provider-auth escalation. Every check is
anonymous, so provider rate limits apply per egress IP (GitHub core 60/h,
search ~10/min; several social endpoints block datacenter IPs). The strategy
today is _degrade honestly to `unknown`_, not retry — see
[troubleshooting.md](troubleshooting.md).

If cross-request caching is ever wanted, it belongs behind `ProviderDeps`
(e.g. a `cache?: { get(key): Promise<Result|undefined>; set(key, result, ttl): Promise<void> }`
dep) so runtimes can inject memory vs KV — suggested shape, not implemented.

## Adding a provider — step by step

The plumbing is designed so a new provider is a _registry edit_, not an
engine change:

1. **Id** — add `"newprovider"` to `PROVIDER_IDS` in
   [`src/schemas.ts`](../src/schemas.ts) (and to an alias list if it belongs
   to `domains`/`socials`/etc.).
2. **Name rule** — add a `NameRule` in `PROVIDER_NAME_RULES`
   ([`validation.ts`](../src/providers/validation.ts)). Omitting it is a
   compile error (`Record<ProviderId, NameRule>`).
3. **Adapter** — write `createXAdapter(deps)` in the matching family module
   (or a new `src/providers/x.ts`): validate first (`invalidOutcome`), then a
   single public endpoint; only claim `available`/`taken` on verified
   markers. Reuse the `safeFetch`/`createPageCheck`/`createSubdomainCheck`
   helpers where they fit.
4. **Registry** — wire it in `createAdapters`
   ([`src/providers/index.ts`](../src/providers/index.ts)).
5. **Display** — label + group in [`lib/provider-meta.ts`](../lib/provider-meta.ts),
   claim/profile links in [`lib/links.ts`](../lib/links.ts) (and a
   `TLD_PRICE_ESTIMATES` row for a new domain TLD), a brand icon in
   [`components/brand-icons.tsx`](../components/brand-icons.tsx).
6. **Done** — the contract matrix in `test/provider-contract.test.ts` picks
   it up automatically (`PROVIDER_IDS` parameterization): schema shape,
   boundary lengths, forbidden characters, offline MSW coverage. Add a
   fixture in `lib/demo.ts` only if the demo path should differ from the
   default.

Never call live endpoints in tests — extend MSW handlers or inject
`ProviderDeps` fakes (`test/provider-contract.test.ts` uses
`onUnhandledRequest: "error"` intentionally).

## Type-safety & dead-code policy (confirmed in config)

- **`strict` TypeScript** (`tsconfig.json`: `strict`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax` — import types with `import type`).
- **Zero-`any`, zero-`!`**: ESLint `recommendedTypeChecked` with
  `@typescript-eslint/no-explicit-any: error` and
  `no-non-null-assertion: error` — narrow types properly
  ([`eslint.config.js`](../eslint.config.js)).
- **Dead code**: `npm run knip` gates unused files/exports/deps; public API
  is marked `/** @public */`, `components/ui/**` ignored,
  `ignoreExportsUsedInFile` covers registry patterns
  ([`knip.config.ts`](../knip.config.ts)).
- **Bundle size**: `npm run size` (size-limit file preset) caps `dist/**/*.js`
  at 50 kB and `.next/static/chunks/*.js` at 3 MB.
- **Coverage thresholds** ([`vitest.config.ts`](../vitest.config.ts)): ≥90%
  on `src/providers/**`, ≥95% on `src/schemas.ts`, ≥80% on `lib/**` and
  `worker/**`.
- Strict module syntax (`verbatimModuleSyntax`) — import types with `import type`.
- Full local gate: `npm run check` = typecheck + lint + knip + format:check +
  test + build + size. CI mirrors it in six parallel jobs
  ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).
