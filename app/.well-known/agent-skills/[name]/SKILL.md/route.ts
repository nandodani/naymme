import { agentSkillMarkdown } from "@/lib/agent-skills.js";
import { apiErrorBody, API_ERROR_CODES } from "@/src/api-errors.js";

/** /.well-known/agent-skills/<name>/SKILL.md — one published skill document. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await params;
  const markdown = agentSkillMarkdown(name);
  if (markdown === undefined) {
    return Response.json(
      apiErrorBody(
        API_ERROR_CODES.notFound,
        `unknown skill '${name}'`,
        "Published skills are listed in /.well-known/agent-skills/index.json.",
      ),
      { status: 404 },
    );
  }
  return new Response(markdown, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
