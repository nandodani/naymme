# Architecture

`lmkurname` is a single TypeScript codebase that ships four surfaces:

| Surface                    | Entry point                       | Notes                                                                                           |
| -------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| MCP stdio server (npm bin) | `src/index.ts`                    | `lmkurname` bin; Claude Desktop / Cursor spawn it as a subprocess                               |
| Node HTTP server           | `src/http.ts` + `src/mcp-http.ts` | Stateless Streamable HTTP at `/mcp` plus legacy SSE at `/sse` + `/messages`                     |
| Next.js web app            | `app/`, `components/`, `lib/`     | Checker UI plus `/api/availability`, `/api/score`, `/api/mcp` (`/mcp`, `/health` rewrite to it) |
| Cloudflare Worker          | `worker/index.ts`                 | Stateless `/mcp`; web-standard APIs only (no `node:dns`, no TCP WHOIS)                          |

All four share `createNameCheckServer(deps)` from `src/server.ts` — the MCP
tool registration is written once and reused per transport. In stateless HTTP
mode a fresh `McpServer` + transport pair is created **per request** (with
`sessionIdGenerator: undefined`), so consecutive requests can land on different
serverless instances.

## Layout

```
src/
  schemas.ts          ProviderId registry (PROVIDER_IDS), aliases, zod IO schemas,
                      resolveProviderIds() alias expansion
  types.ts            ProviderAdapter / ProviderOutcome / AvailabilityResult
  deps.ts             ProviderDeps injection point + defaultDeps()
  providers/
    validation.ts     PROVIDER_NAME_RULES — per-provider NameRule, validateName,
                      invalidOutcome
    index.ts          createAdapters / selectAdapters — adapter registry
    domain.ts         TLD adapter: RDAP → WHOIS → DNS NS chain
    rdap.ts           IANA bootstrap client (cached per client)
    whois.ts          whoiser text-matching fallback
    dns.ts            NS-record last-resort signal
    github.ts         memoized /users lookup shared by user+org adapters;
                      repo-name collision via Search API
    npm.ts            npm-name wrapper
    devplatforms.ts   gitlab, pypi, crates, dockerhub
    platforms.ts      createPageCheck helper + huggingface, nuget, rubygems,
                      homebrew, codepen, replit, figma, dribbble, behance,
                      substack, producthunt, telegram, medium
    hosting.ts        vercel/netlify subdomain checks (unclaimed markers)
    stores.ts         appstore (iTunes Search API)
    social.ts         social:x, social:bluesky, social:instagram, social:reddit,
                      social:youtube, social:tiktok
  tools/checkAvailability.ts   checkWithTimeout + runAvailabilityChecks runner
  scoring/            deterministic brand scoring (score_name)
lib/                  web-side services: availability.ts (live vs demo),
                      demo.ts, links.ts (registrar links + TLD_PRICE_ESTIMATES),
                      provider-meta.ts (grid groups), mcp-web.ts, …
worker/index.ts       Worker runtime + portable ProviderDeps
app/api/              Next.js routes: availability, score, mcp
```

## The adapter contract

There is no `BaseAdapter` class — the contract is the `ProviderAdapter`
**interface** in `src/types.ts` plus the rules enforced by
`test/provider-contract.test.ts`:

```ts
interface ProviderAdapter {
  readonly id: string;
  check(name: string, signal: AbortSignal): Promise<ProviderOutcome>;
}

type ProviderOutcome = {
  status: "available" | "taken" | "unknown" | "invalid";
  subject: string;
  available: boolean | null;
  detail?: string;
};
```

The contract:

1. `check` resolves to a `ProviderOutcome` and **never rejects for a "taken"
   answer**. Rejection is only acceptable for unexpected infrastructure
   failures — the runner converts any rejection into `unknown`.
2. `available` agrees with `status`: `available`→`true`, `taken`/`invalid`→
   `false`, `unknown`→`null`.
3. Validate via `invalidOutcome(providerId, name, subject?)` **before** any
   network call; a violation returns `invalid` with
   `detail: "not a valid {label}: {reason}"`.
4. `available`/`taken` require a verified marker — a status code or body
   marker proven to mean that (RDAP 404, `DEPLOYMENT_NOT_FOUND`, registry
   404, WHOIS "no match" phrases, exact-match search hits). Bot walls,
   redirects, rate limits, 5xx and network failures always degrade to
   `unknown`; adapters never fabricate availability.
