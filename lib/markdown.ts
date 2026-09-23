import type { PageContent } from "./page-content.js";
import { SITE_NAME, SITE_URL } from "./site.js";

/**
 * Markdown renderers for agent-facing responses — `Accept: text/markdown`
 * page bodies and the markdown-flavoured 404. Relative links are absolutized
 * against SITE_URL so the documents are self-contained for crawlers.
 */

const REPO_DOCS = "https://github.com/nandodani/name-check-mcp/tree/main/docs";

function absolutize(href: string): string {
  return href.startsWith("/") ? `${SITE_URL}${href}` : href;
}

export function pageContentToMarkdown(page: PageContent): string {
  const out: string[] = [`# ${page.title}`, "", page.description, ""];
  for (const section of page.sections) {
    if (section.heading !== undefined) out.push(`## ${section.heading}`, "");
    for (const paragraph of section.paragraphs ?? []) out.push(paragraph, "");
    for (const item of section.list ?? []) out.push(`- ${item}`);
    if (section.list !== undefined && section.list.length > 0) out.push("");
    for (const link of section.links ?? []) out.push(`- [${link.label}](${absolutize(link.href)})`);
    if (section.links !== undefined && section.links.length > 0) out.push("");
  }
  return `${out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}

/**
 * Body returned with status 404 to clients asking for markdown: explains the
 * miss, and points agents at the site map, docs and the MCP endpoint.
 */
export function notFoundMarkdown(path: string): string {
  const requested = path === "" ? "/" : path;
  return [
    `# 404 — not found`,
    "",
    `\`${requested}\` does not exist on ${SITE_NAME} (${SITE_URL}). Nothing is published at this URL — check the spelling, or start from a real entry point:`,
    "",
    `- [Homepage](${SITE_URL}/) — name availability checker`,
    `- [llms.txt](${SITE_URL}/llms.txt) — agent quick-start`,
    `- [llms-full.txt](${SITE_URL}/llms-full.txt) — complete agent instructions`,
    `- [sitemap.xml](${SITE_URL}/sitemap.xml) — every indexable route`,
    `- [Documentation](${REPO_DOCS}) — API reference, providers, deployment`,
    `- [MCP discovery](${SITE_URL}/.well-known/mcp) — tools and transport`,
    "",
    `Machine endpoints: POST ${SITE_URL}/api/mcp (MCP Streamable HTTP), GET /api/availability?name=<name>, GET /api/score?name=<name>.`,
    "",
  ].join("\n");
}
