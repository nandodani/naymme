# name-check-mcp

An MCP (Model Context Protocol) server that answers two questions about a
candidate name:

1. **`check_availability`** — is it free as a `.com` / `.gg` / `.dev` / `.io`
   domain, as a GitHub user/org, and as an npm package?
2. **`score_name`** — how good is it as a brand, deterministically scored
   out of 100?

Runs both as a **stdio** server (Claude Desktop, Cursor, any local MCP
client) and as an **HTTP** server (Streamable HTTP at `/mcp`, deployable to
Vercel/any Node host for remote clients like Poke; legacy SSE at `/sse` +
`/messages` for older clients).

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
  `domain:com`, `domain:gg`, `domain:dev`, `domain:io`, `github`, `npm`,
  plus the aliases `domains` (all four TLDs) and `all`. Default: `all`.

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
    github.ts           GET api.github.com/users/{name}
    npm.ts              npm-name wrapper
  tools/checkAvailability.ts   Promise.allSettled runner + per-provider timeout
  scoring/score.ts      deterministic scoring formula
api/
  mcp.ts                Vercel serverless function (stateless /mcp only)
```

Every provider implements

```ts
interface ProviderAdapter {
  readonly id: string;
  check(name: string, signal: AbortSignal): Promise<ProviderOutcome>;
}
```

External calls (fetch/whois/npm-name) are injected via `ProviderDeps`, so
tests substitute fakes instead of hitting the network — the suite never
hardcodes live lookup results.

## Use it locally

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "name-check": {
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
    "name-check": {
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
  `.com`, `.dev`), otherwise via raw **WHOIS** (`whoiser`) — `.gg`, `.io`.
  RDAP `404` → `available`, `200` → `taken`; WHOIS is normalized by text
  matching ("no match", registrar fields) and is inherently fuzzy —
  inconclusive output is `unknown`.
- **GitHub**: `GET api.github.com/users/{name}`; usernames and orgs share
  one namespace.
- **npm**: `npm-name` against the public registry.
- Results are **snapshots, not guarantees**. Registries can lag, names can
  be taken between the check and your registration, and reserved names may
  report `available` but still be unregisterable. Re-confirm at the
  registrar/registry before committing.
- `unknown` ≠ `taken` — it means the provider could not give a definitive
  answer (timeout, rate limit, inconclusive WHOIS).

## License

MIT
