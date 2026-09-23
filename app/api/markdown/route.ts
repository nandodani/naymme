import { notFoundMarkdown, pageContentToMarkdown } from "@/lib/markdown.js";
import { PAGE_CONTENTS, normalizePagePath } from "@/lib/page-content.js";

/**
 * GET /api/markdown?path=/about — markdown representations of the site's
 * pages. proxy.ts rewrites `Accept: text/markdown` requests here; unknown
 * paths get a markdown 404 document. `Vary: Accept` keeps the HTML and
 * markdown variants distinct for caches.
 */
export const runtime = "nodejs";

const MARKDOWN_HEADERS = {
  "content-type": "text/markdown; charset=utf-8",
  vary: "Accept",
};

export function GET(request: Request): Response {
  const raw =
    request.headers.get("x-markdown-path") ?? new URL(request.url).searchParams.get("path");
  if (raw === null) {
    return new Response(notFoundMarkdown("/"), { status: 404, headers: MARKDOWN_HEADERS });
  }
  const path = normalizePagePath(raw);
  const page = PAGE_CONTENTS[path];
  if (page === undefined) {
    return new Response(notFoundMarkdown(path), { status: 404, headers: MARKDOWN_HEADERS });
  }
  return new Response(pageContentToMarkdown(page), { headers: MARKDOWN_HEADERS });
}
