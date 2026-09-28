import {
  clientKeyFromHeaders,
  contentLengthExceeded,
  MAX_REQUEST_BODY_BYTES,
  RATE_LIMITS,
  rateLimiterFromEnv,
  rateLimitHeaders,
  tooManyRequestsResponse,
  type RateLimiter,
} from "../src/security.js";
import { SITE_URL } from "./site.js";

/**
 * Stateless OAuth 2.0 authorization server for the hosted MCP endpoint.
 *
 * The API is public — nothing here gates data — but remote-MCP connectors
 * (Poke and similar) refuse servers that don't complete the OAuth handshake:
 * they need RFC 8414 discovery, RFC 7591 dynamic client registration and a
 * code+PKCE exchange. This module provides that flow with zero server-side
 * storage, which is what makes it safe to run on Vercel functions where
 * consecutive requests may hit different instances:
 *
 * - client_id is a signed token carrying the registered redirect_uris —
 *   /oauth/authorize recovers the registration by verifying the signature.
 * - Authorization codes, access tokens and refresh tokens are signed
 *   `nmc.<base64url payload>.<base64url HMAC-SHA256>` tokens carrying their
 *   own expiry and PKCE binding.
 *
 * Keys come from `NAYMME_OAUTH_SECRET`; when unset a random per-process key
 * is used, which works on a warm instance but means codes may fail to verify
 * after a cold start — set the secret in production.
 *
 * Security posture: PKCE S256 is mandatory, redirect_uri must exactly match
 * one registered at /oauth/register (no open redirect), codes are single-use
 * within a warm instance and expire in 5 minutes, tokens are Bearer and
 * `no-store`. There is intentionally no consent page — the resource is
 * already public, so an interstitial would gate nothing.
 */

const CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 3600;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;
const SUPPORTED_SCOPE = "public:read";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
};

const NO_STORE = { "cache-control": "no-store", pragma: "no-cache" } as const;

/** Optional seams for tests; production resolves everything internally. */
export interface OauthServerOptions {
  /** HMAC key material; defaults to env NAYMME_OAUTH_SECRET, else ephemeral. */
  secret?: string;
  /** Clock override (ms since epoch). */
  now?: () => number;
  /** Rate limiter for register/token; defaults to the shared aux budget. */
  limiter?: Pick<RateLimiter, "allow">;
}

interface ClientPayload {
  t: "client";
  iat: number;
  /** Random per-registration id — identical metadata still mints unique ids. */
  jti: string;
  uris: string[];
  name?: string;
}

interface CodePayload {
  t: "code";
  iat: number;
  exp: number;
  jti: string;
  /** base64url(sha256(client_id)) — binds the code to the registered client. */
  cid: string;
  uri: string;
  cc: string;
  scp?: string;
}

interface AccessPayload {
  t: "access";
  iat: number;
  exp: number;
  cid: string;
  scp?: string;
}

interface RefreshPayload {
  t: "refresh";
  iat: number;
  exp: number;
  jti: string;
  cid: string;
  scp?: string;
}

type SignedPayload = ClientPayload | CodePayload | AccessPayload | RefreshPayload;

/* ---------------------------------------------------------------- crypto */

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function b64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Per-process fallback when NAYMME_OAUTH_SECRET is unset — see module doc. */
let ephemeralSecret: string | undefined;
function resolveSecret(options: OauthServerOptions): string {
  const configured = options.secret ?? process.env.NAYMME_OAUTH_SECRET;
  if (configured !== undefined && configured !== "") return configured;
  ephemeralSecret ??= b64urlEncode(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  return ephemeralSecret;
}

const keyCache = new Map<string, Promise<CryptoKey>>();
function signingKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (key === undefined) {
    key = globalThis.crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    keyCache.set(secret, key);
  }
  return key;
}

async function mintToken(payload: SignedPayload, secret: string): Promise<string> {
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await signingKey(secret);
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `nmc.${body}.${b64urlEncode(new Uint8Array(signature))}`;
}

/**
 * Verify and decode a `nmc.` token of the expected kind. Returns `null` on
 * any malformed input, bad signature, type mismatch or expiry.
 */
