# Contributing to naymme

Thanks for your interest in contributing! This guide covers the local
workflow, the project conventions, and what a pull request needs to pass.

## Getting set up

```bash
git clone https://github.com/nandodani/naymme.git
cd naymme
npm install
npm run check        # the full gate: typecheck + lint + knip + format + test + build + size
```

Requires **Node.js ≥ 20** (the code uses the global `fetch`). No API keys or
external accounts are needed — every check runs unauthenticated, and the test
suite is fully offline.

Useful while iterating:

```bash
npm run dev:web      # Next.js dev — UI at / and MCP at /api/mcp
npm run dev          # stdio MCP server via tsx
npm run dev:http     # Node HTTP transport via tsx
npm test             # vitest
```

Set `NAYMME_AVAILABILITY_MODE=demo` to run the UI against deterministic
fixture data instead of the live network — handy for offline work.

## The one command that matters

`npm run check` runs everything CI runs. The CI matrix
(`.github/workflows/ci.yml`) executes the same commands as six parallel jobs:
typecheck, lint+format, knip, tests with coverage, build+size, and Playwright
e2e. If it is green locally, CI should be green too.

| Command                | What it gates                                           |
| ---------------------- | ------------------------------------------------------- |
| `npm run typecheck`    | `tsc --noEmit`, strict mode                             |
| `npm run lint`         | ESLint `recommendedTypeChecked`                         |
| `npm run format:check` | Prettier — run `npm run format` to fix                  |
| `npm run knip`         | No unused files/exports/dependencies                    |
| `npm test`             | Vitest unit + provider contract suite (offline via MSW) |
| `npm run build`        | `next build` + `tsc`                                    |
| `npm run size`         | Bundle-size guard                                       |
| `npm run test:e2e`     | Playwright smoke + axe accessibility (needs a build)    |

## Conventions that will get your PR rejected if missed

- **Zero `any`, zero `!`.** `no-explicit-any` and `no-non-null-assertion`
  are hard errors. Narrow types properly.
- **Tests never hit the network.** HTTP is mocked with MSW
  (`onUnhandledRequest: "error"`), WHOIS/DNS via injected `ProviderDeps`
  fakes. A test that reaches for a real URL fails by design.
- **`verbatimModuleSyntax` is on** — import types with `import type`.
- **Coverage thresholds are enforced** (`vitest.config.ts`). Raise them,
  never lower them.
- **`worker/index.ts` stays web-standard only** — no `node:*` imports;
  portable deps are injected via `workerDeps()`.
- Don't commit generated output (`dist/`, `.next/`).

## Adding a provider

The provider contract is enforced by a parameterized test matrix in
`test/provider-contract.test.ts`. To add one:

1. Add the id to `PROVIDER_IDS` in `src/schemas.ts`.
2. Add a `NameRule` in `PROVIDER_NAME_RULES`
   (`src/providers/validation.ts`) — omitting it is a compile error.
3. Register the adapter factory in `createAdapters`/`selectAdapters`
   (`src/providers/index.ts`).
4. Add display metadata in `lib/provider-meta.ts`, links in `lib/links.ts`
   (and `TLD_PRICE_ESTIMATES` for domains), and a brand icon in
   `components/brand-icons.tsx`.

Adapters must validate the name **before** any network call, honor the
`AbortSignal`, and only report `available` on a verified unclaimed marker —
a failure degrades to `unknown`, never a fabricated `available`.

See [`docs/architecture.md`](docs/architecture.md) for the full contract and
[`AGENTS.md`](AGENTS.md) for the deeper engineering rules.

## Pull requests

- Keep PRs focused — one concern per PR.
- Fill in the PR template; link the issue if there is one.
- Make sure `npm run check` passes before asking for review.

## Reporting bugs

Open an issue with the bug template — include the name you checked (or a
redacted equivalent), what you expected, what you got, and which surface you
were on (web UI, hosted MCP, stdio, Node HTTP, or the Worker).

Security reports go through [GitHub's private vulnerability reporting](SECURITY.md), not public issues.
