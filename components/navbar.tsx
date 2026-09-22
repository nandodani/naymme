"use client";

import { GitHubIcon } from "./brand-icons.js";
import { ConnectMcpDialog } from "./connect-mcp-dialog.js";

/**
 * Ultra-minimal top bar: wordmark on the left; attribution, GitHub link and
 * the Connect MCP dialog trigger on the right.
 */
export function Navbar({ onCopy }: { onCopy: (text: string, label: string) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <a
          href="/"
          aria-label="lmkurname home"
          className="rounded-md font-mono text-[13px] font-semibold tracking-tight text-zinc-100 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
        >
          lmkurname
        </a>
        <div className="ml-auto flex items-center gap-1.5">
          <a
            href="https://nandodani.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="mr-1 hidden rounded-md text-[11px] text-zinc-600 transition-colors outline-none hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-ring sm:inline"
          >
            crafted by @nandodani
          </a>
          <a
            href="https://github.com/nandodani/name-check-mcp"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="lmkurname on GitHub"
            className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors outline-none hover:bg-white/5 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GitHubIcon className="size-4" />
          </a>
          <ConnectMcpDialog onCopy={onCopy} />
        </div>
      </div>
    </header>
  );
}
