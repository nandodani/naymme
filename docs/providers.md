# Provider reference

`lmkurname` checks one candidate name across 55 providers, grouped into adapter
families under `src/providers/`. Every adapter returns a normalized
`ProviderOutcome`:

```ts
{
  status: "available" | "taken" | "unknown" | "invalid",
  subject: string,           // the concrete identifier checked, e.g. "acme.com"
  available: boolean | null, // true = free, false = taken/invalid, null = unknown
  detail?: string,           // registry URL, error reason, etc.
}
```

`unknown` means the provider could not give a definitive answer — network error,
rate limit, inconclusive WHOIS, timeout. It is **not** the same as `taken`.

All adapters share a common contract (enforced by
`test/provider-contract.test.ts`):

1. Validate the name via `invalidOutcome()` **before** any network call —
   invalid names return `invalid` without touching the network.
2. `available`/`taken` are only returned on a **verified marker** (a status code
   or body marker proven to mean free/held). Everything else — rate limits, bot
   walls, unexpected statuses, network failures — reports `unknown`.
3. Honor the `AbortSignal`; aborts propagate and the runner maps them to a
   timed-out `unknown`.

## Availability mechanisms

The providers use five families of checks:

| Mechanism            | Used by                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| HTTP status code     | Most adapters — GET a public URL; a verified status (`200`/`404`/…) maps to `taken`/`available`.                         |
| Public REST/JSON API | GitHub, GitLab, npm (registry HEAD), PyPI, crates.io, Docker Hub, NuGet, RubyGems, Homebrew, App Store, Bluesky, Reddit. |
| RDAP                 | `domain:*` TLDs that publish an RDAP service in the IANA bootstrap registry.                                             |
| WHOIS                | `domain:*` TLDs without RDAP; fuzzy text matching, fallback only.                                                        |
| DNS NS record        | `domain:*` — last-resort signal when WHOIS is inconclusive.                                                              |

No provider uses GraphQL, and only the npm check (via `npm-name` on Node, and a
manual `HEAD` on the Cloudflare Worker) uses HEAD requests; every other HTTP
check is a `GET`.

## Domains (`domain:*` — 25 TLDs)

Provider ids: `domain:com`, `domain:gg`, `domain:dev`, `domain:io`, `domain:ai`,
`domain:app`, `domain:pt`, `domain:es`, `domain:de`, `domain:fr`, `domain:uk`,
`domain:eu`, `domain:co`, `domain:me`, `domain:org`, `domain:sh`, `domain:so`,
`domain:xyz`, `domain:design`, `domain:store`, `domain:work`, `domain:studio`,
`domain:tech`, `domain:agency`, `domain:space`.

Implemented in `src/providers/domain.ts` (`createDomainAdapter(tld, deps,
rdap)`). All TLD adapters share one `RdapClient` so the IANA bootstrap document
is fetched once per `createAdapters()` call.

Resolution order:

1. **RDAP** (`src/providers/rdap.ts`) — the IANA bootstrap registry
   (`https://data.iana.org/rdap/dns.json`) maps each TLD to its RDAP base URL;
   the document is fetched lazily and cached for the client's lifetime (fetch
   failures are not cached). If the TLD has an RDAP service, the adapter GETs
   `{base}/domain/{fqdn}` and maps the status: `404` → `available`,
   `200` → `taken`, `400`/`422` → `invalid`, everything else (including
   `429` and 5xx) → `unknown`. If the bootstrap fetch itself fails, the adapter
   falls through to WHOIS.
2. **WHOIS** (`src/providers/whois.ts`) — for TLDs with no RDAP service, a raw
   WHOIS query via `whoiser` (`follow: 1` referral hop, timeout = the provider
   timeout minus 250 ms). WHOIS has no standard schema, so the response text is
   matched against `NOT_FOUND_PATTERNS` (`no match`, `not found`,
   `no entries found`, `no data found`, `nothing found`, `domain not found`,
   `status: free|available`, `is available`, `available for registration`) →
   `available`, and `TAKEN_PATTERNS` (`domain name`, `registrar`, `name server`,
   `creation date`, `expiry|expires|expiration`) → `taken`. Neither match →
   `unknown`.
3. **DNS NS check** (`src/providers/dns.ts`) — final signal when WHOIS is
   inconclusive. Delegated name servers prove the domain is registered →
   `taken`. The absence of NS records does **not** prove availability
   (undelegated registrations exist), so anything else stays `unknown`.

