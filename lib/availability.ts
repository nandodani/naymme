import { defaultDeps, type ProviderDeps } from "../src/deps.js";
import type { CheckAvailabilityInput, CheckAvailabilityOutput } from "../src/schemas.js";
import { nameSchema, providerSelectionSchema } from "../src/schemas.js";
import {
  clientKeyFromHeaders,
  RATE_LIMITS,
  rateLimiterFromEnv,
  tooManyRequestsResponse,
  type RateLimiter,
} from "../src/security.js";
import { checkAvailability } from "../src/tools/checkAvailability.js";
import { z } from "zod";
import { demoCheckAvailability } from "./demo.js";

/**
 * Typed service boundary between the web UI and the availability providers.
 * `live` runs the real adapters (RDAP/WHOIS/DNS/GitHub/npm/socials); `demo`
 * answers with deterministic fixtures when network egress or credentials are
 * unavailable. The response always carries `mode` so the UI labels results
 * honestly.
 */
export type AvailabilityMode = "live" | "demo";

/** Validated provider ids/aliases — the zod-parsed subset of the input. */
export type ProviderSelection = CheckAvailabilityInput["providers"];

export interface AvailabilityService {
  readonly mode: AvailabilityMode;
  check(name: string, providers?: ProviderSelection): Promise<CheckAvailabilityOutput>;
}

export interface AvailabilityResponse extends CheckAvailabilityOutput {
  mode: AvailabilityMode;
}

export function liveAvailabilityService(deps: ProviderDeps = defaultDeps()): AvailabilityService {
  return {
    mode: "live",
    check: (name, providers) => checkAvailability({ name, providers: providers?.slice() }, deps),
  };
}

export function demoAvailabilityService(): AvailabilityService {
  return {
    mode: "demo",
    check: (name, providers) => Promise.resolve(demoCheckAvailability(name, providers)),
  };
}

/**
 * Pick the service from the environment. `LMKURNAME_AVAILABILITY_MODE=demo`
 * switches the whole endpoint to the deterministic fixture provider.
 */
export function availabilityServiceFromEnv(
  env: Record<string, string | undefined> = process.env,
): AvailabilityService {
  return env.LMKURNAME_AVAILABILITY_MODE === "demo"
    ? demoAvailabilityService()
    : liveAvailabilityService();
}

const querySchema = z.object({
  name: nameSchema,
  providers: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(z.array(providerSelectionSchema).max(65))
    .optional(),
});

const NO_STORE = { "cache-control": "no-store" } as const;

function jsonError(status: number, error: string, issues?: unknown): Response {
  return Response.json({ error, issues }, { status, headers: NO_STORE });
}

/**
 * GET /api/availability?name=<name>[&providers=a,b] — shared handler, kept
 * framework-free so it is testable without Next.js. The route passes the
 * env-selected service; tests inject their own.
 */
let sharedLimiter: RateLimiter | null = null;
function defaultLimiter(): RateLimiter {
  sharedLimiter ??= rateLimiterFromEnv(RATE_LIMITS.availability, process.env);
  return sharedLimiter;
}

export async function handleAvailabilityRequest(
  req: Request,
  service: AvailabilityService = availabilityServiceFromEnv(),
  limiter: Pick<RateLimiter, "allow"> = defaultLimiter(),
): Promise<Response> {
  const verdict = limiter.allow(clientKeyFromHeaders(req.headers));
  if (!verdict.ok) return tooManyRequestsResponse(verdict.retryAfterSeconds, NO_STORE);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    name: url.searchParams.get("name"),
    providers: url.searchParams.get("providers") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(400, "invalid request", z.treeifyError(parsed.error));
  }

  try {
    const output = await service.check(parsed.data.name, parsed.data.providers);
    const body: AvailabilityResponse = { ...output, mode: service.mode };
    return Response.json(body, { headers: NO_STORE });
  } catch (err) {
    // Internal detail goes to logs only — the client gets a generic error.
    console.error("availability check failed:", err);
    return jsonError(502, "availability check failed");
  }
}
