#!/usr/bin/env node
import fs from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"

const webRoot = path.resolve(import.meta.dirname, "../..")
const requiredPaths = [
  ".github",
  ".githooks",
  "Dockerfile.runtime",
  "README.md",
  "docs",
  "e2e",
  "package.json",
  "packages",
  "public",
  "scripts",
  "src",
  "yarn.lock",
]
const forbiddenDirectories = ["front", "back", "deploy"]
const gitRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: webRoot,
  encoding: "utf8",
})
const gitRootFinding =
  gitRoot.status !== 0 || !gitRoot.stdout.trim()
    ? "unable to confirm Git repository root"
    : path.resolve(gitRoot.stdout.trim()) !== webRoot
      ? "Git repository root does not match the web root"
      : null

const findings = [
  ...(gitRootFinding ? [gitRootFinding] : []),
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
