# API reference

Schemas live in [`src/schemas.ts`](../src/schemas.ts); tool registration in
[`src/server.ts`](../src/server.ts); HTTP handlers in [`lib/`](../lib/) and
[`src/mcp-http.ts`](../src/mcp-http.ts). Everything below matches that code.

## MCP tools

Two tools, registered by `createNameCheckServer` (name `lmkurname`, version
`0.1.0`). Results are returned both as text JSON and `structuredContent`.

### `check_availability`

Check one bare name across the selected providers.

**Input** (`checkAvailabilityInputSchema`):

```jsonc
{
  "name": "acme", // required — bare name, no TLD/scope/spaces
  "providers": ["domains", "npm"], // optional — provider ids and/or aliases; default: all
}
```

`name` rules: trimmed, 1–63 chars, starts with a letter or digit,
`[A-Za-z0-9._-]` (`nameSchema`). Provider rules then apply per adapter —
e.g. `Acme` is valid input but `invalid` on npm.

`providers` accepts any of the 55 ids plus aliases:

| Alias           | Expands to                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `all`           | every provider (default)                                                                             |
| `domains`       | `.com`, `.gg`, `.dev`, `.io`                                                                         |
| `domains:cctld` | `.gg .io .pt .es .de .fr .uk .eu .co .me .sh .so`                                                    |
| `domains:all`   | all 25 `domain:*` providers                                                                          |
| `socials`       | `social:x`, `social:bluesky`, `social:instagram`, `social:reddit`, `social:youtube`, `social:tiktok` |

**Output** (`checkAvailabilityOutputSchema`):

```jsonc
{
  "name": "acme",
  "results": [
    {
      "provider": "domain:com", // provider id
      "status": "available", // available | taken | unknown | invalid
      "subject": "acme.com", // concrete identifier checked
      "available": true, // true | false | null (=unknown)
      "detail": "rdap: https://rdap.verisign.com/com/v1/domain/acme.com",
      "durationMs": 241,
    },
  ],
  "summary": { "available": 1, "taken": 0, "unknown": 0, "invalid": 0 },
}
```

Providers run concurrently, each with an independent ~5 s timeout — the tool
itself can take up to that long. A provider that times out, errors, or is
inconclusive reports `unknown`; the request never fails because one provider
did.

### `score_name`

Deterministic brand score — no lookups, same input → same output.

**Input**: `{ "name": "acme" }` (same `nameSchema`).

**Output** (`scoreNameOutputSchema`):

```jsonc
{
  "name": "acme",
  "normalized": "acme",
  "punchiness": { "value": 17, "max": 25, "detail": "…" },
  "syllables": { "count": 2, "value": 15, "max": 15, "detail": "…" },
  "pronounceability": { "value": 20, "max": 25, "detail": "…" },
  "uniqueness": { "value": 14, "max": 20, "detail": "…" },
  "cleanliness": { "value": 15, "max": 15, "detail": "…" },
  "total": 81, // 0–100, sum of components
  "grade": "Strong", // ≥85 Excellent · ≥70 Strong · ≥55 Fair · ≥40 Weak · else Poor
}
```

## HTTP endpoints

### Next.js app (`npm run dev:web` / deployed app)

| Route                                        | Method  | Response                                                                                                                                                                                                       |
| -------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                          | GET     | Checker UI                                                                                                                                                                                                     |
| `/api/availability?name=<n>[&providers=a,b]` | GET     | `CheckAvailabilityOutput` **plus** `"mode": "live" \| "demo"` — `demo` serves deterministic fixtures (`LMKURNAME_AVAILABILITY_MODE=demo`). `400` invalid input, `502` check failure. `cache-control: no-store` |
| `/api/score?name=<n>`                        | GET     | `ScoreNameOutput` JSON. `400` invalid input                                                                                                                                                                    |
| `/api/mcp`                                   | POST    | Stateless Streamable-HTTP MCP — JSON-RPC, SSE-framed unless the client asks for JSON only                                                                                                                      |
| `/api/mcp`                                   | GET     | Status doc `{ ok, name, version, transport, usage }` — `/health` and `/mcp` rewrite to the same route                                                                                                          |
| `/api/mcp`                                   | OPTIONS | CORS preflight (`access-control-allow-*: *` for read/write, MCP headers exposed)                                                                                                                               |

### Standalone Node HTTP (`npm run dev:http` / `start:http`, `PORT`/`HOST`)

| Route                      | Method | Response                                                        |
| -------------------------- | ------ | --------------------------------------------------------------- |
| `/mcp`                     | POST   | Stateless Streamable-HTTP MCP (modern remote transport)         |
| `/sse`                     | GET    | Legacy SSE stream — opens a session                             |
| `/messages?sessionId=<id>` | POST   | JSON-RPC post for an open SSE session (`400` unknown sessionId) |
| `/health`                  | GET    | `{ ok, name, version, transports }`                             |

Legacy SSE keeps session state in memory — single persistent Node process
only, not serverless.

### Cloudflare Worker (`wrangler deploy`)

| Route                   | Method | Response                                                |
| ----------------------- | ------ | ------------------------------------------------------- |
| `/mcp`                  | POST   | Stateless Streamable-HTTP MCP (portable `workerDeps()`) |
| `/health`, `/mcp` (GET) | GET    | Status doc                                              |
| other                   | —      | `404 { error, endpoints }`                              |

## Error semantics

- Schema failures (`name`, `providers`) → tool-level MCP error / HTTP `400`
  with zod `issues`.
- Per-provider failures never propagate — they surface as `status: "unknown"`
  with a `detail` reason (timeout, rate limit, blocked, inconclusive).
- `invalid` is a first-class status (name cannot exist on that provider), not
  an error.
