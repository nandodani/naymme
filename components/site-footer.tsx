import type { ReactNode } from "react";

/** Internal site links — every footer link lives here, in one place. */
const FOOTER_LINKS = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Docs", href: "/docs" },
  { label: "Credits", href: "/credits" },
  { label: "llms.txt", href: "/llms.txt" },
  { label: "MCP discovery", href: "/.well-known/mcp" },
] as const;

/**
 * Shared footer for the app shell and the static pages: disclaimer lines
 * first, then every link in a single nav at the very bottom.
 */
export function SiteFooter({ note }: { note?: ReactNode }) {
  return (
    <footer className="flex shrink-0 flex-col items-center justify-center gap-1 border-t border-zinc-800 px-4 py-2.5 text-center text-[11px] text-zinc-400 sm:px-6">
      <span>
        Independent project. Not affiliated with, endorsed by, or associated with any brands,
        platforms, or registries displayed.
      </span>
      <span>
        Scores are deterministic heuristics · availability is a best-effort snapshot, not a
        guarantee.
      </span>
      {note}
      <nav
        aria-label="Resources"
        className="mt-0.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
      >
        {FOOTER_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-sm text-zinc-400 underline-offset-2 outline-none transition-colors hover:text-zinc-200 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
