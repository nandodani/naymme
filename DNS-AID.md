# DNS-AID — agent discovery via DNS

This project documents the DNS records for
[DNS-AID](https://datatracker.ietf.org/doc/html/draft-mozleywilliams-dnsop-dnsaid)
(DNS for AI Discovery, IETF draft) so the hosted service is discoverable by
agents that resolve capabilities through DNS rather than by reading this
site's well-known documents.

DNS-AID uses SVCB (Service Binding, RFC 9460) records:

- a **ServiceMode** record per agent carries connectivity + capability
  metadata (TargetName, `alpn`, `port`, `bap` agent protocol, `well-known`
  path), and
- a `_index._agents.<domain>` record points at the organization's index of
  agents.

## Records for this deployment

The agent-facing service runs at `name-check-mcp.vercel.app`. Because
`vercel.app` is a provider-owned suffix, `*.vercel.app` owners cannot
publish `_agents`/`_index` names under it — publish the records under a
domain you control (shown here under `nandodani.dev`) with `TargetName`
pointing at the deployed host. If a custom domain is attached to the
deployment, the same records can be published under that domain directly.

```zone
; Organizational agent index — agents query _index._agents to locate the
; catalog of this org's agents. TargetName serves /.well-known/api-catalog
; (RFC 9264 linkset) over HTTPS.
_index._agents.nandodani.dev.   3600  IN  SVCB  1  name-check-mcp.vercel.app. (
                                                alpn="h2"
                                                port=443
                                                well-known="api-catalog" )

; Known agent — the lmkurname MCP server. `bap` marks the agent protocol
; (MCP); `well-known` is the RFC 8615 path to the SEP-1649 server card.
lmkurname._agents.nandodani.dev. 3600 IN  SVCB  1  name-check-mcp.vercel.app. (
                                                alpn="h2"
                                                port=443
                                                bap="mcp"
                                                well-known="mcp/server-card.json" )
```

Notes:

- `SVCB 1 <TargetName>` is ServiceMode — the record carries parameters, not
  an alias. `alpn="h2"` advertises HTTP/2; `port=443` is the TLS port.
- `bap` (the draft's experimental agent-protocol SvcParamKey) is `mcp`; the
  endpoint itself is `POST https://name-check-mcp.vercel.app/api/mcp`,
  discoverable from the server card at `well-known` + `/`.
- `well-known` values are the names under `/.well-known/` on the
  TargetName host (`api-catalog`, `mcp/server-card.json`).
- Optional hardening per the draft: DNSSEC signing and a `TLSA` record on
  `_443._tcp.<TargetName>` to pin the TLS endpoint.

## Verify

```sh
dig SVCB _index._agents.nandodani.dev
dig SVCB lmkurname._agents.nandodani.dev
curl -s https://name-check-mcp.vercel.app/.well-known/api-catalog
curl -s https://name-check-mcp.vercel.app/.well-known/mcp/server-card.json
```

## Non-DNS discovery (always available)

The HTTP discovery surface does not depend on these records: `Link` headers
on `/`, `/openapi.json`, `/.well-known/api-catalog`,
`/.well-known/mcp/server-card.json`, `/.well-known/agent-skills/index.json`,
`/.well-known/ai-catalog.json`, `/llms.txt`, and `/auth.md`.
