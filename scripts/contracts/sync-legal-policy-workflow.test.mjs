import assert from "node:assert/strict"
import crypto from "node:crypto"
import { chmodSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "../..")
const workflowPath = path.join(root, ".github/workflows/sync-legal-policy-to-platform.yml")
const payloadKeys = [
  "schema_version",
  "source_repository",
  "source_commit",
  "manifest_sha256",
  "target_repository",
  "target_commit",
  "delivery_id",
]

function workflow() {
  assert.equal(existsSync(workflowPath), true, "legal-policy producer workflow must exist")
  const source = readFileSync(workflowPath, "utf8")
  const ruby = ["require 'yaml'", "require 'json'", "puts JSON.generate(YAML.load_file(ARGV.fetch(0)))"].join("; ")
  const parsed = spawnSync("ruby", ["-e", ruby, workflowPath], { encoding: "utf8" })
  assert.equal(parsed.status, 0, parsed.stderr || "workflow YAML must parse")
  return { source, document: JSON.parse(parsed.stdout) }
}

function onlyJob(document) {
  const jobs = Object.values(document.jobs)
  assert.equal(jobs.length, 1, "legal producer must stay a single job")
  return jobs[0]
}

function matchingStep(job, predicate, description) {
  const matches = job.steps.filter(predicate)
  assert.equal(matches.length, 1, `expected one ${description} step`)
  return matches[0]
}

function runShell(source, cwd, env = {}) {
  return spawnSync("bash", ["-c", source], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  })
}

function output(pathname) {
  return existsSync(pathname) ? readFileSync(pathname, "utf8") : ""
}

function values(pathname) {
  return Object.fromEntries(output(pathname).trim().split("\n").filter(Boolean).map((line) => {
    const separator = line.indexOf("=")
    return [line.slice(0, separator), line.slice(separator + 1)]
  }))
}

