import assert from "node:assert/strict"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "../..")
const workflowPath = path.join(root, ".github/workflows/receive-platform-public-contract.yml")

function workflow() {
  assert.equal(existsSync(workflowPath), true, "Platform public-contract receiver must exist")
  const source = readFileSync(workflowPath, "utf8")
  const ruby = ["require 'yaml'", "require 'json'", "puts JSON.generate(YAML.load_file(ARGV.fetch(0)))"].join("; ")
  const parsed = spawnSync("ruby", ["-e", ruby, workflowPath], { encoding: "utf8" })
  assert.equal(parsed.status, 0, parsed.stderr || "workflow YAML must parse")
  return { source, document: JSON.parse(parsed.stdout) }
}

function step(job, name) {
  const result = job.steps.find((candidate) => candidate.name === name)
  assert.ok(result, `missing workflow step: ${name}`)
  return result
}

test("receiver admits only the exact App-owned nine-key Platform payload", () => {
  const { source, document } = workflow()
  const job = document.jobs.receive
  assert.match(source, /^  repository_dispatch:\n    types: \[platform_public_contract_ready\]/m)
  assert.equal(job.if, undefined, "untrusted dispatches must fail in admission, not be silently skipped")
  assert.equal(document.permissions["pull-requests"], "read")
  const admit = step(job, "Validate immutable Platform delivery")
  assert.equal(admit.env.EXPECTED_APP_LOGIN, "${{ vars.REPO_SYNC_APP_BOT_LOGIN }}")
  assert.match(admit.run, /EVENT_SENDER_TYPE !== "Bot"/)
  assert.match(admit.run, /EVENT_SENDER_LOGIN !== process\.env\.EXPECTED_APP_LOGIN/)
  for (const key of [
    "schema_version", "source_repository", "source_commit", "manifest_sha256", "openapi_sha256",
    "error_codes_sha256", "target_repository", "target_commit", "delivery_id",
  ]) assert.match(admit.run, new RegExp(`\\b${key}\\b`), `missing payload key ${key}`)
  assert.match(admit.run, /Object\.keys\(payload\)/)
  assert.match(admit.run, /AquilaXk\/aquila-blog/)
  assert.match(admit.run, /AquilaXk\/aquila-blog-web/)
  assert.match(admit.run, /createHash\("sha256"\)/)
  assert.match(admit.run, /expectedDelivery/)
})

test("receiver reads the manifest-declared immutable Platform bytes before any Web write capability", () => {
  const { source, document } = workflow()
  const job = document.jobs.receive
  const token = step(job, "Create Platform read token")
  assert.equal(token.with.repositories, "aquila-blog")
  assert.equal(token.with["permission-contents"], "read")
  assert.equal(token.with["permission-pull-requests"], undefined)

  const fetch = step(job, "Read exact Platform contract bytes")
  assert.match(fetch.run, /\/contents\/contracts\/public-api\/manifest\.json\?ref=/)
  assert.match(fetch.run, /\/contents\/contracts\/public-api\/openapi\.json\?ref=/)
  assert.match(fetch.run, /\/contents\/contracts\/public-api\/error-codes\.json\?ref=/)
  assert.match(fetch.run, /summary-fixtures\.json/)
  assert.match(fetch.run, /summaryFixtures/)
  assert.doesNotMatch(fetch.run, /summary_fixtures=/)
  assert.doesNotMatch(source, /repository:\s*AquilaXk\/aquila-blog/)
  assert.doesNotMatch(source, /path:\s*platform/)
  assert.doesNotMatch(source, /git -C platform|git clone|actions\/checkout[^\n]*aquila-blog/)

  const writerIndex = job.steps.indexOf(step(job, "Create Web write token"))
  const checkout = step(job, "Checkout immutable Web target without persisted credentials")
  assert.equal(checkout.with.ref, "${{ steps.delivery.outputs.target_commit }}")
  assert.equal(checkout.with["fetch-depth"], 0, "durable sync branch merge requires full history")
  assert.ok(job.steps.indexOf(token) < job.steps.indexOf(checkout), "stale Platform source must avoid checkout/install")
  assert.ok(job.steps.indexOf(fetch) < writerIndex)
  assert.match(String(step(job, "Create Web write token").if), /steps\.changes\.outputs\.changed == 'true'/)
  assert.ok(job.steps.indexOf(step(job, "Set up Node.js 20")) < job.steps.indexOf(step(job, "Build validated Web-local contract candidate")))
  assert.match(step(job, "Install locked Web dependencies").run, /yarn install --frozen-lockfile/)
})

