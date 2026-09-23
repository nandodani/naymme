import { buildAgentSkillsIndex } from "@/lib/agent-skills.js";

/**
 * /.well-known/agent-skills/index.json — agent-skills discovery RFC
 * v0.2.0 index: every published skill with its SKILL.md URL and a
 * sha256 digest for integrity verification.
 */
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  return Response.json(await buildAgentSkillsIndex());
}
