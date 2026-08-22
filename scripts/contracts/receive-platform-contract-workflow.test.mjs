import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
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
  assert.equal(document.permissions["pull-requests"], undefined)
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

test("receiver reads exactly three immutable Platform bytes before any Web write capability", () => {
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
  assert.doesNotMatch(source, /repository:\s*AquilaXk\/aquila-blog/)
  assert.doesNotMatch(source, /path:\s*platform/)
  assert.doesNotMatch(source, /git -C platform|git clone|actions\/checkout[^\n]*aquila-blog/)

  const writerIndex = job.steps.indexOf(step(job, "Create Web write token"))
  const checkout = step(job, "Checkout immutable Web target without persisted credentials")
  assert.equal(checkout.with.ref, "${{ steps.delivery.outputs.target_commit }}")
  assert.ok(job.steps.indexOf(token) < job.steps.indexOf(checkout), "stale Platform source must avoid checkout/install")
  assert.ok(job.steps.indexOf(fetch) < writerIndex)
  assert.match(String(step(job, "Create Web write token").if), /steps\.changes\.outputs\.changed == 'true'/)
  assert.ok(job.steps.indexOf(step(job, "Set up Node.js 20")) < job.steps.indexOf(step(job, "Build validated Web-local contract candidate")))
  assert.match(step(job, "Install locked Web dependencies").run, /yarn install --frozen-lockfile/)
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
  assert.match(String(step(job, "Create Platform read token").if), /steps\.initial-target\.outputs\.stale != 'true'/)
  const prewrite = step(job, "Recheck source and target freshness before Web write token")
  assert.match(prewrite.run, /source_main/)
  assert.equal(prewrite.env.WEB_TOKEN, "${{ github.token }}")
  assert.match(prewrite.run, /current repository SHA is invalid/)
  assert.match(String(step(job, "Create Web write token").if), /steps\.prewrite\.outputs\.stale != 'true'/)
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
  assert.match(pr.run, /\[Chore\] sync Platform public contract/)
  for (const section of ["## Related Issue", "## Verification", "## Risk & Delivery", "## Evidence", "## Checklist"]) assert.match(pr.run, new RegExp(section.replace(/[&]/g, "\\&")))
})
