import { z } from "zod";
import { nameSchema } from "../src/schemas.js";
import { scoreName } from "../src/scoring/score.js";

const NO_STORE = { "cache-control": "no-store" } as const;

/** GET /api/score?name=<name> — deterministic brand score as JSON. */
export function handleScoreRequest(req: Request): Response {
  const parsed = nameSchema.safeParse(new URL(req.url).searchParams.get("name"));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid request", issues: z.treeifyError(parsed.error) },
      { status: 400, headers: NO_STORE },
    );
  }
  return Response.json(scoreName(parsed.data), { headers: NO_STORE });
}
