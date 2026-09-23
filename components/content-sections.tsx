import type { ContentSection } from "@/lib/page-content.js";

/**
 * Server-rendered prose sections — shared by the static pages and the
 * homepage's below-fold content. OLED black surface, 1px zinc-800 hairline
 * separators, zinc-400 copy (WCAG AA on black), sequential h2 headings.
 */
export function ContentSections({ sections }: { sections: readonly ContentSection[] }) {
  return (
    <div className="flex w-full flex-col divide-y divide-zinc-800 border-y border-zinc-800">
      {sections.map((section, index) => (
        <section key={section.heading ?? index} className="py-8 first:pt-10 last:pb-10">
          {section.heading !== undefined && (
            <h2 className="text-[17px] font-semibold tracking-tight text-zinc-100">
              {section.heading}
            </h2>
          )}
          {section.paragraphs?.map((paragraph, i) => (
            <p key={i} className="mt-3 text-[13.5px] leading-relaxed text-zinc-400 first:mt-0">
              {paragraph}
            </p>
          ))}
          {section.list !== undefined && (
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-zinc-400 marker:text-zinc-600">
              {section.list.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          {section.links !== undefined && (
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {section.links.map((link) => {
                const external = !link.href.startsWith("/");
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="rounded-sm text-[13px] text-zinc-200 underline decoration-zinc-600 underline-offset-4 outline-none transition-colors hover:text-white hover:decoration-zinc-300 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {link.label}
                      {external && <span className="sr-only">(opens in a new tab)</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