function fakeGh(temp, response) {
  const bin = path.join(temp, "bin")
  const calls = path.join(temp, "gh-calls")
  mkdirSync(bin, { recursive: true })
  const executable = path.join(bin, "gh")
  writeFileSync(executable, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${calls}"\nprintf '%s\\n' "${response}"\n`)
  chmodSync(executable, 0o755)
  return { calls, path: `${bin}:${process.env.PATH}` }
}

test("automatic delivery and manual validation have one explicit boundary", () => {
  const { document } = workflow()
  const triggers = document.on ?? document.true
  const job = onlyJob(document)
  const context = matchingStep(job, (candidate) => String(candidate.run ?? "").includes("dispatch_enabled="), "producer context")

  assert.deepEqual(triggers.push, { branches: ["main"] })
  assert.equal(Object.hasOwn(triggers.push, "paths"), false, "every main push must produce a replacement delivery run")
  assert.deepEqual(Object.keys(triggers.workflow_dispatch.inputs), ["source_ref"])
  assert.equal(triggers.workflow_dispatch.inputs.source_ref.default, "main")
  assert.deepEqual(document.permissions, { contents: "read" })
  assert.deepEqual(document.concurrency, { group: "web-legal-policy-sync", "cancel-in-progress": false })
  assert.match(String(job.if), /workflow_dispatch/)
  assert.match(String(job.if), /REPO_SPLIT_SYNC_ENABLED/)

  const temp = mkdtempSync(path.join(os.tmpdir(), "web-legal-context-"))
  const manualOutput = path.join(temp, "manual.out")
  const manual = runShell(context.run, temp, {
    EVENT_NAME: "workflow_dispatch",
    EVENT_SHA: "a".repeat(40),
    REQUESTED_SOURCE_REF: "refs/pull/70/head",
    SYNC_ENABLED: "true",
    GITHUB_OUTPUT: manualOutput,
  })
  assert.equal(manual.status, 0, manual.stderr)
  assert.deepEqual(values(manualOutput), { source_ref: "refs/pull/70/head", dispatch_enabled: "false" })

  const pushOutput = path.join(temp, "push.out")
  const push = runShell(context.run, temp, {
    EVENT_NAME: "push",
    EVENT_SHA: "b".repeat(40),
    REQUESTED_SOURCE_REF: "",
    SYNC_ENABLED: "true",
    GITHUB_OUTPUT: pushOutput,
  })
  assert.equal(push.status, 0, push.stderr)
  assert.deepEqual(values(pushOutput), { source_ref: "b".repeat(40), dispatch_enabled: "true" })
})

test("Web source and canonical manifest identity fail closed on real bytes", () => {
  const { document } = workflow()
  const job = onlyJob(document)
  const sourceStep = matchingStep(job, (candidate) => String(candidate.run ?? "").includes("git -C web rev-parse HEAD"), "source identity")
  const exportStep = matchingStep(job, (candidate) => String(candidate.run ?? "").includes("export-policy-manifest.mjs --check"), "canonical export")
  const hashStep = matchingStep(job, (candidate) => String(candidate.run ?? "").includes("createHash(\"sha256\")"), "manifest hash")
  const temp = mkdtempSync(path.join(os.tmpdir(), "web-legal-source-"))
  const web = path.join(temp, "web")
  mkdirSync(path.join(web, "contracts/export"), { recursive: true })
  assert.equal(runShell("git init -q && git config user.email test@example.com && git config user.name test && git commit --allow-empty -qm source", web).status, 0)
  const sourceSha = runShell("git rev-parse HEAD", web).stdout.trim()

  const manualOutput = path.join(temp, "source-manual.out")
  const manual = runShell(sourceStep.run, temp, {
    DISPATCH_ENABLED: "false",
    EVENT_SHA: "f".repeat(40),
    SOURCE_REF: "refs/pull/70/head",
    GITHUB_OUTPUT: manualOutput,
  })
  assert.equal(manual.status, 0, manual.stderr)
  assert.equal(values(manualOutput).source_commit, sourceSha)

  const mismatchedPush = runShell(sourceStep.run, temp, {
    DISPATCH_ENABLED: "true",
    EVENT_SHA: "f".repeat(40),
    SOURCE_REF: "f".repeat(40),
    GITHUB_OUTPUT: path.join(temp, "source-push.out"),
  })
  assert.notEqual(mismatchedPush.status, 0, "automatic delivery must use the exact push commit")

  assert.match(exportStep.run, /node scripts\/legal\/export-policy-manifest\.mjs --check/)
  const manifest = Buffer.from('{"contract":"aquila-public-legal-policies"}\n')
  writeFileSync(path.join(web, "contracts/export/legal-policy-manifest.json"), manifest)
  const hashOutput = path.join(temp, "hash.out")
  const hashed = runShell(hashStep.run, web, { GITHUB_OUTPUT: hashOutput })
  assert.equal(hashed.status, 0, hashed.stderr)
  assert.equal(values(hashOutput).manifest_sha256, crypto.createHash("sha256").update(manifest).digest("hex"))
})

test("stale Web main is a successful no-op before the scoped Platform token", () => {
  const { document } = workflow()
  const job = onlyJob(document)
  const freshness = matchingStep(job, (candidate) => {
    const run = String(candidate.run ?? "")
    return run.includes("commits/main") && run.includes("should_dispatch=")
  }, "Web main freshness")
  const token = matchingStep(job, (candidate) => String(candidate.uses ?? "").startsWith("actions/create-github-app-token@"), "Platform dispatch token")
  const temp = mkdtempSync(path.join(os.tmpdir(), "web-legal-freshness-"))
  const current = "a".repeat(40)
  const gh = fakeGh(temp, current)

  const freshOutput = path.join(temp, "fresh.out")
  const fresh = runShell(freshness.run, temp, {
    PATH: gh.path,
    SOURCE_COMMIT: current,
    SOURCE_REPOSITORY: "AquilaXk/aquila-blog-web",
    GITHUB_OUTPUT: freshOutput,
    GITHUB_STEP_SUMMARY: path.join(temp, "fresh.summary"),
  })
  assert.equal(fresh.status, 0, fresh.stderr)
  assert.equal(values(freshOutput).should_dispatch, "true")

  const staleOutput = path.join(temp, "stale.out")
  const stale = runShell(freshness.run, temp, {
    PATH: gh.path,
    SOURCE_COMMIT: "b".repeat(40),
    SOURCE_REPOSITORY: "AquilaXk/aquila-blog-web",
    GITHUB_OUTPUT: staleOutput,
    GITHUB_STEP_SUMMARY: path.join(temp, "stale.summary"),
  })
  assert.equal(stale.status, 0, stale.stderr)
  assert.equal(values(staleOutput).should_dispatch, "false")

  assert.equal(token.with.repositories.trim(), "aquila-blog")
  assert.equal(token.with["permission-contents"], "write")
  assert.equal(token.with["permission-pull-requests"], undefined)
  assert.match(String(token.if), /should_dispatch == 'true'/)
  assert.ok(job.steps.indexOf(freshness) < job.steps.indexOf(token))
})

test("delivery uses the frozen seven-key payload and raw-value delivery hash", () => {
  const { document } = workflow()
  const job = onlyJob(document)
  const prepare = matchingStep(job, (candidate) => {
    const run = String(candidate.run ?? "")
    return run.includes("commits/main") && run.includes("delivery_id=")
  }, "delivery preparation")
  const dispatch = matchingStep(job, (candidate) => String(candidate.run ?? "").includes("/dispatches"), "repository dispatch")
  const temp = mkdtempSync(path.join(os.tmpdir(), "web-legal-delivery-"))
  const targetCommit = "c".repeat(40)
  const fixture = {
    SCHEMA_VERSION: "1",
    SOURCE_REPOSITORY: "AquilaXk/aquila-blog-web",
    SOURCE_COMMIT: "a".repeat(40),
    MANIFEST_SHA256: "b".repeat(64),
    TARGET_REPOSITORY: "AquilaXk/aquila-blog",
  }
  const gh = fakeGh(temp, targetCommit)
  const preparedOutput = path.join(temp, "prepared.out")
  const prepared = runShell(prepare.run, temp, {
    ...fixture,
    PATH: gh.path,
    GITHUB_OUTPUT: preparedOutput,
  })
  assert.equal(prepared.status, 0, prepared.stderr)
  const preparedValues = values(preparedOutput)
  const expectedDeliveryId = crypto.createHash("sha256").update([
    fixture.SCHEMA_VERSION,
    fixture.SOURCE_REPOSITORY,
    fixture.SOURCE_COMMIT,
    fixture.MANIFEST_SHA256,
    fixture.TARGET_REPOSITORY,
    targetCommit,
    "",
  ].join("\n")).digest("hex")
  assert.deepEqual(preparedValues, { target_commit: targetCommit, delivery_id: expectedDeliveryId })

  const malformedGh = fakeGh(mkdtempSync(path.join(os.tmpdir(), "web-legal-bad-target-")), "not-a-commit")
  const malformed = runShell(prepare.run, temp, {
    ...fixture,
    PATH: malformedGh.path,
    GITHUB_OUTPUT: path.join(temp, "malformed.out"),
  })
  assert.notEqual(malformed.status, 0, "invalid Platform main identity must fail closed")

  const fields = [...dispatch.run.matchAll(/client_payload\[([^\]]+)\]/g)].map((match) => match[1])
  assert.deepEqual(fields, payloadKeys)
  assert.match(dispatch.run, /event_type="web_legal_policy_ready"/)
  assert.equal((dispatch.run.match(/gh api --method POST/g) ?? []).length, 1)
})

