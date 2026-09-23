# Deployment guide

Four surfaces, one codebase. Commands and constraints match `package.json`,
`wrangler.toml`, `next.config.ts`, `vercel.json` and the CI workflow.

## Prerequisites

- Node.js ≥ 20 (global `fetch` is used)
- `npm install` (Vercel uses `npm install --legacy-peer-deps` via
  [`vercel.json`](../vercel.json))
- `npm run build` → `next build` (`.next/`) + `tsc` (`dist/`)

## 1. Next.js app — web UI + hosted MCP

The primary deployment. Serves the checker UI at `/` and the stateless
Streamable-HTTP MCP endpoint at `/api/mcp` — `/mcp` and `/health` rewrite to
it ([`next.config.ts`](../next.config.ts)).

```bash
npm run dev:web     # dev
npm run build && npm run start:web   # production
```

**Vercel**: deploy the repo root — the "Deploy with Vercel" button picks this
up; `vercel deploy --prod` works too. Runtime is `nodejs`; `/api/mcp` has
`maxDuration = 60`. `whoiser`, `npm-name` and the MCP SDK are
`serverExternalPackages` (raw TCP / fs reads — not bundlable).

Endpoints: `/api/availability`, `/api/score`, `/api/mcp` — see
[api-reference.md](api-reference.md).

## 2. Cloudflare Worker — Streamable HTTP only

[`worker/index.ts`](../worker/index.ts) + [`wrangler.toml`](../wrangler.toml)
— web-standard APIs only, **no `nodejs_compat`** (deliberate: WHOIS TCP :43
and `node:dns` are swapped for portable equivalents in `workerDeps()`).

```bash
npm run dev:worker      # wrangler dev
npm run deploy:worker   # wrangler deploy → <worker>.<account>.workers.dev/mcp
```

Caveats: WHOIS never runs; non-RDAP TLDs fall back to DoH-backed DNS NS;
npm uses direct registry `HEAD` checks. Stateless `/mcp` only — no SSE.

## 3. Persistent Node host — both MCP transports

For clients that need legacy SSE, or a long-running Streamable-HTTP endpoint:

```bash
npm ci && npm run build
PORT=3000 HOST=0.0.0.0 npm run start:http
```

`POST /mcp` (stateless), `GET /sse` + `POST /messages?sessionId=` (legacy SSE,
in-memory sessions), `GET /health`. Anywhere a Node process stays alive —
Render, Fly.io, Railway, a VPS. Not serverless-compatible for `/sse`.

## 4. stdio server — local MCP clients

`dist/index.js` is the published `naymme` bin. Point Claude Desktop /
Cursor at it (config snippets in README "Use it locally"):

```json
{ "mcpServers": { "naymme": { "command": "node", "args": ["/abs/path/dist/index.js"] } } }
```

## Environment variables

| Var                        | Default   | Used by                                                    |
| -------------------------- | --------- | ---------------------------------------------------------- |
| `PORT`                     | `3000`    | `start:http`                                               |
| `HOST`                     | `0.0.0.0` | `start:http`                                               |
| `NAYMME_AVAILABILITY_MODE` | `live`    | `/api/availability` — `demo` serves deterministic fixtures |

No API keys are required anywhere — all provider checks are unauthenticated.

## CI / quality gates

`.github/workflows/ci.yml` runs six parallel jobs on push to `main` and PRs:
typecheck, lint+format, knip, unit tests with coverage, build+size-limit,
Playwright e2e (demo mode). Local equivalent: `npm run check`.

## Operational notes

- `check_availability` can take up to ~5 s (per-provider timeout) — set
  serverless timeouts ≥ 60 s (`/api/mcp` already has `maxDuration = 60`).
- `/api/availability` and `/api/score` return `cache-control: no-store`.
- CORS is open (`access-control-allow-origin: *`) on the MCP endpoints —
  the checks are anonymous and read-only; tighten if you add auth later.
- WHOIS needs outbound TCP :43 — verify egress allows it on your platform;
  otherwise expect `unknown` for non-RDAP TLDs.
