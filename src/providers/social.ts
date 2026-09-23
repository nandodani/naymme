import type { ProviderDeps } from "../deps.js";
import type { ProviderAdapter, ProviderOutcome } from "../types.js";
import { invalidOutcome } from "./validation.js";

/**
 * These platforms expect a real browser; a descriptive UA keeps the
 * unauthenticated endpoints from being trivially rejected.
 */
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function unknown(subject: string, detail: string): ProviderOutcome {
  return { status: "unknown", subject, available: null, detail };
}

function taken(subject: string, detail: string): ProviderOutcome {
  return { status: "taken", subject, available: false, detail };
}

function available(subject: string, detail: string): ProviderOutcome {
  return { status: "available", subject, available: true, detail };
}

/** fetch wrapper: network failures → null, aborts propagate to the runner. */
async function safeFetch(
  deps: ProviderDeps,
  url: string,
  signal: AbortSignal,
  headers: Record<string, string> = {},
): Promise<Response | null> {
  try {
    return await deps.fetch(url, {
      signal,
      headers: { "user-agent": BROWSER_UA, ...headers },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return null;
  }
}

/** Map an HTTP status to a verdict via the platform's taken/free codes. */
function statusVerdict(
  res: Response,
  opts: { free: readonly number[]; busy: readonly number[]; blocked?: readonly number[] },
): "available" | "taken" | "unknown" {
  if (opts.free.includes(res.status)) return "available";
  if (opts.busy.includes(res.status)) return "taken";
  return "unknown";
}

/**
 * X/Twitter handle check via the public profile URL: x.com answers 404 for
 * handles that don't exist and 200 for registered ones. Rate limits and
 * redirects report `unknown` — suspended accounts also answer 404, so an
 * `available` verdict is not a guarantee the handle can be claimed.
 */
export function createXAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "social:x",
    async check(name, signal): Promise<ProviderOutcome> {
      const invalidName = invalidOutcome("social:x", name);
      if (invalidName !== null) return invalidName;
      const url = `https://x.com/${encodeURIComponent(name)}`;
      const res = await safeFetch(deps, url, signal, { accept: "text/html" });
      if (!res) return unknown(name, "request failed");
      const verdict = statusVerdict(res, { free: [404], busy: [200] });
      if (verdict === "available") return available(name, url);
      if (verdict === "taken") return taken(name, url);
      return unknown(name, `x.com returned HTTP ${res.status}`);
    },
  };
}

/**
 * Bluesky handle check in the `.bsky.social` namespace via the public
 * `com.atproto.identity.resolveHandle` API: 200 means the handle resolves
 * (taken), 400 means a syntactically valid handle doesn't resolve (available).
 * Deactivated/reserved handles also fail resolution and report `available`.
 */
export function createBlueskyAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "social:bluesky",
    async check(name, signal): Promise<ProviderOutcome> {
      const handle = `${name.toLowerCase()}.bsky.social`;
      const invalidName = invalidOutcome("social:bluesky", name, handle);
      if (invalidName !== null) return invalidName;
      const url = `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
      const res = await safeFetch(deps, url, signal, { accept: "application/json" });
      if (!res) return unknown(handle, "request failed");
      const verdict = statusVerdict(res, { free: [400], busy: [200] });
      if (verdict === "available") return available(handle, url);
      if (verdict === "taken") return taken(handle, url);
      return unknown(handle, `bsky.app returned HTTP ${res.status}`);
    },
  };
}

/**
 * Instagram handle check via the web profile-info endpoint used by the public
 * app (anonymous callers must present the app's client id). 200 → taken,
 * 404 → available; Instagram requires authentication on most IPs, in which
 * case 401/403/429 degrade to `unknown`.
 */
export function createInstagramAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "social:instagram",
    async check(name, signal): Promise<ProviderOutcome> {
      const invalidName = invalidOutcome("social:instagram", name);
      if (invalidName !== null) return invalidName;
      const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(name)}`;
      const res = await safeFetch(deps, url, signal, {
        accept: "application/json",
        "x-ig-app-id": "936619743392459",
      });
      if (!res) return unknown(name, "request failed");
      const verdict = statusVerdict(res, { free: [404], busy: [200] });
      if (verdict === "available") return available(name, url);
      if (verdict === "taken") return taken(name, url);
      return unknown(
        name,
        res.status === 401 || res.status === 403
          ? "Instagram requires authentication for this check (blocked)"
          : `Instagram returned HTTP ${res.status}`,
      );
    },
  };
}

