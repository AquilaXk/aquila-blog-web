#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const webRoot = path.resolve(import.meta.dirname, "../..")
const requiredPaths = [
  ".github",
  ".githooks",
  "Dockerfile.runtime",
  "README.md",
  "docs",
  "e2e",
  "legal/policies",
  "legal/schemas",
  "package.json",
  "packages",
  "public",
  "scripts",
  "src",
  "yarn.lock",
]
const forbiddenDirectories = ["front", "back", "deploy"]

const findings = [
  ...requiredPaths
    .filter((requiredPath) => !fs.existsSync(path.join(webRoot, requiredPath)))
    .map((requiredPath) => `missing required path: ${requiredPath}`),
  ...forbiddenDirectories
    .filter((directory) => fs.existsSync(path.join(webRoot, directory)))
    .map((directory) => `forbidden directory exists: ${directory}`),
]

if (findings.length > 0) {
  console.error(`[web-root] violation: ${findings.join(", ")}`)
  process.exit(1)
}

console.log("[web-root] ok")
