import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";

import { CREDIT_GROUPS } from "@/lib/credits.js";

export const metadata: Metadata = {
  title: "Credits",
  description:
    "Credits and attributions — the open-source libraries, fonts, and creative assets lmkurname is built on.",
  alternates: { canonical: "/credits" },
};

/**
 * /credits — a quiet honor roll for the third-party projects behind the app.
 * Fully server-rendered: no client JS beyond the shared layout.
 */
export default function CreditsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Same skip-link contract as the app page: first tab stop, jumps
          focus into the main landmark. */}
      <a
        href="#main-content"
        className="fixed top-0 left-3 z-60 -translate-y-[150%] rounded-md bg-zinc-100 px-4 py-2 text-[12px] font-medium text-black outline-none motion-safe:transition-transform focus-visible:translate-y-3 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to main content
      </a>

      <header className="bg-gradient-to-b from-black via-black/70 to-transparent pb-3">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4 sm:px-6">
          <a
            href="/"
            aria-label="lmkurname home"
            className="rounded-md font-mono text-[13px] font-semibold tracking-tight text-zinc-100 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
          >
            lmkurname
          </a>
          <a
            href="/"
            className="ml-auto rounded-md text-[12px] text-zinc-400 outline-none transition-colors hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to app
          </a>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 outline-none sm:px-6"
      >
        <h1 className="bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-[28px] leading-[1.15] font-semibold tracking-tight text-transparent sm:text-[36px]">
          Credits
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-zinc-400">
          lmkurname stands on open source. These are the libraries, fonts, and creative assets that
          make it work — each links to its project.
        </p>

        {CREDIT_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`credits-${group.id}`} className="mt-10">
            <h2
              id={`credits-${group.id}`}
              className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase"
            >
              {group.title}
            </h2>
            <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-zinc-800">
              {group.entries.map((entry) => (
                <li key={entry.name}>
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-4 px-4 py-3.5 outline-none transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-zinc-100 transition-colors group-hover:text-white">
                        {entry.name}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-5 text-zinc-400">
                        {entry.usedFor}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2.5">
                      <span className="font-mono text-[10px] font-medium tracking-[0.08em] text-zinc-400 uppercase">
                        {entry.license}
                      </span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="size-3.5 text-zinc-500 transition-colors group-hover:text-zinc-300"
                      />
                    </span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-10 text-[12px] leading-5 text-zinc-400">
          Missing an attribution?{" "}
          <a
            href="https://github.com/nandodani/name-check-mcp/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-zinc-200 underline decoration-zinc-600 underline-offset-2 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open an issue
            <span className="sr-only">(opens in a new tab)</span>
          </a>{" "}
          and we&rsquo;ll fix it.
        </p>
      </main>

      <footer className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-t border-white/5 px-4 py-2.5 text-center text-[11px] text-zinc-400 sm:px-6">
        <span>
          Independent project. Not affiliated with, endorsed by, or associated with any brands,
          platforms, or registries displayed.
        </span>
        <span>Trademarks belong to their respective owners.</span>
      </footer>
    </div>
  );
}
