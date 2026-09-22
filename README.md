# lmkurname

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nandodani/name-check-mcp)
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nandodani/name-check-mcp)

An MCP (Model Context Protocol) server that answers two questions about a
candidate name:

1. **`check_availability`** — is it free as a `.com` / `.gg` / `.dev` / `.io` /
   `.app` domain or European ccTLD (`.pt` / `.es` / `.de` / `.fr` / `.uk` /
   `.eu`), as a GitHub user/org, as an npm package, and as a social handle on
   X, Bluesky, Instagram, Reddit, YouTube and TikTok?
2. **`score_name`** — how good is it as a brand, deterministically scored
   out of 100?

Runs both as a **stdio** server (Claude Desktop, Cursor, any local MCP
client) and as an **HTTP** server (Streamable HTTP at `/mcp`, deployable to
Vercel, Cloudflare Workers, or any Node host for remote clients like Poke;
legacy SSE at `/sse` + `/messages` for older clients).

## Requirements

- Node.js ≥ 20 (uses the global `fetch`)

## Install & commands

```bash
npm install
npm run build        # tsc → dist/
npm test             # vitest
npm run check        # typecheck + lint + format:check + test + build
```

| Script               | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | stdio server via tsx (dev)                    |
| `npm run dev:http`   | HTTP server via tsx on `$PORT` (default 3000) |
| `npm run dev:worker` | Cloudflare Worker via wrangler dev            |
| `npm start`          | stdio server from `dist/`                     |
| `npm run start:http` | HTTP server from `dist/`                      |
| `npm run typecheck`  | `tsc --noEmit` (strict)                       |
| `npm run lint`       | ESLint (typescript-eslint, type-checked)      |
| `npm run format`     | Prettier                                      |
| `npm test`           | Vitest suite (`npm run test:coverage` for v8) |

## Tools

### `check_availability`

```jsonc
// input
{ "name": "acme", "providers": ["github", "domains"] } // providers optional
```

- `name` — the bare name, no TLD/scope. Letters, digits, `.`, `-`, `_`,
  ≤63 chars, must start with a letter or digit.
- `providers` — subset of:
  `domain:com`, `domain:gg`, `domain:dev`, `domain:io`, `domain:app`,
  `domain:pt`, `domain:es`, `domain:de`, `domain:fr`, `domain:uk`,
  `domain:eu`, `github`, `npm`, `social:x`, `social:bluesky`,
  `social:instagram`, `social:reddit`, `social:youtube`, `social:tiktok`,
  plus the aliases `domains` (the original four TLDs), `domains:all` (every
  TLD), `domains:cctld` (the ccTLDs), `socials` (all social providers) and
  `all`. Default: `all`.

Each provider returns a normalized result:

```jsonc
{
  "provider": "domain:com",
  "status": "available", // available | taken | unknown | invalid
  "subject": "acme.com",
  "available": true, // true | false | null (=unknown)
  "detail": "rdap: https://rdap.verisign.com/com/v1/domain/acme.com",
  "durationMs": 241,
}
```

Providers run **concurrently** (`Promise.allSettled`), each with an
**independent 5-second AbortController timeout**. A provider that errors,
times out or can't decide reports `unknown` — it never fails the request.

### `score_name`

```jsonc
{ "name": "acme" }
```

Deterministic heuristic — pure function of the input, no lookups, always the
same answer:

| Component          | Max | What it rewards                                                    |
| ------------------ | --- | ------------------------------------------------------------------ |
| `punchiness`       | 25  | Length; peaks at 5–8 chars                                         |
| `syllables`        | 15  | Estimated vowel-group count; peaks at 2–3                          |
| `pronounceability` | 25  | Share of familiar English bigrams; cluster/vowel-balance penalties |
| `uniqueness`       | 20  | Coinages over common/over-used words; distinctive letters          |
| `cleanliness`      | 15  | Letters only; penalties for digits, separators, repeats            |

`total` (0–100) maps to a `grade`: ≥85 `Excellent`, ≥70 `Strong`, ≥55
`Fair`, ≥40 `Weak`, else `Poor`. The formula is documented in
`src/scoring/score.ts` and pinned by tests.

## Architecture

```
src/
  index.ts              stdio entry (Claude Desktop / Cursor)
  http.ts               Node HTTP server: /mcp + /sse + /messages + /health
  mcp-http.ts           stateless Streamable-HTTP handler (shared with Vercel)
  server.ts             McpServer factory, tool registration
  schemas.ts            Zod input/output schemas, provider selection
  deps.ts               injectable ProviderDeps (fetch, whois, npm, timeout)
  providers/
    index.ts            adapter registry (shared RDAP client)
    domain.ts           TLD adapter: RDAP first, WHOIS fallback
    rdap.ts             IANA bootstrap → per-TLD RDAP client (cached)
    whois.ts            whoiser wrapper + text normalization
    dns.ts              NS-record signal after inconclusive WHOIS
    github.ts           GET api.github.com/users/{name}
    npm.ts              npm-name wrapper
    social.ts           X, Bluesky, Instagram, Reddit, YouTube, TikTok handles
  tools/checkAvailability.ts   Promise.allSettled runner + per-provider timeout
  scoring/score.ts      deterministic scoring formula
api/
  mcp.ts                Vercel serverless function (stateless /mcp only)
worker/
  index.ts              Cloudflare Worker (stateless /mcp, portable deps)
```

Every provider implements

```ts
interface ProviderAdapter {
  readonly id: string;
  check(name: string, signal: AbortSignal): Promise<ProviderOutcome>;
}
```

External calls (fetch/whois/DNS/npm-name) are injected via `ProviderDeps`,
so tests substitute fakes instead of hitting the network — the suite never
hardcodes live lookup results.

