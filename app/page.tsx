import { NaymmeChecker } from "@/components/naymme-checker.js";
import { jsonLdGraph } from "@/lib/json-ld.js";

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph()) }}
      />
      <NaymmeChecker />
    </>
  );
}
