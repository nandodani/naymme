import type { Metadata } from "next";

import { StaticPage } from "@/components/static-page.js";
import type { PageContent } from "@/lib/page-content.js";

export const metadata: Metadata = {
  title: "404 — page not found",
  robots: { index: false, follow: false },
};

const NOT_FOUND_CONTENT: PageContent = {
  path: "/404",
  title: "404 — page not found",
  description:
    "That URL does not exist on lmkurname. Nothing is published here — head back to the checker or one of the resources below.",
  sections: [
    {
      links: [
        { label: "Name checker", href: "/" },
        { label: "llms.txt — agent quick-start", href: "/llms.txt" },
        { label: "llms-full.txt — full agent instructions", href: "/llms-full.txt" },
        { label: "sitemap.xml", href: "/sitemap.xml" },
        {
          label: "Documentation",
          href: "https://github.com/nandodani/name-check-mcp/tree/main/docs",
        },
      ],
    },
  ],
};

export default function NotFound() {
  return <StaticPage content={NOT_FOUND_CONTENT} />;
}
