import { apiNotFound } from "@/lib/api-guard.js";

/**
 * Catch-all for unmapped /api/* paths — agents (and humans) always get the
 * structured error envelope instead of the default HTML 404 page. Static
 * routes take precedence, so this only sees genuinely unknown paths.
 */
export const runtime = "nodejs";

export function GET(request: Request): Response {
  return apiNotFound(request);
}

export function POST(request: Request): Response {
  return apiNotFound(request);
}

export function PUT(request: Request): Response {
  return apiNotFound(request);
}

export function PATCH(request: Request): Response {
  return apiNotFound(request);
}

export function DELETE(request: Request): Response {
  return apiNotFound(request);
}