## Use it locally

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "lmkurname": {
      "command": "node",
      "args": ["/absolute/path/to/name-check-mcp/dist/index.js"]
    }
  }
}
```

(Run `npm run build` first. Or use `"command": "npx", "args": ["tsx",
"/absolute/path/to/name-check-mcp/src/index.ts"]` to skip the build.)

### Claude Desktop

`claude_desktop_config.json`
(macOS `~/Library/Application Support/Claude/`, Windows `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "lmkurname": {
      "command": "node",
      "args": ["/absolute/path/to/name-check-mcp/dist/index.js"]
    }
  }
}
```

## Deploy as a remote MCP server (Poke, other clients)

### Vercel — Streamable HTTP

The repo ships `api/mcp.ts` + `vercel.json`. Deploy:

```bash
npm i -g vercel
vercel deploy --prod
```

Your MCP endpoint is `https://<deployment>/mcp` (`POST`, Streamable HTTP,
stateless). Point Poke or any remote MCP client at that URL. `/health` is a
liveness probe.

Runtime caveat: on serverless, only the **stateless Streamable HTTP**
transport works — the legacy SSE transport holds in-memory sessions and
cannot span invocations, so `/sse` is intentionally not exposed on Vercel.
WHOIS lookups open raw TCP to port 43 and may also be blocked on some
serverless networks; affected TLDs simply report `unknown`.

### Cloudflare Workers — Streamable HTTP

The repo ships `worker/index.ts` + `wrangler.toml` (also what the
“Deploy to Cloudflare Workers” button uses). Deploy:

```bash
npx wrangler deploy        # or: npm run deploy:worker
```

Your MCP endpoint is `https://<worker>.<account>.workers.dev/mcp` (`POST`,
Streamable HTTP, stateless). `/health` is a liveness probe. Try it locally
with `npm run dev:worker`.

Worker caveats:

- **Port 43 / WHOIS**: Workers can't open raw TCP connections the way
  `whoiser` needs, so WHOIS is not run at all. For TLDs without an RDAP
  service (`.gg`, `.io`, `.pt`, `.es`, `.de`, `.eu`) the check falls through
  to the **DNS NS lookup** — reimplemented over DNS-over-HTTPS — and
  otherwise reports `unknown`.
- **npm**: `npm-name` reads local npm config (`~/.npmrc`), which doesn't
  exist on Workers, so the check uses direct `HEAD` requests against
  `registry.npmjs.org` — exact name plus the same punctuation-variant
  probes. Best-effort, same semantics.
- Stateless `/mcp` only, same as Vercel — no `/sse`.

### Any persistent Node host — both transports

```bash
npm ci && npm run build
PORT=3000 npm run start:http
```

- `POST /mcp` — Streamable HTTP (stateless)
- `GET /sse` + `POST /messages?sessionId=…` — legacy SSE for older clients
- `GET /health` — liveness

Works on Render/Fly.io/Railway/a VPS — anywhere a Node process stays alive.

## Environment variables

| Var    | Default   | Used by                    |
| ------ | --------- | -------------------------- |
| `PORT` | `3000`    | HTTP server (`start:http`) |
| `HOST` | `0.0.0.0` | HTTP server (`start:http`) |

No API keys required. GitHub checks run unauthenticated (60 req/hour per
IP); the GitHub provider degrades to `unknown` when rate-limited.

## Availability semantics & limitations

- **Domains**: looked up via [RDAP](https://www.rfc-editor.org/rfc/rfc7484)
  when the IANA bootstrap registry lists a service for the TLD (today:
  `.com`, `.dev`, `.app` via the Google Registry, `.fr`, `.uk`), otherwise
  via raw **WHOIS** (`whoiser`) — `.gg`, `.io`, `.pt`, `.es`, `.de`, `.eu`.
  RDAP `404` → `available`, `200` → `taken`; WHOIS is normalized by text
  matching ("no match", registrar fields) and is inherently fuzzy. When
  WHOIS is inconclusive a **DNS NS-record** check runs as a last resort —
  delegated name servers prove `taken`, while their absence stays `unknown`.
- **GitHub**: `GET api.github.com/users/{name}`; usernames and orgs share
  one namespace.
- **npm**: `npm-name` against the public registry.
- **Social handles** — all unauthenticated, best-effort:
  - **X** (`social:x`): `x.com/{handle}` — `404`/`200`. Suspended accounts
    also answer `404`, so `available` is not a guarantee.
  - **Bluesky** (`social:bluesky`): `com.atproto.identity.resolveHandle` on
    `public.api.bsky.app` for `{name}.bsky.social` — `200` → `taken`,
    `400` → `available`. Deactivated/reserved handles report `available`.
  - **Instagram** (`social:instagram`): the app's `web_profile_info`
    endpoint — `200`/`404`. Instagram requires authentication on most IPs,
    so anonymous checks commonly degrade to `unknown`.
  - **Reddit** (`social:reddit`): `api/username_available.json` — a bare
    JSON boolean. Rate-limited/blocked responses report `unknown`.
  - **YouTube** (`social:youtube`): `youtube.com/@{handle}` — `404`/`200`.
  - **TikTok** (`social:tiktok`): `tiktok.com/@{user}` — the embedded
    `statusCode` marker (`0` → `taken`, `10202`/`10221`/`10245` →
    `available`); pages without it report `unknown`.
- Results are **snapshots, not guarantees**. Registries can lag, names can
  be taken between the check and your registration, and reserved names may
  report `available` but still be unregisterable. Re-confirm at the
  registrar/registry before committing.
- `unknown` ≠ `taken` — it means the provider could not give a definitive
  answer (timeout, rate limit, blocked endpoint, inconclusive WHOIS/DNS).

## License

MIT
