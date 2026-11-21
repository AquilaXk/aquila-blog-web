import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const webRoot = path.resolve(import.meta.dirname, "../..")
const guardPath = path.join(webRoot, "scripts/repo-boundary/check-web-root.mjs")
const brandMarkSource = fs.readFileSync(path.join(webRoot, "src/components/branding/BrandMark.tsx"), "utf8")

const requiredDirectories = [
  ".github",
  ".githooks",
  "docs",
  "e2e",
  "packages",
  "public",
  "src",
]
const requiredFiles = ["Dockerfile.runtime", "README.md", "package.json", "yarn.lock"]

const initializeGitRepository = (root) => {
  const result = spawnSync("git", ["init", "--quiet", root], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
}

const createWebRootFixture = (t, root = fs.mkdtempSync(path.join(os.tmpdir(), "web-root-")), initializeGit = true) => {
  t.after(() => fs.rmSync(root, { force: true, recursive: true }))

  for (const directory of requiredDirectories) fs.mkdirSync(path.join(root, directory), { recursive: true })
  for (const file of requiredFiles) fs.writeFileSync(path.join(root, file), "fixture\n")
  fs.mkdirSync(path.join(root, "scripts/repo-boundary"), { recursive: true })
  fs.copyFileSync(guardPath, path.join(root, "scripts/repo-boundary/check-web-root.mjs"))
  if (initializeGit) initializeGitRepository(root)
  return root
}

const runGuard = (cwd) => spawnSync(process.execPath, ["scripts/repo-boundary/check-web-root.mjs"], { cwd, encoding: "utf8" })

test("shared brand mark uses a content-versioned canonical asset", () => {
  const assetMatch = brandMarkSource.match(/src="\/(brand-mascot\.([a-f0-9]{8})\.png)"/)
  assert.ok(assetMatch, "BrandMark must use a content-versioned PNG URL")

  const [, assetFile, expectedHashPrefix] = assetMatch
  const assetPath = path.join(webRoot, "public", assetFile)
  assert.equal(fs.existsSync(assetPath), true, `missing canonical brand asset: ${assetFile}`)
  assert.equal(fs.existsSync(path.join(webRoot, "public/brand-mascot.png")), false)

  const actualHash = createHash("sha256").update(fs.readFileSync(assetPath)).digest("hex")
  assert.equal(actualHash.slice(0, expectedHashPrefix.length), expectedHashPrefix)
})

test("Web root guard accepts the standalone required structure", (t) => {
  assert.equal(fs.existsSync(guardPath), true, "Web root guard must exist")
  const root = createWebRootFixture(t)

  const result = runGuard(root)

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /\[web-root\] ok/)
})

test("Web root guard fails closed when a required path is missing", (t) => {
  assert.equal(fs.existsSync(guardPath), true, "Web root guard must exist")
  const root = createWebRootFixture(t)
  fs.rmSync(path.join(root, "src"), { force: true, recursive: true })

  const result = runGuard(root)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /missing required path: src/)
})

test("Web root guard fails closed when nested below the Git repository root", (t) => {
  const monorepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-monorepo-"))
  t.after(() => fs.rmSync(monorepoRoot, { force: true, recursive: true }))
  initializeGitRepository(monorepoRoot)
  const root = createWebRootFixture(t, path.join(monorepoRoot, "front"), false)

  const result = runGuard(root)

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Git repository root does not match the web root/)
})

for (const forbiddenDirectory of ["front", "back", "deploy"]) {
  test(`Web root guard fails closed for ${forbiddenDirectory}`, (t) => {
    assert.equal(fs.existsSync(guardPath), true, "Web root guard must exist")
    const root = createWebRootFixture(t)
    fs.mkdirSync(path.join(root, forbiddenDirectory))

    const result = runGuard(root)

    assert.equal(result.status, 1)
    assert.match(result.stderr, new RegExp(`forbidden directory exists: ${forbiddenDirectory}`))
  })
}