test("receiver validates the required summary fixture from the verified manifest", () => {
  const { document } = workflow()
  const fetch = step(document.jobs.receive, "Read exact Platform contract bytes")
  const heredoc = /node - <<'NODE'\n([\s\S]*?)\nNODE/.exec(fetch.run)
  assert.ok(heredoc, "Platform byte validation heredoc must exist")

  const directory = mkdtempSync(path.join(tmpdir(), "platform-contract-output-"))
  try {
    const incoming = path.join(directory, "incoming")
    const output = path.join(directory, "github-output")
    mkdirSync(incoming)
    const openapi = Buffer.from('{"openapi":"3.1.0"}\n')
    const errorCodes = Buffer.from('[]\n')
    const summaryFixtures = Buffer.from('{"fixture":"transport-only"}\n')
    const sha256 = (value) => createHash("sha256").update(value).digest("hex")
    writeFileSync(path.join(incoming, "openapi.json"), openapi)
    writeFileSync(path.join(incoming, "error-codes.json"), errorCodes)
    const manifest = {
      version: 1,
      contract: "aquila-public-api",
      artifacts: {
        openapi: { path: "openapi.json", sha256: sha256(openapi) },
        errorCodes: { path: "error-codes.json", sha256: sha256(errorCodes) },
        summaryFixtures: { path: "summary-fixtures.json", sha256: sha256(summaryFixtures) },
      },
    }
    writeFileSync(path.join(incoming, "manifest.json"), JSON.stringify(manifest))

    const result = spawnSync(process.execPath, ["-e", heredoc[1]], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        MANIFEST_SHA256: sha256(readFileSync(path.join(incoming, "manifest.json"))),
        OPENAPI_SHA256: sha256(openapi),
        ERROR_CODES_SHA256: sha256(errorCodes),
      },
    })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(existsSync(output), false)

    manifest.artifacts.summaryFixtures = null
    writeFileSync(path.join(incoming, "manifest.json"), JSON.stringify(manifest))
    const invalidOutput = path.join(directory, "invalid-github-output")
    writeFileSync(invalidOutput, "keep\n")
    const invalid = spawnSync(process.execPath, ["-e", heredoc[1]], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_OUTPUT: invalidOutput,
        MANIFEST_SHA256: sha256(readFileSync(path.join(incoming, "manifest.json"))),
        OPENAPI_SHA256: sha256(openapi),
        ERROR_CODES_SHA256: sha256(errorCodes),
      },
    })
    assert.notEqual(invalid.status, 0)
    assert.match(invalid.stderr, /manifest summary fixture declaration is invalid/)
    assert.equal(readFileSync(invalidOutput, "utf8"), "keep\n")
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("stale delivery is a successful no-write no-op and Web changes remain narrowly owned", () => {
  const { source, document } = workflow()
  const job = document.jobs.receive
  const freshness = step(job, "Confirm authenticated source and target freshness")
  assert.match(freshness.run, /source_main/)
  assert.match(freshness.run, /target_main/)
  assert.match(freshness.run, /stale=true/)
  assert.equal(step(job, "Confirm initial target main identity").env.WEB_TOKEN, "${{ github.token }}")
  assert.equal(freshness.env.WEB_TOKEN, "${{ github.token }}")
  assert.match(String(step(job, "Create Platform read token").if), /steps\.initial-target\.outputs\.stale == 'false'/)
  assert.match(String(freshness.if), /steps\.initial-target\.outputs\.stale == 'false'/)
  assert.match(String(step(job, "Checkout immutable Web target without persisted credentials").if), /steps\.freshness\.outputs\.stale == 'false'/)
  const prewrite = step(job, "Recheck source and target freshness before Web write token")
  assert.match(prewrite.run, /source_main/)
  assert.equal(prewrite.env.WEB_TOKEN, "${{ github.token }}")
  assert.match(prewrite.run, /current repository SHA is invalid/)
  assert.match(String(step(job, "Create Web write token").if), /steps\.prewrite\.outputs\.stale == 'false'/)
  assert.doesNotMatch(source, /outputs\.stale != 'true'/)
  assert.match(source, /chore\/platform-contract-sync/)
  assert.match(source, /contracts\/platform\/\*\*/)
  assert.match(source, /packages\/shared-contracts\/src\/generated\/backend-openapi\.d\.ts/)
  assert.match(source, /--draft/)
  assert.doesNotMatch(source, /git push --force|--force-with-lease/)
})

