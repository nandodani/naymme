import { describe, expect, it } from "vitest";

import { GET as authorizeGET } from "../app/oauth/authorize/route.js";
import { OPTIONS as registerOPTIONS, POST as registerPOST } from "../app/oauth/register/route.js";
import { OPTIONS as tokenOPTIONS, POST as tokenPOST } from "../app/oauth/token/route.js";
import { GET as prmPathGET } from "../app/.well-known/oauth-protected-resource/[...path]/route.js";
import { buildOauthAuthorizationServer } from "../lib/agent-discovery.js";
import { SITE_URL } from "../lib/site.js";

const REGISTER_URI = `${SITE_URL}/oauth/register`;
const CONNECTOR_CALLBACK = "https://connector.example.com/oauth/callback";
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

/** RFC 7636 S256: base64url(sha256(verifier)). */
async function s256(verifier: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function registerClient(redirectUris: string[] = [CONNECTOR_CALLBACK]): Promise<Response> {
  return registerPOST(
    new Request(REGISTER_URI, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "test connector",
        redirect_uris: redirectUris,
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
    }),
  );
}

async function clientId(): Promise<string> {
  const res = await registerClient();
  expect(res.status).toBe(201);
  const body = (await res.json()) as { client_id: string };
  return body.client_id;
}

function authorizeUrl(clientIdValue: string, overrides: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientIdValue,
    redirect_uri: CONNECTOR_CALLBACK,
    code_challenge: "A".repeat(64),
    code_challenge_method: "S256",
    state: "s-123",
    ...overrides,
  });
  return `${SITE_URL}/oauth/authorize?${params.toString()}`;
}

/** Runs the full register → authorize dance bound to a real verifier. */
async function issueCode(
  verifier: string = VERIFIER,
): Promise<{ clientIdValue: string; code: string }> {
  const id = await clientId();
  const res = await authorizeGET(
    new Request(authorizeUrl(id, { code_challenge: await s256(verifier) })),
  );
  expect(res.status).toBe(302);
  const code = new URL(res.headers.get("location") ?? "").searchParams.get("code");
  expect(code).toBeTruthy();
  return { clientIdValue: id, code: code ?? "" };
}

