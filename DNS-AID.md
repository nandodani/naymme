# DNS-AID — agent discovery via DNS

This document defines the exact DNS records for
[DNS-AID](https://datatracker.ietf.org/doc/html/draft-mozleywilliams-dnsop-dnsaid)
(DNS for AI Discovery, `draft-mozleywilliams-dnsop-dnsaid-02`, IETF draft)
that make the hosted service discoverable by agents that resolve
capabilities through DNS rather than by reading this site's well-known
documents.

DNS-AID uses SVCB (Service Binding, RFC 9460) records — or the equivalent
`HTTPS` record type for HTTPS endpoints:

- a **ServiceMode** record per agent carries connectivity + capability
  metadata (`TargetName`, `alpn`, `port`, agent protocol, `well-known`
  path), and
- an `_index._agents.<domain>` record points at the organization's index
  of agents.

> **Provider limitation (read first).** The deployment is
> `name-check-mcp.vercel.app`. `vercel.app` is a provider-owned suffix —
> the zone's SOA (`ns1.vercel-dns-*.com` / `awsdns-hostmaster.amazon.com`)
> belongs to Vercel, and Vercel does not expose record control under
> `*.vercel.app` subdomains. `_agents` names under
> `name-check-mcp.vercel.app` therefore **cannot be created, period** —
> not by any setting in the app or the Vercel project. Nothing here
> claims records are deployed.

> **How the auditor checks (verified against a live scan).**
> `isitagentready.com` validates DNS-AID **purely via DNS-over-HTTPS** —
> its scan evidence shows zero HTTP requests for this check, so no
> endpoint or header on the site can satisfy it (the HTTP discovery
> surface — Link headers, `/.well-known/*`, llms.txt — is complementary,
> not a substitute). Against the scanned hostname it issues exactly these
> queries, via `https://cloudflare-dns.com/dns-query` (`do=1`), with
> `https://dns.google/resolve` as fallback:
>
> - `SVCB` and `HTTPS` `_index._agents.<scanned-host>`
> - `SVCB` and `HTTPS` `_a2a._agents.<scanned-host>`
> - `SVCB` and `HTTPS` `_mcp._agents.<scanned-host>`
> - `TXT` `_index._agents.<scanned-host>` (TXT index fallback — see
>   "TXT fallback" below)
>
> `domainsChecked` in the scan result is `["name-check-mcp.vercel.app"]`
> — **only the scanned hostname**. Records published under any other
> zone (e.g. `nandodani.dev`) are valid DNS-AID but are invisible to a
> scan of the `.vercel.app` URL. Consequence: the only way to turn this
> check green is to serve the site on a hostname inside a zone you
> control and scan _that_ hostname.

## Records

Two ServiceMode records, shown under `nandodani.dev` — substitute your
own zone. A copy-paste zone file lives at [`dns/dnsaid.zone`](dns/dnsaid.zone).

```zone
; Organizational agent index — requestors query _index._agents to locate
; the catalog of this org's agents. TargetName serves the index document
; (/.well-known/api-catalog, an RFC 9264 linkset) over HTTPS.
_index._agents.nandodani.dev.    3600  IN  SVCB  1  name-check-mcp.vercel.app. (
                                      alpn="h2"
                                      port=443
                                      mandatory=alpn,port
                                      well-known="api-catalog" )

; Known agent — the lmkurname MCP server. `bap` marks the agent protocol
; (mcp); `well-known` is the RFC 8615 path to the SEP-1649 server card.
lmkurname._agents.nandodani.dev. 3600  IN  SVCB  1  name-check-mcp.vercel.app. (
                                      alpn="h2"
                                      port=443
                                      mandatory=alpn,port
                                      bap="mcp"
                                      well-known="mcp/server-card.json" )
```

### Notes on the parameters

- `SVCB 1 <TargetName>` is ServiceMode — the record carries parameters,
  not an alias. `alpn="h2"` advertises HTTP/2 and `port=443` the TLS
  port; `mandatory=alpn,port` marks both as required.
- `bap` (bulk agent protocol) is the draft's **experimental** SvcParamKey
  for the agent protocol. Per the draft, the agent protocol MAY instead
  be carried directly inside `alpn` (e.g. `alpn="mcp,h2"`) — the
  standards-track alternative that avoids the unregistered key.
- `well-known` values are names under `/.well-known/` on the TargetName
  host (`api-catalog`, `mcp/server-card.json`). Both resolve today.
- **Unregistered keys:** `bap`, `well-known`, `cap` and `cap-sha256` are
  deferred to IANA assignment (draft §7.1). Until registered, a zone file
  or provider UI that rejects the names must express them in numeric
  `keyNNNNN` form — if your provider does, publish `alpn="mcp,h2"` and
  drop `bap`, and keep `well-known` only if the editor accepts it.
- `ipv4hint`/`ipv6hint` are intentionally omitted — TargetName is a CNAME
  the provider already resolves.
- Optional capability signing per the draft: `cap` (capability descriptor
  URI) and `cap-sha256` (its digest) may be added once the draft's IANA
  values land.

### HTTPS-record variant

The skill and draft accept `HTTPS` records for HTTPS endpoints — required
if your DNS provider exposes only that type name:

```zone
_index._agents.nandodani.dev.    3600  IN  HTTPS 1  name-check-mcp.vercel.app. (
                                       alpn="h2" port=443 well-known="api-catalog" )
lmkurname._agents.nandodani.dev. 3600  IN  HTTPS 1  name-check-mcp.vercel.app. (
                                       alpn="h2" port=443 bap="mcp"
                                       well-known="mcp/server-card.json" )
```

### TXT fallback

Draft §4 allows `TXT` records carrying SvcParamKey-style RDATA as a
fallback where an authoritative portal cannot create SVCB/HTTPS at all,
and the auditor does probe `TXT _index._agents.<scanned-host>`. The
draft calls this "not considered desirable" (TXT has no `TargetName`, so
the service must live at the queried name itself) and §5.9 leaves the
index TXT encoding unsettled — treat it as a last resort, not a
substitute for the SVCB/HTTPS records above.

## Publishing

### Case A — custom domain attached to the deployment (the pass path)

This is the **only** configuration that can turn the audit's `dnsAid`
check green, because the auditor queries `_agents` names under the
hostname it scans:

1. Attach a custom domain to the Vercel project — e.g.
   `lmkurname.nandodani.dev` (a name inside a zone you control).
2. In that zone, publish the two records **under the attached hostname**
   — `_index._agents.lmkurname.nandodani.dev` and
   `lmkurname._agents.lmkurname.nandodani.dev` — with `TargetName` set to
   the custom domain itself (or keep `name-check-mcp.vercel.app.` — both
   resolve to the service).
3. Enable DNSSEC on the zone.
4. Re-scan `https://lmkurname.nandodani.dev` —
   `checks.discoverability.dnsAid.status` becomes `"pass"`.

### Case B — records under a domain you control (real DNS-AID, no score change)

Publishing the records under `nandodani.dev` (or any zone you control)
with `TargetName = name-check-mcp.vercel.app.` is valid DNS-AID today —
resolvers that query `_index._agents.nandodani.dev` will discover the
service. It does **not** change the audit result for
`name-check-mcp.vercel.app`: the auditor never queries other domains, so
the check only passes once the site is scanned on the hostname that
carries the records (Case A).

### Provider notes

- **Cloudflare DNS** — full `SVCB` + `HTTPS` support and one-click
  DNSSEC: DNS → Records → Add record, type `SVCB`, name
  `_index._agents.<host>` (e.g. `_index._agents.lmkurname`), value
  `1 <TargetName>. alpn="h2" port=443 mandatory=alpn,port well-known="api-catalog"`;
  repeat for `lmkurname._agents.<host>` with `bap="mcp"`. Enable DNSSEC
  under DNS → Settings.
- **Vercel DNS** — supports `HTTPS` records (RFC 9460) but not the `SVCB`
  type name; use the HTTPS-record variant. If its record editor rejects
  the unregistered `bap`/`well-known` params, keep
  `alpn="mcp,h2" port=443` only, or delegate the zone to Cloudflare.
  (Vercel DNS is a zone host for _your_ domains — it still cannot create
  records under `vercel.app` itself.)
- **DNSSEC** — the draft recommends signing public DNS-AID zones so
  validating resolvers get authenticated data (required if `TLSA` records
  are ever added). Enable it wherever the zone is hosted.

## Verify

```sh
dig SVCB _index._agents.nandodani.dev +dnssec
dig SVCB lmkurname._agents.nandodani.dev +dnssec
curl -s https://name-check-mcp.vercel.app/.well-known/api-catalog
curl -s https://name-check-mcp.vercel.app/.well-known/mcp/server-card.json
```

The auditor re-checks via DNS-over-HTTPS (Cloudflare resolver with
dns.google fallback): `POST https://isitagentready.com/api/scan` with
`{"url": "https://<the-hostname-that-carries-the-records>"}` →
`checks.discoverability.dnsAid.status` becomes `"pass"` once the records
are live under the scanned hostname. Scanning
`https://name-check-mcp.vercel.app` can never pass — `vercel.app` is
provider-owned; see the limitation above.

## Non-DNS discovery (always available)

The HTTP discovery surface does not depend on these records: `Link`
headers on `/`, `/openapi.json`, `/.well-known/api-catalog`,
`/.well-known/mcp/server-card.json`, `/.well-known/agent-skills/index.json`,
`/.well-known/ai-catalog.json`, `/llms.txt`, and `/auth.md`.
