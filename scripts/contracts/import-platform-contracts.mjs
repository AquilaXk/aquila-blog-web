import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { realpathSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { validateErrorCodes, validateLock } from "./verify-platform-contracts.mjs"

const SOURCE_REPOSITORY = "AquilaXk/aquila-blog"
const COMMIT = /^[a-f0-9]{40}$/
const SHA256 = /^[a-f0-9]{64}$/
const MANIFEST_KEYS = ["artifacts", "contract", "version"]
const ARTIFACT_KEYS = ["path", "sha256"]
const REQUIRED_SOURCE_ARTIFACTS = [
  ["openapi", "openapi.json"],
  ["errorCodes", "error-codes.json"],
]
const SUMMARY_FIXTURE_ARTIFACT = ["summaryFixtures", "summary-fixtures.json"]
let inheritedGitEnvKeysCache

// git rev-parse --local-env-vars lists every environment variable that binds git to one
// specific repository, and .githooks/pre-commit already unsets exactly this set. Asking git
// keeps the two in step instead of freezing a copy that silently falls behind. It needs no
// repository of its own, so it answers even when the inherited GIT_DIR points nowhere.
export function inheritedGitEnvKeys() {
  if (!inheritedGitEnvKeysCache) {
    inheritedGitEnvKeysCache = execFileSync("git", ["rev-parse", "--local-env-vars"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean)
  }
  return inheritedGitEnvKeysCache
}

// Git exports GIT_DIR and friends to hooks in a linked worktree, so a git call that
// targets another directory would silently operate on the inherited repository instead.
export function gitEnvWithoutInheritedRepository(env = process.env) {
  const inherited = new Set(inheritedGitEnvKeys())
  return Object.fromEntries(Object.entries(env).filter(([key]) => !inherited.has(key)))
}

function fail(message) {
  throw new Error(`[platform-contracts] ${message}`)
}

function hasExactKeys(value, keys) {
  return value !== null
    && !Array.isArray(value)
    && typeof value === "object"
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

async function readJson(filePath, label) {
  try {
    const bytes = await fs.readFile(filePath)
    return { bytes, value: JSON.parse(bytes.toString("utf8")) }
  } catch (error) {
    fail(`${label} is malformed or missing: ${error.message}`)
  }
}

function validateSourceIdentity(sourceRepository, sourceCommit) {
  if (sourceRepository !== SOURCE_REPOSITORY || !COMMIT.test(sourceCommit)) {
    fail("source repository or commit is invalid")
  }
}

function gitHubRepository(remote) {
  const scp = /^git@github\.com:(.+?)(?:\.git)?$/.exec(remote)
  if (scp) {
    return scp[1]
  }
  try {
    const url = new URL(remote)
    return url.hostname.toLowerCase() === "github.com"
      ? url.pathname.replace(/^\//, "").replace(/\.git$/, "")
      : null
  } catch {
    return null
  }
}

function validateSourceCommit(source, sourceRepository, sourceCommit, files) {
  const env = gitEnvWithoutInheritedRepository()

  let repositoryRoot
  try {
    repositoryRoot = execFileSync("git", ["-C", source, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    fail("source directory is not inside a Git repository")
  }

  let origin
  try {
    origin = execFileSync("git", ["-C", repositoryRoot, "remote", "get-url", "origin"], {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    fail("source Git origin is missing")
  }
  if (gitHubRepository(origin) !== sourceRepository) {
    fail("source Git origin does not match source repository")
  }

  const sourceDirectory = path.relative(realpathSync(repositoryRoot), realpathSync(source))
  if (path.isAbsolute(sourceDirectory) || sourceDirectory === ".." || sourceDirectory.startsWith(`..${path.sep}`)) {
    fail("source directory is outside its Git repository")
  }

  for (const [file, bytes] of files) {
    const gitPath = [sourceDirectory.split(path.sep).join("/"), file].filter(Boolean).join("/")
    let committed
    try {
      committed = execFileSync("git", ["-C", repositoryRoot, "show", `${sourceCommit}:${gitPath}`], {
        encoding: null,
        env,
        stdio: ["ignore", "pipe", "ignore"],
      })
    } catch {
      fail(`source commit does not contain canonical contract: ${file}`)
    }
    if (!committed.equals(bytes)) {
      fail(`source contract bytes do not match source commit: ${file}`)
    }
  }
}

function validateManifest(manifest) {
  const artifactNames = Object.keys(manifest?.artifacts ?? {}).sort()
  const valid = hasExactKeys(manifest, MANIFEST_KEYS)
    && manifest.version === 1
    && manifest.contract === "aquila-public-api"
    && (JSON.stringify(artifactNames) === JSON.stringify(["errorCodes", "openapi"])
      || JSON.stringify(artifactNames) === JSON.stringify(["errorCodes", "openapi", "summaryFixtures"]))
  if (!valid) {
    fail("source manifest has an invalid identity or shape")
  }
}

function sourceArtifactEntries(manifest) {
  return Object.hasOwn(manifest.artifacts, "summaryFixtures")
    ? [...REQUIRED_SOURCE_ARTIFACTS, SUMMARY_FIXTURE_ARTIFACT]
    : REQUIRED_SOURCE_ARTIFACTS
}

function validateSourceArtifact(artifact, name, expectedPath) {
  const valid = hasExactKeys(artifact, ARTIFACT_KEYS)
    && artifact.path === expectedPath
    && typeof artifact.sha256 === "string"
    && SHA256.test(artifact.sha256)
  if (!valid) {
    fail(`source manifest has an invalid ${name} artifact`)
  }
}

async function readSourceArtifacts(source, manifest) {
  const artifacts = {}
  for (const [name, expectedPath] of sourceArtifactEntries(manifest)) {
    const artifact = manifest.artifacts[name]
    validateSourceArtifact(artifact, name, expectedPath)

    let bytes
    try {
      bytes = await fs.readFile(path.join(source, artifact.path))
    } catch {
      fail(`source artifact is missing: ${artifact.path}`)
    }
    if (sha256(bytes) !== artifact.sha256) {
      fail(`source artifact hash does not match manifest: ${artifact.path}`)
    }
    artifacts[name] = { ...artifact, bytes }
  }
  return artifacts
}

function readArtifactBytes(manifest, artifactBytes) {
  const declaresSummaryFixtures = Object.hasOwn(manifest.artifacts, "summaryFixtures")
  const suppliesSummaryFixtures = Buffer.isBuffer(artifactBytes.summaryFixtures)
  if (declaresSummaryFixtures !== suppliesSummaryFixtures) {
    fail(declaresSummaryFixtures
      ? "source artifact bytes are missing: summary-fixtures.json"
      : "source artifact is undeclared: summary-fixtures.json")
  }
  const artifacts = {}
  for (const [name, expectedPath] of sourceArtifactEntries(manifest)) {
    const artifact = manifest.artifacts[name]
    validateSourceArtifact(artifact, name, expectedPath)
    const bytes = artifactBytes[name]
    if (!Buffer.isBuffer(bytes)) {
      fail(`source artifact bytes are missing: ${artifact.path}`)
    }
    if (sha256(bytes) !== artifact.sha256) {
      fail(`source artifact hash does not match manifest: ${artifact.path}`)
    }
    artifacts[name] = { ...artifact, bytes }
  }
  return artifacts
}

function validateOpenApi(bytes) {
  try {
    const openapi = JSON.parse(bytes.toString("utf8"))
    const valid = openapi !== null
      && !Array.isArray(openapi)
      && typeof openapi === "object"
      && typeof openapi.openapi === "string"
      && openapi.openapi.length > 0
    if (!valid) {
      fail("OpenAPI artifact has an invalid shape")
    }
  } catch (error) {
    if (error.message?.startsWith("[platform-contracts]")) {
      throw error
    }
    fail(`OpenAPI artifact is malformed: ${error.message}`)
  }
}

function validateErrorCodeArtifact(bytes) {
  try {
    validateErrorCodes(JSON.parse(bytes.toString("utf8")))
  } catch (error) {
    if (error.message?.startsWith("[platform-contracts]")) {
      throw error
    }
    fail(`error-codes.json is malformed: ${error.message}`)
  }
}

function createLock(manifest, artifacts, sourceRepository, sourceCommit) {
  return {
    version: 1,
    sourceRepository,
    sourceCommit,
    contract: manifest.contract,
    artifacts: Object.fromEntries(
      Object.entries(artifacts).map(([name, artifact]) => [name, {
        path: artifact.path,
        sha256: artifact.sha256,
      }]),
    ),
  }
}

async function writeOutput(output, artifacts, lock) {
  await fs.mkdir(output, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(output, "openapi.json"), artifacts.openapi.bytes),
    fs.writeFile(path.join(output, "error-codes.json"), artifacts.errorCodes.bytes),
    fs.writeFile(path.join(output, "manifest.lock.json"), `${JSON.stringify(lock, null, 2)}\n`),
    artifacts.summaryFixtures
      ? fs.writeFile(path.join(output, "summary-fixtures.json"), artifacts.summaryFixtures.bytes)
      : fs.rm(path.join(output, "summary-fixtures.json"), { force: true }),
  ])
}

export async function importPlatformContracts({ source, output, sourceRepository, sourceCommit }) {
  validateSourceIdentity(sourceRepository, sourceCommit)
  const { bytes: manifestBytes, value: manifest } = await readJson(path.join(source, "manifest.json"), "source manifest")
  validateManifest(manifest)

  const artifacts = await readSourceArtifacts(source, manifest)
  validateOpenApi(artifacts.openapi.bytes)
  validateErrorCodeArtifact(artifacts.errorCodes.bytes)
  validateSourceCommit(source, sourceRepository, sourceCommit, [
    ["manifest.json", manifestBytes],
    ...sourceArtifactEntries(manifest).map(([name, file]) => [file, artifacts[name].bytes]),
  ])

  const lock = createLock(manifest, artifacts, sourceRepository, sourceCommit)
  validateLock(lock)

  await writeOutput(output, artifacts, lock)
}

// The receiver obtains immutable bytes through the Platform Contents API.  Keep this path
// separate from the Git-backed CLI until Phase C, but share every content validation and
// defer output writes until the complete candidate is known to be valid.
export async function importPlatformContractBytes({
  manifestBytes,
  openapiBytes,
  errorCodesBytes,
  summaryFixturesBytes,
  output,
  sourceRepository,
  sourceCommit,
}) {
  validateSourceIdentity(sourceRepository, sourceCommit)
  if (!Buffer.isBuffer(manifestBytes)) {
    fail("source manifest bytes are missing")
  }

  let manifest
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"))
  } catch (error) {
    fail(`source manifest is malformed or missing: ${error.message}`)
  }
  validateManifest(manifest)

  const artifacts = readArtifactBytes(manifest, {
    openapi: openapiBytes,
    errorCodes: errorCodesBytes,
    summaryFixtures: summaryFixturesBytes,
  })
  validateOpenApi(artifacts.openapi.bytes)
  validateErrorCodeArtifact(artifacts.errorCodes.bytes)

  const lock = createLock(manifest, artifacts, sourceRepository, sourceCommit)
  validateLock(lock)

  await writeOutput(output, artifacts, lock)
}

function usage() {
  fail("Usage: node scripts/contracts/import-platform-contracts.mjs (--source <dir> | --manifest <file> --openapi <file> --error-codes <file> [--summary-fixtures <file>]) --output <dir> --source-repository AquilaXk/aquila-blog --source-commit <40-hex>")
}

function parseArgs(args) {
  const values = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    const known = ["--source", "--manifest", "--openapi", "--error-codes", "--summary-fixtures", "--output", "--source-repository", "--source-commit"].includes(key)
    if (!known || !value || values[key]) {
      usage()
    }
    values[key] = value
  }
  const gitBacked = ["--source", "--output", "--source-repository", "--source-commit"].every((key) => values[key])
  const byteBacked = ["--manifest", "--openapi", "--error-codes", "--output", "--source-repository", "--source-commit"].every((key) => values[key])
  if ((gitBacked && Object.keys(values).length !== 4) || (byteBacked && ![6, 7].includes(Object.keys(values).length)) || (!gitBacked && !byteBacked)) {
    usage()
  }
  return {
    source: values["--source"] && path.resolve(values["--source"]),
    manifest: values["--manifest"] && path.resolve(values["--manifest"]),
    openapi: values["--openapi"] && path.resolve(values["--openapi"]),
    errorCodes: values["--error-codes"] && path.resolve(values["--error-codes"]),
    summaryFixtures: values["--summary-fixtures"] && path.resolve(values["--summary-fixtures"]),
    output: path.resolve(values["--output"]),
    sourceRepository: values["--source-repository"],
    sourceCommit: values["--source-commit"],
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2))
  const importOperation = options.source
    ? importPlatformContracts(options)
    : Promise.all([fs.readFile(options.manifest), fs.readFile(options.openapi), fs.readFile(options.errorCodes), options.summaryFixtures && fs.readFile(options.summaryFixtures)])
      .then(([manifestBytes, openapiBytes, errorCodesBytes, summaryFixturesBytes]) => importPlatformContractBytes({
        ...options,
        manifestBytes,
        openapiBytes,
        errorCodesBytes,
        summaryFixturesBytes,
      }))
  importOperation
    .then(() => console.log("[platform-contracts] imported"))
    .catch((error) => {
      console.error(error.message)
      process.exit(1)
    })
}
