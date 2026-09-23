# Provider search mechanisms

How every adapter in [`src/providers/`](../src/providers/) actually decides
`available` / `taken` / `unknown` / `invalid`. Source of truth: the adapter
files themselves — nothing here is aspirational.

## Outcome semantics (shared contract)

Every adapter returns a `ProviderOutcome` — `{ status, subject, available, detail? }`
([`src/types.ts`](../src/types.ts)):

| `status`    | `available` | Meaning                                                                                  |
| ----------- | ----------- | ---------------------------------------------------------------------------------------- |
| `available` | `true`      | The provider gave a verified "unclaimed" signal (e.g. RDAP 404, `DEPLOYMENT_NOT_FOUND`). |
| `taken`     | `false`     | The provider gave a verified "claimed" signal (e.g. RDAP 200, exact-name search hit).    |
| `unknown`   | `null`      | Inconclusive — timeout, rate limit, bot wall, inconclusive WHOIS/DNS. **Not** `taken`.   |
| `invalid`   | `false`     | The name cannot exist on this provider (failed its naming rules) — no network call made. |

Contract rules enforced by [`test/provider-contract.test.ts`](../test/provider-contract.test.ts):

- `available` must agree with `status` (`available`→`true`, `taken`/`invalid`→`false`, `unknown`→`null`).
- Validation runs **before** any network call; the detail reads `not a valid ${rule.label}: ${reason}`.
- Boundary lengths are accepted (`minLength`/`maxLength`); `min−1`/`max+1` are rejected (`too short`/`too long`).
- Every charset is ASCII-only — a non-ASCII character inside a length-valid name yields `disallowed character` (`appstore` additionally allows spaces/punctuation).
- Adapters only claim `available` on a verified unclaimed marker, and never reject for a `taken` answer — rejections are reserved for infrastructure failures the runner maps to `unknown`.

## Validation layer

Per-provider naming rules live in
[`PROVIDER_NAME_RULES`](../src/providers/validation.ts), a
`Record<ProviderId, NameRule>` — omitting a rule for a registered provider is a
**compile error**. A `NameRule` has `label`, `minLength`/`maxLength`, a
per-character `charset` regex, a `charsetLabel` and whole-name `constraints`
(edge characters, repeats, casing) evaluated by `validateName()` in order:
length → charset → constraints. `invalidOutcome()` turns a violation into the
`invalid` outcome before any fetch.

The input `name` is first gated by `nameSchema` in
[`src/schemas.ts`](../src/schemas.ts): 1–63 chars, must start with a letter or
digit, `[A-Za-z0-9._-]` only. Provider rules are intentionally stricter
(uppercase on npm is `invalid`, not a schema rejection).

## Execution model

[`runAvailabilityChecks`](../src/tools/checkAvailability.ts) fans the selected
adapters out concurrently under `Promise.allSettled`, each inside
`checkWithTimeout`: an `AbortController` + `setTimeout` deadline race of
`deps.timeoutMs` (default **5000 ms**, `DEFAULT_TIMEOUT_MS` in
[`src/deps.ts`](../src/deps.ts)). An abort or thrown error becomes
`unknown` with detail `timed out`/`timed out after 5000ms`; one provider's
failure never fails the batch.

## Domains (`domain:*`) — RDAP → WHOIS → DNS

[`domain.ts`](../src/providers/domain.ts) checks `{name}.{tld}` (lowercased)
through a three-stage fallback:

1. **RDAP** — [`rdap.ts`](../src/providers/rdap.ts) lazily fetches the IANA
   bootstrap `https://data.iana.org/rdap/dns.json` once per process and caches
   the TLD→base-URL map for the client's lifetime (failures are _not_ cached).
   If the TLD has an RDAP service, it GETs `{base}/domain/{fqdn}` with
   `Accept: application/rdap+json`:

   | HTTP status                                   | Verdict     |
   | --------------------------------------------- | ----------- |
   | 200                                           | `taken`     |
   | 404                                           | `available` |
   | 400 / 422                                     | `invalid`   |
   | anything else (incl. 429, 5xx, network error) | `unknown`   |

