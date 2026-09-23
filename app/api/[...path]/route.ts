import { apiErrorResponse, API_ERROR_CODES } from "@/src/api-errors.js";
import { API_VERSION } from "@/src/api-version.js";

/**
 * Catch-all for unmapped /api/* paths — agents (and humans) always get the
 * structured error envelope instead of the default HTML 404 page. Static
 * routes take precedence, so this only sees genuinely unknown paths.
 */
export const runtime = "nodejs";

function notFound(request: Request): Response {
  const { pathname } = new URL(request.url);
  return apiErrorResponse(
    404,
    API_ERROR_CODES.notFound,
    `${pathname} not found`,
    "No API endpoint is published at this path — real entry points: /api/availability, /api/score, /api/mcp (+ /api/v1/* aliases), /api/markdown, /api/openapi.json. See /openapi.json.",
    { headers: { "api-version": API_VERSION } },
  );
}

export function GET(request: Request): Response {
  return notFound(request);
}

export function POST(request: Request): Response {
  return notFound(request);
}

export function PUT(request: Request): Response {
  return notFound(request);
}

export function PATCH(request: Request): Response {
  return notFound(request);
}

export function DELETE(request: Request): Response {
  return notFound(request);
}
