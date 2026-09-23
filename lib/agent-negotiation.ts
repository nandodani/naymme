import { MARKDOWN_PAGE_PATHS, normalizePagePath } from "./page-content.js";

/**
 * Content-negotiation decision for agent-friendly Accept headers, shared by
 * proxy.ts (per-request) — pure and edge-safe (no Node APIs).
 *
 * - Known page + markdown Accept   → rewrite to the markdown representation.
 * - Unknown path + markdown Accept → rewrite to the markdown 404 document.
 * - Unknown path + JSON Accept     → structured JSON 404 ({error:{code,message,hint}}).
 * - Anything else                   → let the normal HTML pipeline answer.
 */
export type AgentNegotiation =
  | { kind: "markdown"; path: string }
  | { kind: "not-found-markdown"; path: string }
  | { kind: "not-found-json"; path: string }
  | { kind: "passthrough" };

export function negotiateAgentRequest(pathname: string, accept: string | null): AgentNegotiation {
  if (accept === null) return { kind: "passthrough" };
  const lowered = accept.toLowerCase();
  const path = normalizePagePath(pathname);
  if (lowered.includes("text/markdown")) {
    if (MARKDOWN_PAGE_PATHS.includes(path)) return { kind: "markdown", path };
    return { kind: "not-found-markdown", path };
  }
  if (lowered.includes("application/json") && !MARKDOWN_PAGE_PATHS.includes(path)) {
    return { kind: "not-found-json", path };
  }
  return { kind: "passthrough" };
}
