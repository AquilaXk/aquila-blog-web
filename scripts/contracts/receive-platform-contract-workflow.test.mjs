import assert from "node:assert/strict"
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"
import { execFileSync, spawnSync } from "node:child_process"
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
  assert.deepEqual(document.permissions, { contents: "read" })
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

  const writeToken = step(job, "Create Web write token")
  const writerIndex = job.steps.indexOf(writeToken)
  const checkout = step(job, "Checkout immutable Web target without persisted credentials")
  assert.equal(checkout.with.ref, "${{ steps.delivery.outputs.target_commit }}")
  assert.equal(checkout.with["fetch-depth"], 1, "direct fast-forward push needs only target commit")
  assert.ok(job.steps.indexOf(token) < job.steps.indexOf(checkout), "stale Platform source must avoid checkout/install")
  assert.ok(job.steps.indexOf(fetch) < writerIndex)
  assert.equal(writeToken.with["permission-contents"], "write")
  assert.equal(writeToken.with["permission-pull-requests"], undefined)
  assert.match(String(writeToken.if), /steps\.changes\.outputs\.changed == 'true'/)
  assert.match(String(writeToken.if), /steps\.prewrite\.outputs\.stale == 'false'/)
  assert.doesNotMatch(String(writeToken.if), /existing-pr/)
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
  assert.equal(document.env.SYNC_BRANCH, undefined)
  for (const retiredStep of [
    "Discover exact existing Web Draft PR",
    "Commit Web-local contract candidate",
    "Close stale Web Draft PR",
    "Create or update the Web draft PR",
  ]) {
    assert.equal(job.steps.find((candidate) => candidate.name === retiredStep), undefined)
  }
  assert.doesNotMatch(
    source,
    /pull-requests|permission-pull-requests|SYNC_BRANCH|chore\/platform-contract-sync|gh pr|--draft|git add -A|git merge|git checkout -B|git branch -[dD]|git reset|git push[^\n]*(?:--force|--force-with-lease)/,
  )
})

