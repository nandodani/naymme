/**
 * Structured JSON error envelope shared by every runtime (Next.js route
 * handlers, the standalone Node HTTP server, the Cloudflare Worker and the
 * edge proxy). Web-standard API only — no `node:*` imports.
 *
 * Every non-RPC error body is `{ error: { code, message, hint, details? } }`:
 * `code` is a stable machine string, `message` the human summary and `hint`
 * an actionable fix for tool-calling agents. JSON-RPC responses from the MCP
 * transports keep their protocol-mandated `{ code, message }` shape and carry
 * the same hint inside `error.data`.
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    hint: string;
    details?: unknown;
  };
}

export function apiErrorBody(
  code: string,
  message: string,
  hint: string,
  details?: unknown,
): ApiErrorBody {
  return details === undefined
    ? { error: { code, message, hint } }
    : { error: { code, message, hint, details } };
}

export function apiErrorResponse(
  status: number,
  code: string,
  message: string,
  hint: string,
  options: { headers?: Record<string, string>; details?: unknown } = {},
): Response {
  return Response.json(apiErrorBody(code, message, hint, options.details), {
    status,
    headers: options.headers ?? {},
  });
}

/** Stable error codes across surfaces. */
export const API_ERROR_CODES = {
  invalidRequest: "invalid_request",
  notFound: "not_found",
  rateLimited: "rate_limited",
  bodyTooLarge: "body_too_large",
  upstreamFailed: "upstream_failed",
  tooManySessions: "too_many_sessions",
  internal: "internal_error",
} as const;
