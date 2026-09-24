"use client";

import { ConnectMcpDialog } from "./connect-mcp-dialog.js";
import { NaymmeMark } from "./naymme-mark.js";

/**
 * Ultra-minimal top bar: logo mark + wordmark on the left; attribution and
 * the Connect MCP dialog trigger on the right.
 */
export function Navbar({ onCopy }: { onCopy: (text: string, label: string) => void }) {
  return (
    <header className="sticky top-0 z-40 bg-gradient-to-b from-black via-black/70 to-transparent pb-3">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <a
          href="/"
          aria-label="naymme home"
          className="flex items-center gap-2 rounded-md font-mono text-[13px] font-semibold tracking-tight text-zinc-100 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
        >
          <NaymmeMark className="h-[18px] w-[18px]" />
          naymme
        </a>
        <div className="ml-auto flex items-center gap-1.5">
          <a
            href="/docs"
            className="mr-1 hidden rounded-md text-[11px] text-zinc-400 transition-colors outline-none hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-ring sm:inline"
          >
            Docs
          </a>
          <a
            href="https://github.com/nandodani/naymme"
            target="_blank"
            rel="noopener noreferrer"
            className="mr-1 hidden rounded-md text-[11px] text-zinc-400 transition-colors outline-none hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-ring sm:inline"
          >
            GitHub
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <a
            href="https://nandodani.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="mr-1 hidden rounded-md text-[11px] text-zinc-400 transition-colors outline-none hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-ring sm:inline"
          >
            crafted by @nandodani
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <ConnectMcpDialog onCopy={onCopy} />
        </div>
      </div>
    </header>
  );
}
