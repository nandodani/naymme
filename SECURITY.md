# Security Policy

## Supported versions

The latest commit on `main` is supported. Older versions receive fixes only
if they ship in a new release.

## Reporting a vulnerability

Please **do not** open a public issue for security reports.

Report vulnerabilities privately through
[GitHub's private vulnerability reporting](https://github.com/nandodani/naymme/security/advisories/new)
on this repository. Include the affected surface (web UI, hosted MCP
endpoint, stdio server, Node HTTP server, or Cloudflare Worker), reproduction
steps, and the impact you believe the issue has.

You can expect an acknowledgement within a few days and a timeline for a fix
once the report is confirmed.

## Scope notes

- naymme issues **unauthenticated** availability lookups to third-party
  registries on behalf of the caller. Results are snapshots, not guarantees —
  that is a documented limitation, not a vulnerability.
- The hosted endpoints carry RFC RateLimit headers and return structured
  error envelopes; abusive-traffic reports are still welcome.
