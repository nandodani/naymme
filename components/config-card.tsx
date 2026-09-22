"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Plug } from "lucide-react";

import { buildMcpConfigs, type McpClientConfig } from "@/lib/mcp-config.js";
import { cn } from "@/lib/utils.js";
import { Skeleton } from "./ui/skeleton.js";

function CopyConfigButton({
  config,
  onCopy,
}: {
  config: McpClientConfig;
  onCopy: (text: string, label: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

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
    onCopy(config.json, `Copied ${config.label} config`);
    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${config.label} MCP config`}
      className="group flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-zinc-950/60 px-3 text-left transition-colors outline-none hover:border-zinc-700 hover:bg-zinc-900/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0">
        <span className="block truncate font-mono text-[12px] text-zinc-200">
          {config.fileName}
        </span>
        <span className="block text-[11px] text-zinc-500">{config.label}</span>
      </span>
      <span
        className={cn(
          "flex shrink-0 items-center gap-1 text-[11px] font-medium",
          copied ? "text-emerald-300" : "text-zinc-500 group-hover:text-zinc-300",
        )}
      >
        {copied ? (
          <Check aria-hidden="true" className="size-3.5" />
        ) : (
          <Copy aria-hidden="true" className="size-3.5" />
        )}
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}

export function ConfigCard({ onCopy }: { onCopy: (text: string, label: string) => void }) {
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const configs = useMemo(() => (origin === null ? null : buildMcpConfigs(origin)), [origin]);

  return (
    <section
      aria-labelledby="connect-client-title"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex h-10 items-center gap-2 border-b border-border px-4">
        <Plug aria-hidden="true" className="size-3.5 text-zinc-500" />
        <h2
          id="connect-client-title"
          className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
        >
          Connect a client
        </h2>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg border border-border bg-zinc-950/60 px-3 py-2">
          <span className="text-[10px] font-medium tracking-[0.08em] text-zinc-600 uppercase">
            MCP endpoint
          </span>
          <span className="mt-0.5 truncate font-mono text-[12px] text-zinc-300">
            {configs?.endpoint ?? "/api/mcp"}
          </span>
        </div>
        {configs === null ? (
          <Skeleton className="h-11 flex-1 rounded-lg sm:flex-[2]" />
        ) : (
          <div className="grid flex-[2] grid-cols-1 gap-2 sm:grid-cols-2">
            <CopyConfigButton config={configs.cursor} onCopy={onCopy} />
            <CopyConfigButton config={configs.claude} onCopy={onCopy} />
          </div>
        )}
      </div>
    </section>
  );
}
