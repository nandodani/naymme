import { expect, it } from "vitest";
import { defaultDeps } from "../src/deps.js";
import { createDockerHubAdapter } from "../src/providers/devplatforms.js";
import { createTelegramAdapter } from "../src/providers/platforms.js";
import { whoisLookup } from "../src/providers/whois.js";
import { createRdapClient } from "../src/providers/rdap.js";

it.each([
  {
    errorCode: 404,
    description: ["This name is not available for registration:", "Registry Reserved"],
  },
  {
    errorCode: 404,
    notices: [
      {
        title: "Blocked Domain",
        description: ["This name has been blocked by a GlobalBlock service."],
      },
    ],
  },
])("RDAP blocked or reserved 404 is not available: %j", async (body) => {
  const client = createRdapClient(
    defaultDeps({ fetch: async () => Response.json(body, { status: 404 }) }),
  );
  expect(
    await client.lookup("google.work", "https://rdap.test/", new AbortController().signal),
  ).toBe("unknown");
});

it("RDAP explicitly unregistered response remains available", async () => {
  const client = createRdapClient(
    defaultDeps({
      fetch: async () =>
        Response.json(
          {
            errorCode: 404,
            description: ["Domain zqxv7k3m9p.store is available for registration"],
          },
          { status: 404 },
        ),
    }),
  );
  expect(
    await client.lookup("zqxv7k3m9p.store", "https://rdap.test/", new AbortController().signal),
  ).toBe("available");
});

it("recognizes the .so no-object response despite its echoed Domain Name", async () => {
  const deps = defaultDeps({
    whoisDomain: async () => ({
      "whois.nic.so": {
        "Domain Name": "zqxv7k3m9p.so",
        __raw: "Domain Name: zqxv7k3m9p.so\r\nThe queried object does not exist: No Object Found",
      },
    }),
  });
  expect(await whoisLookup("zqxv7k3m9p.so", deps)).toBe("available");
});

it("does not infer registration from empty WHOIS fields or registrar terms", async () => {
  const deps = defaultDeps({
    whoisDomain: async () => ({
      "whois.nic.sh": {
        "Domain Status": [],
        "Name Server": [],
        text: ["Queries are throttled. Please contact your registrar."],
        __raw: "Queries are throttled. Please contact your registrar.",
      },
    }),
  });
  expect(await whoisLookup("zqxv7k3m9p.sh", deps)).toBe("unknown");
});

it("checks Docker identities rather than an empty repository listing", async () => {
  const adapter = createDockerHubAdapter(
    defaultDeps({
      fetch: async (input) =>
        (typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url
        ).includes("/users/")
          ? Response.json(
              { message: "User not found", errinfo: { username: "zqxv7k3m9p" } },
              { status: 404 },
            )
          : Response.json({ count: 0, next: null, previous: null, results: [] }),
    }),
  );
  expect(await adapter.check("zqxv7k3m9p", new AbortController().signal)).toMatchObject({
    status: "available",
  });
});

it.each(["", "<html>challenge</html>"])("Telegram ambiguous body is unknown: %s", async (body) => {
  const adapter = createTelegramAdapter(defaultDeps({ fetch: async () => new Response(body) }));
  expect(await adapter.check("acmechannel", new AbortController().signal)).toMatchObject({
    status: "unknown",
    available: null,
  });
});
