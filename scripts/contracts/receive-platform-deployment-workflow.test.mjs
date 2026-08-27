import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "../..")
const workflowPath = path.join(root, ".github/workflows/receive-platform-web-deployment.yml")
const ciPath = path.join(root, ".github/workflows/ci.yml")
const smokeSpecPath = path.join(root, "e2e/platform-deployment-smoke.spec.ts")

function workflow() {
  assert.equal(existsSync(workflowPath), true, "Platform deployment receiver workflow must exist")
  const source = readFileSync(workflowPath, "utf8")
  const ruby = ["require 'yaml'", "require 'json'", "puts JSON.generate(YAML.load_file(ARGV.fetch(0)))"].join("; ")
  const parsed = spawnSync("ruby", ["-e", ruby, workflowPath], { encoding: "utf8" })
  assert.equal(parsed.status, 0, parsed.stderr || "workflow YAML must parse")
  return { source, document: JSON.parse(parsed.stdout) }
}

function step(job, name) {
  const found = job.steps.find((candidate) => candidate.name === name)
  assert.ok(found, `missing workflow step: ${name}`)
  return found
}

const payloadKeys = [
  "schema_version", "platform_repository", "platform_sha", "web_repository", "web_sha",
  "image_digest", "deploy_run_id", "domain", "served_build_sha", "deployment_identity",
]

function delivery(overrides = {}) {
  const payload = {
    schema_version: "1",
    platform_repository: "AquilaXk/aquila-blog",
    platform_sha: "a".repeat(40),
    web_repository: "AquilaXk/aquila-blog-web",
    web_sha: "b".repeat(40),
    image_digest: `sha256:${"c".repeat(64)}`,
    deploy_run_id: "12345",
    domain: "https://blog.aquilaxk.site",
    served_build_sha: "b".repeat(40),
    ...overrides,
  }
  const canonical = payloadKeys.slice(0, -1).map((key) => `${key}=${payload[key]}\n`).join("")
  return { ...payload, deployment_identity: createHash("sha256").update(canonical).digest("hex") }
}

