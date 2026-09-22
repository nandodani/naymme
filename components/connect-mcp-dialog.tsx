"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  Check,
  ChevronDown,
  Copy,
  MousePointer2,
  Plug,
  Sparkles,
  SquareTerminal,
  Wind,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { buildMcpConfigs, type McpClientConfig } from "@/lib/mcp-config.js";
import { buildClientGuides } from "@/lib/mcp-guides.js";
import { cn } from "@/lib/utils.js";

const CLIENT_ICONS: Record<McpClientConfig["id"], LucideIcon> = {
  "claude-desktop": Sparkles,
  cursor: MousePointer2,
  windsurf: Wind,
  "claude-code": SquareTerminal,
};

/** Read-only input row + one-click copy button with checkmark feedback. */
function CopyField({
  value,
  copyLabel,
  toastLabel,
  onCopy,
}: {
  value: string;
  copyLabel: string;
  toastLabel: string;
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
    onCopy(value, toastLabel);
    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex items-stretch gap-2">
      <input
        readOnly
        value={value}
        aria-label={`${copyLabel} — click the copy button to copy`}
        onFocus={(e) => e.target.select()}
        className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 font-mono text-[12px] text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${copyLabel}`}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          copied
            ? "border-white/30 bg-white/10 text-zinc-50"
            : "border-zinc-800 bg-white/[0.05] text-zinc-200 hover:border-zinc-700 hover:bg-white/[0.09]",
        )}
      >
        {copied ? (
          <Check aria-hidden="true" className="size-3.5" />
        ) : (
          <Copy aria-hidden="true" className="size-3.5" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** Raw config JSON block — only rendered inside the advanced disclosure. */
function SnippetBlock({ config }: { config: McpClientConfig }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
      <div className="flex h-9 items-center justify-between gap-3 border-b border-white/5 bg-white/[0.02] px-3.5">
        <span className="truncate font-mono text-[10px] text-zinc-600">{config.destination}</span>
        <span className="shrink-0 text-[10px] font-medium tracking-[0.08em] text-zinc-600 uppercase">
          {config.language}
        </span>
      </div>
      <pre className="max-h-36 overflow-auto px-3.5 py-3 font-mono text-[11px] leading-relaxed whitespace-pre text-zinc-400">
        <code>{config.snippet}</code>
      </pre>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-white/[0.03] text-[10px] font-semibold text-zinc-400 tabular-nums"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-zinc-200">{title}</p>
        <div className="mt-1 text-[12px] leading-5 text-zinc-500">{children}</div>
      </div>
    </div>
  );
}

/**
 * The "Connect MCP" dialog — a guided, plain-English setup for each MCP
 * client: pick a client, open its settings, copy the URL/command, paste and
 * save. The raw JSON configs stay available in a collapsed disclosure at the
 * bottom for power users.
 */
export function ConnectMcpDialog({ onCopy }: { onCopy: (text: string, label: string) => void }) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [selected, setSelected] = useState<McpClientConfig["id"]>("claude-desktop");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const endpoint = origin === null ? "/api/mcp" : buildMcpConfigs(origin).endpoint;
  const configs = useMemo(() => (origin === null ? null : buildMcpConfigs(origin)), [origin]);
  const guides = useMemo(() => buildClientGuides(endpoint), [endpoint]);
  const guide = guides.find((g) => g.id === selected) ?? guides[0];
  const activeConfig = configs?.clients.find((c) => c.id === selected);

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
            "fixed top-1/2 left-1/2 z-50 w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-black shadow-2xl outline-none",
            "transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-[14px] font-semibold tracking-tight text-zinc-100">
                Connect a client
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-[12px] leading-5 text-zinc-500">
                Point your favorite AI tool at this server — no install, no API key.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close dialog"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors outline-none hover:bg-white/5 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="px-5 py-4">
            <div
              role="tablist"
              aria-label="Choose your client"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {guides.map((g) => {
                const Icon = CLIENT_ICONS[g.id];
                const active = g.id === selected;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelected(g.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-zinc-700 bg-white/[0.07] text-zinc-100"
                        : "border-zinc-800 bg-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {configs?.clients.find((c) => c.id === g.id)?.label ?? g.id}
                  </button>
                );
              })}
            </div>

            {guide !== undefined ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={guide.id}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="mt-4 flex flex-col gap-3.5"
                >
                  <Step n={1} title="Open settings">
                    {guide.openSettings}
                  </Step>
                  <Step n={2} title={`Copy the ${guide.copyLabel.toLowerCase()}`}>
                    <div className="mt-1">
                      <CopyField
                        value={guide.copyValue}
                        copyLabel={guide.copyLabel}
                        toastLabel={guide.copyToast}
                        onCopy={onCopy}
                      />
                    </div>
                  </Step>
                  <Step n={3} title="Paste and save">
                    {guide.pasteAndSave}
                  </Step>
                </motion.div>
              </AnimatePresence>
            ) : null}

            <div className="mt-4 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => setAdvancedOpen((open) => !open)}
                aria-expanded={advancedOpen}
                className="flex w-full items-center justify-between rounded-md px-1 py-1 text-[12px] font-medium text-zinc-500 transition-colors outline-none hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-ring"
              >
                Need raw config JSON?
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-4 transition-transform duration-200",
                    advancedOpen ? "rotate-180" : "",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {advancedOpen && activeConfig !== undefined ? (
                  <motion.div
                    key="advanced"
                    initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3">
                      <p className="mb-2 text-[11px] leading-4 text-zinc-600">
                        Paste this into{" "}
                        <span className="font-mono text-zinc-400">{activeConfig.destination}</span>:
                      </p>
                      <SnippetBlock config={activeConfig} />
                      <button
                        type="button"
                        onClick={() =>
                          onCopy(activeConfig.snippet, `Copied ${activeConfig.label} config`)
                        }
                        className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-zinc-800 bg-white/[0.03] px-2.5 text-[11px] font-medium text-zinc-400 transition-colors outline-none hover:border-zinc-700 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Copy aria-hidden="true" className="size-3" />
                        Copy JSON
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
