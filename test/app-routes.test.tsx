import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { GET as availabilityGET } from "../app/api/availability/route.js";
import { GET as scoreGET } from "../app/api/score/route.js";
import { GET as mcpGET, OPTIONS as mcpOPTIONS, POST as mcpPOST } from "../app/api/mcp/route.js";
import RootLayout from "../app/layout.js";

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

afterEach(() => {
  delete process.env.NAYMME_AVAILABILITY_MODE;
});

describe("app/api/availability route", () => {
  it("delegates to the demo service when NAYMME_AVAILABILITY_MODE=demo", async () => {
    process.env.NAYMME_AVAILABILITY_MODE = "demo";
    const res = await availabilityGET(
      new Request("https://app.test/api/availability?name=acme&providers=npm,domain:com"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("demo");
    expect(body.results).toHaveLength(2);
  });

  it("400s on a missing name", async () => {
    const res = await availabilityGET(new Request("https://app.test/api/availability"));
    expect(res.status).toBe(400);
  });
});

describe("app/api/score route", () => {
  it("returns the deterministic score payload", async () => {
    const res = scoreGET(new Request("https://app.test/api/score?name=acme"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "acme" });
  });

  it("400s on an invalid name", async () => {
    const res = scoreGET(new Request("https://app.test/api/score?name=bad name!"));
    expect(res.status).toBe(400);
  });
});

describe("app/api/mcp route", () => {
  it("GET returns the status document", async () => {
    const res = mcpGET(new Request("https://app.test/api/mcp"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, name: "naymme" });
  });

  it("OPTIONS answers CORS preflight", () => {
    const res = mcpOPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("POST initializes the MCP session", async () => {
    const res = await mcpPOST(
      new Request("https://app.test/api/mcp", {
        method: "POST",
        headers: MCP_HEADERS,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "0" },
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("naymme");
  });
});

describe("app shell", () => {
  it("RootLayout renders the html/body shell", () => {
    const markup = renderToStaticMarkup(
      createElement(RootLayout, null, createElement("p", null, "child")),
    );
    expect(markup).toContain("<html");
    expect(markup).toContain("child");
  });
});
