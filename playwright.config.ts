import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config.
 *
 * Required env vars (set in .env.e2e or your shell):
 *   E2E_BASE_URL              e.g. http://localhost:8080 or your preview URL
 *   E2E_AGENCY_EMAIL          existing agency_admin user
 *   E2E_AGENCY_PASSWORD
 *   E2E_SCHOOL_EMAIL          existing school_admin user
 *   E2E_SCHOOL_PASSWORD
 *
 * If E2E_BASE_URL is not set, Playwright will start `bun run dev` on :8080.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
