import type { Metadata } from "next";

import { StaticPage } from "@/components/static-page.js";
import { CONTACT_CONTENT } from "@/lib/page-content.js";

export const metadata: Metadata = {
  title: CONTACT_CONTENT.title,
  description: CONTACT_CONTENT.description,
  alternates: { canonical: CONTACT_CONTENT.path },
};

export default function ContactPage() {
  return <StaticPage content={CONTACT_CONTENT} />;
}
