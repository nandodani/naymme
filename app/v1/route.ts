import { guardAuxRequest } from "@/lib/api-guard.js";
import { API_SEMVER, API_VERSION } from "@/src/api-version.js";

/**
 * GET /v1 — version index for the root-level alias surface: which API
 * version this is and where the v1 endpoints live. Root aliases mirror the
 * canonical /api/v1/* paths (the unversioned /api/* paths are the same
 * handlers).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const guard = guardAuxRequest(request);
  if (!guard.ok) return guard.response;
  return Response.json(
    {
      apiVersion: API_VERSION,
      xApiVersion: API_SEMVER,
      deprecated: false,
      sunset: null,
      deprecationPolicy:
        'Stable versions are never removed without notice — before a breaking release the previous version emits Deprecation + Sunset headers and a Link rel="deprecation" pointer. See /auth.md.',
      endpoints: {
        check: "/v1/check",
        score: "/v1/score",
        mcp: "/v1/mcp",
        canonicalPrefix: "/api/v1",
      },
      docs: "/docs",
      openapi: "/openapi.json",
    },
    { headers: guard.headers },
  );
}
