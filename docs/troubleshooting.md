# Troubleshooting & rate limits

Reading `unknown` results, per-provider limits, and the runtime caveats that
make checks inconclusive. Grounded in the adapters —
[`src/providers/`](../src/providers/), [`worker/index.ts`](../worker/index.ts).

## `unknown` is not `taken`

`status: "unknown"` (`available: null`) means the provider could not decide:
network error, rate limit, blocked endpoint, timeout, or an inconclusive
WHOIS/DNS answer. The `detail` field carries the reason (e.g. `timed out`,
`GitHub API rate limit`, `Instagram requires authentication`). **Never treat
`unknown` as `taken` — or as `available`.**

`invalid` is different again: the name cannot exist on that provider at all
(violated its naming rules — detail reads `not a valid <label>: <reason>`),
reported with no network call.

## Per-provider rate limits & bot walls (all anonymous checks)

Every check is unauthenticated — limits are per egress IP, shared with all
other anonymous traffic from the same IP.

| Provider                     | Limit / wall                                                                                     | Symptom                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| GitHub `/users`              | ~60 req/h unauthenticated; `403` → `unknown` ("rate limit or forbidden")                         | Frequent `github:user`/`github:org` unknowns on shared egress |
| GitHub search                | ~10 req/min unauthenticated; `403`/`429` → `unknown`                                             | `github:repo` unknowns under load                             |
| `vercel`, `netlify`          | `429` → `unknown` ("rate limited the check")                                                     | Burst traffic from one IP                                     |
| `codepen`                    | Bot wall — `403` for non-browser clients → `unknown`                                             | Commonly `unknown` from servers                               |
| `producthunt`                | Cloudflare wall — `403` → `unknown`                                                              | Commonly `unknown` from servers                               |
| `social:instagram`           | Auth required on most IPs — `401`/`403` → `unknown` ("requires authentication")                  | Almost always `unknown` from datacenter IPs                   |
| `social:reddit`              | Aggressive rate-limiting of datacenter IPs — `403`/`429` → `unknown`                             | Commonly `unknown` from servers                               |
| `social:x`, `social:youtube` | Redirects/consent walls/rate limits → `unknown`                                                  | Intermittent `unknown`                                        |
| `social:tiktok`              | Pages without the `statusCode` marker (bot walls, consent redirects, layout changes) → `unknown` | Intermittent `unknown`                                        |
| `replit`                     | SPA 404 shell is ambiguous by design — only `200` proves `taken`                                 | `available` is never reported                                 |

Mitigations **implemented**: honest degradation to `unknown`; per-adapter 5 s
timeout so one slow provider can't stall the batch.
**Not implemented**: retries, backoff, cached answers, authenticated
requests. If a provider is persistently `unknown` for you, that's an egress-
IP/endpoint limitation — not a bug the runner can retry around. See
[providers.md](providers.md) for the exact status-code table each adapter
uses.

## Timeout behaviour

Every adapter runs under its own `AbortController` with a `deps.timeoutMs`
deadline (default **5 s**, `DEFAULT_TIMEOUT_MS`). On expiry the fetch is
aborted and the result is `unknown` with `detail: "timed out"` /
`timed out after 5000ms`. WHOIS gets `timeoutMs − 250` so it can finish
first. A long `check_availability` response (≈5 s) usually means some
providers hit their deadline — expected on slow networks or against walled
endpoints.

## Runtime caveats

### Serverless / Next.js app

- Only the **stateless** Streamable-HTTP transport works per-request — no
  standalone GET SSE stream (same contract as the standalone server).
- **WHOIS opens raw TCP to port 43** and may be blocked on some serverless
  networks — affected TLDs (`.gg .io .pt .es .de .eu .so`) then fall through
  to the DNS NS check or report `unknown`.

### Cloudflare Worker

- No `node:*` APIs: **WHOIS never runs** (`whoisDomain` resolves
  "unavailable"), so non-RDAP TLDs rely on the DoH-backed DNS NS check or
  report `unknown`.
- `npm-name` reads `~/.npmrc` — unavailable, so npm becomes direct `HEAD`
  checks against `registry.npmjs.org` plus punctuation-variant probes.

### Legacy SSE transport

`GET /sse` + `POST /messages` keeps sessions in process memory — it only
works on a persistent single Node process (`start:http`), **not** on
serverless or Workers. Use `POST /mcp` for remote clients.

## Getting deterministic results locally

`LMKURNAME_AVAILABILITY_MODE=demo` switches `/api/availability` (and the web
UI) to deterministic FNV-1a fixtures — same input → same output, no network,
no rate limits. Responses carry `"mode": "demo"` and the grid is badged.
That's what Playwright e2e and offline dev use; unset the var for live checks.

## If a check looks wrong

- `available` on a name you know is taken → likely a fuzzy endpoint (WHOIS
  text-match, `dockerhub` empty/private namespaces, suspended X handles,
  deactivated Bluesky handles, Replit's 404 shell). These are documented
  per-provider in [providers.md](providers.md).
- `taken`/`unknown` on a name that should be free → bot wall or rate limit
  above; rerun from a different egress IP or accept `unknown` as
  inconclusive and re-verify at the registrar/registry.
- Always re-confirm at the registrar before buying — results are snapshots,
  not guarantees (see README's "Availability semantics & limitations").