5. Honor the `AbortSignal` — abort errors propagate (the runner maps them to a
   timed-out `unknown`); every other failure degrades to `unknown`.

### Dependency injection

Every external call flows through `ProviderDeps` (`src/deps.ts`):
`fetch`, `whoisDomain` (whoiser), `resolveNs` (`node:dns`), `npmNameAvailable`
(npm-name), `rdapBootstrapUrl`, `githubApiBase`, `timeoutMs`, `userAgent`.
`defaultDeps()` wires the real implementations; tests substitute fakes instead
of `vi.mock`-ing internals, which keeps the whole suite offline (MSW +
`onUnhandledRequest: "error"`; WHOIS/DNS stubs injected as deps). The
Cloudflare Worker swaps in portable deps — DNS-over-HTTPS NS lookups, a WHOIS
stub that resolves "unavailable", and a fetch-based npm check — because raw
TCP and `node:dns` don't exist there.

## Strict TypeScript & the zero-`any` policy

The codebase enforces:

- `tsc --noEmit` in **strict** mode with `verbatimModuleSyntax` (import types
  with `import type`).
- ESLint `recommendedTypeChecked` with `no-explicit-any: error` and
  `no-non-null-assertion: error` — narrow types properly instead of `as any`
  or `!`. Response bodies are parsed into minimal local interfaces
  (`{ type?: unknown }`, `trackName?: unknown`, …) and narrowed before use.
- `knip` gates unused files/exports/dependencies; public API surface is marked
  `/** @public */`.
- Coverage floors in `vitest.config.ts`: ≥90% statements/functions/lines and
  ≥85% branches on `src/providers/**`, ≥95% on `src/schemas.ts`, ≥80% on
  `lib/**` and `worker/**`.
- `size-limit` caps `dist/**/*.js` at 50 kB and `.next` chunks at 3 MB.
- The contract matrix (`test/provider-contract.test.ts`) parameterizes over
  `PROVIDER_IDS`: schema compliance, `min−1`/`max+1` rejection, boundary
  acceptance, and non-ASCII rejection for every provider.

## Adding a new provider — step by step

1. **Pick the id** and add it to `PROVIDER_IDS` in `src/schemas.ts`
   (e.g. `"gitlab"` or a namespaced `"domain:newtld"` / `"social:threads"`).
2. **Add its `NameRule`** in `PROVIDER_NAME_RULES`
   (`src/providers/validation.ts`). The `Record<ProviderId, NameRule>` type
   makes skipping this a compile error. Compose constraints from the shared
   constants (`START_ALNUM`, `END_ALNUM`, `START_LETTER`, `NO_DOUBLE_HYPHEN`,
   `NO_DOUBLE_DOT`, `NO_DOUBLE_SEPARATOR`, `NO_LEADING_DOT`,
   `NO_TRAILING_DOT`) or define a new `NameConstraint`.
3. **Write the adapter** as a `create*Adapter(deps)` factory in the matching
   family module (or a new file). Validate first via `invalidOutcome`, then
   issue the check through `deps.fetch`/`deps.*` with the caller's
   `AbortSignal`; map only verified statuses/markers to `available`/`taken`
   and let everything else be `unknown`. Reuse `createPageCheck` or
   `createSubdomainCheck` when the shape fits.
4. **Register it** in `createAdapters` in `src/providers/index.ts`.
5. **Wire the UI**: a `ProviderMeta` entry in the right `PROVIDER_GROUPS`
   group (`lib/provider-meta.ts`), claim/profile deep links in
   `PLATFORM_LINKS` (`lib/links.ts`), a row in `TLD_PRICE_ESTIMATES` for a
   `domain:*` provider, and a brand icon in `components/brand-icons.tsx`.
6. **Extend aliases** if the provider belongs in one (`domains`, `socials`,
   `domains:cctld`, `domains:all` in `src/schemas.ts`).
7. **Test**: the contract matrix now covers the new id automatically — extend
   the _rule_, not the test. Add targeted tests only for behavior the matrix
   can't express (body markers, multi-step lookups). Never hit the live
   service: extend MSW handlers or inject `ProviderDeps` fakes.
