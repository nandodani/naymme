import type { SVGProps } from "react";

import { NAYMME_MARK_PATHS, NAYMME_MARK_VIEWBOX } from "@/lib/logo-mark.js";

/**
 * The naymme logo mark — geometric "n" with radar/signal arcs — as inline
 * SVG so it inherits `currentColor` and stays crisp at any size. Decorative
 * by default (`aria-hidden`): wrap it in an element with an accessible name.
 */
export function NaymmeMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={NAYMME_MARK_VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {NAYMME_MARK_PATHS.map((d) => (
        <path key={d.slice(0, 12)} d={d} />
      ))}
    </svg>
  );
}
