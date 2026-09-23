import { HomeContent } from "@/components/home-content.js";
import { NameChecker } from "@/components/name-checker.js";
import { jsonLdGraph } from "@/lib/json-ld.js";

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph()) }}
      />
      <NameChecker heroContent={<HomeContent />} />
    </>
  );
}
