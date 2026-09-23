import type { Metadata } from "next";

import { StaticPage } from "@/components/static-page.js";
import { DOCS_CONTENT } from "@/lib/page-content.js";

export const metadata: Metadata = {
  title: DOCS_CONTENT.title,
  description: DOCS_CONTENT.description,
  alternates: { canonical: DOCS_CONTENT.path },
};

export default function DocsPage() {
  return <StaticPage content={DOCS_CONTENT} />;
}