2. **WHOIS** — TLDs without an RDAP service fall back to raw WHOIS via
   `whoiser` (`whoisDomain` dep, TCP port 43, timeout `deps.timeoutMs − 250`).
   [`whois.ts`](../src/providers/whois.ts) text-matches the response: a
   "not found" phrase (`no match`, `not found`, `no entries found`,
   `status: free`, `is available`, …) → `available`; registration fields
   (`domain name`, `registrar`, `name server`, `creation date`, `expiry…`)
   → `taken`; anything else → `unknown`. WHOIS has no standard schema, so
   this is intentionally fuzzy — RDAP is preferred wherever it exists.

3. **DNS NS** — an inconclusive WHOIS falls through to
   [`dns.ts`](../src/providers/dns.ts): delegated NS records prove
   registration → `taken`; no records or a resolver error stays `unknown`
   (absence of delegation does **not** prove availability).

Before lookup: `invalidOutcome` + a 253-char FQDN cap; the detail carries
`rdap: {url}` or `whois fallback (no RDAP service for .{tld})`.

TLD coverage: 25 providers, `.com .gg .dev .io .ai .app .pt .es .de .fr .uk
.eu .co .me .org .sh .so .xyz .design .store .work .studio .tech .agency
.space` ([`PROVIDER_IDS`](../src/schemas.ts)). Label rules: 1–63 chars,
`[a-z0-9-]`, must start/end with a letter or digit; `.pt` and `.eu` require
≥2, `.es` and `.me` require ≥3 chars
([`validation.ts`](../src/providers/validation.ts)).

## Git hosting — GitHub & GitLab

[`github.ts`](../src/providers/github.ts) — three adapters over the
**unauthenticated** REST API (`{deps.githubApiBase}`, default
`https://api.github.com`):

