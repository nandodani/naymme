import { MARKDOWN_PAGE_PATHS, normalizePagePath } from "./page-content.js";

/**
 * Content-negotiation decision for `Accept: text/markdown`, shared by
 * proxy.ts (per-request) — pure and edge-safe (no Node APIs).
 *
 * - Known page + markdown Accept  → rewrite to the markdown representation.
 * - Unknown path + markdown Accept → rewrite to the markdown 404 document.
 * - Anything else                  → let the normal HTML pipeline answer.
 */
export type AgentNegotiation =
  | { kind: "markdown"; path: string }
  | { kind: "not-found-markdown"; path: string }
  | { kind: "passthrough" };

export function negotiateAgentRequest(pathname: string, accept: string | null): AgentNegotiation {
  if (accept === null || !accept.toLowerCase().includes("text/markdown")) {
    return { kind: "passthrough" };
  }
  const path = normalizePagePath(pathname);
  if (MARKDOWN_PAGE_PATHS.includes(path)) return { kind: "markdown", path };
  return { kind: "not-found-markdown", path };
}
