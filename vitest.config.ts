import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["{src,lib,worker,app,components}/**/*.{ts,tsx}"],
      reporter: ["text", "html"],
      thresholds: {
        "src/providers/**": { statements: 90, branches: 85, functions: 90, lines: 90 },
        "src/schemas.ts": { statements: 95, branches: 95, functions: 95, lines: 95 },
        "lib/**": { statements: 80, branches: 75, functions: 80, lines: 80 },
        "worker/**": { statements: 80, branches: 70, functions: 80, lines: 80 },
      },
    },
  },
});
