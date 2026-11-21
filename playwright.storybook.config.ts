import { defineConfig } from "@playwright/test"
import { resolveStorybookStaticPort } from "./.storybook/storybook-static-port.mjs"

export const createStorybookPlaywrightConfig = (port: number) => {
  const baseURL = `http://127.0.0.1:${port}`

  return defineConfig({
    testDir: "./tests/storybook",
    outputDir: "test-results/storybook-smoke",
    timeout: 10_000,
    expect: {
      timeout: 1_000,
    },
    workers: 1,
    use: {
      baseURL,
    },
    webServer: {
      command: "node scripts/storybook/serve-static.mjs",
      env: { STORYBOOK_STATIC_PORT: String(port) },
      url: baseURL,
      reuseExistingServer: false,
    },
    reporter: process.env.CI
      ? [["github"], ["html", { outputFolder: "playwright-report-storybook", open: "never" }]]
      : [["list"]],
  })
}

const storybookStaticPort = resolveStorybookStaticPort(process.env.STORYBOOK_STATIC_PORT)

export default createStorybookPlaywrightConfig(storybookStaticPort)
