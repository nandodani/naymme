/**
 * API versioning. Every API response carries `API-Version: 1`; the
 * versioned `/api/v1/*` routes and the unversioned `/api/*` paths are the
 * same handlers — v1 behavior. A future breaking v2 will keep v1 live and
 * mark it with the standard `Deprecation` + `Sunset` headers plus a
 * `Link: <…>; rel="deprecation"` pointer before removal, documented in
 * /auth.md.
 */
export const API_VERSION = "1";