/**
 * Reddit username check via the signup helper endpoint
 * `/api/username_available.json`, which answers a bare JSON boolean.
 * Reddit aggressively rate-limits datacenter IPs — 403/429 report `unknown`.
 */
export function createRedditAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "social:reddit",
    async check(name, signal): Promise<ProviderOutcome> {
      const invalidName = invalidOutcome("social:reddit", name);
      if (invalidName !== null) return invalidName;
      const url = `https://www.reddit.com/api/username_available.json?user=${encodeURIComponent(name)}`;
      const res = await safeFetch(deps, url, signal, { accept: "application/json" });
      if (!res) return unknown(name, "request failed");
      if (res.status === 200) {
        const body = (await res.text()).trim();
        if (body === "true") return available(name, url);
        if (body === "false") return taken(name, url);
        return unknown(name, "unexpected username_available.json response");
      }
      return unknown(name, `Reddit returned HTTP ${res.status}`);
    },
  };
}

/**
 * YouTube handle check via the public `/@handle` page: 404 → available,
 * 200 → taken, anything else (consent walls, rate limits) → `unknown`.
 */
export function createYouTubeAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "social:youtube",
    async check(name, signal): Promise<ProviderOutcome> {
      const invalidName = invalidOutcome("social:youtube", name);
      if (invalidName !== null) return invalidName;
      const url = `https://www.youtube.com/@${encodeURIComponent(name)}`;
      const res = await safeFetch(deps, url, signal, { accept: "text/html" });
      if (!res) return unknown(name, "request failed");
      const verdict = statusVerdict(res, { free: [404], busy: [200] });
      if (verdict === "available") return available(name, url);
      if (verdict === "taken") return taken(name, url);
      return unknown(name, `YouTube returned HTTP ${res.status}`);
    },
  };
}

const TIKTOK_STATUS = /"statusCode"\s*:\s*(\d+)/;
/** statusCode values the TikTok web app uses for "this user does not exist". */
const TIKTOK_NOT_FOUND = new Set(["10202", "10221", "10245"]);

/**
 * TikTok handle check via the public `/@user` page: the HTML embeds a
 * `statusCode` field — `0` means the profile exists (taken) and `10202`/
 * `10221`/`10245` mean no such user (available). Pages without the marker
 * (bot walls, consent redirects, layout changes) report `unknown`.
 */
export function createTikTokAdapter(deps: ProviderDeps): ProviderAdapter {
  return {
    id: "social:tiktok",
    async check(name, signal): Promise<ProviderOutcome> {
      const invalidName = invalidOutcome("social:tiktok", name);
      if (invalidName !== null) return invalidName;
      const url = `https://www.tiktok.com/@${encodeURIComponent(name)}`;
      const res = await safeFetch(deps, url, signal, { accept: "text/html" });
      if (!res) return unknown(name, "request failed");
      if (res.status !== 200) return unknown(name, `TikTok returned HTTP ${res.status}`);
      const code = TIKTOK_STATUS.exec(await res.text())?.[1];
      if (code === "0") return taken(name, url);
      if (code !== undefined && TIKTOK_NOT_FOUND.has(code)) return available(name, url);
      return unknown(name, "no recognizable statusCode marker in TikTok page");
    },
  };
}
