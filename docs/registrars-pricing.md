# Registrar pricing & domain resolution

How `lmkurname` resolves domain availability and how registrar links and
price estimates are modeled in `lib/links.ts`.

## Domain availability resolution flow

For every `domain:*` provider (`src/providers/domain.ts`), the check runs a
three-stage chain. The order is **RDAP → WHOIS → DNS NS** — WHOIS is the
fallback when the TLD has no RDAP service, and DNS is only a tiebreaker after
an inconclusive WHOIS:

```
                    ┌──────────────────────────────────────────────┐
                    │ 1. IANA bootstrap (data.iana.org/rdap/dns.json) │
                    └──────────────────────────────────────────────┘
                                   │
              ┌────────────────────┴─────────────────────┐
              │ TLD has an RDAP service                  │ TLD has none (or bootstrap unreachable)
              ▼                                          ▼
   GET {rdapBase}/domain/{fqdn}                 2. WHOIS via whoiser
   404 → available                              (raw text, 1 referral hop,
   200 → taken                                   timeoutMs − 250ms)
   400/422 → invalid                            "no match"/"not found"/… → available
   else  → unknown                              registration fields → taken
                                                inconclusive → unknown
                                                          │
                                                          ▼
                                              3. DNS NS lookup (resolveNs)
                                              NS records present → taken
                                              none / error → unknown
```

Key properties:

- The IANA bootstrap document is fetched lazily once per `RdapClient` and
  shared by all 25 TLD adapters; a failed bootstrap fetch is not cached, so the
  next lookup retries — and the current lookup falls through to WHOIS rather
  than failing.
- TLDs with RDAP (e.g. `.com`, `.dev`, `.app`, `.fr`, `.uk` per the IANA
  registry) never hit WHOIS; TLDs without RDAP (e.g. `.gg`, `.io`, `.pt`,
  `.es`, `.de`, `.eu`) go straight to stage 2.
- WHOIS is inherently fuzzy — registries phrase "not found" differently — so a
  clear registration/absence marker is required for a verdict; anything
  ambiguous escalates to the NS check.
- The NS check only ever upgrades `unknown` to `taken` (delegated name
  servers prove registration). It never produces `available`: undelegated
  registrations exist, and NXDOMAIN covers unregistered names too.
- On the Cloudflare Worker, WHOIS is unavailable (no raw TCP port 43), so the
  chain collapses to RDAP → DNS-over-HTTPS NS check (`cloudflare-dns.com`).

## Registrar links

`lib/links.ts` exports `REGISTRARS` — the registrars the UI offers to route an
available domain to. Each entry is `{ id, label, searchUrl(domain) }` where
`searchUrl` produces the registrar's public domain-search URL for the FQDN:

| Registrar  | `searchUrl` target                                            |
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

These are **plain deep links** — no affiliate parameters, referral tags, or
partner codes are added anywhere in the codebase. The app declares itself an
independent project with no brand affiliation in the UI footer
(`components/name-checker.tsx`). If affiliate tracking is added later it would
belong in these `searchUrl` builders, but today none exists.

## Pricing model — `TLD_PRICE_ESTIMATES`

`lib/links.ts` holds a static `TLD_PRICE_ESTIMATES` table:

```ts
Partial<Record<ProviderId, Partial<Record<RegistrarId, number | null>>>>;
```

- Values are **rough first-year USD estimates** based on published rates.
  There is **no live registrar pricing API** wired in — no provider is queried
  at runtime for prices, and numbers can drift from current rates.
- The UI renders every figure with `~` and labels it an estimate.
- `null` means the registrar does not carry that TLD (or no published rate is
  tracked) — rendered as `—`, never invented. Cloudflare Registrar is the
  clearest example: it supports a subset of gTLDs and no ccTLDs, so it is
  `null` for `.io`, `.ai`, `.gg`, `.pt`, `.es`, `.de`, `.fr`, `.uk`, `.eu`,
  `.sh`, `.so` — and Vercel is `null` for most TLDs outside `.com`/`.dev`/
  `.app`/`.org`/`.xyz`.
- `tldPrices(providerId)` returns the estimates in `REGISTRARS` order, or `[]`
  for non-domain providers and TLDs with no tracked pricing.

### Per-registrar notes (as implemented)

| Registrar  | Coverage in the table                                                | Estimate character                               |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| Porkbun    | All 25 TLDs have values                                              | Low-to-mid; e.g. `com` 11, `io` 34, `ai`/`gg` 68 |
| Cloudflare | gTLD subset only — `null` for every ccTLD (wholesale, at-cost model) | `com` 10, `dev` 13, `app` 15, `org` 11           |
| Namecheap  | All 25 TLDs have values                                              | Low-to-mid; e.g. `com` 11, `io` 33, `ai` 68      |
| GoDaddy    | All 25 TLDs have values                                              | Mid-to-high; e.g. `com` 13, `io` 45, `ai` 100    |

(The remaining five registrars — Vercel, Spaceship, Dynadot, Gandi, Hover —
follow the same `number | null` scheme.)

## TLD handling

- The 25 `domain:*` provider ids map one-to-one to TLDs; the table covers all 25. A provider id absent from the table yields `tldPrices() === []`.
- TLDs are grouped in the UI as core (`.com`, `.io`, `.ai`, `.dev`, `.app`,
  `.co`, `.me`, `.org`, `.xyz`), regional ccTLDs (`.pt`, `.es`, `.de`, `.fr`,
  `.uk`, `.eu`, `.gg`, `.sh`, `.so`) and industry niches (`.design`, `.store`,
  `.work`, `.studio`, `.tech`, `.agency`, `.space`) in
  `lib/provider-meta.ts` — grouping is display-only; it does not affect
  pricing or the availability chain.
- The `domains` alias covers `.com`/`.gg`/`.dev`/`.io`; `domains:cctld` the
  ccTLD set; `domains:all` every TLD (`src/schemas.ts`).

## Renewal vs first-year pricing — not modeled

The table tracks **first-year** estimates only. There is no renewal-price
field, no promo-vs-standard distinction, and no multi-year math. Registrar
promos frequently price year one below the renewal rate (GoDaddy notably
advertises very low first-year `.com` prices with higher renewals), so treat
the estimates as "what a first checkout might look like", not the cost of
holding the domain. Adding a renewal column would mean extending
`TLD_PRICE_ESTIMATES` to `{ firstYear, renewal }` records — currently
unimplemented.

## ICANN fees — not modeled

Nothing in the codebase adds, tracks, or displays ICANN fees. For context
(external knowledge, not implementation): ICANN charges registrars a
per-domain-year transaction fee (USD 0.18 for large gTLDs at the time of
writing); some registrars list it separately at checkout, others fold it into
the headline price. The estimates in `TLD_PRICE_ESTIMATES` do not say which
style each registrar uses — another reason they are labelled `~` estimates.
