import { apiErrorResponse, API_ERROR_CODES } from "@/src/api-errors.js";
import { guardAuxRequest } from "@/lib/api-guard.js";
import { notFoundMarkdown, pageContentToMarkdown } from "@/lib/markdown.js";
import { PAGE_CONTENTS, normalizePagePath } from "@/lib/page-content.js";

/**
 * GET /api/markdown?path=/about — markdown representations of the site's
 * pages. proxy.ts rewrites `Accept: text/markdown` requests here; unknown
 * paths get a markdown 404 document. `Vary: Accept` keeps the HTML and
 * markdown variants distinct for caches. Every response carries the same
 * API-Version + RFC RateLimit headers as the rest of the API surface
 * (shared aux budget).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARKDOWN_HEADERS = {
  "content-type": "text/markdown; charset=utf-8",
  vary: "Accept",
};

/** Structured JSON 404 for clients that asked for application/json. */
function notFoundJson(path: string, headers: Record<string, string>): Response {
  return apiErrorResponse(
    404,
    API_ERROR_CODES.notFound,
    `${path} not found`,
    "Set ?path= to a real page (/, /docs, /about, /contact, /privacy, /credits) or send Accept: text/markdown.",
    { headers: { vary: "Accept", ...headers } },
  );
}

export function GET(request: Request): Response {
  const guard = guardAuxRequest(request);
  if (!guard.ok) return guard.response;
  const headers = { ...MARKDOWN_HEADERS, ...guard.headers };

  const wantsJson = request.headers.get("accept")?.toLowerCase().includes("application/json");
  const raw =
    request.headers.get("x-markdown-path") ?? new URL(request.url).searchParams.get("path");
  if (raw === null) {
    if (wantsJson === true) return notFoundJson("/", guard.headers);
    return new Response(notFoundMarkdown("/"), { status: 404, headers });
  }
  const path = normalizePagePath(raw);
  const page = PAGE_CONTENTS[path];
  if (page === undefined) {
    if (wantsJson === true) return notFoundJson(path, guard.headers);
    return new Response(notFoundMarkdown(path), { status: 404, headers });
  }
  return new Response(pageContentToMarkdown(page), { headers });
}
