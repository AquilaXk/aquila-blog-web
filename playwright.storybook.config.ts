import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/storybook",
  outputDir: "test-results/storybook-smoke",
  timeout: 10_000,
  expect: {
    timeout: 1_000,
  },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:6006",
  },
  webServer: {
    command: "node scripts/storybook/serve-static.mjs",
    url: "http://127.0.0.1:6006",
    reuseExistingServer: false,
  },
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report-storybook", open: "never" }]]
    : [["list"]],
})
