"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Check, Copy, Plug, X } from "lucide-react";

import { buildMcpConfigs, type McpClientConfig } from "@/lib/mcp-config.js";
import { cn } from "@/lib/utils.js";

function SnippetBlock({
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

  const copy = () => {
    onCopy(config.snippet, `Copied ${config.label} config`);
    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
      <div className="flex h-10 items-center justify-between gap-3 border-b border-white/5 bg-white/[0.02] px-3.5">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="shrink-0 text-[12px] font-medium text-zinc-200">{config.label}</span>
          <span className="truncate font-mono text-[10px] text-zinc-600">{config.destination}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${config.label} config`}
          className={cn(
            "flex h-6 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            copied
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200",
          )}
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3" />
          ) : (
            <Copy aria-hidden="true" className="size-3" />
          )}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="max-h-36 overflow-auto px-3.5 py-3 font-mono text-[11px] leading-relaxed whitespace-pre text-zinc-400">
        <code>{config.snippet}</code>
      </pre>
    </div>
  );
}

/**
 * The "Connect MCP" dialog — one-click config snippets pointing every major
 * MCP client at the hosted /api/mcp endpoint.
 */
export function ConnectMcpDialog({ onCopy }: { onCopy: (text: string, label: string) => void }) {
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const configs = useMemo(() => (origin === null ? null : buildMcpConfigs(origin)), [origin]);

  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[12px] font-medium text-zinc-300 transition-colors outline-none",
          "hover:border-white/20 hover:bg-white/[0.07] hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Plug aria-hidden="true" className="size-3.5" />
        Connect MCP
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl outline-none",
            "transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-[14px] font-semibold tracking-tight text-zinc-100">
                Connect a client
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-[12px] leading-5 text-zinc-500">
                Point any MCP client at the hosted endpoint — no install, no API key.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close dialog"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors outline-none hover:bg-white/5 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-2.5 px-5 py-4">
            <div className="flex h-10 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5">
              <span className="text-[10px] font-medium tracking-[0.08em] text-zinc-600 uppercase">
                Endpoint
              </span>
              <span className="truncate font-mono text-[11px] text-zinc-300">
                {configs?.endpoint ?? "/api/mcp"}
              </span>
            </div>
            {configs?.clients.map((config) => (
              <SnippetBlock key={config.id} config={config} onCopy={onCopy} />
            )) ?? (
              <div className="flex flex-col gap-2.5" aria-hidden="true">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl bg-white/[0.03]" />
                ))}
              </div>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