function admissionProgram(run) {
  const match = run.match(/node\s+<<["']?([A-Z_]+)["']?\n([\s\S]*?)\n\1/m)
  assert.ok(match, "admission must use an executable Node heredoc")
  assert.match(match[2], /deployment_identity/)
  return match[2]
}

function admit(program, payload, sender = "aquila-repo-sync[bot]") {
  const directory = mkdtempSync(path.join(os.tmpdir(), "platform-deployment-admission-"))
  try {
    const output = path.join(directory, "output")
    writeFileSync(output, "")
    const result = spawnSync("node", ["-e", program], {
      encoding: "utf8",
      env: {
        ...process.env,
        CLIENT_PAYLOAD: JSON.stringify(payload),
        EVENT_SENDER_TYPE: "Bot",
        EVENT_SENDER_LOGIN: sender,
        EXPECTED_APP_LOGIN: "aquila-repo-sync[bot]",
        GITHUB_OUTPUT: output,
      },
    })
    return { ...result, output: readFileSync(output, "utf8") }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("receiver admits only the verified Platform deployment event before any expensive or privileged work", () => {
  const { source, document } = workflow()
  const job = document.jobs.receive
  assert.match(source, /^  repository_dispatch:\n    types: \[platform_web_deployment_ready\]/m)
  assert.deepEqual(document.permissions, { attestations: "read", contents: "read", packages: "read" })
  assert.equal(job.if, undefined, "untrusted dispatches must fail in admission, not be silently skipped")

  const admission = step(job, "Validate verified Platform deployment")
  assert.equal(admission.env.EXPECTED_APP_LOGIN, "${{ vars.REPO_SYNC_APP_BOT_LOGIN }}")
  assert.match(admission.run, /EVENT_SENDER_TYPE !== "Bot"/)
  assert.match(admission.run, /EVENT_SENDER_LOGIN !== process\.env\.EXPECTED_APP_LOGIN/)
  assert.match(admission.run, /Object\.keys\(payload\)/)
  for (const key of payloadKeys) assert.match(admission.run, new RegExp(`\\b${key}\\b`))
  assert.match(admission.run, /createHash\("sha256"\)/)
  assert.match(admission.run, /served_build_sha/)
  assert.match(admission.run, /web_sha/)

  const firstSensitive = job.steps.findIndex((candidate) =>
    [candidate.uses, candidate.run].some((value) => /actions\/checkout|\byarn\b|playwright|create-github-app-token/.test(String(value ?? ""))),
  )
  assert.ok(firstSensitive > job.steps.indexOf(admission), "admission must precede checkout, install, and smoke")
  const checkout = step(job, "Checkout immutable Web receiver")
  assert.equal(checkout.with.ref, "${{ steps.delivery.outputs.web_sha }}")
  assert.equal(checkout.with["persist-credentials"], false)
  assert.doesNotMatch(admission.run, /create-github-app-token|gh api|curl/i)
})

test("the executable admission heredoc rejects representative untrusted deliveries without outputs", () => {
  const { document } = workflow()
  const program = admissionProgram(step(document.jobs.receive, "Validate verified Platform deployment").run)
  const valid = admit(program, delivery())
  assert.equal(valid.status, 0, valid.stderr)
  for (const key of ["platform_sha", "web_sha", "served_build_sha", "deployment_identity", "deploy_run_id"]) {
    assert.match(valid.output, new RegExp(`^${key}=`, "m"), `valid delivery must expose ${key}`)
  }

  const malformed = [
    admit(program, delivery(), "github-actions[bot]"),
    admit(program, { ...delivery(), unexpected: "field" }),
    admit(program, delivery({ served_build_sha: "d".repeat(40) })),
    admit(program, { ...delivery(), deployment_identity: "0".repeat(64) }),
  ]
  for (const result of malformed) {
    assert.notEqual(result.status, 0, "wrong sender, schema, served SHA, and identity must fail closed")
    assert.equal(result.output, "", "rejected delivery must not expose trusted values")
  }
})

test("receiver verifies native evidence, smokes, and records only the approved deployment", () => {
  const { source, document } = workflow()
  const job = document.jobs.receive
  const smoke = step(job, "Run served Platform deployment smoke")
  assert.match(smoke.run, /e2e\/platform-deployment-smoke\.spec\.ts/)
  assert.match(smoke.run, /--project=chromium/)
  assert.match(smoke.run, /--workers=1/)
  assert.match(smoke.run, /timeout 5m/)
  assert.ok(job["timeout-minutes"] <= 15, "the complete receiver job must remain bounded")

  const evidence = step(job, "Verify exact Web image attestations")
  const registryLogin = step(job, "Log in to GitHub Container Registry")
  assert.match(registryLogin.uses, /^docker\/login-action@[a-f0-9]{40}$/)
  assert.equal(registryLogin.with.registry, "ghcr.io")
  assert.equal(registryLogin.with.password, "${{ github.token }}")
  assert.equal(evidence.env.GH_TOKEN, "${{ github.token }}")
  assert.match(evidence.run, /gh attestation verify "oci:\/\/\$\{IMAGE_REF\}"/)
  assert.match(evidence.run, /--source-digest "\$\{WEB_SHA\}"/)
  assert.match(evidence.run, /--source-ref refs\/heads\/main/)
  assert.match(evidence.run, /--signer-workflow AquilaXk\/aquila-blog-web\/.github\/workflows\/frontend-image\.yml/)
  assert.match(evidence.run, /https:\/\/slsa\.dev\/provenance\/v1/)
  assert.match(evidence.run, /https:\/\/spdx\.dev\/Document\/v2\.3/)
  assert.match(evidence.run, /https:\/\/cosign\.sigstore\.dev\/attestation\/vuln\/v1/)
  assert.match(
    evidence.run,
    /native-image-evidence\.mjs verify-attestation-set \\\n\s+\/tmp\/web-image-provenance\.json \\\n\s+\/tmp\/web-image-sbom\.json \\\n\s+\/tmp\/web-image-vulnerability-attestation\.json/,
  )
  assert.ok(job.steps.indexOf(registryLogin) < job.steps.indexOf(evidence))
  assert.ok(job.steps.indexOf(evidence) < job.steps.indexOf(smoke))

  const variableToken = step(job, "Create approved deployment variable token")
  assert.equal(variableToken.if, "steps.smoke.outcome == 'success'")
  assert.equal(variableToken.with.owner, "AquilaXk")
  assert.equal(variableToken.with.repositories, "aquila-blog-web")
  assert.equal(variableToken.with["permission-contents"], "read")
  assert.equal(variableToken.with["permission-variables"], "write")
  assert.match(variableToken.uses, /^actions\/create-github-app-token@[a-f0-9]{40}$/)

  const approved = step(job, "Record approved Web deployment")
  assert.equal(approved.if, "steps.smoke.outcome == 'success'")
  assert.equal(approved.env.GH_TOKEN, "${{ steps.variable-token.outputs.token }}")
  assert.match(approved.run, /repos\/AquilaXk\/aquila-blog-web\/commits\/main/)
  assert.match(approved.run, /repos\/AquilaXk\/aquila-blog-web\/actions\/variables/)
  assert.match(approved.run, /AQUILA_APPROVED_WEB_DEPLOYMENT_V1/)
  assert.match(approved.run, /native-image-evidence\.mjs build-approved-record/)
  assert.match(approved.run, /native-image-evidence\.mjs authorize-replacement/)
  assert.match(approved.run, /gh variable set AQUILA_APPROVED_WEB_DEPLOYMENT_V1/)
  assert.ok(job.steps.indexOf(smoke) < job.steps.indexOf(variableToken))
  assert.ok(job.steps.indexOf(variableToken) < job.steps.indexOf(approved))

  const summary = step(job, "Record Platform deployment backlink")
  assert.equal(summary.env.PLATFORM_REPOSITORY, "${{ steps.delivery.outputs.platform_repository }}")
  assert.match(summary.run, /https:\/\/github\.com\/\$\{PLATFORM_REPOSITORY\}\/actions\/runs\/\$\{DEPLOY_RUN_ID\}/)
  assert.match(source, /GITHUB_STEP_SUMMARY/)
  assert.match(source, /deployment_identity/)
  assert.doesNotMatch(source, /pull-requests:|git push|gh pr |--draft|web_frontend_image_ready/i)

  const ci = readFileSync(ciPath, "utf8")
  assert.match(ci, /node --test scripts\/contracts\/receive-platform-deployment-workflow\.test\.mjs/)
  assert.match(ci, /PLAYWRIGHT_USE_WEBSERVER=false yarn playwright test e2e\/platform-deployment-smoke\.spec\.ts --grep .*readiness fallback payloads/)

  const smokeSpec = readFileSync(smokeSpecPath, "utf8")
  assert.match(smokeSpec, /test\("rejects readiness fallback payloads"/)
})
