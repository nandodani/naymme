# AGENTS.md — guide for AI agents working in this repo

`lmkurname` checks one candidate name's availability across 55+ providers
(domains, developer platforms, package registries, socials, publishing)
and scores it for brand quality. It ships as three runtimes from a single
TypeScript codebase:

| Surface                        | Entry                             | Notes                                                                                   |
| ------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------- |
| MCP stdio server (npm package) | `src/index.ts`                    | published bin `lmkurname` (`dist/index.js`)                                             |
| Node HTTP (Streamable HTTP)    | `src/http.ts` + `src/mcp-http.ts` | `npm run dev:http` / `start:http`                                                       |
| Next.js web app                | `app/`, `components/`, `lib/`     | UI + `/api/availability`, `/api/score`, `/api/mcp` (`/mcp` and `/health` rewrite to it) |
| Cloudflare Worker              | `worker/index.ts`                 | same MCP tools; web-standard APIs only (no `node:dns`/TCP)                              |

## Architecture

- `src/schemas.ts` — the provider registry (`PROVIDER_IDS`, 55 ids),
  aliases (`all`, `domains`, `domains:cctld`, `domains:all`, `socials`),
  `resolveProviderIds()` expansion, and all zod IO schemas
  (`nameSchema`, `checkAvailabilityInputSchema`, `...OutputSchema`).
- `src/types.ts` — `ProviderAdapter` / `ProviderOutcome` /
  `AvailabilityResult` / `ProviderDeps` types.
- `src/deps.ts` — `ProviderDeps` dependency injection (fetch, whoisDomain,
  resolveNs, npmNameAvailable, timeoutMs, …) and `defaultDeps()`. Tests
  substitute fakes here; never `vi.mock` internals.
- `src/providers/` — one module per adapter family:
  `domain.ts` (RDAP → WHOIS → DNS NS chain), `rdap.ts` (IANA bootstrap
  client), `whois.ts`, `dns.ts`, `github.ts` (user/org/repo), `npm.ts`,
  `devplatforms.ts`, `platforms.ts`, `hosting.ts` (vercel/netlify
  subdomain checks with unclaimed-marker verification), `stores.ts`,
  `social.ts`, and `index.ts` (`createAdapters`, `selectAdapters`).
- `src/providers/validation.ts` — `PROVIDER_NAME_RULES` (a
  `Record<ProviderId, NameRule>` — adding a provider id without a rule is
  a compile error), `validateName`, `invalidOutcome`.
- `src/tools/checkAvailability.ts` — `checkWithTimeout` (per-adapter
  `AbortController` + deadline race) and `runAvailabilityChecks`
  (`Promise.allSettled` — one failing adapter degrades to `unknown`,
  never fails the batch).
- `src/server.ts` — `createNameCheckServer(deps)`: registers the two MCP
  tools. `src/mcp-http.ts` adapts it to Node HTTP; `lib/mcp-web.ts` and
  `worker/index.ts` to web-standard Request/Response.
- `lib/` — web-side services: `availability.ts` (live vs demo service,
  `LMKURNAME_AVAILABILITY_MODE=demo` switches to deterministic FNV-1a
  fixtures in `demo.ts`), `score-api.ts`, `mcp-web.ts`, `links.ts`
  (registrar deep links + `TLD_PRICE_ESTIMATES`), `provider-meta.ts`
  (grid grouping in `PROVIDER_GROUPS`), `result-filter.ts`,
  `overall-display.ts`, `mcp-config.ts`, `mcp-guides.ts`, `utils.ts`.
- `components/` — React client components (`name-checker.tsx` is the app;
  `silk.tsx` is the R3F background — needs WebGL, not covered in Node).
- `src/scoring/` — deterministic brand scoring (`score.ts` → `total` 0–100
  and `grade`; `overall.ts` availability tallies/percent for the UI card).

## MCP tools

- `check_availability` — `{ name, providers? }` → `{ name, results, summary }`.
  Each result: `{ provider, status, subject, available, detail?, durationMs }`
  with `status ∈ available | taken | unknown | invalid`.
- `score_name` — `{ name }` → deterministic score payload (no network).

## Provider contract (enforced by `test/provider-contract.test.ts`)

Every adapter **must**:

1. Return `{ status, subject, available, detail? }` matching the
   `ProviderOutcome` shape; `available` agrees with `status`
   (`available`→`true`, `taken`/`invalid`→`false`, `unknown`→`null`).
