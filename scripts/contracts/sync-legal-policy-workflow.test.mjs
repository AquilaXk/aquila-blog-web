import assert from "node:assert/strict"
import crypto from "node:crypto"
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "../..")
const workflowPath = path.join(root, ".github/workflows/sync-legal-policy-to-platform.yml")

function workflow() {
  assert.equal(existsSync(workflowPath), true, "sync workflow must exist")
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

function policy(content) {
  const value = { documentType: "test", contentSha256: "", content }
  value.contentSha256 = crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")
  return value
}

function manifestFor(policies) {
  return {
    version: 1,
    contract: "aquila-public-legal-policies",
    active: Object.fromEntries(Object.entries(policies).map(([name, value]) => [name, { version: "1.0.0", contentSha256: value.contentSha256 }])),
  }
}

test("legal sync trigger, branch, and concurrency stay singular", () => {
  const { source, document } = workflow()
  const validator = readFileSync(path.join(root, "scripts/legal/validate-public-policies.mjs"), "utf8")

  for (const expectedPath of [
    "legal/policies/**",
    "legal/schemas/**",
    "scripts/legal/**",
    "contracts/export/legal-policy-manifest.json",
    "src/apis/backend/legal.ts",
  ]) assert.equal(source.includes(`- "${expectedPath}"`), true, `missing trigger path ${expectedPath}`)
  assert.match(validator, /path\.join\(root, "src\/apis\/backend\/legal\.ts"\)/)
  assert.match(source, /^  workflow_dispatch:\n    inputs:\n      source_ref:/m)
  assert.match(source, /^      mode:\n[\s\S]*?default: test-only[\s\S]*?options:\n          - test-only\n          - sync/m)
  assert.deepEqual(document.concurrency, { group: "web-legal-policy-sync", "cancel-in-progress": false })
  assert.equal(document.env.SYNC_BRANCH, "chore/web-policy-sync")
  assert.equal(document.env.WEB_REPOSITORY, "AquilaXk/aquila-blog-web")
  assert.equal(document.env.PLATFORM_REPOSITORY, "AquilaXk/aquila-blog")
})

test("automatic runs no-op before the kill switch while manual test-only remains read-only", () => {
  const { source, document } = workflow()
  const job = document.jobs.sync
  const context = step(job, "Resolve sync context")

  assert.match(String(job.if), /github\.event_name == 'workflow_dispatch'/)
  assert.match(String(job.if), /vars\.REPO_SPLIT_SYNC_ENABLED == 'true'/)
  assert.equal(context.env.SYNC_ENABLED, "${{ vars.REPO_SPLIT_SYNC_ENABLED }}")
  assert.match(context.run, /sync mode requires REPO_SPLIT_SYNC_ENABLED=true/)
  assert.match(context.run, /write_enabled=false/)
  assert.match(context.run, /source_ref must be one non-empty line/)
  assert.doesNotMatch(context.run, /git push|gh pr (?:create|edit)/)
  assert.doesNotMatch(source, /skip-token-revoke|GITHUB_TOKEN/)
})

test("context, hash, and canonical change shell steps fail closed on their real inputs", () => {
  const { document } = workflow()
  const job = document.jobs.sync
  const temp = mkdtempSync(path.join(os.tmpdir(), "web-policy-sync-workflow-"))

  const contextOutput = path.join(temp, "context.out")
  const context = step(job, "Resolve sync context")
  const denied = runShell(context.run, temp, {
    EVENT_NAME: "workflow_dispatch",
    REQUESTED_SOURCE_REF: "main",
    REQUESTED_MODE: "sync",
    SYNC_ENABLED: "false",
    GITHUB_OUTPUT: contextOutput,
  })
  assert.notEqual(denied.status, 0)
  const testOnly = runShell(context.run, temp, {
    EVENT_NAME: "workflow_dispatch",
    REQUESTED_SOURCE_REF: "main",
    REQUESTED_MODE: "test-only",
    SYNC_ENABLED: "false",
    GITHUB_OUTPUT: contextOutput,
  })
  assert.equal(testOnly.status, 0, testOnly.stderr)
  assert.match(output(contextOutput), /write_enabled=false/)

  const web = path.join(temp, "web")
  mkdirSync(path.join(web, "legal/policies"), { recursive: true })
  mkdirSync(path.join(web, "contracts/export"), { recursive: true })
  const policies = Object.fromEntries(["terms", "privacy", "cookies"].map((name) => [name, policy(name)]))
  for (const [name, value] of Object.entries(policies)) writeFileSync(path.join(web, `legal/policies/${name}.ko-KR.v1.0.0.yaml`), JSON.stringify(value))
  const manifest = manifestFor(policies)
  writeFileSync(path.join(web, "contracts/export/legal-policy-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  const hashOutput = path.join(temp, "hash.out")
  const hashStep = step(job, "Record canonical legal manifest SHA-256")
  const validHash = runShell(hashStep.run, web, { GITHUB_OUTPUT: hashOutput })
  assert.equal(validHash.status, 0, validHash.stderr)
  assert.match(output(hashOutput), /manifest_sha256=[a-f0-9]{64}/)

  const checker = step(job, "Verify current Platform legal lock")
  const changes = step(job, "Detect canonical policy changes")
  assert.ok(job.steps.indexOf(checker) < job.steps.indexOf(step(job, "Import Web policy manifest into Platform fixture")))
  const platform = path.join(temp, "platform")
  mkdirSync(path.join(platform, "contracts/web"), { recursive: true })
  assert.equal(runShell("git init -q && git config user.email test@example.com && git config user.name test", platform).status, 0)
  const lock = { ...manifestFor(policies), sourceRepository: "AquilaXk/aquila-blog-web", sourceCommit: "a".repeat(40) }
  lock.manifestSha256 = crypto.createHash("sha256").update(`${JSON.stringify(manifestFor(policies), null, 2)}\n`).digest("hex")
  const lockPath = path.join(platform, "contracts/web/legal-policy-manifest.lock.json")
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
  mkdirSync(path.join(platform, "tools/contracts"), { recursive: true })
  writeFileSync(path.join(platform, "tools/contracts/check-web-policy-lock.mjs"), "process.exit(0)\n")
  const checked = runShell(checker.run, platform, { GITHUB_OUTPUT: path.join(temp, "current-lock.out") })
  assert.equal(checked.status, 0, checked.stderr)
  assert.equal(runShell("git add contracts && git commit -qm baseline", platform).status, 0)
  const sameOutput = path.join(temp, "same.out")
  lock.sourceCommit = "b".repeat(40)
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
  const same = runShell(changes.run, temp, {
    GITHUB_OUTPUT: sameOutput,
    CURRENT_MANIFEST_SHA256: lock.manifestSha256,
    STABLE_MANIFEST_SHA256: lock.manifestSha256,
  })
  assert.equal(same.status, 0, same.stderr)
  assert.match(output(sameOutput), /^changed=false$/m)
  assert.match(output(sameOutput), /^main_changed=false$/m)
  assert.match(output(sameOutput), /^branch_changed=false$/m)
  assert.match(output(sameOutput), /^sync_required=false$/m)
  lock.manifestSha256 = "b".repeat(64)
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
  const changedOutput = path.join(temp, "changed.out")
  const changed = runShell(changes.run, temp, {
    GITHUB_OUTPUT: changedOutput,
    CURRENT_MANIFEST_SHA256: "c".repeat(64),
    STABLE_MANIFEST_SHA256: "c".repeat(64),
  })
  assert.equal(changed.status, 0, changed.stderr)
  assert.match(output(changedOutput), /^changed=true$/m)
  assert.match(output(changedOutput), /^main_changed=true$/m)
  assert.match(output(changedOutput), /^branch_changed=true$/m)
  assert.match(output(changedOutput), /^sync_required=true$/m)
})

test("canonical export, hash verification, and Platform import fail closed", () => {
  const { document } = workflow()
  const job = document.jobs.sync
  const sourceCheckout = step(job, "Checkout immutable Web source")
  const platformCheckout = step(job, "Checkout Platform main without persisted credentials")
  for (const checkout of [sourceCheckout, platformCheckout]) {
    assert.match(checkout.uses, /^actions\/checkout@[a-f0-9]{40}$/)
    assert.equal(checkout.with["persist-credentials"], false)
  }
  assert.equal(platformCheckout.with.repository, "AquilaXk/aquila-blog")
  assert.equal(platformCheckout.with.ref, "main")
  assert.equal(sourceCheckout.with.ref, "${{ steps.context.outputs.source_ref }}")
  const sourceStep = step(job, "Resolve immutable Web commit")
  assert.equal(sourceStep.env.SOURCE_REF, "${{ steps.context.outputs.source_ref }}")
  assert.match(sourceStep.run, /git -C web rev-parse HEAD/)
  assert.match(sourceStep.run, /git -C web rev-parse --is-shallow-repository/)
  assert.match(sourceStep.run, /\+refs\/heads\/main:refs\/remotes\/origin\/main/)
  assert.doesNotMatch(sourceStep.run, /\$\{\{\s*steps\.context\.outputs\.source_ref/)

  const exportStep = step(job, "Export and verify canonical legal manifest")
  assert.match(exportStep.run, /node scripts\/legal\/export-policy-manifest\.mjs --check/)
  const hashStep = step(job, "Record canonical legal manifest SHA-256")
  assert.ok(job.steps.indexOf(exportStep) < job.steps.indexOf(hashStep))
  assert.match(hashStep.run, /createHash\("sha256"\)\.update\(manifestBytes\)/)
  assert.match(hashStep.run, /sha256sum contracts\/export\/legal-policy-manifest\.json/)
  assert.doesNotMatch(hashStep.run, /JSON\.parse|legal\/policies/)
  const importStep = step(job, "Import Web policy manifest into Platform fixture")
  assert.match(importStep.run, /import-web-policy-manifest\.mjs/)
  assert.match(importStep.run, /--source-repository "\$\{WEB_REPOSITORY\}"/)
  assert.match(importStep.run, /--source-commit "\$\{SOURCE_SHA\}"/)
  assert.doesNotMatch(importStep.run, /allow-monorepo-source/)
})

test("manual test-only accepts arbitrary refs while sync rejects commits outside Web main", () => {
  const { document } = workflow()
  const sourceStep = step(document.jobs.sync, "Resolve immutable Web commit")
  const temp = mkdtempSync(path.join(os.tmpdir(), "web-policy-sync-trusted-source-"))
  const origin = path.join(temp, "origin.git")
  const main = path.join(temp, "main")
  const untrusted = path.join(temp, "untrusted")
  const web = path.join(temp, "web")

  assert.equal(runShell(`git init -q --bare "${origin}"`, temp).status, 0)
  assert.equal(runShell(`git clone -q "${origin}" "${main}" && git -C "${main}" config user.email test@example.com && git -C "${main}" config user.name test && git -C "${main}" checkout -qb main && git -C "${main}" commit --allow-empty -qm main && git -C "${main}" push -q origin main`, temp).status, 0)
  assert.equal(runShell(`git init -q "${untrusted}" && git -C "${untrusted}" config user.email test@example.com && git -C "${untrusted}" config user.name test && git -C "${untrusted}" checkout -qb untrusted && git -C "${untrusted}" commit --allow-empty -qm untrusted && git -C "${untrusted}" remote add origin "${origin}" && git -C "${untrusted}" push -q origin untrusted`, temp).status, 0)
  assert.equal(runShell(`git clone -q "${origin}" "${web}" && git -C "${web}" checkout -q --detach origin/untrusted`, temp).status, 0)

  const testOnly = runShell(sourceStep.run, temp, {
    SOURCE_REF: "refs/pull/123/head",
    WRITE_ENABLED: "false",
    GITHUB_OUTPUT: path.join(temp, "test-only.out"),
  })
  assert.equal(testOnly.status, 0, testOnly.stderr)

  const sync = runShell(sourceStep.run, temp, {
    SOURCE_REF: "untrusted",
    WRITE_ENABLED: "true",
    GITHUB_OUTPUT: path.join(temp, "sync.out"),
  })
  assert.notEqual(sync.status, 0, "sync must reject a resolved commit outside origin/main before token creation")

  assert.equal(runShell("git -C web checkout -q --detach origin/main", temp).status, 0)
  const trusted = runShell(sourceStep.run, temp, {
    SOURCE_REF: "main",
    WRITE_ENABLED: "true",
    GITHUB_OUTPUT: path.join(temp, "trusted.out"),
  })
  assert.equal(trusted.status, 0, trusted.stderr)
  assert.match(output(path.join(temp, "trusted.out")), /trusted=true/)
})

test("canonical export workflow step rejects a policy body with a stale content hash", () => {
  const { document } = workflow()
  const exportStep = step(document.jobs.sync, "Export and verify canonical legal manifest")
  const web = path.join(mkdtempSync(path.join(os.tmpdir(), "web-policy-sync-hash-mismatch-")), "web")

  cpSync(path.join(root, "legal/policies"), path.join(web, "legal/policies"), { recursive: true })
  cpSync(path.join(root, "scripts/legal"), path.join(web, "scripts/legal"), { recursive: true })
  mkdirSync(path.join(web, "contracts/export"), { recursive: true })
  mkdirSync(path.join(web, "src/apis/backend"), { recursive: true })
  writeFileSync(
    path.join(web, "contracts/export/legal-policy-manifest.json"),
    readFileSync(path.join(root, "contracts/export/legal-policy-manifest.json")),
  )
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

test("preflight accepts only a same-repository draft targeting main", () => {
  const { document } = workflow()
  const preflight = step(document.jobs.sync, "Preflight Platform draft PR")
  const temp = mkdtempSync(path.join(os.tmpdir(), "web-policy-sync-preflight-"))
  const fakeBin = path.join(temp, "bin")
  mkdirSync(fakeBin)
  writeFileSync(path.join(fakeBin, "gh"), "#!/usr/bin/env bash\nprintf '%s\\n' \"${GH_PR_JSON}\"\n")
  assert.equal(runShell(`chmod +x "${path.join(fakeBin, "gh")}"`, temp).status, 0)

  const releaseDraft = JSON.stringify([{
    number: 42,
    isDraft: true,
    isCrossRepository: false,
    headRepository: { nameWithOwner: "AquilaXk/aquila-blog" },
    baseRefName: "release",
  }])
  const rejected = runShell(preflight.run, temp, {
    GH_PR_JSON: releaseDraft,
    PATH: `${fakeBin}:${process.env.PATH}`,
    PLATFORM_REPOSITORY: "AquilaXk/aquila-blog",
    SYNC_BRANCH: "chore/web-policy-sync",
    GITHUB_OUTPUT: path.join(temp, "release.out"),
  })
  assert.notEqual(rejected.status, 0, "preflight must reject a draft that does not target main")

  const mainDraft = JSON.stringify([{ ...JSON.parse(releaseDraft)[0], baseRefName: "main" }])
  const accepted = runShell(preflight.run, temp, {
    GH_PR_JSON: mainDraft,
    PATH: `${fakeBin}:${process.env.PATH}`,
    PLATFORM_REPOSITORY: "AquilaXk/aquila-blog",
    SYNC_BRANCH: "chore/web-policy-sync",
    GITHUB_OUTPUT: path.join(temp, "main.out"),
  })
  assert.equal(accepted.status, 0, accepted.stderr)

  const forkDraft = {
    number: 43,
    isDraft: true,
    isCrossRepository: true,
    headRepository: { nameWithOwner: "fork/aquila-blog" },
    baseRefName: "main",
  }
  const mixedOutput = path.join(temp, "mixed.out")
  const mixed = runShell(preflight.run, temp, {
    GH_PR_JSON: JSON.stringify([forkDraft, JSON.parse(mainDraft)[0]]),
    PATH: `${fakeBin}:${process.env.PATH}`,
    PLATFORM_REPOSITORY: "AquilaXk/aquila-blog",
    SYNC_BRANCH: "chore/web-policy-sync",
    GITHUB_OUTPUT: mixedOutput,
  })
  assert.equal(mixed.status, 0, mixed.stderr)
  assert.match(output(mixedOutput), /^pr_number=42$/m)
  assert.match(output(mixedOutput), /^count=1$/m)

  const forkOnlyOutput = path.join(temp, "fork-only.out")
  const forkOnly = runShell(preflight.run, temp, {
    GH_PR_JSON: JSON.stringify([forkDraft]),
    PATH: `${fakeBin}:${process.env.PATH}`,
    PLATFORM_REPOSITORY: "AquilaXk/aquila-blog",
    SYNC_BRANCH: "chore/web-policy-sync",
    GITHUB_OUTPUT: forkOnlyOutput,
  })
  assert.equal(forkOnly.status, 0, forkOnly.stderr)
  assert.match(output(forkOnlyOutput), /^pr_number=$/m)
  assert.match(output(forkOnlyOutput), /^count=0$/m)
})

test("stable sync branch rejects tracked changes outside the legal lock", () => {
  const { document } = workflow()
  const prepare = step(document.jobs.sync, "Prepare stable Platform sync branch")
  const temp = mkdtempSync(path.join(os.tmpdir(), "web-policy-sync-branch-scope-"))
  const origin = path.join(temp, "origin.git")
  const seed = path.join(temp, "seed")
  const platform = path.join(temp, "platform")
  const lockPath = path.join(seed, "contracts/web/legal-policy-manifest.lock.json")

  assert.equal(runShell(`git init -q --bare "${origin}"`, temp).status, 0)
  assert.equal(runShell(`git init -q -b main "${seed}" && git -C "${seed}" config user.email test@example.com && git -C "${seed}" config user.name test && git -C "${seed}" remote add origin "${origin}"`, temp).status, 0)
  mkdirSync(path.dirname(lockPath), { recursive: true })
  writeFileSync(lockPath, '{"manifestSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}\n')
  assert.equal(runShell(`git -C "${seed}" add . && git -C "${seed}" commit -qm main && git -C "${seed}" push -q origin main && git -C "${seed}" checkout -qb chore/web-policy-sync && git -C "${seed}" push -q origin chore/web-policy-sync`, temp).status, 0)
  assert.equal(runShell(`git clone -q "${origin}" "${platform}" && git -C "${platform}" checkout -q main`, temp).status, 0)

  const env = { SYNC_BRANCH: "chore/web-policy-sync" }
  const zero = runShell(prepare.run, temp, env)
  assert.equal(zero.status, 0, zero.stderr)

  writeFileSync(lockPath, '{"manifestSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}\n')
  assert.equal(runShell(`git -C "${seed}" add contracts/web/legal-policy-manifest.lock.json && git -C "${seed}" commit -qm legal && git -C "${seed}" push -q origin chore/web-policy-sync`, temp).status, 0)
  const legalOnly = runShell(prepare.run, temp, env)
  assert.equal(legalOnly.status, 0, legalOnly.stderr)

  writeFileSync(path.join(seed, "unexpected.txt"), "out of scope\n")
  assert.equal(runShell(`git -C "${seed}" add unexpected.txt && git -C "${seed}" commit -qm unexpected && git -C "${seed}" push -q origin chore/web-policy-sync`, temp).status, 0)
  const rejected = runShell(prepare.run, temp, env)
  assert.notEqual(rejected.status, 0, "stable branch must fail closed before publishing unrelated tracked changes")
})

test("prepare treats an absent sync branch differently from an unavailable remote", () => {
  const { document } = workflow()
  const prepare = step(document.jobs.sync, "Prepare stable Platform sync branch")
  const temp = mkdtempSync(path.join(os.tmpdir(), "web-policy-sync-remote-status-"))
  const origin = path.join(temp, "origin.git")
  const seed = path.join(temp, "seed")
  const platform = path.join(temp, "platform")

  assert.equal(runShell(`git init -q --bare "${origin}" && git init -q -b main "${seed}" && git -C "${seed}" config user.email test@example.com && git -C "${seed}" config user.name test && git -C "${seed}" remote add origin "${origin}" && git -C "${seed}" commit --allow-empty -qm main && git -C "${seed}" push -q origin main && git clone -q "${origin}" "${platform}" && git -C "${platform}" checkout -q main`, temp).status, 0)

  const env = { SYNC_BRANCH: "chore/web-policy-sync" }
  const absent = runShell(prepare.run, temp, env)
  assert.equal(absent.status, 0, absent.stderr)

  assert.equal(runShell(`git -C "${platform}" remote set-url origin "${path.join(temp, "missing.git")}"`, temp).status, 0)
  const unavailable = runShell(prepare.run, temp, env)
  assert.notEqual(unavailable.status, 0, "remote/provider errors must not create a local sync branch")
})

test("writes require real manifest diff, a scoped App token, and preserve one draft PR", () => {
  const { source, document } = workflow()
  const job = document.jobs.sync
  const checker = step(job, "Verify current Platform legal lock")
  const prepareStep = step(job, "Prepare stable Platform sync branch")
  const stableLock = step(job, "Capture stable Platform legal lock")
  const changeStep = step(job, "Detect canonical policy changes")
  assert.match(changeStep.run, /contracts\/web\/legal-policy-manifest\.lock\.json/)
  const tokenStep = step(job, "Create repository sync token")
  assert.match(String(tokenStep.if), /write_enabled == 'true'/)
  assert.match(String(tokenStep.if), /steps\.source\.outputs\.trusted == 'true'/)
  assert.match(String(tokenStep.if), /steps\.changes\.outputs\.sync_required == 'true'/)
  assert.match(tokenStep.uses, /^actions\/create-github-app-token@[a-f0-9]{40}$/)
  assert.equal(tokenStep.with.owner, "AquilaXk")
  assert.equal(tokenStep.with.repositories, "aquila-blog")
  assert.equal(tokenStep.with["client-id"], "${{ vars.REPO_SYNC_APP_CLIENT_ID }}")
  assert.equal(tokenStep.with["private-key"], "${{ secrets.REPO_SYNC_APP_PRIVATE_KEY }}")
  assert.equal(tokenStep.with["permission-contents"], "write")
  assert.equal(tokenStep.with["permission-pull-requests"], "write")
  assert.doesNotMatch(source, /PAT|pull_request_target|skip-token-revoke/)

  const preflight = step(job, "Preflight Platform draft PR")
  assert.match(String(preflight.if), /write_enabled == 'true'/)
  assert.match(String(preflight.if), /steps\.source\.outputs\.trusted == 'true'/)
  assert.match(String(preflight.if), /steps\.changes\.outputs\.sync_required == 'true'/)
  assert.match(preflight.run, /--json number,isDraft,isCrossRepository,headRepository,baseRefName/)
  assert.match(preflight.run, /headRepository\.nameWithOwner/)
  assert.match(preflight.run, /baseRefName/)
  assert.match(preflight.run, /isCrossRepository/)
  assert.match(preflight.run, /select\(\.isCrossRepository == false and \.headRepository\.nameWithOwner == "AquilaXk\/aquila-blog"\)/)
  assert.match(preflight.run, /exactly one draft PR/)
  assert.match(preflight.run, /\} >> "\$\{GITHUB_OUTPUT\}"/)

  const prStep = step(job, "Create or update the single Platform draft PR")
  assert.match(String(prStep.if), /write_enabled == 'true'/)
  assert.match(String(prStep.if), /steps\.changes\.outputs\.main_changed == 'true'/)
  assert.doesNotMatch(String(prStep.if), /main_changed != 'true'/)
  assert.ok(job.steps.indexOf(checker) < job.steps.indexOf(prepareStep))
  assert.match(prStep.run, /--draft/)
  assert.match(prStep.run, /--head "\$\{SYNC_BRANCH\}"/)
  assert.match(prStep.run, /Promoted legal evidence/)
  assert.match(prStep.run, /\[Chore\] Web legal policy snapshot sync/)
  assert.match(prStep.run, /AquilaXk\/aquila-blog-web#9/)
  assert.match(prStep.run, /chore\(legal\): sync Web %s/)
  assert.match(prStep.run, /"\$\{SOURCE_SHA:0:12\}"/)
  for (const section of [
    "## 🔗 Related Issue",
    "## 📝 Summary",
    "## 🔄 Contract Sync",
    "## 🛠 Changes",
    "## 🎯 Scope",
    "## ✅ Validation",
    "### 실행한 검증과 결과",
    "### 미실행 검증",
    "## 📸 Screenshot / API Example",
    "## ⚠️ Risk & Rollback",
    "## ☑️ Checklist",
  ]) assert.match(prStep.run, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  for (const answer of [
    "- [x] 관련 이슈를 정확히 연결했는가?",
    "- [x] base branch가 `main`인지 다시 확인했는가?",
    "- [x] PR 범위 밖 변경을 제외했는가?",
    "- [x] Plan, issue, commit, PR 설명이 서로 일치하는가?",
    "- [x] Worker가 추측해야 할 미확정 구현 결정이 남아 있지 않은가?",
    "- [x] 필요한 테스트와 검증 결과를 본문에 남겼는가?",
    "- [x] 미실행 검증이 있다면 사유와 재실행 조건을 남겼는가?",
    "- [x] SEO/권한/캐시/배포 영향이 있다면 본문에 설명했는가?",
    "- [x] API 계약 또는 운영 문서 변경이 있다면 함께 반영했는가?",
    "- [x] 새 코드 주석이 있다면 [코드 주석 정책]",
  ]) assert.match(prStep.run, new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.doesNotMatch(prStep.run, /gh pr ready|gh pr merge/)
  assert.doesNotMatch(prStep.run, /gh pr list/)
  assert.match(prStep.env.PREFLIGHT_PR_NUMBER, /steps\.preflight\.outputs\.pr_number/)
  const pushStep = step(job, "Push stable Platform sync branch")
  assert.match(String(pushStep.if), /steps\.commit\.outputs\.committed == 'true'/)
  assert.doesNotMatch(String(prStep.if), /steps\.commit\.outputs\.committed == 'true'/)
  assert.doesNotMatch(pushStep.run, /--force/)
  assert.match(prepareStep.run, /user\.name='github-actions\[bot\]'/)
  assert.match(prepareStep.run, /user\.email='41898282\+github-actions\[bot\]@users\.noreply\.github\.com'/)
  assert.match(prepareStep.run, /commit\.gpgsign=false/)
  const commitStep = step(job, "Commit latest Web policy snapshot")
  assert.match(commitStep.run, /user\.name "github-actions\[bot\]"/)
  assert.match(commitStep.run, /user\.email "41898282\+github-actions\[bot\]@users\.noreply\.github\.com"/)
  assert.match(commitStep.run, /commit\.gpgsign false/)
  const closeStep = step(job, "Close stale Platform draft PR")
  assert.match(String(closeStep.if), /steps\.changes\.outputs\.main_changed != 'true'/)
  assert.match(String(closeStep.if), /steps\.changes\.outputs\.branch_changed == 'true'/)
  assert.match(String(closeStep.if), /steps\.preflight\.outputs\.pr_number != ''/)
  assert.match(closeStep.run, /gh pr close/)
  assert.ok(job.steps.indexOf(preflight) < job.steps.indexOf(closeStep))
  assert.ok(job.steps.indexOf(pushStep) < job.steps.indexOf(closeStep))
  assert.match(source, /shellcheck disable=SC2016/)

  const temp = mkdtempSync(path.join(os.tmpdir(), "web-policy-sync-closed-draft-"))
  const platform = path.join(temp, "platform")
  const oldManifestSha = "a".repeat(64)
  const desiredManifestSha = "b".repeat(64)
  const lockPath = path.join(platform, "contracts/web/legal-policy-manifest.lock.json")
  const writeLock = (manifestSha256, sourceCommit = "b".repeat(40)) => writeFileSync(lockPath, `${JSON.stringify({ manifestSha256, sourceCommit }, null, 2)}\n`)

  mkdirSync(path.join(platform, "contracts/web"), { recursive: true })
  mkdirSync(path.join(platform, "tools/contracts"), { recursive: true })
  writeFileSync(path.join(platform, "tools/contracts/check-web-policy-lock.mjs"), "process.exit(0)\n")
  assert.equal(runShell("git init -q -b main && git config user.email test@example.com && git config user.name test", platform).status, 0)
  writeLock(oldManifestSha)
  assert.equal(runShell("git add . && git commit -qm main", platform).status, 0)
  assert.equal(runShell("git checkout -qb chore/web-policy-sync", platform).status, 0)
  writeLock(desiredManifestSha)
  assert.equal(runShell("git add contracts/web/legal-policy-manifest.lock.json && git commit -qm desired", platform).status, 0)
  assert.equal(runShell("git checkout -q main", platform).status, 0)

  const currentLockOutput = path.join(temp, "current-lock.out")
  const checked = runShell(checker.run, platform, { GITHUB_OUTPUT: currentLockOutput })
  assert.equal(checked.status, 0, checked.stderr)
  assert.match(output(currentLockOutput), new RegExp(`manifest_sha256=${oldManifestSha}`))

  assert.equal(runShell("git checkout -q chore/web-policy-sync", platform).status, 0)
  const stableLockOutput = path.join(temp, "stable-lock.out")
  const rejectedStableLockOutput = path.join(temp, "rejected-stable-lock.out")
  writeFileSync(path.join(platform, "tools/contracts/check-web-policy-lock.mjs"), "process.exit(1)\n")
  const rejectedStableLock = runShell(stableLock.run, platform, { GITHUB_OUTPUT: rejectedStableLockOutput })
  assert.notEqual(rejectedStableLock.status, 0, "stable lock capture must reject checker failure before reading the manifest")
  writeFileSync(path.join(platform, "tools/contracts/check-web-policy-lock.mjs"), "process.exit(0)\n")
  const captured = runShell(stableLock.run, platform, { GITHUB_OUTPUT: stableLockOutput })
  assert.equal(captured.status, 0, captured.stderr)
  assert.match(output(stableLockOutput), new RegExp(`manifest_sha256=${desiredManifestSha}`))

  writeLock(oldManifestSha)
  const revertedOutput = path.join(temp, "reverted.out")
  const reverted = runShell(changeStep.run, temp, {
    GITHUB_OUTPUT: revertedOutput,
    CURRENT_MANIFEST_SHA256: oldManifestSha,
    STABLE_MANIFEST_SHA256: desiredManifestSha,
  })
  assert.equal(reverted.status, 0, reverted.stderr)
  assert.match(output(revertedOutput), /^changed=false$/m)
  assert.match(output(revertedOutput), /^main_changed=false$/m)
  assert.match(output(revertedOutput), /^branch_changed=true$/m)
  assert.match(output(revertedOutput), /^sync_required=true$/m)

  writeLock(desiredManifestSha)
  const closedDraftRecoveryOutput = path.join(temp, "closed-draft-recovery.out")
  const closedDraftRecovery = runShell(changeStep.run, temp, {
    GITHUB_OUTPUT: closedDraftRecoveryOutput,
    CURRENT_MANIFEST_SHA256: oldManifestSha,
    STABLE_MANIFEST_SHA256: desiredManifestSha,
  })
  assert.equal(closedDraftRecovery.status, 0, closedDraftRecovery.stderr)
  assert.match(output(closedDraftRecoveryOutput), /^changed=true$/m)
  assert.match(output(closedDraftRecoveryOutput), /^main_changed=true$/m)
  assert.match(output(closedDraftRecoveryOutput), /^branch_changed=false$/m)
  assert.match(output(closedDraftRecoveryOutput), /^sync_required=true$/m)

  writeLock(desiredManifestSha, "c".repeat(40))
  const provenanceOutput = path.join(temp, "provenance.out")
  const provenanceOnly = runShell(changeStep.run, temp, {
    GITHUB_OUTPUT: provenanceOutput,
    CURRENT_MANIFEST_SHA256: oldManifestSha,
    STABLE_MANIFEST_SHA256: desiredManifestSha,
  })
  assert.equal(provenanceOnly.status, 0, provenanceOnly.stderr)
  assert.match(output(provenanceOutput), /^changed=true$/m)
  assert.match(output(provenanceOutput), /^main_changed=true$/m)
  assert.match(output(provenanceOutput), /^branch_changed=false$/m)
  assert.match(output(provenanceOutput), /^sync_required=true$/m)
  const provenanceCommitOutput = path.join(temp, "provenance-commit.out")
  const provenanceCommitted = runShell(commitStep.run, temp, {
    GITHUB_OUTPUT: provenanceCommitOutput,
    SOURCE_SHA: "c".repeat(40),
  })
  assert.equal(provenanceCommitted.status, 0, provenanceCommitted.stderr)
  assert.match(output(provenanceCommitOutput), /committed=true/)
  assert.match(stableLock.run, /node tools\/contracts\/check-web-policy-lock\.mjs/)
  assert.match(String(pushStep.if), /steps\.changes\.outputs\.sync_required == 'true'/)
  assert.doesNotMatch(String(pushStep.if), /steps\.changes\.outputs\.branch_changed/)

  const fakeBin = path.join(temp, "bin")
  const closeCapture = path.join(temp, "close.out")
  mkdirSync(fakeBin)
  writeFileSync(path.join(fakeBin, "gh"), "#!/usr/bin/env bash\nprintf '%s\\n' \"$*\" > \"${GH_CAPTURE}\"\n")
  assert.equal(runShell(`chmod +x "${path.join(fakeBin, "gh")}"`, temp).status, 0)
  const closed = runShell(closeStep.run, temp, {
    GH_CAPTURE: closeCapture,
    PATH: `${fakeBin}:${process.env.PATH}`,
    PLATFORM_REPOSITORY: "AquilaXk/aquila-blog",
    PREFLIGHT_PR_NUMBER: "42",
  })
  assert.equal(closed.status, 0, closed.stderr)
  assert.equal(output(closeCapture), "pr close 42 --repo AquilaXk/aquila-blog\n")

  const commitOutput = path.join(temp, "commit.out")
  const committed = runShell(commitStep.run, temp, {
    GITHUB_OUTPUT: commitOutput,
    SOURCE_SHA: "c".repeat(40),
  })
  assert.equal(committed.status, 0, committed.stderr)
  assert.match(output(commitOutput), /committed=false/)
})

test("Web core CI runs the legal sync workflow contract test", () => {
  const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8")
  assert.match(ci, /node --test scripts\/contracts\/sync-legal-policy-workflow\.test\.mjs/)
})
