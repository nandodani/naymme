import { defineConfig } from "@playwright/test";

/**
 * Smoke suite against the production build (`next build` first). The server
 * runs in demo mode — deterministic fixtures, no external provider calls —
 * so CI never depends on a live network.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3210",
    headless: true,
    // Traces only survive on failure — cheap insurance for CI-only flakes.
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start:web -- -p 3210",
    env: { LMKURNAME_AVAILABILITY_MODE: "demo" },
    url: "http://127.0.0.1:3210",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
