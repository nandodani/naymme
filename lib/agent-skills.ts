import { SITE_URL } from "./site.js";

/**
 * Agent Skills discovery (Cloudflare agent-skills-discovery-rfc v0.2.0,
 * RFC 8615 well-known URI). Two `skill-md` artifacts are published under
 * /.well-known/agent-skills/<name>/SKILL.md and listed in index.json with
 * SHA-256 digests so clients can verify integrity before loading them.
 */

export interface AgentSkillDoc {
  /** 1-64 chars, lowercase alphanumeric + hyphens (spec naming rule). */
  name: string;
  description: string;
  /** Full SKILL.md body, frontmatter included. */
  markdown: string;
}

const FRONTMATTER = (name: string, description: string) =>
  ["---", `name: ${name}`, `description: ${description}`, "---", ""].join("\n");

export const AGENT_SKILLS: readonly AgentSkillDoc[] = [
  {
    name: "name-availability-check",
    description:
      "Check whether a candidate project or brand name is available across domains, GitHub, npm and other dev registries, hosted subdomains, stores and social handles via naymme's public API or MCP tools. Use when asked whether a name, domain, package or handle is free, when naming a project or brand, or when vetting a name before registering it.",
    markdown:
      FRONTMATTER(
        "name-availability-check",
        "Check name availability across 61 providers with naymme",
      ) +
      [
        "",
        "## When to use",
        "",
        'Use when the request is "is <name> free?" — naming a project, product, company, package or handle, or answering whether a handle/domain is already taken. Triggers: naming a repo or package, choosing a brand, checking a handle across socials, vetting a name before registering anywhere.',
        "",
        "Do NOT use for trademark or legal clearance, premium-domain pricing, WHOIS owner lookup, or guaranteed availability — verdicts are best-effort snapshots to re-confirm at the source.",
        "",
        "## REST",
        "",
        `GET ${SITE_URL}/api/v1/availability?name=<name>[&providers=<csv>] — returns \`{ name, results, summary }\`. Each result reports \`provider\`, \`status\` (available | taken | unknown | invalid), \`subject\`, \`available\`, optional \`detail\` and \`durationMs\`.`,
        "",
        "- `providers` is an optional comma-separated list of provider ids or the aliases `all`, `domains`, `domains:cctld`, `domains:all`, `socials`.",
        "- `unknown` means the source could not be checked — never treat it as available; re-confirm at the source before registering.",
        "- Responses carry `API-Version: 1` and RFC RateLimit headers; honor `Retry-After` on 429.",
        "",
        "### Invocation",
        "",
        "```",
        `curl -s '${SITE_URL}/api/v1/availability?name=myapp&providers=domains,github,npm'`,
        "```",
        "",
        "## MCP",
        "",
        `Call the \`check_availability\` tool on ${SITE_URL}/api/mcp (stateless Streamable HTTP, no auth). Same input and output as REST:`,
        "",
        "```",
        `curl -s -X POST ${SITE_URL}/api/mcp \\`,
        `  -H 'content-type: application/json' \\`,
        `  -H 'accept: application/json, text/event-stream' \\`,
        `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check_availability","arguments":{"name":"myapp","providers":["domains","github","npm"]}}}'`,
        "```",
        "",
        "## Notes",
        "",
        "- Bare names only: 1–63 chars, starts alphanumeric, ASCII letters/digits plus `.`, `_`, `-`.",
        "- `available`/`taken` are best-effort snapshots — always re-verify at the registrar or platform before purchase.",
        "- Errors are structured: `{error:{code,message,hint}}`.",
        "",
      ].join("\n"),
  },
  {
    name: "brand-name-scoring",
    description:
      "Score a candidate name 0–100 for brand quality — punchiness, syllables, pronounceability, uniqueness and cleanliness — with naymme's deterministic scorer. Use when comparing candidate names, scoring a brand name, or sanity-checking a name's brand quality before or after an availability check.",
    markdown:
      FRONTMATTER("brand-name-scoring", "Deterministically score a name for brand quality") +
      [
        "",
        "## When to use",
        "",
        'Use when comparing candidate names for brand quality or sanity-checking a name before/after an availability sweep. Triggers: "which of these names is stronger?", "score this brand name", "is this name punchy?". Pair with the name-availability-check skill for the full naming decision.',
        "",
        "Do NOT use for availability itself (it never checks registries) or for subjective taste — it is a deterministic heuristic, not a brand consultant.",
        "",
        "## REST",
        "",
        `GET ${SITE_URL}/api/v1/score?name=<name> — returns \`{ name, normalized, punchiness, syllables, pronounceability, uniqueness, cleanliness, total, grade }\` with \`total\` 0–100 and \`grade\` Excellent | Strong | Fair | Weak | Poor.`,
        "",
        "### Invocation",
        "",
        "```",
        `curl -s '${SITE_URL}/api/v1/score?name=myapp'`,
        "```",
        "",
        "## MCP",
        "",
        `Call the \`score_name\` tool on ${SITE_URL}/api/mcp (stateless Streamable HTTP, no auth):`,
        "",
        "```",
        `curl -s -X POST ${SITE_URL}/api/mcp \\`,
        `  -H 'content-type: application/json' \\`,
        `  -H 'accept: application/json, text/event-stream' \\`,
        `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"score_name","arguments":{"name":"myapp"}}}'`,
        "```",
        "",
        "## Notes",
        "",
        "- Deterministic: same input always yields the same score — no network lookups.",
        "- Punchiness rewards the 5–8 character sweet spot; cleanliness penalizes digits, separators and repeated characters.",
        "- Responses carry `API-Version: 1` and RFC RateLimit headers.",
        "",
      ].join("\n"),
  },
];

/** SHA-256 hex digest of a UTF-8 string — web-standard, runs on Node ≥20 and edge. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The RFC v0.2.0 index served at /.well-known/agent-skills/index.json. */
export async function buildAgentSkillsIndex(): Promise<Record<string, unknown>> {
  const skills = await Promise.all(
    AGENT_SKILLS.map(async (skill) => ({
      name: skill.name,
      type: "skill-md",
      description: skill.description,
      url: `${SITE_URL}/.well-known/agent-skills/${skill.name}/SKILL.md`,
      digest: `sha256:${await sha256Hex(skill.markdown)}`,
    })),
  );
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills,
  };
}

/** Look up a published skill document by name — `undefined` for unknown ids. */
export function agentSkillMarkdown(name: string): string | undefined {
  return AGENT_SKILLS.find((skill) => skill.name === name)?.markdown;
}
