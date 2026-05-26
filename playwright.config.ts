import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Run tests sequentially (site has rate limits)
  workers: 1,
  // Retry once on CI
  retries: 1,
  reporter: "list",

  use: {
    // Test against the live production site
    baseURL: "https://vcharge.co.il",
    // Take screenshot on failure
    screenshot: "only-on-failure",
    // Generous timeout — API calls can be slow
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],

  // Global timeout per test (search + table build can take up to 90s)
  timeout: 120_000,
});
