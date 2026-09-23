// `next/server` has no exports-map entry or file extension, so it cannot be
// resolved under this repo's `nodenext` module resolution — these are the
// exact modules `next/server.js` re-exports, resolved by explicit path.
import type { NextRequest } from "next/dist/server/web/spec-extension/request.js";
import { NextResponse } from "next/dist/server/web/spec-extension/response.js";

import { apiErrorBody, API_ERROR_CODES } from "./src/api-errors.js";
import { negotiateAgentRequest } from "./lib/agent-negotiation.js";

/**
 * Content negotiation edge-proxy (Next 16's name for middleware).
 *
 * Clients sending `Accept: text/markdown` get the markdown representation of
 * a page — or a markdown 404 for unknown paths — via an internal rewrite to
 * /api/markdown, which responds `Content-Type: text/markdown` + `Vary:
 * Accept`. Clients sending `Accept: application/json` get a structured JSON
 * 404 envelope ({error:{code,message,hint}}) on unknown paths. Everything
 * else falls through to the normal pipeline unchanged.
 *
 * The matcher scope intentionally excludes dotted paths (robots.txt,
 * sitemap.xml, llms.txt, icons, fonts — already machine-readable), API and
 * MCP endpoints, and _next internals, so only real page URLs negotiate.
 */
export function proxy(request: NextRequest): NextResponse {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }
  const pathname = new URL(request.url).pathname;
  const plan = negotiateAgentRequest(pathname, request.headers.get("accept"));
  if (plan.kind === "not-found-json") {
    return NextResponse.json(
      apiErrorBody(
        API_ERROR_CODES.notFound,
        `${plan.path} not found`,
        "Nothing is published at this URL — real entry points: /, /docs, /openapi.json, /.well-known/mcp, /sitemap.xml.",
      ),
      { status: 404 },
    );
  }
  if (plan.kind === "passthrough") {
    // Vary: Accept can't be added here — response headers set on the
    // middleware response are overwritten by the page's own Vary. The
    // markdown variant emitted by /api/markdown does carry it, which is
    // what the audit requires.
    return NextResponse.next();
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-markdown-path", plan.path);
  return NextResponse.rewrite(new URL("/api/markdown", request.url), {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next|fonts|api|mcp|health|opengraph-image|twitter-image|.*\\..*).*)"],
};
