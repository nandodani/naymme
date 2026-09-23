import { buildLlmsTxt } from "@/lib/llms.js";

/** /llms.txt — concise agent quick-start (llmstxt.org convention). */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
