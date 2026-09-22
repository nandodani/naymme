"use client";

import { useEffect, useMemo, useState } from "react";
import { buildMcpConfigs, type McpClientConfig } from "@/lib/mcp-config.js";

function CopyButton({ config }: { config: McpClientConfig }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(config.json);
    } catch {
      // Clipboard can be unavailable (non-secure context, denied permission)
      // — fall back to a hidden textarea + execCommand.
      const area = document.createElement("textarea");
      area.value = config.json;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="group flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-hairline bg-zinc-950/60 px-3 text-left transition-colors hover:border-zinc-600"
    >
      <span className="min-w-0">
        <span className="block truncate font-mono text-[12px] text-zinc-200">
          {config.fileName}
        </span>
        <span className="block text-[11px] text-zinc-500">{config.label}</span>
      </span>
      <span
        className={`shrink-0 text-[11px] font-medium ${
          copied ? "text-emerald-300" : "text-zinc-500 group-hover:text-zinc-300"
        }`}
      >
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}

export function ConfigCard() {
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const configs = useMemo(() => (origin === null ? null : buildMcpConfigs(origin)), [origin]);

  return (
    <section className="rounded-xl border border-hairline bg-panel">
      <div className="border-b border-hairline px-4 py-2.5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
          Connect a client
        </h2>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg border border-hairline bg-zinc-950/60 px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-600">
            MCP endpoint
          </span>
          <span className="mt-0.5 truncate font-mono text-[12px] text-zinc-300">
            {configs?.endpoint ?? "/api/mcp"}
          </span>
        </div>
        {configs === null ? (
          <div className="loading-shimmer h-10 flex-1 rounded-lg border border-hairline bg-zinc-950/60 sm:flex-[2]" />
        ) : (
          <div className="grid flex-[2] grid-cols-1 gap-2 sm:grid-cols-2">
            <CopyButton config={configs.cursor} />
            <CopyButton config={configs.claude} />
          </div>
        )}
      </div>
    </section>
  );
}