test("stable branch, write identity, and Draft PR stay exactly Web-owned", () => {
  const { source, document } = workflow()
  const job = document.jobs.receive
  const commit = step(job, "Commit Web-local contract candidate")
  assert.equal(commit.env.APP_SLUG, "${{ steps.web-token.outputs.app-slug }}")
  assert.match(commit.run, /app_login="\$\{APP_SLUG\}\[bot\]"/)
  assert.match(commit.run, /gh api "\/users\/\$\{app_login\}" --jq \.id/)
  assert.match(commit.run, /EXPECTED_APP_LOGIN/)
  assert.match(commit.run, /\+refs\/heads\/main:refs\/remotes\/origin\/main/)
  assert.match(commit.run, /allowed_path\(\)/)
  assert.match(commit.run, /git diff --name-only origin\/main\.\.\.HEAD/)
  assert.match(commit.run, /git diff --cached --name-only/)
  assert.ok(commit.run.indexOf("git config user.name") < commit.run.indexOf("git merge --no-edit"))
  assert.match(commit.run, /ready=false/)
  assert.match(commit.run, /git rev-parse HEAD/)
  assert.doesNotMatch(source, /gh pr list/)
  const pr = step(job, "Create or update the Web draft PR")
  assert.match(pr.run, /repos\/\$\{WEB_REPOSITORY\}\/pulls\?state=open&head=AquilaXk:\$\{SYNC_BRANCH\}&base=main/)
  assert.match(pr.run, /pr\.head\?\.repo\?\.full_name !== "AquilaXk\/aquila-blog-web"/)
  assert.match(String(pr.if), /steps\.commit\.outputs\.ready == 'true'/)
  assert.match(pr.run, /\[Chore\] Sync Platform public contract/)
  for (const section of ["## Verified delivery", "## SHA-256", "## Generated scope", "## Verification"]) assert.ok(pr.run.includes(section))
})

test("a fresh unchanged candidate only opens the scoped stale-Draft-PR lifecycle when one exact PR exists", () => {
  const { source, document } = workflow()
  const job = document.jobs.receive
  assert.equal(document.permissions["pull-requests"], "read")
  const discovery = job.steps.find((candidate) => candidate.id === "existing-pr")
  assert.ok(discovery, "the receiver must discover an exact existing Draft PR before creating a Web write token")
  assert.equal(discovery.env.WEB_TOKEN, "${{ github.token }}")
  assert.match(discovery.run, /repos\/\$\{WEB_REPOSITORY\}\/pulls\?state=open&head=AquilaXk:\$\{SYNC_BRANCH\}&base=main/)
  assert.match(discovery.run, /pr\.head\?\.repo\?\.full_name !== "AquilaXk\/aquila-blog-web"/)
  assert.match(discovery.run, /pr\.draft/)
  assert.match(discovery.run, /pr\.base\?\.ref !== "main"/)
  assert.match(discovery.run, /exists=false/)
  assert.match(discovery.run, /exists=true/)

  const writeToken = step(job, "Create Web write token")
  assert.match(String(writeToken.if), /steps\.changes\.outputs\.changed == 'true'/)
  assert.match(String(writeToken.if), /steps\.existing-pr\.outputs\.exists == 'true'/)
  const close = job.steps.find((candidate) => candidate.id === "close-stale-pr")
  assert.ok(close, "only an existing stale Draft PR may enter the close path")
  assert.match(String(close.if), /steps\.changes\.outputs\.changed == 'false'/)
  assert.match(String(close.if), /steps\.existing-pr\.outputs\.exists == 'true'/)
  assert.match(close.run, /pr\.state === "closed"/)
  assert.doesNotMatch(source, /git branch -[dD]|git reset|git push[^\n]*(?:--force|--force-with-lease)/)
})