Additional rule: the composed FQDN `{name}.{tld}` must be ≤ 253 characters;
longer names are `invalid`. On the Cloudflare Worker, WHOIS (raw TCP port 43)
is replaced by a stub that resolves "unavailable", so the chain falls through
to the NS check, which is implemented over Cloudflare's DNS-over-HTTPS JSON API
(`cloudflare-dns.com/dns-query`).

## Dev platforms & registries

### GitHub (`src/providers/github.ts`)

User and org share one namespace, so `github:user` and `github:org` both query
`GET api.github.com/users/{name}` through a memoized lookup shared by the two
adapters — one API call covers both checks (unauthenticated limit: 60 req/h per
IP). `404` → absent (`available` for both adapters), `200` → held; the
response's `type` field (`"Organization"` vs anything else) is reported in the
`detail` so the caller can see which of the two holds the name. `403` →
`unknown` (rate limit or forbidden); other statuses → `unknown`.

`github:repo` is a separate collision check via the unauthenticated Search API:
`GET /search/repositories?q={name} in:name&per_page=10`. Because search is
fuzzy, only an **exact case-insensitive** `name` match in `items` counts as
`taken` (reported as `{owner}/{repo}`). `403`/`429` → `unknown`
(unauthenticated search is limited to 10 req/min per IP).

### GitLab (`gitlab`, `src/providers/devplatforms.ts`)

Two-step REST check: `GET gitlab.com/api/v4/users?username={name}`. A non-empty
array → `taken`. An empty array triggers `GET /api/v4/groups/{name}`:
`404` → `available`, `200` → `taken` (public group), `403` → `taken` (private
group — the path is held either way). Any other status on either call →
`unknown`.

### npm (`npm`, `src/providers/npm.ts`)

