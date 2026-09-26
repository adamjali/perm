import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker: this runs on a 2015 laptop, and parallel browsers have
  // crashed it (v2/CLAUDE.md, "never run headless browsers in parallel").
  workers: 1,
  reporter: "html",

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      // The installed Chrome rather than Playwright's own download, which is
      // not installed here (and WebKit can't be on macOS 12).
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],

  // NOTE: webServer config removed - use ./run-e2e-tests.sh instead
  // The automatic server detection was unreliable with Convex + Next.js
  // Run tests with: ./run-e2e-tests.sh
});
