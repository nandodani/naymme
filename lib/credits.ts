/**
 * Credits & attributions data for the /credits page — the third-party
 * libraries, fonts, and creative assets naymme is built on. Keep this in
 * sync with package.json and public/fonts/.
 */

/** @public */
export interface CreditEntry {
  /** Display name, e.g. "Silk · React Bits". */
  name: string;
  /** Project homepage or license page. */
  href: string;
  /** SPDX-style license label shown as a badge ("MIT", "ISC", "OFL-1.1"). */
  license: string;
  /** One line on how naymme uses it. */
  usedFor: string;
}

/** @public */
export interface CreditGroup {
  /** Stable id — anchors the section's aria-labelledby. */
  id: string;
  /** Section heading. */
  title: string;
  entries: CreditEntry[];
}

/** @public */
export const CREDIT_GROUPS: CreditGroup[] = [
  {
    id: "framework",
    title: "Framework & language",
    entries: [
      {
        name: "Next.js",
        href: "https://nextjs.org",
        license: "MIT",
        usedFor: "The web app — App Router, metadata, and server rendering.",
      },
      {
        name: "React",
        href: "https://react.dev",
        license: "MIT",
        usedFor: "Component model and rendering for every UI surface.",
      },
      {
        name: "TypeScript",
        href: "https://www.typescriptlang.org",
        license: "Apache-2.0",
        usedFor: "Strict types across the server, web app, and worker — zero any.",
      },
      {
        name: "Tailwind CSS",
        href: "https://tailwindcss.com",
        license: "MIT",
        usedFor: "Utility styling and the OLED-monochrome design tokens.",
      },
    ],
  },
  {
    id: "interface",
    title: "Interface & motion",
    entries: [
      {
        name: "Base UI",
        href: "https://base-ui.com",
        license: "MIT",
        usedFor: "Headless primitives — dialog, tabs, tooltip — via shadcn-style components.",
      },
      {
        name: "shadcn/ui",
        href: "https://ui.shadcn.com",
        license: "MIT",
        usedFor: "The primitive registry pattern behind components/ui.",
      },
      {
        name: "Lucide",
        href: "https://lucide.dev",
        license: "ISC",
        usedFor: "Every interface icon, from copy buttons to link glyphs.",
      },
      {
        name: "Motion",
        href: "https://motion.dev",
        license: "MIT",
        usedFor: "Page transitions and reduced-motion-aware animations.",
      },
      {
        name: "class-variance-authority",
        href: "https://cva.style",
        license: "Apache-2.0",
        usedFor: "Variant typing for the ui primitives.",
      },
      {
        name: "clsx + tailwind-merge",
        href: "https://github.com/dcastil/tailwind-merge",
        license: "MIT",
        usedFor: "The cn() class-composition helper.",
      },
    ],
  },
  {
    id: "visuals",
    title: "Visuals & assets",
    entries: [
      {
        name: "Silk · React Bits",
        href: "https://reactbits.dev/backgrounds/silk",
        license: "MIT",
        usedFor: "The animated silk shader behind the whole app (components/silk.tsx).",
      },
      {
        name: "three.js",
        href: "https://threejs.org",
        license: "MIT",
        usedFor: "WebGL math and scene plumbing for the shader background.",
      },
      {
        name: "@react-three/fiber",
        href: "https://github.com/pmndrs/react-three-fiber",
        license: "MIT",
        usedFor: "React renderer driving the Silk canvas.",
      },
      {
        name: "loading.dev (by Jakub Krehel & Paul Faivret)",
        href: "https://loading.dev",
        license: "MIT",
        usedFor: "React loading indicator (Atom orbit spinner) used for checking state.",
      },
      {
        name: "Geist",
        href: "https://vercel.com/font",
        license: "OFL-1.1",
        usedFor: "Vercel's typeface — self-hosted sans and mono faces.",
      },
    ],
  },
  {
    id: "engine",
    title: "Engine & protocol",
    entries: [
      {
        name: "Model Context Protocol SDK",
        href: "https://modelcontextprotocol.io",
        license: "MIT",
        usedFor: "The MCP server — stdio, Streamable HTTP, and SSE transports.",
      },
      {
        name: "zod",
        href: "https://zod.dev",
        license: "MIT",
        usedFor: "Runtime schemas for tool IO and provider name rules.",
      },
      {
        name: "whoiser",
        href: "https://github.com/LayeredStudio/whoiser",
        license: "MIT",
        usedFor: "WHOIS fallback in the RDAP → WHOIS → DNS domain chain.",
      },
      {
        name: "npm-name",
        href: "https://github.com/sindresorhus/npm-name",
        license: "MIT",
        usedFor: "npm registry availability checks.",
      },
    ],
  },
  {
    id: "platform",
    title: "Hosting & delivery",
    entries: [
      {
        name: "Vercel",
        href: "https://vercel.com",
        license: "Platform",
        usedFor: "Hosts this web app and the hosted MCP endpoint.",
      },
    ],
  },
];