test("producer has one dispatch mutation and no foreign Platform write path", () => {
  const { document, source } = workflow()
  const job = onlyJob(document)
  const checkouts = job.steps.filter((candidate) => String(candidate.uses ?? "").startsWith("actions/checkout@"))

  assert.equal(checkouts.length, 1)
  assert.equal(checkouts[0].with?.repository, undefined)
  assert.equal(checkouts[0].with?.["persist-credentials"], false)
  assert.equal((source.match(/gh api --method POST/g) ?? []).length, 1)
  assert.doesNotMatch(source, /SYNC_BRANCH|working-directory:\s*platform|git -C platform|gh auth setup-git|git push|gh pr (?:list|create|edit|close)|import-web-policy-manifest|check-web-policy-lock|contracts\/web\/legal-policy-manifest\.lock|permission-pull-requests/)
  assert.doesNotMatch(source, /repository:\s*AquilaXk\/aquila-blog/)
})

test("canonical export rejects a policy body with a stale content hash", () => {
  const { document } = workflow()
  const exportStep = matchingStep(onlyJob(document), (candidate) => String(candidate.run ?? "").includes("export-policy-manifest.mjs --check"), "canonical export")
  const web = path.join(mkdtempSync(path.join(os.tmpdir(), "web-policy-sync-hash-mismatch-")), "web")

  cpSync(path.join(root, "legal/policies"), path.join(web, "legal/policies"), { recursive: true })
  cpSync(path.join(root, "scripts/legal"), path.join(web, "scripts/legal"), { recursive: true })
  mkdirSync(path.join(web, "contracts/export"), { recursive: true })
  mkdirSync(path.join(web, "src/apis/backend"), { recursive: true })
  writeFileSync(path.join(web, "contracts/export/legal-policy-manifest.json"), readFileSync(path.join(root, "contracts/export/legal-policy-manifest.json")))
  writeFileSync(path.join(web, "src/apis/backend/legal.ts"), readFileSync(path.join(root, "src/apis/backend/legal.ts")))

  const valid = runShell(exportStep.run, web)
  assert.equal(valid.status, 0, valid.stderr)
  const policyPath = path.join(web, "legal/policies/terms.ko-KR.v1.0.0.yaml")
  const corrupted = JSON.parse(readFileSync(policyPath, "utf8"))
  corrupted.sections[0].body[0] += " hash mismatch mutation"
  writeFileSync(policyPath, `${JSON.stringify(corrupted, null, 2)}\n`)
  const rejected = runShell(exportStep.run, web)
  assert.notEqual(rejected.status, 0)
  assert.match(rejected.stderr, /contentSha256 mismatch/)
})

test("Web core CI runs the legal producer contract test", () => {
  const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8")
  assert.match(ci, /node --test scripts\/contracts\/sync-legal-policy-workflow\.test\.mjs/)
})
