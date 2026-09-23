import type { Metadata } from "next";

import { StaticPage } from "@/components/static-page.js";
import { PRIVACY_CONTENT } from "@/lib/page-content.js";

export const metadata: Metadata = {
  title: PRIVACY_CONTENT.title,
  description: PRIVACY_CONTENT.description,
  alternates: { canonical: PRIVACY_CONTENT.path },
};

export default function PrivacyPage() {
  return <StaticPage content={PRIVACY_CONTENT} />;
}