Delegates to the `npm-name` package via the injected `deps.npmNameAvailable`.
`npm-name` runs `HEAD registry.npmjs.org/{name}` (and, for unscoped names,
`HEAD` probes of punctuation variants — npm blocks names that differ from an
existing package only by `-`/`_`/`.`, e.g. `foo-bar` collides with `foobar`).
`404` plus no variant conflict → `available`; `200` or a variant hit →
`taken`; any thrown error (validation failures from `validate-npm-package-name`,
non-404 statuses, timeouts — `npm-name` uses a 10 s request timeout internally
and resolves before the adapter's own deadline) → `unknown`. The Worker
reimplements the same logic: `HEAD` on the package URL plus the variant probes.

### Other registries (`src/providers/devplatforms.ts`, `src/providers/platforms.ts`)

| Provider      | Endpoint                                                  | `taken` | `available` |
| ------------- | --------------------------------------------------------- | ------- | ----------- |
| `pypi`        | `GET pypi.org/pypi/{name}/json` (name PEP 503–normalized) | `200`   | `404`       |
| `crates`      | `GET crates.io/api/v1/crates/{name}`                      | `200`   | `404`       |
| `dockerhub`   | `GET hub.docker.com/v2/repositories/{name}/`              | `200`   | `404`       |
| `nuget`       | `GET api.nuget.org/v3-flatcontainer/{name}/index.json`    | `200`   | `404`       |
| `rubygems`    | `GET rubygems.org/api/v1/gems/{name}.json`                | `200`   | `404`       |
| `homebrew`    | `GET formulae.brew.sh/api/formula/{name}.json`            | `200`   | `404`       |
| `huggingface` | `GET huggingface.co/{name}`                               | `200`   | `404`       |

PyPI names are lowercased and `-`/`_`/`.` runs normalized to a single `-`
(PEP 503). Docker Hub is best-effort: a namespace that exists but has no public
repositories also answers `404`, so `available` there means "no public
namespace". crates.io rejects requests without a `User-Agent`; all adapters
send the shared `deps.userAgent`.

Any other status on these endpoints → `unknown`.

## Hosted subdomains (`src/providers/hosting.ts`)

`vercel` and `netlify` check `GET https://{name}.{vercel.app|netlify.app}/`
with `redirect: "manual"` (the platform edge's own redirect proves a
deployment exists — following it could land on an unrelated origin's status
code).

Verdict mapping for both:

- `200`–`399` → `taken` (a deployment serves the name)
- `401`/`403` → `taken` — auth-gated deployments exist but can't be viewed;
  the name is held
- `404` → `available` **only** when the platform's unclaimed marker is
  verified; a 404 without it is `unknown`
- `429` → `unknown` (rate limited)
- anything else → `unknown`

Unclaimed markers:

- **Vercel**: `x-vercel-error: DEPLOYMENT_NOT_FOUND` response header or
  `DEPLOYMENT_NOT_FOUND` in the body.
- **Netlify**: body starts with `Not Found` (the edge's bare
  `Not Found - Request ID: …` page; a claimed site serves its own content and
  never that body).

## Stores (`src/providers/stores.ts`)

`appstore` queries the public iTunes Search API — one unauthenticated GET:
`itunes.apple.com/search?term={name}&entity=software&country=US&limit=50`.
The search is fuzzy, so only an exact `trackName` match (case-insensitive)
counts: a listing with the identical name → `taken` (with the app's
`trackViewUrl`), otherwise → `available`. Non-`200` responses and unexpected
bodies → `unknown`. Note the check pins the US storefront; names occupied only
in other storefronts are not detected.

## Socials (`src/providers/social.ts`)

All social adapters send a desktop-browser `User-Agent` because these platforms
trivially reject unauthenticated non-browser clients.

| Provider           | Endpoint                                                                                      | `taken`                          | `available`                                  | Notes                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `social:x`         | `GET x.com/{name}`                                                                            | `200`                            | `404`                                        | Suspended accounts also answer `404` — `available` is not a guarantee the handle can be claimed.      |
| `social:bluesky`   | `GET public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={name}.bsky.social`   | `200` (handle resolves)          | `400` (valid handle, doesn't resolve)        | Deactivated/reserved handles also fail resolution → `available`. Checks the `.bsky.social` namespace. |
| `social:instagram` | `GET i.instagram.com/api/v1/users/web_profile_info/?username={name}` (+ `x-ig-app-id` header) | `200`                            | `404`                                        | `401`/`403` → `unknown` (Instagram requires auth on most IPs); `429` → `unknown`.                     |
| `social:reddit`    | `GET www.reddit.com/api/username_available.json?user={name}`                                  | `200` + body `false`             | `200` + body `true`                          | Any other 200 body, or `403`/`429` (Reddit rate-limits datacenter IPs), → `unknown`.                  |
| `social:youtube`   | `GET www.youtube.com/@{name}`                                                                 | `200`                            | `404`                                        | Consent walls and rate limits → `unknown`.                                                            |
| `social:tiktok`    | `GET www.tiktok.com/@{name}`                                                                  | `200` + `"statusCode":0` in HTML | `200` + `statusCode` ∈ {10202, 10221, 10245} | Pages without the marker (bot walls, consent redirects, layout changes) → `unknown`.                  |

## Community & publishing platforms (`src/providers/platforms.ts`)

These use the shared `createPageCheck()` helper: `GET` a public URL,
`free`/`busy` status lists map to `available`/`taken`, everything else →
`unknown`. Defaults are `free: [404]`, `busy: [200]`.

| Provider      | URL                       | `taken`                           | `available`              | Notes                                                                                                                          |
| ------------- | ------------------------- | --------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `codepen`     | `codepen.io/{name}`       | `200`                             | `404`                    | Bot wall (`403` for non-browser clients) → `unknown`.                                                                          |
| `replit`      | `replit.com/@{name}`      | `200`                             | —                        | `free: []`: the SPA returns a generic 404 shell for missing users, so only `200` is meaningful — everything else is `unknown`. |
| `figma`       | `figma.com/@{name}`       | `200`                             | `404`                    |                                                                                                                                |
| `dribbble`    | `dribbble.com/{name}`     | `200`                             | `404`                    |                                                                                                                                |
| `behance`     | `behance.net/{name}`      | `200`                             | `404`                    |                                                                                                                                |
| `substack`    | `{name}.substack.com`     | `200`                             | `404`                    | Substack serves a real 404 for absent publications.                                                                            |
| `producthunt` | `producthunt.com/@{name}` | `200`                             | `404`                    | Cloudflare-walled for non-browser clients (`403` → `unknown`).                                                                 |
| `telegram`    | `t.me/{name}`             | `200` + `tgme_page_title` in body | `200` without the marker | The page always answers `200`, so the body marker decides.                                                                     |
| `medium`      | `medium.com/feed/@{name}` | `200`                             | `404`                    | The profile page is bot-walled; the RSS feed is not.                                                                           |

## Input validation rules

Every adapter validates the name against its entry in `PROVIDER_NAME_RULES`
(`src/providers/validation.ts`) before any network call. A failure returns
`invalid` with a detail of the form `not a valid {label}: {reason}` — length
bounds first, then per-character charset, then whole-name constraints. All
charsets are ASCII-only (the contract test requires a length-valid name with
non-ASCII characters to be rejected with `disallowed character`); `appstore` is
the only provider whose charset allows spaces and punctuation.

Length bounds are inclusive: `minLength`/`maxLength` are accepted,
`minLength − 1`/`maxLength + 1` are rejected (`too short`/`too long`).

| Provider                                                                                                                                                                                                                                                                                                   | Min–Max | Charset                                                                  | Whole-name constraints                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `domain:com`, `domain:gg`, `domain:dev`, `domain:io`, `domain:ai`, `domain:app`, `domain:de`, `domain:fr`, `domain:uk`, `domain:co`, `domain:org`, `domain:sh`, `domain:so`, `domain:xyz`, `domain:design`, `domain:store`, `domain:work`, `domain:studio`, `domain:tech`, `domain:agency`, `domain:space` | 1–63    | letters, digits, hyphens (case-insensitive)                              | must start and end alnum                                                  |
| `domain:pt`, `domain:eu`                                                                                                                                                                                                                                                                                   | 2–63    | letters, digits, hyphens                                                 | must start and end alnum (registries enforce 2-char minimum)              |
| `domain:es`, `domain:me`                                                                                                                                                                                                                                                                                   | 3–63    | letters, digits, hyphens                                                 | must start and end alnum (registries enforce 3-char minimum at 2nd level) |
| `github:user`, `github:org`                                                                                                                                                                                                                                                                                | 1–39    | letters, digits, hyphens                                                 | must start/end alnum; no consecutive hyphens                              |
| `github:repo`                                                                                                                                                                                                                                                                                              | 1–100   | letters, digits, `.`, `_`, `-`                                           | must start alnum                                                          |
| `gitlab`                                                                                                                                                                                                                                                                                                   | 2–255   | letters, digits, `.`, `_`, `-`                                           | must not start with a separator; must not end with a period               |
| `npm`                                                                                                                                                                                                                                                                                                      | 1–214   | lowercase letters, digits, `.`, `_`, `-`                                 | must not start with a period or underscore                                |
| `pypi`                                                                                                                                                                                                                                                                                                     | 1–255   | letters, digits, `.`, `_`, `-`                                           | must start and end alnum                                                  |
| `crates`                                                                                                                                                                                                                                                                                                   | 1–64    | letters, digits, `_`, `-`                                                | must start with a letter                                                  |
| `dockerhub`                                                                                                                                                                                                                                                                                                | 4–30    | lowercase letters, digits, `.`, `_`, `-`                                 | must start/end alnum; no consecutive separators                           |
| `huggingface`                                                                                                                                                                                                                                                                                              | 2–64    | letters, digits, `_`, `-`                                                | must start alnum                                                          |
| `nuget`                                                                                                                                                                                                                                                                                                    | 1–128   | letters, digits, `.`, `_`, `-`                                           | must start alnum                                                          |
| `rubygems`                                                                                                                                                                                                                                                                                                 | 1–128   | lowercase letters, digits, `_`, `-`                                      | must start with a letter                                                  |
| `homebrew`                                                                                                                                                                                                                                                                                                 | 1–64    | lowercase letters, digits, hyphens                                       | must start alnum                                                          |
| `codepen`                                                                                                                                                                                                                                                                                                  | 1–30    | letters, digits, `_`, `-`                                                | —                                                                         |
| `replit`                                                                                                                                                                                                                                                                                                   | 2–64    | letters, digits, `_`, `-`                                                | —                                                                         |
| `vercel`                                                                                                                                                                                                                                                                                                   | 1–63    | lowercase letters, digits, hyphens                                       | must start and end alnum (`vercel.app` subdomain rule)                    |
| `netlify`                                                                                                                                                                                                                                                                                                  | 1–63    | lowercase letters, digits, hyphens                                       | must start and end alnum (`netlify.app` subdomain rule)                   |
| `appstore`                                                                                                                                                                                                                                                                                                 | 2–30    | alphanumeric plus standard punctuation (`._!?&+'"(),:;@#%&*-` and space) | —                                                                         |
| `figma`                                                                                                                                                                                                                                                                                                    | 1–50    | letters, digits, `_`, `-`                                                | must start alnum                                                          |
| `dribbble`                                                                                                                                                                                                                                                                                                 | 1–30    | letters, digits, `_`, `-`                                                | must start alnum                                                          |
| `behance`                                                                                                                                                                                                                                                                                                  | 3–30    | letters, digits, `_`, `-`                                                | must start alnum                                                          |
| `substack`                                                                                                                                                                                                                                                                                                 | 1–63    | letters, digits, hyphens                                                 | must start and end alnum                                                  |
| `producthunt`                                                                                                                                                                                                                                                                                              | 2–30    | letters, digits, `_`, `-`                                                | —                                                                         |
| `telegram`                                                                                                                                                                                                                                                                                                 | 5–32    | letters, digits, underscores                                             | must start with a letter                                                  |
| `medium`                                                                                                                                                                                                                                                                                                   | 3–30    | letters, digits, `.`, `_`, `-`                                           | must start alnum                                                          |
| `social:x`                                                                                                                                                                                                                                                                                                 | 4–15    | letters, digits, underscores                                             | —                                                                         |
| `social:bluesky`                                                                                                                                                                                                                                                                                           | 3–20    | letters, digits, hyphens                                                 | must start and end alnum                                                  |
| `social:instagram`                                                                                                                                                                                                                                                                                         | 1–30    | letters, digits, `.`, `_`                                                | no leading/trailing period; no consecutive periods                        |
| `social:reddit`                                                                                                                                                                                                                                                                                            | 3–20    | letters, digits, `_`, `-`                                                | —                                                                         |
| `social:youtube`                                                                                                                                                                                                                                                                                           | 3–30    | letters, digits, `.`, `_`, `-`                                           | —                                                                         |
| `social:tiktok`                                                                                                                                                                                                                                                                                            | 2–24    | letters, digits, `.`, `_`                                                | —                                                                         |

Notes on validation coverage:

- The tool's own `nameSchema` (in `src/schemas.ts`) is deliberately looser —
  1–63 chars, starts alnum, `[A-Za-z0-9._-]` — so provider-specific rejects
  surface as per-provider `invalid` results rather than a tool-level error.
- `PROVIDER_NAME_RULES` is a `Record<ProviderId, NameRule>`: adding a provider
  id without a rule is a **compile error**.
- There is no explicit reserved-name list in `PROVIDER_NAME_RULES`. npm's
  stricter policy (core-module names, `validate-npm-package-name` rejects,
  punctuation-collision rules) is enforced inside `npm-name` — a name that
  fails those checks surfaces as `unknown` ("npm registry check failed"), not
  `invalid`, because the rejection happens at lookup time rather than during
  local validation.

## Response handling

- **Status → verdict mapping**: every adapter maps a small set of verified
  statuses to `available`/`taken`/`invalid` and lets **everything else —
  including `429`, `401`/`403` bot walls, 5xx and network errors — degrade to
  `unknown`**. Adapters never fabricate `available` from an ambiguous response.
- **Timeouts**: each check runs under its own `AbortController` with a
  `deps.timeoutMs` deadline (default `DEFAULT_TIMEOUT_MS = 5000` in
  `src/deps.ts`). The runner races `adapter.check()` against the deadline, so
  even a provider that cannot observe cancellation (e.g. the WHOIS socket)
  resolves as `unknown` after 5 s. The WHOIS dep itself gets
  `timeoutMs − 250` (floor 1 s) so it fails before the outer deadline.
- **Rate limits**: `429` always maps to `unknown`, with provider-specific
  detail text where the adapter knows the limit (e.g. GitHub's 60 req/h REST /
  10 req/min search; Instagram's auth wall). There are no retries or backoff —
  a rate-limited provider reports `unknown` for that check rather than delaying
  the batch.
- **`available` field agreement**: `available`→`true`, `taken`/`invalid`→
  `false`, `unknown`→`null` — enforced by the provider contract test.
- **`subject` conventions**: domains carry the full FQDN (`acme.com`), hosted
  subdomains the full hostname (`acme.vercel.app`), Bluesky/Telegram/Medium the
  `@{handle}` form, and registries the normalized name (PyPI's PEP 503 form).
