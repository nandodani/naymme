# Publishing naymme — npm package + official MCP registry

This document covers distributing naymme as an installable MCP server:
the npm package (`npx -y naymme`) and listing it in the
[official MCP registry](https://registry.modelcontextprotocol.io).

**Status: prepared, not yet published.** The steps below are a checklist
for the maintainer — nothing has been pushed to npm or the registry yet.
It exists so the release is one command away and reviewable beforehand.

## The npm package

The repository's root `package.json` **is** the published artifact:

| Field             | Value / purpose                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `name`            | `naymme` — confirmed available on npmjs.com (404 = unclaimed).                                                     |
| `bin`             | `naymme` → `dist/index.js` (stdio entry, shebang preserved by `tsc`).                                              |
| `main`/`types`    | `dist/index.js` / `dist/index.d.ts`.                                                                               |
| `files`           | `dist`, `README.md`, `LICENSE`, `server.json` — nothing else ships.                                                |
| `dependencies`    | Runtime only: `@modelcontextprotocol/sdk`, `zod`, `whoiser`, `npm-name`.                                           |
| `devDependencies` | Everything needed to develop/deploy the web app, worker and tests — **not** installed for `npx`/library consumers. |
| `mcpName`         | `io.github.nandodani/naymme` — the registry's npm ownership-verification field.                                    |
| `engines`         | Node ≥ 20 (global `fetch` required).                                                                               |
| `prepack`         | `npm run build:core` — `dist/` is gitignored, so `npm pack`/`npm publish` always rebuilds it first.                |

Because the web UI, worker and test tooling live in `devDependencies`, a
consumer install pulls only the four runtime packages plus the MCP SDK's
small dependency tree — `npx -y naymme` stays fast. The published tarball
contains only `dist/` + docs — no Next.js, React or test code.

## Publish checklist

### 1. Publish to npm

```bash
npm ci
npm run check          # full gate: typecheck, lint, knip, format, tests, build, size
npm pack --dry-run     # inspect the tarball — should be dist/ + README + LICENSE + server.json
npm publish            # owner: nandodani (needs npm 2FA/login)
```

The npm package is unscoped (`naymme`), so a consumer runs:

```bash
npx -y naymme
```

> If a scoped alias is ever preferred, `naymme` can also be published as
> `@nandodani/naymme` — that name is currently unclaimed too.

### 2. Publish to the official MCP registry

The manifest is [`server.json`](../server.json) at the repo root —
`io.github.nandodani/naymme`, npm `registryType`, `stdio` transport, plus
the hosted `streamable-http` remote (`https://naymme.vercel.app/api/mcp`).

```bash
# requires npm publish to have happened first — the registry verifies
# package.json `mcpName` against server.json `name`
npx -y mcp-publisher@latest login github     # authenticates the io.github.nandodani namespace
npx -y mcp-publisher@latest publish           # reads ./server.json
```

Verification rules the publish must satisfy:

- `package.json` `mcpName` === `server.json` `name` (already aligned).
- `server.json` `version` === the npm package `version` (already aligned —
  keep them bumped together; `test/package.test.ts` enforces it).
- Namespace `io.github.nandodani/*` authenticates via the GitHub login flow.

### 3. Smithery

[Smithery](https://smithery.ai) lists servers from its own registry; once
the npm package is live, submit it via the Smithery dashboard or CLI so
clients can install with:

```bash
npx -y @smithery/cli install naymme --client claude
```

Not yet submitted — the listing depends on the npm package existing.

### 4. Other catalogues

- **Glama / pulseMCP / mcp.so** — all ingest npm-published stdio servers;
  submit `naymme` after the npm publish.
- The hosted `streamable-http` remote in `server.json` already makes the
  live endpoint discoverable from the official registry listing.

## Client configuration (what users paste)

Every MCP host speaks the same stdio invocation — `npx -y naymme`:

```json
{
  "mcpServers": {
    "naymme": {
      "command": "npx",
      "args": ["-y", "naymme"]
    }
  }
}
```

| Client         | Config location                                    |
| -------------- | -------------------------------------------------- |
| Claude Desktop | `claude_desktop_config.json` → `mcpServers`        |
| Cursor         | `~/.cursor/mcp.json` → `mcpServers`                |
| Windsurf       | `mcp_config.json` → `mcpServers`                   |
| VS Code        | `.vscode/mcp.json` → `servers` (`"type": "stdio"`) |
| Claude Code    | `claude mcp add naymme -- npx -y naymme`           |

The hosted endpoint is an alternative for clients that speak Streamable
HTTP natively — see the README.
