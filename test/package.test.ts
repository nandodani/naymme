import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SERVER_NAME, SERVER_VERSION } from "../src/server.js";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  type?: string;
  bin?: Record<string, string>;
  main?: string;
  types?: string;
  mcpName?: string;
  files?: string[];
  engines?: { node?: string };
  repository?: { url?: string };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
}

interface ServerJson {
  name: string;
  version: string;
  packages?: { registryType: string; identifier: string; version: string }[];
  remotes?: { type: string; url: string }[];
}

const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as PackageJson;
const serverJson = JSON.parse(
  readFileSync(path.join(repoRoot, "server.json"), "utf8"),
) as ServerJson;

/**
 * The published npm package ships only `dist/` plus docs — everything the
 * stdio server needs at runtime. Web UI, worker and test tooling must stay
 * out of `dependencies` so `npx -y naymme` installs a near-zero tree.
 */
const RUNTIME_DEPENDENCIES = ["@modelcontextprotocol/sdk", "npm-name", "whoiser", "zod"];

describe("npm package metadata (package.json)", () => {
  it("is the publishable MCP CLI package", () => {
    expect(pkg.name).toBe("naymme");
    expect(pkg.license).toBe("MIT");
    expect(pkg.type).toBe("module");
    expect(pkg.engines?.node).toBe(">=20");
    expect(pkg.repository?.url).toContain("github.com/nandodani/naymme");
  });

  it("points bin/main/types at the compiled stdio entry", () => {
    expect(pkg.bin?.[SERVER_NAME]).toBe("dist/index.js");
    expect(pkg.main).toBe("dist/index.js");
    expect(pkg.types).toBe("dist/index.d.ts");
    // `dist` is gitignored — publish must always rebuild it.
    expect(pkg.scripts?.prepack).toBe("npm run build:core");
  });

  it("ships only the compiled server plus docs/manifest", () => {
    expect(pkg.files).toEqual(["dist", "README.md", "LICENSE", "server.json"]);
  });

  it("keeps runtime dependencies to the MCP server's actual imports", () => {
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(RUNTIME_DEPENDENCIES);
  });
});

describe("server.json (official MCP registry manifest)", () => {
  it("matches the npm package identity and version", () => {
    expect(serverJson.name).toBe("io.github.nandodani/naymme");
    expect(pkg.mcpName).toBe(serverJson.name);
    expect(serverJson.version).toBe(pkg.version);
  });

  it("declares the npm package with stdio transport", () => {
    const npmPkg = serverJson.packages?.find((p) => p.registryType === "npm");
    expect(npmPkg?.identifier).toBe("naymme");
    expect(npmPkg?.version).toBe(pkg.version);
  });

  it("advertises the hosted Streamable HTTP remote", () => {
    const remote = serverJson.remotes?.find((r) => r.type === "streamable-http");
    expect(remote?.url).toBe("https://naymme.vercel.app/api/mcp");
  });
});

describe("version alignment", () => {
  it("keeps MCP serverInfo.version in sync with the package version", () => {
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});
