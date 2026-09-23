import { apiNotFound } from "@/lib/api-guard.js";

/**
 * Catch-all for unmapped /v1/* paths — same structured JSON 404 envelope
 * as the /api/* catch-all. Static routes take precedence.
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