8. **Run the gates**: `npm run check` (typecheck + lint + knip + format:check
   - test + build + size).

## MCP tool integration

`createNameCheckServer(deps)` registers two tools on an `McpServer` from
`@modelcontextprotocol/sdk`:

- **`check_availability`** — input `{ name, providers? }` validated by
  `checkAvailabilityInputSchema` (zod). `name` is a bare candidate
  (`nameSchema`: 1–63 chars, starts alnum, `[A-Za-z0-9._-]` — intentionally
  looser than provider rules so per-provider rejects surface as `invalid`
  results instead of a tool error). `providers` accepts individual ids or the
  aliases `all`, `domains`, `domains:cctld`, `domains:all`, `socials`;
  `resolveProviderIds()` expands and de-duplicates them. Output conforms to
  `checkAvailabilityOutputSchema` — `{ name, results[], summary }` — returned
  both as JSON text content and `structuredContent`.
- **`score_name`** — input `{ name }`; calls the deterministic heuristic in
  `src/scoring/score.ts` (no network).

Tool → engine call chain:

```
checkAvailability(input, deps)
  → resolveProviderIds(input.providers)          // default: all 55
  → selectAdapters(ids, deps)                    // createAdapters + pick
  → Promise.allSettled(adapters.map(a => checkWithTimeout(a, name, deps)))
  → { name, results, summary }
```

Transports: `src/index.ts` wraps the server in `StdioServerTransport`;
`src/http.ts`+`src/mcp-http.ts` serve stateless Streamable HTTP (a fresh
server/transport per request) plus the legacy SSE pair; `lib/mcp-web.ts` does
the same against web-standard `Request`/`Response` for the Next.js
`/api/mcp` route; `worker/index.ts` uses the SDK's
`WebStandardStreamableHTTPServerTransport`. The web UI bypasses MCP for its
own grid — `/api/availability` calls `checkAvailability` directly through the
`AvailabilityService` boundary (`lib/availability.ts`), which also implements
`LMKURNAME_AVAILABILITY_MODE=demo` (deterministic FNV-1a fixtures in
`lib/demo.ts`, no network).

## Caching

There is no persistent or cross-request cache — by design, since stateless
HTTP creates fresh adapters per request. Two memoizations live for the
lifetime of one `createAdapters()` call:

- **RDAP bootstrap** (`src/providers/rdap.ts`): `loadBootstrap()` memoizes the
  IANA `dns.json` promise so all 25 TLD adapters share one document. Failures
  reset the slot so the next lookup retries (errors are never cached).
- **GitHub `/users` lookup** (`src/providers/github.ts`): `createGitHubLookup`
  memoizes one `/users/{name}` promise per name, shared by the `github:user`
  and `github:org` adapters — one API call instead of two (the unauthenticated
  budget is 60 req/h). Entries evict on rejection so failed lookups can retry.

## Concurrency & timeouts

`runAvailabilityChecks` fans out all selected adapters **concurrently** via
`Promise.allSettled` — there is no batching or global concurrency limit; the
fan-out is bounded by the selection itself (max 55 checks, most of which hit
different hosts).

`checkWithTimeout` wraps each adapter in its own `AbortController` plus a
`Promise.race` against a `deps.timeoutMs` deadline (default 5 s). The race
guarantees resolution even for checks that can't observe cancellation — e.g.
the WHOIS TCP socket, which gets its own internal `timeoutMs − 250`. Any
rejection (timeout, abort, infrastructure error) becomes an `unknown` result
with the error message as `detail`; one adapter's failure can never fail the
batch. The runner then tallies `summary` counts per status.

## Rate-limit mitigations

- **Unknown over waiting**: `429` and auth/forbidden walls (`401`/`403`)
  map to `unknown` with provider-specific detail — no retries or backoff, so
  one throttled provider can't stall the batch.
- **Shared lookups**: the memoized GitHub `/users` lookup halves calls for the
  user+org pair; the shared RDAP bootstrap avoids 25 redundant fetches.
- **Headers**: registry APIs that require a `User-Agent` (GitHub, crates.io)
  get the shared `deps.userAgent`; social providers send a browser UA to avoid
  trivial rejection.
- **Honest degradation**: `unknown` stays a first-class status — the UI and
  summary count it separately rather than collapsing it into `taken`.
