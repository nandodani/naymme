import type { KnipConfig } from "knip";

const config: KnipConfig = {
  project: ["**/*.{ts,tsx}"],
  // `tailwindcss` is imported by app/globals.css — knip can't follow CSS imports.
  ignoreDependencies: ["tailwindcss"],
  // components/ui/** are shadcn/base-ui style primitives — a design-system
  // API surface kept whole even when a given app page uses only a subset.
  // .agents/** is vendored third-party content (superpowers skills).
  ignore: ["components/ui/**", ".agents/**"],
  // Exports referenced inside their own module (brand icon registry, schema
  // composition) are part of the module's public surface, not dead code.
  ignoreExportsUsedInFile: true,
  next: true,
  vitest: true,
  playwright: true,
};

export default config;