async function readToken<T extends SignedPayload>(
  token: string,
  expectedType: T["t"],
  secret: string,
  now: number,
): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "nmc") return null;
  const body = parts[1] ?? "";
  const signature = parts[2] ?? "";
  try {
    const key = await signingKey(secret);
    const valid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(signature),
      encoder.encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SignedPayload;
    if (payload.t !== expectedType) return null;
    if ("exp" in payload && now >= payload.exp) return null;
    return payload as T;
  } catch {
    return null;
  }
}

async function sha256B64url(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(text));
  return b64urlEncode(new Uint8Array(digest));
}

/* ------------------------------------------------------- replay tracking */

/**
 * Consumed authorization-code jtis — best-effort single use within a warm
 * instance. Serverless cold starts can lose entries; the 5-minute code TTL
 * and PKCE binding bound the residual risk.
 */
const consumedCodes = new Map<string, number>();
function consumeCode(jti: string, expiresAt: number, now: number): boolean {
  for (const [key, exp] of consumedCodes) {
    if (now >= exp) consumedCodes.delete(key);
  }
  if (consumedCodes.has(jti)) return false;
  if (consumedCodes.size >= 10_000) {
    const oldest = consumedCodes.keys().next().value;
    if (oldest !== undefined) consumedCodes.delete(oldest);
  }
  consumedCodes.set(jti, expiresAt);
  return true;
}

/* ---------------------------------------------------------------- errors */

function oauthError(
  status: number,
  error: string,
  description: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error, error_description: description },
    { status, headers: { ...CORS_HEADERS, ...NO_STORE, ...headers } },
  );
}

/** Redirect an authorization error per RFC 6749 §4.1.2.1. */
function redirectError(redirectUri: string, state: string | null, error: string): Response {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error);
  if (state !== null) target.searchParams.set("state", state);
  return new Response(null, { status: 302, headers: { location: target.toString() } });
}

/** CORS preflight for all three OAuth endpoints. */
export function oauthOptionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

let sharedLimiter: RateLimiter | null = null;
function defaultLimiter(): Pick<RateLimiter, "allow"> {
  sharedLimiter ??= rateLimiterFromEnv(RATE_LIMITS.aux, process.env);
  return sharedLimiter;
}

function rateLimited(request: Request, limiter: Pick<RateLimiter, "allow">): Response | null {
  const verdict = limiter.allow(clientKeyFromHeaders(request.headers));
  if (verdict.ok) return null;
  return tooManyRequestsResponse(verdict, { ...CORS_HEADERS, ...rateLimitHeaders(verdict) });
}

async function bodyText(request: Request): Promise<string | null> {
  if (contentLengthExceeded(request, MAX_REQUEST_BODY_BYTES)) return null;
  const text = await request.text();
  return text.length <= MAX_REQUEST_BODY_BYTES ? text : null;
}

/* ---------------------------------------------------- client validation */

const FORBIDDEN_SCHEMES = new Set([
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
  "about:",
  "blob:",
]);
const CUSTOM_SCHEME = /^[a-z][a-z0-9+.-]*:$/;

/**
 * RFC 7591 redirect_uri validation: absolute https:// URIs, http:// only on
 * loopback (native/dev connectors), or private-use custom schemes used by
 * desktop apps. Fragments, userinfo and executable schemes are refused.
 */
function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash !== "" || url.username !== "" || url.password !== "") return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  }
  return CUSTOM_SCHEME.test(url.protocol) && !FORBIDDEN_SCHEMES.has(url.protocol);
}

/* ------------------------------------------------------------ /register */

