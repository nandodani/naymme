---
name: testing-naymme-web
description: How to run and end-to-end test the naymme Next.js naymme-checker web app locally, including the Next 16 dev-mode 127.0.0.1 hydration gotcha.
---

# Testing the naymme web UI

## Run the app

- Dev: `NAYMME_AVAILABILITY_MODE=demo npm run dev:web -- -p 3210`
- Production: `npm run build` then `NAYMME_AVAILABILITY_MODE=demo npm run start:web -- -p 3210`
- `NAYMME_AVAILABILITY_MODE=demo` gives deterministic fixture data (no real RDAP/WHOIS calls); a "demo data" badge shows on the Overall card.

## Critical gotcha: use localhost, not 127.0.0.1, in dev mode

Next 16 dev mode blocks cross-origin dev resources (`/_next/hmr`). Opening `http://127.0.0.1:<port>` renders the SSR HTML but **hydration never runs** — the page looks fine but typing/clicking does nothing and the input's typed text may vanish (React resets the controlled input once it does hydrate).

Always browse to `http://localhost:<port>` when using `next dev`. `next start` (production) is unaffected — 127.0.0.1 works fine there.

Related: `playwright.config.ts` uses `baseURL: http://127.0.0.1:3210` with `reuseExistingServer` — locally it will reuse a dev server on that port and the suite will fail exactly this way. Run `npm run build` + `start:web` first (as CI does) before `npx playwright test`.

## UI anchors

- Search input: `aria-label="Name to check"`; submit via Enter or the "Search" button.
- Results view: "results for {name}", "Overall" card, filter chips "All (N)" / "Available only (N)".
- Group headings: Code & registries, Social media, Core domains, Regional domains, Industry domains, Platforms & stores, Community & publishing.
- Navbar: wordmark "naymme", "Connect MCP" button opens "Connect a client" dialog with per-client copy buttons.
- Name schema (src/schemas.ts): 1–63 chars, starts alnum, `[A-Za-z0-9._-]` only — invalid input shows inline hint and never submits.
- Available domains show registrar price chips that link out (e.g. porkbun checkout); registrars that don't carry a TLD render disabled chips titled "… does not carry this TLD"; taken subjects link out as "Visit".

## APIs (no auth)

- `GET /api/availability?name=x` → JSON results array; invalid name → 400.
- `GET /api/score?name=x` → JSON score breakdown.
- `POST /api/mcp` requires `Accept: application/json, text/event-stream` — without it returns a -32000 JSON-RPC error; with it returns SSE initialize result `serverInfo.name="naymme"`.

## Agentic surface (agentic-readiness PR)

- Content negotiation: `curl -H "Accept: text/markdown" localhost:<port>/<page>` → `text/markdown` body + `Vary: Accept` for `/`, `/about`, `/contact`, `/privacy`; unknown paths → 404 markdown doc. Implemented in `proxy.ts` (rewrite to `/api/markdown`, path via `x-markdown-path` request header) — curl is the practical way to test; browsers always send HTML Accept.
- `GET /llms.txt` + `/llms-full.txt` → text/markdown agent docs (rendered as `<pre>` text in the browser).
- `GET /.well-known/mcp` → JSON discovery doc (tools with JSON Schemas); `POST` with the MCP Accept header runs a real JSON-RPC handshake; `OPTIONS` → 204 CORS preflight.
- Static pages `/about` `/contact` `/privacy` + styled 404 share `components/static-page.tsx` (sticky header nav, `aria-current="page"` on the active link).

## Devin Secrets Needed

None.
