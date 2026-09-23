/**
 * API versioning. Every API response carries `API-Version: 1`; the
 * versioned `/api/v1/*` routes and the unversioned `/api/*` paths are the
 * same handlers — v1 behavior. A future breaking v2 will keep v1 live and
 * mark it with the standard `Deprecation` + `Sunset` headers plus a
 * `Link: <…>; rel="deprecation"` pointer before removal, documented in
 * /auth.md.
 */
export const API_VERSION = "1";

/** Semantic form of the API version — the `X-API-Version` header value. */
export const API_SEMVER = "1.0.0";

/**
 * Version headers every API response carries: `API-Version: 1` (the wire
 * version) and `X-API-Version: 1.0.0` (semver form for clients that look
 * for the conventional header).
 */
export function apiVersionHeaders(): Record<string, string> {
  return { "api-version": API_VERSION, "x-api-version": API_SEMVER };
}
