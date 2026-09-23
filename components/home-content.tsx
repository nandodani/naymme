import { HOME_CONTENT } from "@/lib/page-content.js";

import { ContentSections } from "./content-sections.js";

/**
 * Below-fold SSR content for the zero state: real copy about what the
 * product does — rendered into the raw HTML so crawlers and agents see
 * substance without executing JavaScript, and users get docs-linked
 * context by scrolling past the hero.
 */
export function HomeContent() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
      <ContentSections sections={HOME_CONTENT.sections} />
    </div>
  );
}
