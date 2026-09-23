import type { PageContent } from "@/lib/page-content.js";

import { ContentSections } from "./content-sections.js";
import { SiteFooter } from "./site-footer.js";

const NAV_LINKS = [
  { label: "About", href: "/about" },
  { label: "Docs", href: "/docs" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "llms.txt", href: "/llms.txt" },
] as const;

/**
 * Shell for the static content pages (/about, /contact, /privacy, /docs)
 * and the 404: same header/footer chrome as the app, prose via
 * ContentSections.
 */
export function StaticPage({ content }: { content: PageContent }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 bg-gradient-to-b from-black via-black/70 to-transparent pb-3">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4 sm:px-6">
          <a
            href="/"
            aria-label="naymme home"
            className="rounded-md font-mono text-[13px] font-semibold tracking-tight text-zinc-100 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
          >
            naymme
          </a>
          <nav aria-label="Site" className="ml-auto flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={link.href === content.path ? "page" : undefined}
                className="rounded-md text-[12px] text-zinc-400 outline-none transition-colors hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-zinc-100"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 sm:px-6">
        <h1 className="pt-10 pb-2 text-[26px] font-semibold tracking-tight text-zinc-100">
          {content.title}
        </h1>
        <p className="pb-6 text-[13.5px] leading-relaxed text-zinc-400">{content.description}</p>
        <ContentSections sections={content.sections} />
      </main>

      <SiteFooter />
    </div>
  );
}
