import type { Metadata } from "next";

import { StaticPage } from "@/components/static-page.js";
import { ABOUT_CONTENT } from "@/lib/page-content.js";

export const metadata: Metadata = {
  title: ABOUT_CONTENT.title,
  description: ABOUT_CONTENT.description,
  alternates: { canonical: ABOUT_CONTENT.path },
};

export default function AboutPage() {
  return <StaticPage content={ABOUT_CONTENT} />;
}
