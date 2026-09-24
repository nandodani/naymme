# naymme — technical documentation

Deep-dive docs for how the availability engine, providers and transports
actually work under the hood. Everything here was written against the code
on `main`; where a feature is planned rather than implemented, it is marked
**Proposal**.

| Doc                                            | Contents                                                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [providers.md](providers.md)                   | Provider catalog: query method per adapter (REST/JSON, RDAP, WHOIS, DNS, body markers), validation rules, status codes.             |
| [registrars-pricing.md](registrars-pricing.md) | How domain availability is decided (RDAP → WHOIS → DNS), registrar deep links, static first-year price estimates.                   |
| [architecture.md](architecture.md)             | Runtimes, the `ProviderAdapter` contract, `ProviderDeps` injection, the runner, caching & rate-limit stance, how to add a provider. |
| [api-reference.md](api-reference.md)           | MCP tools (`check_availability`, `score_name`) and HTTP endpoints (`/api/availability`, `/api/score`, `/api/mcp`).                  |
| [troubleshooting.md](troubleshooting.md)       | `unknown` vs `taken`, per-provider rate limits and bot walls, runtime caveats (WHOIS on serverless/Workers).                        |
| [deployment.md](deployment.md)                 | The four surfaces (Next.js app, stdio, Node HTTP, Cloudflare Worker), env vars, CI gates.                                           |

Top-level orientation stays in the root [README](../README.md); contributor
rules and the command matrix are in [AGENTS.md](../AGENTS.md). To get set up
and send a change, start with [CONTRIBUTING.md](../CONTRIBUTING.md).