- **`github:user` / `github:org`** share one memoized `GET /users/{name}`
  lookup ([`createGitHubLookup`](../src/providers/github.ts)) so a check costs
  a single call: `404` → `available`; `200` → `taken` (the `type` field says
  whether a user or an org holds it); `403` → `unknown` ("rate limit or
  forbidden — 60 req/h per IP unauthenticated"); other → `unknown`.
  Login rules: 1–39 chars, `[A-Za-z0-9-]`, no edge or consecutive hyphens.
- **`github:repo`** uses the Search API
  `GET /search/repositories?q={name} in:name&per_page=10`. Fuzzy results only
  count on an exact case-insensitive `name` match → `taken` (detail links the
  `{owner}/{repo}`); no match → `available`; `403`/`429` → `unknown`
  (unauthenticated search is ~10 req/min). Rules: 1–100, `[A-Za-z0-9._-]`,
  must start with a letter or digit.

[`devplatforms.ts`](../src/providers/devplatforms.ts) — **`gitlab`**: two
public REST calls. `GET /api/v4/users?username={name}` — `200` with a
non-empty array → `taken`. If empty, `GET /api/v4/groups/{name}` — `404` →
`available`; `200` → `taken`; `403` → `taken` ("private group — the path is
held either way"). Other statuses → `unknown`. Rules: 2–255, `[A-Za-z0-9._-]`,
must not start with a separator or end with a period.

## Package registries

- **`npm`** ([`npm.ts`](../src/providers/npm.ts)) — delegates to the
  `npm-name` package against the public registry (injected as
  `npmNameAvailable`). Internally `npm-name` issues `HEAD` requests against
  `registry.npmjs.org/{name}` (10 s internal timeout): `404` → free _unless_
  a punctuation-variant probe finds a collision — npm blocks names that
  differ from an existing package only by `-`/`_`/`.`, so `foo-bar` conflicts
  with `foobar`, `foo.bar` and `foo_bar` alike (each variant gets its own
  `HEAD`); `200` or a variant hit → taken. Names rejected by
  `validate-npm-package-name` (stricter than `PROVIDER_NAME_RULES` — e.g.
  core-module and reserved spellings) throw inside the dep and surface as
  `unknown` ("npm registry check failed"), not `invalid`, because the
  rejection happens at lookup time rather than during local validation. Any
  other failure → `unknown`. Rules: 1–214, **lowercase**
  `[a-z0-9._-]`, must not start with a period or underscore.
- **`pypi`** — `GET https://pypi.org/pypi/{normalized}/json`; the name is
  PEP 503-normalized (lowercase, `[-_.]+` → `-`): `404` → `available`,
  `200` → `taken`, else `unknown`. Rules: 1–255, `[A-Za-z0-9._-]`, start/end
  alphanumeric.
- **`crates`** — `GET https://crates.io/api/v1/crates/{name}`: `404` →
  `available`, `200` → `taken`. crates.io rejects requests without a
  User-Agent; `deps.userAgent` is sent. Rules: 1–64, `[A-Za-z0-9_-]`, must
  start with a letter.
- **`dockerhub`** — `GET https://hub.docker.com/v2/repositories/{name}/`:
  `200` → `taken` (namespace exists and has public repos), `404` →
  `available` — namespaces that are empty or fully private also answer 404,
  so it's best-effort. Rules: 4–30, lowercase `[a-z0-9._-]`, start/end
  alphanumeric, no consecutive separators.
- **`nuget`** — `GET https://api.nuget.org/v3-flatcontainer/{name}/index.json`
  (flat-container registration index, case-insensitive): `200` → `taken`,
  `404` → `available`. Rules: 1–128, `[A-Za-z0-9._-]`, starts alphanumeric.
- **`rubygems`** — `GET https://rubygems.org/api/v1/gems/{name}.json`:
  `200` → `taken`, `404` → `available`. Rules: 1–128, `[a-z0-9_-]`, starts
  with a letter.
- **`homebrew`** — `GET https://formulae.brew.sh/api/formula/{name}.json`:
  `200` → `taken`, `404` → `available`. Rules: 1–64, `[a-z0-9-]`, starts
  alphanumeric.
- **`huggingface`** — `GET https://huggingface.co/{name}` profile page:
  `200` → `taken`, `404` → `available`. Rules: 2–64, `[A-Za-z0-9_-]`, starts
  alphanumeric.

All of the above live in [`devplatforms.ts`](../src/providers/devplatforms.ts)
and [`platforms.ts`](../src/providers/platforms.ts); non-2xx/4xx statuses and
network failures → `unknown`.

## Hosted subdomains — Vercel, Netlify & Railway

[`hosting.ts`](../src/providers/hosting.ts) checks `https://{name}.{suffix}/`
with `redirect: "manual"` — the platform edge's own redirect proves a
deployment exists, and following it could land on an unrelated origin:

| Response                          | Verdict                                                   |
| --------------------------------- | --------------------------------------------------------- |
| 2xx–3xx                           | `taken` (a deployment holds the subdomain)                |
| 401 / 403                         | `taken` — "protected deployment" (auth-gated but claimed) |
| 404 **with** the unclaimed marker | `available`                                               |
| 404 without the marker            | `unknown` — availability is never fabricated              |
| 429                               | `unknown` ("rate limited the check")                      |
| other / network error             | `unknown`                                                 |

- **`vercel`** — unclaimed marker: `x-vercel-error: DEPLOYMENT_NOT_FOUND`
  header **or** `DEPLOYMENT_NOT_FOUND` in the 404 body.
- **`netlify`** — unclaimed marker: a 404 body that starts with `Not Found`
  (the edge's bare `Not Found - Request ID: …`).
- **`railway`** (`{name}.up.railway.app`) — unclaimed marker: a 404 carrying
  **both** the `x-railway-fallback: true` header and `Application not found`
  in the body (the edge's wildcard-DNS fallback page). A deployed app's own
  404 lacks the header, so missing either marker → `unknown`.

All three use the shared subdomain rule: 1–63, `[a-z0-9-]`, start/end alphanumeric.

## Hosted subdomains — DNS provisioned (Cloudflare Pages, Fly.io, Supabase)

`createSubdomainDnsCheck` in [`hosting.ts`](../src/providers/hosting.ts)
checks DNS existence via the injected `deps.resolveAny` (A/AAAA/CNAME —
Cloudflare DoH JSON in the Worker): these platforms provision DNS per
claim, so the zone has no wildcard and NXDOMAIN is the verified
"nobody holds this" marker.

| DNS result                  | Verdict                                      |
| --------------------------- | -------------------------------------------- |
| any A/AAAA/CNAME answer     | `taken`                                      |
| NXDOMAIN                    | `available`                                  |
| NODATA (empty, no NXDOMAIN) | `unknown`                                    |
| resolver error              | `unknown` — availability is never fabricated |

- **`cloudflare`** — `{name}.pages.dev`
- **`flyio`** — `{name}.fly.dev`
- **`supabase`** — `{name}.supabase.co`

All three use the shared subdomain rule: 1–63, `[a-z0-9-]`, start/end alphanumeric.

## App stores

[`stores.ts`](../src/providers/stores.ts) — **`appstore`** uses the public
iTunes Search API
`GET https://itunes.apple.com/search?term={name}&entity=software&country=US&limit=50`
(no key). The search is fuzzy, so only an exact case-insensitive `trackName`
match → `taken` (detail links the listing); no match → `available`; non-200 or
a malformed body → `unknown`. US storefront is pinned via `country=US`.
Rules: 2–30 — notably the only ASCII-plus-punctuation charset (`[A-Za-z0-9 .,!?&+'"(),:;@#%&*-]`).

The file documents the intent to add Google Play, Chrome Web Store and
Raycast Store here later — **not implemented**.

## Dev/community profiles

[`platforms.ts`](../src/providers/platforms.ts) shares a `createPageCheck`
spec: `free`/`busy` status lists per endpoint, `bodyMeansTaken` for marker
checks, and a hard rule that only verified statuses produce verdicts.

| Provider      | Endpoint                        | 200    | 404         | Notes                                                                                                  |
| ------------- | ------------------------------- | ------ | ----------- | ------------------------------------------------------------------------------------------------------ |
| `codepen`     | `codepen.io/{name}`             | taken  | available   | Sits behind a bot wall — 403 → `unknown`                                                               |
| `replit`      | `replit.com/@{name}`            | taken  | **unknown** | SPA serves a generic 404 shell for missing _and_ existing users — only 200 proves `taken` (`free: []`) |
| `figma`       | `figma.com/@{name}`             | taken  | available   |                                                                                                        |
| `dribbble`    | `dribbble.com/{name}`           | taken  | available   |                                                                                                        |
| `behance`     | `behance.net/{name}`            | taken  | available   |                                                                                                        |
| `substack`    | `{name}.substack.com`           | taken  | available   | Real 404 for absent publications; subject is `{name}.substack.com`                                     |
| `producthunt` | `producthunt.com/@{name}`       | taken  | available   | Cloudflare-walled — 403 → `unknown`                                                                    |
| `telegram`    | `t.me/{name}`                   | marker | —           | Always 200; `tgme_page_title` in body → `taken`, absent → `available`                                  |
| `medium`      | `medium.com/feed/@{name}` (RSS) | taken  | available   | Profile page is bot-walled; the feed is not                                                            |

## Social handles

[`social.ts`](../src/providers/social.ts) — all unauthenticated with a
browser User-Agent (descriptive UA keeps endpoints from being trivially
rejected).

| Provider           | Endpoint                                                                                             | Verdict logic                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `social:x`         | `x.com/{name}`                                                                                       | `404` → `available`, `200` → `taken`. Suspended accounts also 404 — `available` is not a claim guarantee                       |
| `social:bluesky`   | `public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={name}.bsky.social`              | `200` → `taken`, `400` → `available` (valid handle that doesn't resolve). Deactivated/reserved handles also report `available` |
| `social:instagram` | `i.instagram.com/api/v1/users/web_profile_info/?username={name}` with `x-ig-app-id: 936619743392459` | `200` → `taken`, `404` → `available`; `401`/`403` → `unknown` ("requires authentication") — common from most IPs               |
| `social:reddit`    | `www.reddit.com/api/username_available.json?user={name}`                                             | `200` + body `true` → `available`, `false` → `taken`; anything else (incl. 403/429 on datacenter IPs) → `unknown`              |
| `social:youtube`   | `youtube.com/@{name}`                                                                                | `404` → `available`, `200` → `taken`; consent walls/rate limits → `unknown`                                                    |
| `social:tiktok`    | `tiktok.com/@{name}`                                                                                 | 200 page embeds `statusCode`: `0` → `taken`, `10202`/`10221`/`10245` → `available`; missing marker → `unknown`                 |

## Runtime differences

On the **Cloudflare Worker** ([`worker/index.ts`](../worker/index.ts)) the
Node-only deps are swapped: WHOIS is a no-op resolving "unavailable" (no raw
TCP port 43) so the domain chain falls straight through to the DNS NS check —
reimplemented over Cloudflare's DoH JSON API — and `npmNameAvailable` becomes
direct `HEAD` requests against `registry.npmjs.org` (exact name plus
punctuation-variant probes, mirroring npm's own collision rules).

## What's **not** implemented

- No GraphQL anywhere — all checks are plain HTTP GETs, RDAP, WHOIS TCP, or DNS.
- No authenticated provider APIs; every check is anonymous, so rate limits are
  per-IP and shared with other traffic (see
  [troubleshooting.md](troubleshooting.md)).
- No result caching between requests — see
  [architecture.md](architecture.md) for what is cached (RDAP bootstrap,
  GitHub lookup) and what is not.

## Appendix — complete `PROVIDER_NAME_RULES` reference

Every rule in [`validation.ts`](../src/providers/validation.ts) verbatim:
inclusive length bounds, the per-character charset, and whole-name
constraints (evaluated in order after length and charset). Constraints are
composed from shared constants: `START_ALNUM`/`END_ALNUM` (must start/end
with a letter or digit), `START_LETTER`, `NO_DOUBLE_HYPHEN`,
`NO_DOUBLE_DOT`, `NO_DOUBLE_SEPARATOR` (no two `.`/`_`/`-` in a row),
`NO_LEADING_DOT`/`NO_TRAILING_DOT`. There is no explicit reserved-name list —
reserved-name policy lives inside `npm-name`/`validate-npm-package-name`
for npm, and nowhere else.

| Provider                                                                                                                                                                                                                                                                                                   | Min–Max | Charset                              | Constraints                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| `domain:com`, `domain:gg`, `domain:dev`, `domain:io`, `domain:ai`, `domain:app`, `domain:de`, `domain:fr`, `domain:uk`, `domain:co`, `domain:org`, `domain:sh`, `domain:so`, `domain:xyz`, `domain:design`, `domain:store`, `domain:work`, `domain:studio`, `domain:tech`, `domain:agency`, `domain:space` | 1–63    | `a-z0-9-` (case-insensitive)         | `START_ALNUM`, `END_ALNUM`                                                    |
| `domain:pt`, `domain:eu`                                                                                                                                                                                                                                                                                   | 2–63    | `a-z0-9-`                            | `START_ALNUM`, `END_ALNUM` (registries enforce a 2-char minimum)              |
| `domain:es`, `domain:me`                                                                                                                                                                                                                                                                                   | 3–63    | `a-z0-9-`                            | `START_ALNUM`, `END_ALNUM` (registries enforce a 3-char minimum at 2nd level) |
| `github:user`, `github:org`                                                                                                                                                                                                                                                                                | 1–39    | `A-Za-z0-9-`                         | `START_ALNUM`, `END_ALNUM`, `NO_DOUBLE_HYPHEN`                                |
| `github:repo`                                                                                                                                                                                                                                                                                              | 1–100   | `A-Za-z0-9._-`                       | `START_ALNUM`                                                                 |
| `gitlab`                                                                                                                                                                                                                                                                                                   | 2–255   | `A-Za-z0-9._-`                       | must not start with a separator; must not end with a period                   |
| `npm`                                                                                                                                                                                                                                                                                                      | 1–214   | `a-z0-9._-` (lowercase)              | must not start with a period or underscore                                    |
| `pypi`                                                                                                                                                                                                                                                                                                     | 1–255   | `A-Za-z0-9._-`                       | `START_ALNUM`, `END_ALNUM`                                                    |
| `crates`                                                                                                                                                                                                                                                                                                   | 1–64    | `A-Za-z0-9_-`                        | `START_LETTER`                                                                |
| `dockerhub`                                                                                                                                                                                                                                                                                                | 4–30    | `a-z0-9._-` (lowercase)              | `START_ALNUM`, `END_ALNUM`, `NO_DOUBLE_SEPARATOR`                             |
| `huggingface`                                                                                                                                                                                                                                                                                              | 2–64    | `A-Za-z0-9_-`                        | `START_ALNUM`                                                                 |
| `nuget`                                                                                                                                                                                                                                                                                                    | 1–128   | `A-Za-z0-9._-`                       | `START_ALNUM`                                                                 |
| `rubygems`                                                                                                                                                                                                                                                                                                 | 1–128   | `a-z0-9_-` (lowercase)               | `START_LETTER`                                                                |
| `homebrew`                                                                                                                                                                                                                                                                                                 | 1–64    | `a-z0-9-` (lowercase)                | `START_ALNUM`                                                                 |
| `codepen`                                                                                                                                                                                                                                                                                                  | 1–30    | `A-Za-z0-9_-`                        | —                                                                             |
| `replit`                                                                                                                                                                                                                                                                                                   | 2–64    | `A-Za-z0-9_-`                        | —                                                                             |
| `vercel`                                                                                                                                                                                                                                                                                                   | 1–63    | `a-z0-9-` (lowercase)                | `START_ALNUM`, `END_ALNUM` (`vercel.app` subdomain)                           |
| `netlify`                                                                                                                                                                                                                                                                                                  | 1–63    | `a-z0-9-` (lowercase)                | `START_ALNUM`, `END_ALNUM` (`netlify.app` subdomain)                          |
| `cloudflare`                                                                                                                                                                                                                                                                                               | 1–63    | `a-z0-9-` (lowercase)                | `START_ALNUM`, `END_ALNUM` (`pages.dev` subdomain)                            |
| `flyio`                                                                                                                                                                                                                                                                                                    | 1–63    | `a-z0-9-` (lowercase)                | `START_ALNUM`, `END_ALNUM` (`fly.dev` subdomain)                              |
| `railway`                                                                                                                                                                                                                                                                                                  | 1–63    | `a-z0-9-` (lowercase)                | `START_ALNUM`, `END_ALNUM` (`up.railway.app` subdomain)                       |
| `supabase`                                                                                                                                                                                                                                                                                                 | 1–63    | `a-z0-9-` (lowercase)                | `START_ALNUM`, `END_ALNUM` (`supabase.co` subdomain)                          |
| `appstore`                                                                                                                                                                                                                                                                                                 | 2–30    | `A-Za-z0-9` + ` .,!?&+'"(),:;@#%&*-` | — (the only punctuation-allowed charset)                                      |
| `figma`                                                                                                                                                                                                                                                                                                    | 1–50    | `A-Za-z0-9_-`                        | `START_ALNUM`                                                                 |
| `dribbble`                                                                                                                                                                                                                                                                                                 | 1–30    | `A-Za-z0-9_-`                        | `START_ALNUM`                                                                 |
| `behance`                                                                                                                                                                                                                                                                                                  | 3–30    | `A-Za-z0-9_-`                        | `START_ALNUM`                                                                 |
| `substack`                                                                                                                                                                                                                                                                                                 | 1–63    | `A-Za-z0-9-`                         | `START_ALNUM`, `END_ALNUM`                                                    |
| `producthunt`                                                                                                                                                                                                                                                                                              | 2–30    | `A-Za-z0-9_-`                        | —                                                                             |
| `telegram`                                                                                                                                                                                                                                                                                                 | 5–32    | `A-Za-z0-9_`                         | `START_LETTER`                                                                |
| `medium`                                                                                                                                                                                                                                                                                                   | 3–30    | `A-Za-z0-9._-`                       | `START_ALNUM`                                                                 |
| `social:x`                                                                                                                                                                                                                                                                                                 | 4–15    | `A-Za-z0-9_`                         | —                                                                             |
| `social:bluesky`                                                                                                                                                                                                                                                                                           | 3–20    | `A-Za-z0-9-`                         | `START_ALNUM`, `END_ALNUM`                                                    |
| `social:instagram`                                                                                                                                                                                                                                                                                         | 1–30    | `a-z0-9._` (case-insensitive)        | `NO_LEADING_DOT`, `NO_TRAILING_DOT`, `NO_DOUBLE_DOT`                          |
| `social:reddit`                                                                                                                                                                                                                                                                                            | 3–20    | `A-Za-z0-9_-`                        | —                                                                             |
| `social:youtube`                                                                                                                                                                                                                                                                                           | 3–30    | `A-Za-z0-9._-`                       | —                                                                             |
| `social:tiktok`                                                                                                                                                                                                                                                                                            | 2–24    | `a-z0-9._` (case-insensitive)        | —                                                                             |