function tokenRequest(fields: Record<string, string>): Request {
  return new Request(`${SITE_URL}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

function exchangeCode(clientIdValue: string, code: string, verifier: string): Promise<Response> {
  return tokenPOST(
    tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: CONNECTOR_CALLBACK,
      client_id: clientIdValue,
      code_verifier: verifier,
    }),
  );
}

describe("RFC 8414 authorization-server metadata", () => {
  it("advertises real endpoints + PKCE for OAuth-requiring connectors", () => {
    const doc = buildOauthAuthorizationServer();
    expect(doc.issuer).toBe(SITE_URL);
    expect(doc.authorization_endpoint).toBe(`${SITE_URL}/oauth/authorize`);
    expect(doc.token_endpoint).toBe(`${SITE_URL}/oauth/token`);
    expect(doc.registration_endpoint).toBe(`${SITE_URL}/oauth/register`);
    expect(doc.response_types_supported).toEqual(["code"]);
    expect(doc.grant_types_supported).toEqual(
      expect.arrayContaining(["authorization_code", "refresh_token"]),
    );
    expect(doc.code_challenge_methods_supported).toEqual(["S256"]);
    expect(doc.token_endpoint_auth_methods_supported).toContain("none");
  });
});

describe("RFC 9728 resource-path discovery", () => {
  it("serves protected-resource metadata under the resource path", async () => {
    const res = await prmPathGET(new Request("https://app.test/.well-known/x"), {
      params: Promise.resolve({ path: ["api", "mcp"] }),
    });
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { resource: string; authorization_servers: string[] };
    expect(doc.resource).toBe(`${SITE_URL}/api/mcp`);
    expect(doc.authorization_servers).toEqual([SITE_URL]);
  });
});

describe("POST /oauth/register (RFC 7591)", () => {
  it("issues a signed client_id and echoes client metadata", async () => {
    const res = await registerClient([CONNECTOR_CALLBACK, "http://localhost:53134/cb"]);
    expect(res.status).toBe(201);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.client_id).toBe("string");
    expect(body.client_id).toMatch(/^nmc\./);
    expect(body.redirect_uris).toEqual([CONNECTOR_CALLBACK, "http://localhost:53134/cb"]);
    expect(body.client_name).toBe("test connector");
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(typeof body.client_id_issued_at).toBe("number");
  });

  it("answers CORS preflight", () => {
    expect(registerOPTIONS().status).toBe(204);
    expect(tokenOPTIONS().status).toBe(204);
  });

  it("rejects missing redirect_uris with invalid_redirect_uri", async () => {
    const res = await registerPOST(
      new Request(REGISTER_URI, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_name: "x" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_redirect_uri");
  });

  it("rejects dangerous redirect_uri schemes", async () => {
    for (const uri of ["javascript:alert(1)", "data:text/html,x", "not a uri"]) {
      const res = await registerClient([uri]);
      expect(res.status, uri).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe("invalid_redirect_uri");
    }
  });

  it("rejects malformed JSON with invalid_client_metadata", async () => {
    const res = await registerPOST(
      new Request(REGISTER_URI, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{oops",
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_client_metadata");
  });
});

describe("GET /oauth/authorize (auto-approve, no interstitial)", () => {
  it("302s to the registered redirect_uri with code + state", async () => {
    const id = await clientId();
    const res = await authorizeGET(new Request(authorizeUrl(id)));
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(CONNECTOR_CALLBACK);
    expect(location.searchParams.get("code")).toMatch(/^nmc\./);
    expect(location.searchParams.get("state")).toBe("s-123");
    expect(location.searchParams.get("error")).toBeNull();
  });

  it("rejects an unregistered redirect_uri without redirecting", async () => {
    const id = await clientId();
    const res = await authorizeGET(
      new Request(authorizeUrl(id, { redirect_uri: "https://evil.example.com/x" })),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
    expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
  });

  it("rejects a forged client_id without redirecting", async () => {
    const res = await authorizeGET(new Request(authorizeUrl("nmc.forged.sig")));
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects protocol errors once redirect_uri is trusted", async () => {
    const id = await clientId();
    const res = await authorizeGET(new Request(authorizeUrl(id, { response_type: "token" })));
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.searchParams.get("error")).toBe("unsupported_response_type");
    expect(location.searchParams.get("state")).toBe("s-123");
  });

  it("requires PKCE S256", async () => {
    const id = await clientId();
    const res = await authorizeGET(
      new Request(authorizeUrl(id, { code_challenge_method: "plain" })),
    );
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location") ?? "").searchParams.get("error")).toBe(
      "invalid_request",
    );
  });
});

describe("POST /oauth/token", () => {
  it("exchanges a code + PKCE verifier for Bearer access + refresh tokens", async () => {
    const { clientIdValue, code } = await issueCode();
    const res = await exchangeCode(clientIdValue, code, VERIFIER);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.access_token).toMatch(/^nmc\./);
    expect(body.token_type).toBe("Bearer");
    expect(body.expires_in).toBe(3600);
    expect(body.refresh_token).toMatch(/^nmc\./);
  });

  it("rejects a mismatched code_verifier", async () => {
    const { clientIdValue, code } = await issueCode();
    const res = await exchangeCode(clientIdValue, code, "Z".repeat(64));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_grant");
  });

  it("rejects a code bound to a different client_id", async () => {
    const { code } = await issueCode();
    const otherId = await clientId();
    const res = await exchangeCode(otherId, code, VERIFIER);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_client");
  });

  it("rejects replay of a consumed authorization code", async () => {
    const { clientIdValue, code } = await issueCode();
    const first = await exchangeCode(clientIdValue, code, VERIFIER);
    expect(first.status).toBe(200);
    const second = await exchangeCode(clientIdValue, code, VERIFIER);
    expect(second.status).toBe(400);
    expect(((await second.json()) as { error: string }).error).toBe("invalid_grant");
  });

  it("rejects unknown grant types", async () => {
    const res = await tokenPOST(tokenRequest({ grant_type: "client_credentials" }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("unsupported_grant_type");
  });

  it("rejects a tampered code", async () => {
    const res = await tokenPOST(
      tokenRequest({
        grant_type: "authorization_code",
        code: "nmc.dGFtcGVyZWQ.forged",
        client_id: "nmc.x.y",
        code_verifier: "D".repeat(64),
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_grant");
  });

  it("rotates a refresh_token into a fresh access token", async () => {
    const { clientIdValue, code } = await issueCode();
    const exchanged = await exchangeCode(clientIdValue, code, VERIFIER);
    const first = (await exchanged.json()) as { refresh_token: string };
    const res = await tokenPOST(
      tokenRequest({
        grant_type: "refresh_token",
        refresh_token: first.refresh_token,
        client_id: clientIdValue,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { access_token: string; token_type: string };
    expect(body.access_token).toMatch(/^nmc\./);
    expect(body.token_type).toBe("Bearer");
  });
});
