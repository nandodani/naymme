# Domain availability & registrar pricing

How `domain:*` availability is determined, how registrar links and price
estimates work today — and what is explicitly **not** implemented yet.

## Availability determination (implemented)

[`src/providers/domain.ts`](../src/providers/domain.ts) resolves
`{name}.{tld}` through a strict fallback chain — not a registrar API:

1. **RDAP** ([`rdap.ts`](../src/providers/rdap.ts)) — the IANA bootstrap
   document (`https://data.iana.org/rdap/dns.json`) is fetched lazily once and
   cached for the client's lifetime. For a TLD with an RDAP service it GETs
   `{base}/domain/{fqdn}`: `404` → `available`, `200` → `taken`,
   `400`/`422` → `invalid`, everything else → `unknown`.
2. **WHOIS** ([`whois.ts`](../src/providers/whois.ts)) — TLDs without RDAP
   fall back to raw WHOIS over TCP port 43 (`whoiser`). The response is
   text-matched for "not found" phrases vs registration fields; inconclusive
   output → `unknown`.
3. **DNS NS** ([`dns.ts`](../src/providers/dns.ts)) — last resort after an
   inconclusive WHOIS: delegated name servers → `taken`; absence → `unknown`
   (undelegated registrations and unregistered names both have no NS).

On the Cloudflare Worker, WHOIS is skipped entirely (no raw TCP) and DNS NS
goes over DNS-over-HTTPS — see [providers.md](providers.md#runtime-differences).

There is **no registrar-API availability path** (no EPP, no
Namecheap/GoDaddy/Porkbun APIs) — checks are anonymous registry-level
lookups, which is why `available`/`taken` are snapshots, not guarantees.

## Registrar deep links (implemented)

[`lib/links.ts`](../lib/links.ts) defines nine registrars the UI links out to
— plain domain-search URLs, **no affiliate parameters**:

| Registrar  | Search URL pattern                                            |
| ---------- | ------------------------------------------------------------- |
| Porkbun    | `porkbun.com/checkout/search?q={domain}`                      |
| Cloudflare | `domains.cloudflare.com/?domain={domain}`                     |
| Namecheap  | `namecheap.com/domains/registration/results/?domain={domain}` |
| GoDaddy    | `godaddy.com/domainsearch/find?domainToCheck={domain}`        |
| Vercel     | `vercel.com/domains?query={domain}`                           |
| Spaceship  | `spaceship.com/domain-search/?query={domain}`                 |
| Dynadot    | `dynadot.com/domain/search.html?domain={domain}`              |
| Gandi      | `shop.gandi.net/en/domain/suggest?search={domain}`            |
| Hover      | `hover.com/domains/results?q={domain}`                        |

`REGISTRARS` in [`lib/links.ts`](../lib/links.ts) is the source; each entry is
`{ id, label, searchUrl(domain) }`.

## Price estimates (implemented — static, not live)

`TLD_PRICE_ESTIMATES` ([`lib/links.ts`](../lib/links.ts)) is a hardcoded table
of **rough first-year USD estimates per TLD per registrar**, surfaced through
`tldPrices(provider)`:

- Prices are **static published-rate estimates in USD** — there is no live
  registrar pricing API wired in. The UI renders them with `~` and labels
  them as estimates.
- `null` means the registrar does not carry the TLD (e.g. Cloudflare
  Registrar supports only a subset of gTLDs and no ccTLDs) — rendered as `—`,
  never invented.
- Estimates cover **first-year** pricing only. Renewal pricing, multi-year,
  premium-tier pricing, ICANN fees and currency conversion are **not
  modeled**.
- Non-`domain:*` providers return `[]` from `tldPrices()`.

Coverage snapshot for the four headline registrars (all 25 TLDs are tracked in
the table; Vercel/Spaceship/Dynadot/Gandi/Hover follow the same
`number | null` scheme):

| Registrar  | Coverage in `TLD_PRICE_ESTIMATES`                                   | Sample first-year estimates            |
| ---------- | ------------------------------------------------------------------- | -------------------------------------- |
| Porkbun    | Value for every TLD                                                 | `com` 11, `io` 34, `ai`/`gg` 68        |
| Cloudflare | gTLD subset only — `null` for every ccTLD (at-cost wholesale model) | `com` 10, `dev` 13, `app` 15, `org` 11 |
| Namecheap  | Value for every TLD                                                 | `com` 11, `io` 33, `ai` 68             |
| GoDaddy    | Value for every TLD                                                 | `com` 13, `io` 45, `ai` 100            |

TLD handling: the 25 `domain:*` provider ids map one-to-one to TLDs and every
one has a `TLD_PRICE_ESTIMATES` row; the core/regional/niche grouping in
[`lib/provider-meta.ts`](../lib/provider-meta.ts) is display-only and does not
affect pricing.

## Proposals — live registrar pricing (not implemented)

None of the below exists in the codebase; this is a suggested design only.

### Registrar availability + price lookups

| Registrar  | Feasible path (proposal)                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Porkbun    | Public JSON API (`api.porkbun.com/api/json/v3/pricing/get` — key required). Free tier exists; returns first-year/renewal/transfer per TLD. |
| Cloudflare | No public pricing API — Registrar is at-cost; likely keep static estimates or scrape-free table.                                           |
| Namecheap  | XML API (`api.namecheap.com`) — requires whitelisted IP + API key; has `domains.check`/`getTldList` + pricing. Server-side only.           |
| GoDaddy    | OTE/production REST API (`api.godaddy.com/v1/domains/available`) — key+secret required.                                                    |

Suggested shape: a `pricing.ts` service exposing `lookupPrice(domain) → { registrar, currency, firstYear, renewal?, status } | null` behind
`ProviderDeps`-style injection (same pattern as `whoisDomain`/`resolveNs`),
with env-var credentials, per-registrar adapters, and the static
`TLD_PRICE_ESTIMATES` table kept as the offline fallback — estimates would
stay labelled `~` whenever no live price is returned.

### Pricing model gaps to close when live pricing lands

- **Renewal vs first-year**: the table tracks first-year only; renewal
  columns should be a separate field, not mixed into the estimate.
- **Currency**: estimates are USD; a `currency` field on the result type
  should be added before any non-USD source is wired in. No conversion
  exists today.
- **ICANN fee**: ~$0.18/year on gTLD registrations, typically bundled into
  registrar pricing — the estimates currently assume bundling; call this out
  per-registrar when real prices land.
- **Premium/aftermarket names**: registry premium tiers are not detectable
  via RDAP/WHOIS — flag as "pricing unknown" rather than showing the standard
  estimate.

## Related docs

- Provider mechanics: [providers.md](providers.md#domains-domain---rdap--whois--dns)
- Registrar deep links used by the UI grid: [`components/`](../components/) + `platformLinks`/`tldPrices` in [`lib/links.ts`](../lib/links.ts)
