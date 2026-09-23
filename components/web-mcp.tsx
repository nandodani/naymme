"use client";

import { useEffect } from "react";

/**
 * WebMCP integration: when the browser exposes a model-context API, this
 * registers lmkurname's tools so an in-page agent can check name
 * availability and brand scores without leaving the tab.
 *
 * The surface is still in flux across proposals, so this feature-detects
 * both shapes: `registerTool` (newer, per-tool) and `provideContext`
 * (older declarative context object), on `document` then `navigator`.
 */

interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

interface ModelContextLike {
  registerTool?: (tool: ModelContextTool) => void;
  provideContext?: (context: { tools: ModelContextTool[] }) => void;
}

declare global {
  interface Document {
    modelContext?: ModelContextLike;
  }
  interface Navigator {
    modelContext?: ModelContextLike;
  }
}

const NAME_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "Bare candidate name — 1–63 chars, starts alphanumeric, ASCII letters/digits plus '.', '_' or '-'.",
    },
    providers: {
      type: "string",
      description:
        "Optional comma-separated provider ids or aliases (all, domains, domains:cctld, domains:all, socials).",
    },
  },
  required: ["name"],
};

async function callApi(path: string, args: Record<string, unknown>): Promise<unknown> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }
  const res = await fetch(`${path}?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  const body: unknown = await res.json();
  if (!res.ok) {
    return body;
  }
  return body;
}

const TOOLS: ModelContextTool[] = [
  {
    name: "check_availability",
    description:
      "Check a name's availability across domains, GitHub, npm and other dev registries, hosted subdomains, stores and social handles.",
    inputSchema: NAME_INPUT_SCHEMA,
    execute: (args) => callApi("/api/availability", args),
  },
  {
    name: "score_name",
    description:
      "Deterministically score a name 0–100 for brand quality (punchiness, syllables, pronounceability, uniqueness, cleanliness).",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Bare candidate name to score.",
        },
      },
      required: ["name"],
    },
    execute: (args) => callApi("/api/score", args),
  },
];

/** Registers lmkurname's tools on the browser's model context, if any. */
export function WebMcp() {
  useEffect(() => {
    const modelContext = document.modelContext ?? navigator.modelContext;
    if (!modelContext) {
      return;
    }
    if (typeof modelContext.registerTool === "function") {
      for (const tool of TOOLS) {
        modelContext.registerTool(tool);
      }
    } else if (typeof modelContext.provideContext === "function") {
      modelContext.provideContext({ tools: TOOLS });
    }
  }, []);
  return null;
}