/** `POST /oauth/register` — RFC 7591 dynamic client registration. */
export async function handleClientRegistration(
  request: Request,
  options: OauthServerOptions = {},
): Promise<Response> {
  const limited = rateLimited(request, options.limiter ?? defaultLimiter());
  if (limited !== null) return limited;

  const text = await bodyText(request);
  if (text === null) {
    return oauthError(400, "invalid_client_metadata", "request body too large");
  }
  let meta: unknown;
  try {
    meta = JSON.parse(text);
  } catch {
    return oauthError(400, "invalid_client_metadata", "request body must be a JSON object");
  }
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
    return oauthError(400, "invalid_client_metadata", "request body must be a JSON object");
  }
  const fields = meta as Record<string, unknown>;

  const redirectUris = fields.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 10) {
    return oauthError(
      400,
      "invalid_redirect_uri",
      "redirect_uris must be an array of 1-10 absolute URIs",
    );
  }
  for (const uri of redirectUris) {
    if (typeof uri !== "string" || !isAllowedRedirectUri(uri)) {
      return oauthError(
        400,
        "invalid_redirect_uri",
        `redirect_uri ${JSON.stringify(uri)} is not allowed — use https, http on loopback, or a private-use scheme`,
      );
    }
  }
  const uris = redirectUris as string[];

  let clientName: string | undefined;
  if (typeof fields.client_name === "string") {
    // Strip control characters; cap length so it stays safe to echo/log.
    clientName =
      Array.from(fields.client_name)
        .filter((ch) => {
          const cp = ch.codePointAt(0) ?? 0;
          return cp > 0x1f && cp !== 0x7f;
        })
        .join("")
        .slice(0, 200) || undefined;
  }

  const now = (options.now ?? (() => Date.now()))();
  const client: ClientPayload = {
    t: "client",
    iat: now,
    jti: globalThis.crypto.randomUUID(),
    uris,
  };
  if (clientName !== undefined) client.name = clientName;
  const clientIdValue = await mintToken(client, resolveSecret(options));

  return Response.json(
    {
      client_id: clientIdValue,
      client_id_issued_at: Math.floor(now / 1000),
      client_secret_expires_at: 0,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SUPPORTED_SCOPE,
      ...(clientName !== undefined ? { client_name: clientName } : {}),
    },
    { status: 201, headers: { ...CORS_HEADERS, ...NO_STORE } },
  );
}

/* ----------------------------------------------------------- /authorize */

const CODE_CHALLENGE = /^[A-Za-z0-9\-._~]{43,128}$/;

/**
 * `GET /oauth/authorize` — authorization endpoint. Auto-approves: after
 * validating the client and redirect_uri it immediately 302s back with a
 * signed code. Per RFC 6749, errors are only delivered via the redirect once
 * redirect_uri has been verified — unknown clients and mismatched URIs get a
 * plain 400 JSON error instead.
 */
export async function handleAuthorizationRequest(
  request: Request,
  options: OauthServerOptions = {},
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  const now = (options.now ?? (() => Date.now()))();
  const secret = resolveSecret(options);

  const clientIdValue = params.get("client_id");
  if (clientIdValue === null || clientIdValue === "") {
    return oauthError(400, "invalid_client", "client_id is required — register at /oauth/register");
  }
  const client = await readToken<ClientPayload>(clientIdValue, "client", secret, now);
  if (client === null) {
    return oauthError(
      400,
      "invalid_client",
      "unknown or malformed client_id — register at /oauth/register",
    );
  }

  const redirectUri = params.get("redirect_uri");
  if (redirectUri === null || !client.uris.includes(redirectUri)) {
    return oauthError(
      400,
      "invalid_request",
      "redirect_uri must exactly match one registered for this client_id",
    );
  }

  // Everything below can safely report through the validated redirect_uri.
  if (params.get("response_type") !== "code") {
    return redirectError(redirectUri, state, "unsupported_response_type");
  }
  const codeChallenge = params.get("code_challenge");
  if (codeChallenge === null || !CODE_CHALLENGE.test(codeChallenge)) {
    return redirectError(redirectUri, state, "invalid_request");
  }
  const method = params.get("code_challenge_method") ?? "S256";
  if (method !== "S256") {
    return redirectError(redirectUri, state, "invalid_request");
  }
  const resource = params.get("resource");
  if (resource !== null && !resource.startsWith(SITE_URL)) {
    return redirectError(redirectUri, state, "invalid_target");
  }

  const scope = params.get("scope") ?? undefined;
  const code: CodePayload = {
    t: "code",
    iat: now,
    exp: now + CODE_TTL_MS,
    jti: globalThis.crypto.randomUUID(),
    cid: await sha256B64url(clientIdValue),
    uri: redirectUri,
    cc: codeChallenge,
    ...(scope !== undefined ? { scp: scope } : {}),
  };
  const target = new URL(redirectUri);
  target.searchParams.set("code", await mintToken(code, secret));
  if (state !== null) target.searchParams.set("state", state);
  return new Response(null, { status: 302, headers: { location: target.toString() } });
}

/* --------------------------------------------------------------- /token */