2. Validate the name via `invalidOutcome(providerId, name, subject?)`
   **before** any network call — status `invalid`, detail
   `not a valid ${rule.label}: ${reason}`.
3. Accept names of exactly `minLength`/`maxLength` chars and reject
   `minLength-1` / `maxLength+1` (`too short` / `too long` in detail).
4. Reject non-ASCII characters inside a length-valid name
   (`disallowed character` detail — every charset is ASCII-only;
   `appstore` additionally allows spaces/punctuation).
5. Honor the `AbortSignal`: abort errors propagate (the runner maps them
   to a timed-out `unknown`); other failures degrade to `unknown`, never
   a fabricated `available` — adapters only claim `available` on a
   verified unclaimed marker (e.g. RDAP 404, `DEPLOYMENT_NOT_FOUND`,
   registry 404, WHOIS "no match" phrases in `whois.ts`).

## Testing standards

- `npm test` — Vitest (`test/**/*.test.{ts,tsx}`), Node environment.
  Suite is fully offline: HTTP egress is mocked by **MSW**
  (`test/provider-contract.test.ts`, `test/worker-availability.test.ts`)
  or by injected `deps` fakes; WHOIS/DNS stubs live in the deps.
  `onUnhandledRequest: "error"` is intentional — a test hitting a real
  URL fails.
- Contract matrix: parameterized over `PROVIDER_IDS` — schema
  compliance, min−1/max+1 rejection, boundary acceptance, forbidden
  characters. Extend the rule, not the test, when adding a provider.
- React components are checked with `react-dom/server`
  `renderToStaticMarkup` (`test/components.test.tsx`) — no DOM/jsdom.
- `test:e2e` — Playwright smoke against `next start` in
  `LMKURNAME_AVAILABILITY_MODE=demo` (deterministic, offline-safe).
- Coverage: `npm run test:coverage` (v8 provider). Thresholds in
  `vitest.config.ts` — ≥90% statements/functions/lines and ≥85% branches
  on `src/providers/**`, ≥95% on `src/schemas.ts`, ≥80% on `lib/**` and
  `worker/**`. Keep them honest: raise, never lower.

## Zero-`any` and dead-code policy

- `tsc --noEmit` strict mode + ESLint `recommendedTypeChecked` with
  `no-explicit-any: error` and `no-non-null-assertion: error`. No `any`,
  no `!` — narrow types properly.
- `npm run knip` gates unused files/exports/deps. Public-API surface is
  marked `/** @public */`; `components/ui/**` is ignored (shadcn-style
  primitive API); `ignoreExportsUsedInFile` covers registry patterns.
- `npm run size` (size-limit, file preset) caps `dist/**/*.js` at 50 kB
  and `.next/static/chunks/*.js` at 3 MB.

## Commands

| Task         | Command                                                                |
| ------------ | ---------------------------------------------------------------------- |
| Typecheck    | `npm run typecheck`                                                    |
| Lint         | `npm run lint`                                                         |
| Dead code    | `npm run knip`                                                         |
| Format check | `npm run format:check`                                                 |
| Unit tests   | `npm test` / `npm run test:coverage`                                   |
| E2E smoke    | `npm run build && npx playwright install chromium && npm run test:e2e` |
| Prod build   | `npm run build` (next build + tsc)                                     |
| Bundle guard | `npm run size`                                                         |
| Everything   | `npm run check`                                                        |

## CI

`.github/workflows/ci.yml` runs six parallel jobs: typecheck, lint+format,
knip, tests with coverage, build+size, and Playwright e2e. All must stay
green — same commands as `npm run check` locally.

## Practical rules for agents

- **Add a provider:** add the id to `PROVIDER_IDS`, a `NameRule` in
  `PROVIDER_NAME_RULES` (compile error if forgotten), an adapter factory
  in `createAdapters`/`selectAdapters`, display metadata in
  `lib/provider-meta.ts`, links in `lib/links.ts`, pricing in
  `TLD_PRICE_ESTIMATES` for domains, and a brand icon in
  `components/brand-icons.tsx`. The contract matrix then covers it.
- **Never** call live registries/whois in tests — extend MSW handlers or
  inject `ProviderDeps` fakes.
- **`worker/index.ts`** must stay web-standard API only (no `node:*`);
  shared logic lives in `src/`, runtime-specific deps in `workerDeps()`.
- `verbatimModuleSyntax` is on: import types with `import type`.
- Don't commit generated/`dist`/`.next` output; `AGENTS.md` is tracked
  (it was removed from `.gitignore` on purpose).