function detectChanges(run, candidate, current) {
  const directory = mkdtempSync(path.join(tmpdir(), "web-contract-change-"))
  try {
    for (const file of [
      ".contract-candidate/platform/openapi.json",
      ".contract-candidate/platform/error-codes.json",
      ".contract-candidate/platform/summary-fixtures.json",
      ".contract-candidate/platform/manifest.lock.json",
      ".contract-candidate/generated/backend-openapi.d.ts",
      "contracts/platform/openapi.json",
      "contracts/platform/error-codes.json",
      "contracts/platform/summary-fixtures.json",
      "contracts/platform/manifest.lock.json",
      "packages/shared-contracts/src/generated/backend-openapi.d.ts",
    ]) mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
    for (const [file, value] of Object.entries(candidate)) writeFileSync(path.join(directory, file), value)
    for (const [file, value] of Object.entries(current)) writeFileSync(path.join(directory, file), value)
    const output = path.join(directory, "output")
    const result = spawnSync("bash", ["-c", run], { cwd: directory, encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: output } })
    assert.equal(result.status, 0, result.stderr)
    return readFileSync(output, "utf8").trim()
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("sourceCommit-only manifest provenance changes are a Web receiver no-op", () => {
  const { document } = workflow()
  const detect = step(document.jobs.receive, "Detect Web-local contract changes")
  assert.match(detect.run, /require\("node:util"\)/)
  assert.match(detect.run, /isDeepStrictEqual/)
  assert.match(detect.run, /delete candidate\.sourceCommit/)
  assert.match(detect.run, /delete current\.sourceCommit/)
  assert.match(detect.run, /\.contract-candidate\/platform\/manifest\.lock\.json/)
  assert.match(detect.run, /contracts\/platform\/manifest\.lock\.json/)
  assert.match(detect.run, /openapi\.json/)
  assert.match(detect.run, /error-codes\.json/)
  assert.match(detect.run, /backend-openapi\.d\.ts/)

  const current = {
    "contracts/platform/openapi.json": "{\"openapi\":\"3.1.0\"}\n",
    "contracts/platform/error-codes.json": "{\"errors\":[]}\n",
    "contracts/platform/summary-fixtures.json": "{\"fixture\":\"same\"}\n",
    "contracts/platform/manifest.lock.json": "{\"sourceCommit\":\"a\",\"artifacts\":{\"open_api\":{\"sha256\":\"same\"}}}\n",
    "packages/shared-contracts/src/generated/backend-openapi.d.ts": "export type paths = {}\n",
  }
  const onlySourceCommitChanged = {
    ".contract-candidate/platform/openapi.json": current["contracts/platform/openapi.json"],
    ".contract-candidate/platform/error-codes.json": current["contracts/platform/error-codes.json"],
    ".contract-candidate/platform/summary-fixtures.json": current["contracts/platform/summary-fixtures.json"],
    ".contract-candidate/platform/manifest.lock.json": "{\"sourceCommit\":\"b\",\"artifacts\":{\"open_api\":{\"sha256\":\"same\"}}}\n",
    ".contract-candidate/generated/backend-openapi.d.ts": current["packages/shared-contracts/src/generated/backend-openapi.d.ts"],
  }
  assert.equal(detectChanges(detect.run, onlySourceCommitChanged, current), "changed=false")

  const openApiHashChanged = {
    ...onlySourceCommitChanged,
    ".contract-candidate/platform/manifest.lock.json": "{\"sourceCommit\":\"b\",\"artifacts\":{\"open_api\":{\"sha256\":\"changed\"}}}\n",
  }
  assert.equal(detectChanges(detect.run, openApiHashChanged, current), "changed=true")
  assert.equal(detectChanges(detect.run, { ...onlySourceCommitChanged, ".contract-candidate/platform/openapi.json": "{\"openapi\":\"3.1.1\"}\n" }, current), "changed=true")
  assert.equal(detectChanges(detect.run, { ...onlySourceCommitChanged, ".contract-candidate/generated/backend-openapi.d.ts": "export type paths = { changed: true }\n" }, current), "changed=true")
})

test("generated Draft PR metadata records only signed delivery identity and generated paths", () => {
  const { document } = workflow()
  const detect = step(document.jobs.receive, "Detect Web-local contract changes")
  const commit = step(document.jobs.receive, "Commit Web-local contract candidate")
  const pr = step(document.jobs.receive, "Create or update the Web draft PR")

  assert.match(detect.run, /summary-fixtures\.json/)
  assert.doesNotMatch(detect.run, /candidate presence/)
  assert.doesNotMatch(commit.run, /rm -f contracts\/platform\/summary-fixtures\.json/)
  assert.match(commit.run, /git add -A -- contracts\/platform/)
  assert.equal(pr.env.SOURCE_REPOSITORY, "${{ steps.delivery.outputs.source_repository }}")
  assert.equal(pr.env.SOURCE_COMMIT, "${{ steps.delivery.outputs.source_commit }}")
  assert.equal(pr.env.DELIVERY_ID, "${{ steps.delivery.outputs.delivery_id }}")
  assert.equal(pr.env.MANIFEST_SHA256, "${{ steps.delivery.outputs.manifest_sha256 }}")
  assert.equal(pr.env.OPENAPI_SHA256, "${{ steps.delivery.outputs.openapi_sha256 }}")
  assert.equal(pr.env.ERROR_CODES_SHA256, "${{ steps.delivery.outputs.error_codes_sha256 }}")
  assert.match(pr.run, /https:\/\/github\.com\/\$\{SOURCE_REPOSITORY\}\/commit\/\$\{SOURCE_COMMIT\}/)
  for (const value of ["${DELIVERY_ID}", "${MANIFEST_SHA256}", "${OPENAPI_SHA256}", "${ERROR_CODES_SHA256}"]) assert.ok(pr.run.includes(value))
  for (const generatedPath of ["contracts/platform/**", "packages/shared-contracts/src/generated/backend-openapi.d.ts"]) assert.ok(pr.run.includes(generatedPath))
  for (const staleMetadata of [/Refs #35/, /Platform #1520/, /summary-only/, /transport-only/, /[가-힣]/]) assert.doesNotMatch(pr.run, staleMetadata)
  assert.match(pr.run, /\[Chore\] Sync Platform public contract/)
})
