import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import nextEnv from "@next/env"

import { loadContract, validateEnvText } from "./env/validate-env.mjs"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontRoot = path.resolve(scriptDir, "..")
const liveSpecs = ["e2e/live.spec.ts"]
const { loadEnvConfig } = nextEnv

const mutedEnvLog = {
  info: () => {},
  error: (message, error) => {
    console.error(`[live-e2e] ${message}`, error)
  },
}

const { loadedEnvFiles } = loadEnvConfig(frontRoot, true, mutedEnvLog, true)
const loadedEnvFileNames = loadedEnvFiles.map((envFile) => envFile.path).join(", ")
if (loadedEnvFileNames) {
  console.log(`[live-e2e] loaded env files: ${loadedEnvFileNames}`)
}

const envText = Object.entries(process.env)
  .map(([key, value]) => `${key}=${value || ""}`)
  .join("\n")
const validation = validateEnvText({
  contract: loadContract(),
  target: "live-ready",
  text: envText,
})
if (!validation.ok) {
  for (const error of validation.errors) {
    console.error(`[live-e2e] live-ready: ${error.key} ${error.message}`)
  }
  process.exit(1)
}

const childEnv = {
  ...process.env,
  PLAYWRIGHT_LIVE_MULTI_BROWSER: process.env.PLAYWRIGHT_LIVE_MULTI_BROWSER || "true",
  PLAYWRIGHT_USE_WEBSERVER: process.env.PLAYWRIGHT_USE_WEBSERVER || "false",
}
delete childEnv.NO_COLOR

const child = spawn("yarn", ["playwright", "test", ...liveSpecs, "--workers=1", ...process.argv.slice(2)], {
  cwd: frontRoot,
  stdio: "inherit",
  env: childEnv,
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})

child.on("error", (error) => {
  console.error(`[live-e2e] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