function formFields(text: string, contentType: string): Record<string, string> | null {
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const fields: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(text)) fields[key] = value;
    return fields;
  }
  if (contentType.includes("json")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") fields[key] = value;
      }
      return fields;
    } catch {
      return null;
    }
  }
  // No recognizable content type — try form encoding anyway; a client that
  // forgot the header still gets a working response.
  const fields: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(text)) fields[key] = value;
  return Object.keys(fields).length > 0 ? fields : null;
}

async function tokenPair(
  cid: string,
  scope: string | undefined,
  secret: string,
  now: number,
): Promise<Record<string, unknown>> {
  const access: AccessPayload = {
    t: "access",
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS * 1000,
    cid,
    ...(scope !== undefined ? { scp: scope } : {}),
  };
  const refresh: RefreshPayload = {
    t: "refresh",
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_MS,
    jti: globalThis.crypto.randomUUID(),
    cid,
    ...(scope !== undefined ? { scp: scope } : {}),
  };
  return {
    access_token: await mintToken(access, secret),
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope: scope ?? SUPPORTED_SCOPE,
    refresh_token: await mintToken(refresh, secret),
  };
}

/**
 * `POST /oauth/token` — token endpoint. Handles `authorization_code` (with
 * mandatory PKCE verification) and `refresh_token`. Accepts the standard
 * form-encoded body, plus JSON for clients that send it.
 */
export async function handleTokenRequest(
  request: Request,
  options: OauthServerOptions = {},
): Promise<Response> {
  const limited = rateLimited(request, options.limiter ?? defaultLimiter());
  if (limited !== null) return limited;

  const text = await bodyText(request);
  if (text === null) {
    return oauthError(400, "invalid_request", "request body too large");
  }
  const fields = formFields(text, request.headers.get("content-type") ?? "");
  if (fields === null) {
    return oauthError(
      400,
      "invalid_request",
      "body must be application/x-www-form-urlencoded (or JSON) parameters",
    );
  }

  const now = (options.now ?? (() => Date.now()))();
  const secret = resolveSecret(options);
  const grantType = fields.grant_type;

  if (grantType === "authorization_code") {
    const codeValue = fields.code;
    if (codeValue === undefined) {
      return oauthError(400, "invalid_request", "code is required");
    }
    const code = await readToken<CodePayload>(codeValue, "code", secret, now);
    if (code === null) {
      return oauthError(400, "invalid_grant", "code is invalid or expired");
    }
    const presentedClient = fields.client_id;
    if (presentedClient === undefined) {
      return oauthError(400, "invalid_client", "client_id is required");
    }
    if ((await sha256B64url(presentedClient)) !== code.cid) {
      return oauthError(400, "invalid_client", "client_id does not match the code");
    }
    if (fields.redirect_uri !== undefined && fields.redirect_uri !== code.uri) {
      return oauthError(400, "invalid_grant", "redirect_uri does not match the code");
    }
    const verifier = fields.code_verifier;
    if (verifier === undefined || !CODE_CHALLENGE.test(verifier)) {
      return oauthError(400, "invalid_request", "code_verifier is required (43-128 chars)");
    }
    if ((await sha256B64url(verifier)) !== code.cc) {
      return oauthError(400, "invalid_grant", "code_verifier does not match the code challenge");
    }
    if (!consumeCode(code.jti, code.exp, now)) {
      return oauthError(400, "invalid_grant", "code has already been exchanged");
    }
    return Response.json(await tokenPair(code.cid, code.scp, secret, now), {
      headers: { ...CORS_HEADERS, ...NO_STORE },
    });
  }

  if (grantType === "refresh_token") {
    const refreshValue = fields.refresh_token;
    if (refreshValue === undefined) {
      return oauthError(400, "invalid_request", "refresh_token is required");
    }
    const refresh = await readToken<RefreshPayload>(refreshValue, "refresh", secret, now);
    if (refresh === null) {
      return oauthError(400, "invalid_grant", "refresh_token is invalid or expired");
    }
    const presentedClient = fields.client_id;
    if (presentedClient !== undefined && (await sha256B64url(presentedClient)) !== refresh.cid) {
      return oauthError(400, "invalid_client", "client_id does not match the refresh_token");
    }
    return Response.json(await tokenPair(refresh.cid, refresh.scp, secret, now), {
      headers: { ...CORS_HEADERS, ...NO_STORE },
    });
  }

  return oauthError(
    400,
    "unsupported_grant_type",
    "supported grant types: authorization_code, refresh_token",
  );
}