function runDirectMainSync(overrides = {}) {
  const { document } = workflow()
  const commit = step(document.jobs.receive, "Commit and push synced Web contract to main")
  const directory = mkdtempSync(path.join(tmpdir(), "web-contract-sync-push-"))
  const remote = path.join(directory, "remote.git")
  const work = path.join(directory, "work")
  const bin = path.join(directory, "bin")
  const output = path.join(directory, "github-output")
  const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
  try {
    mkdirSync(remote)
    git(remote, ["init", "--bare", "--initial-branch=main"])
    mkdirSync(work)
    git(work, ["init", "--initial-branch=main"])
    git(work, ["config", "user.email", "seed@example.com"])
    git(work, ["config", "user.name", "Seed"])
    for (const file of [
      "contracts/platform/openapi.json",
      "contracts/platform/error-codes.json",
      "contracts/platform/summary-fixtures.json",
      "contracts/platform/manifest.lock.json",
      "packages/shared-contracts/src/generated/backend-openapi.d.ts",
    ]) {
      mkdirSync(path.dirname(path.join(work, file)), { recursive: true })
      writeFileSync(path.join(work, file), "initial\n")
    }
    git(work, ["add", "contracts/platform", "packages/shared-contracts/src/generated/backend-openapi.d.ts"])
    git(work, ["commit", "-m", "initial"])
    git(work, ["remote", "add", "origin", remote])
    git(work, ["push", "origin", "HEAD:refs/heads/main"])
    const initialSha = git(work, ["rev-parse", "HEAD"])
    git(work, ["checkout", "--detach", initialSha])

    for (const [file, content] of [
      [".contract-candidate/platform/openapi.json", "updated-openapi\n"],
      [".contract-candidate/platform/error-codes.json", "updated-errors\n"],
      [".contract-candidate/platform/summary-fixtures.json", "updated-fixtures\n"],
      [".contract-candidate/platform/manifest.lock.json", "updated-lock\n"],
      [".contract-candidate/generated/backend-openapi.d.ts", "export type updated = true\n"],
    ]) {
      mkdirSync(path.dirname(path.join(work, file)), { recursive: true })
      writeFileSync(path.join(work, file), content)
    }

    mkdirSync(bin)
    const sourceCommit = overrides.sourceCommit ?? "a".repeat(40)
    const targetCommit = overrides.targetCommit ?? initialSha
    const liveSourceMain = overrides.liveSourceMain ?? sourceCommit
    const liveTargetMain = overrides.liveTargetMain ?? targetCommit
    writeFileSync(path.join(bin, "gh"), `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "auth" ] && [ "\${2:-}" = "setup-git" ]; then exit 0; fi
if [ "\${1:-}" = "api" ]; then
  case "\${2:-}" in
    /users/aquila-repo-sync\\[bot\\]) echo "424242" ;;
    repos/AquilaXk/aquila-blog/git/ref/heads/main) echo "${liveSourceMain}" ;;
    repos/AquilaXk/aquila-blog-web/git/ref/heads/main) echo "${liveTargetMain}" ;;
    *) echo "unexpected gh api: $*" >&2; exit 1 ;;
  esac
  exit 0
fi
exit 1
`)
    writeFileSync(path.join(bin, "yarn"), `#!/usr/bin/env bash
set -euo pipefail
case "\${1:-}" in
  contracts:check) exit ${overrides.contractsCheckExit ?? 0} ;;
  type-check) exit ${overrides.typeCheckExit ?? 0} ;;
  *) echo "unexpected yarn arg: $*" >&2; exit 1 ;;
esac
`)
    chmodSync(path.join(bin, "gh"), 0o755)
    chmodSync(path.join(bin, "yarn"), 0o755)
    writeFileSync(output, "")

    const result = spawnSync("bash", ["-c", commit.run], {
      cwd: work,
      encoding: "utf8",
      env: {
        ...process.env,
        PLATFORM_REPOSITORY: "AquilaXk/aquila-blog",
        WEB_REPOSITORY: "AquilaXk/aquila-blog-web",
        GH_TOKEN: "web-write-token",
        WEB_TOKEN: "web-write-token",
        PLATFORM_TOKEN: "platform-read-token",
        SOURCE_COMMIT: sourceCommit,
        TARGET_COMMIT: targetCommit,
        EXPECTED_APP_LOGIN: "aquila-repo-sync[bot]",
        APP_SLUG: "aquila-repo-sync",
        GITHUB_OUTPUT: output,
        PATH: `${bin}:${process.env.PATH}`,
      },
    })
    const remoteMainAfter = git(remote, ["rev-parse", "refs/heads/main"])
    const remoteFiles = git(remote, ["show", "--name-only", "--format=%s", remoteMainAfter])
    return { ...result, initialSha, remoteMainAfter, remoteFiles, output: readFileSync(output, "utf8") }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("direct main sync verifies contracts:check, type-check, allowed paths, and fast-forward pushes", () => {
  const { document } = workflow()
  const detect = step(document.jobs.receive, "Detect Web-local contract changes")
  const commit = step(document.jobs.receive, "Commit and push synced Web contract to main")

  assert.match(detect.run, /summary-fixtures\.json/)
  assert.doesNotMatch(detect.run, /candidate presence/)
  assert.match(String(commit.if), /steps\.freshness\.outputs\.stale == 'false'/)
  assert.match(String(commit.if), /steps\.changes\.outputs\.changed == 'true'/)
  assert.match(String(commit.if), /steps\.prewrite\.outputs\.stale == 'false'/)
  assert.equal(commit.env.APP_SLUG, "${{ steps.web-token.outputs.app-slug }}")
  assert.equal(commit.env.TARGET_COMMIT, "${{ steps.delivery.outputs.target_commit }}")
  assert.match(commit.run, /git add -- contracts\/platform\/openapi\.json contracts\/platform\/error-codes\.json contracts\/platform\/summary-fixtures\.json contracts\/platform\/manifest\.lock\.json packages\/shared-contracts\/src\/generated\/backend-openapi\.d\.ts/)
  assert.match(commit.run, /yarn contracts:check/)
  assert.match(commit.run, /yarn type-check/)
  assert.match(commit.run, /\[Chore\] 플랫폼 공개 API 계약 동기화 \(\$\{SOURCE_COMMIT:0:12\}\)/)
  assert.match(commit.run, /git push origin HEAD:refs\/heads\/main/)

  const failedContract = runDirectMainSync({ contractsCheckExit: 1 })
  assert.notEqual(failedContract.status, 0)
  assert.equal(failedContract.remoteMainAfter, failedContract.initialSha)

  const failedTypes = runDirectMainSync({ typeCheckExit: 1 })
  assert.notEqual(failedTypes.status, 0)
  assert.equal(failedTypes.remoteMainAfter, failedTypes.initialSha)

  const staleBeforePush = runDirectMainSync({ liveTargetMain: "b".repeat(40) })
  assert.equal(staleBeforePush.status, 0, staleBeforePush.stderr)
  assert.match(staleBeforePush.output, /stale=true/)
  assert.equal(staleBeforePush.remoteMainAfter, staleBeforePush.initialSha)

  const synced = runDirectMainSync()
  assert.equal(synced.status, 0, synced.stderr)
  assert.notEqual(synced.remoteMainAfter, synced.initialSha)
  assert.match(synced.remoteFiles, /^\[Chore\] 플랫폼 공개 API 계약 동기화 \(aaaaaaaaaaaa\)$/m)
  for (const file of [
    "contracts/platform/openapi.json",
    "contracts/platform/error-codes.json",
    "contracts/platform/summary-fixtures.json",
    "contracts/platform/manifest.lock.json",
    "packages/shared-contracts/src/generated/backend-openapi.d.ts",
  ]) {
    assert.match(synced.remoteFiles, new RegExp(`^${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"))
  }
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
