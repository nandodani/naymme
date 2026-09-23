import { buildLlmsFullTxt } from "@/lib/llms.js";

/** /llms-full.txt — complete agent instructions: tools, API, providers. */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildLlmsFullTxt(), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
