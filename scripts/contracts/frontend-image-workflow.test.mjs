import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "../..")
const workflowPath = path.join(root, ".github/workflows/frontend-image.yml")
const ciPath = path.join(root, ".github/workflows/ci.yml")

function workflow() {
  assert.equal(existsSync(workflowPath), true, "frontend image workflow must exist")
  const source = readFileSync(workflowPath, "utf8")
  const ruby = ["require 'yaml'", "require 'json'", "puts JSON.generate(YAML.load_file(ARGV.fetch(0)))"].join("; ")
  const parsed = spawnSync("ruby", ["-e", ruby, workflowPath], { encoding: "utf8" })
  assert.equal(parsed.status, 0, parsed.stderr || "frontend image workflow YAML must parse")
  return { source, document: JSON.parse(parsed.stdout) }
}

function step(job, name) {
  const result = job.steps.find((candidate) => candidate.name === name)
  assert.ok(result, `missing workflow step: ${name}`)
  return result
}

function outputValues(source) {
  return Object.fromEntries(
    source
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=")
        assert.notEqual(separator, -1, `invalid output line: ${line}`)
        return [line.slice(0, separator), line.slice(separator + 1)]
      }),
  )
}

function deliveryFixture(overrides = {}) {
  const sourceSha = overrides.sourceSha ?? "a".repeat(40)
  const imageDigest = overrides.imageDigest ?? `sha256:${"b".repeat(64)}`
  const targetSha = overrides.targetSha ?? "c".repeat(40)
  return {
    schemaVersion: "1",
    sourceRepository: "AquilaXk/aquila-blog-web",
    sourceSha,
    currentWebMainSha: sourceSha,
    imageDigest,
    imageRef: `ghcr.io/aquilaxk/aquila-blog-web-front@${imageDigest}`,
    targetRepository: "AquilaXk/aquila-blog",
    targetSha,
    producerRunId: "32551475385",
    producerRunAttempt: "1",
    producerRunUrl: "https://github.com/AquilaXk/aquila-blog-web/actions/runs/32551475385",
    webToken: "web-token-fixture",
    platformToken: "platform-token-fixture",
    webApiExitCode: 0,
    targetApiExitCode: 0,
    ...overrides,
  }
}

function expectedDeliveryId(fixture) {
  const canonical = [
    `schema_version=${fixture.schemaVersion}`,
    `source_repository=${fixture.sourceRepository}`,
    `source_sha=${fixture.sourceSha}`,
    `image_digest=${fixture.imageDigest}`,
    `target_repository=${fixture.targetRepository}`,
    `target_sha=${fixture.targetSha}`,
  ].join("\n") + "\n"
  return createHash("sha256").update(canonical).digest("hex")
}

function runFreshnessCheck(overrides = {}) {
  const fixture = deliveryFixture(overrides)
  const freshness = step(workflow().document.jobs.publish, "Check current Web source freshness")
  const directory = mkdtempSync(path.join(tmpdir(), "aquila-web-freshness-"))
  const output = path.join(directory, "output")
  const summary = path.join(directory, "summary")
  const calls = path.join(directory, "calls")
  const gh = path.join(directory, "gh")
  writeFileSync(output, "")
  writeFileSync(summary, "")
  writeFileSync(calls, "")
  writeFileSync(
    gh,
    `#!/usr/bin/env bash
printf '%s\n' "$*" >> "${calls}"
case "$2" in
  repos/AquilaXk/aquila-blog-web/commits/main)
    [ "\${GH_TOKEN}" = "web-token-fixture" ] || { echo "wrong token for Web lookup" >&2; exit 9; }
    [ "\${WEB_API_EXIT_CODE}" = "0" ] || exit "\${WEB_API_EXIT_CODE}"
    printf '%s\n' "\${CURRENT_WEB_MAIN_SHA}"
    ;;
  *)
    echo "unexpected gh args: $*" >&2
    exit 1
    ;;
esac
`,
  )
  chmodSync(gh, 0o755)

  const result = spawnSync("bash", ["-c", freshness.run], {
    encoding: "utf8",
    env: {
      ...process.env,
      SOURCE_REPOSITORY: fixture.sourceRepository,
      SOURCE_SHA: fixture.sourceSha,
      PRODUCER_RUN_ID: fixture.producerRunId,
      PRODUCER_RUN_URL: fixture.producerRunUrl,
      WEB_GH_TOKEN: fixture.webToken,
      CURRENT_WEB_MAIN_SHA: fixture.currentWebMainSha,
      WEB_API_EXIT_CODE: String(fixture.webApiExitCode),
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
      PATH: `${directory}:${process.env.PATH}`,
    },
  })
  const values = outputValues(readFileSync(output, "utf8"))
  const callLog = readFileSync(calls, "utf8").trim().split("\n").filter(Boolean)
  const summaryText = readFileSync(summary, "utf8")
  rmSync(directory, { recursive: true, force: true })
  return { ...result, fixture, values, callLog, summaryText }
}

function runDeliveryPreparation(overrides = {}) {
  const fixture = deliveryFixture(overrides)
  const prepare = step(workflow().document.jobs.publish, "Prepare immutable Web image delivery")
  const directory = mkdtempSync(path.join(tmpdir(), "aquila-web-delivery-"))
  const output = path.join(directory, "output")
  const calls = path.join(directory, "calls")
  const gh = path.join(directory, "gh")
  writeFileSync(output, "")
  writeFileSync(calls, "")
  writeFileSync(
    gh,
    `#!/usr/bin/env bash
printf '%s\n' "$*" >> "${calls}"
case "$2" in
  repos/AquilaXk/aquila-blog/commits/main)
    [ "\${GH_TOKEN}" = "platform-token-fixture" ] || { echo "wrong token for Platform lookup" >&2; exit 9; }
    [ "\${TARGET_API_EXIT_CODE}" = "0" ] || exit "\${TARGET_API_EXIT_CODE}"
    printf '%s\n' "\${CURRENT_TARGET_MAIN_SHA}"
    ;;
  *)
    echo "unexpected gh args: $*" >&2
    exit 1
    ;;
esac
`,
  )
  chmodSync(gh, 0o755)

  const result = spawnSync("bash", ["-c", prepare.run], {
    encoding: "utf8",
    env: {
      ...process.env,
      SCHEMA_VERSION: fixture.schemaVersion,
      SOURCE_REPOSITORY: fixture.sourceRepository,
      SOURCE_SHA: fixture.sourceSha,
      IMAGE_REF: fixture.imageRef,
      IMAGE_DIGEST: fixture.imageDigest,
      TARGET_REPOSITORY: fixture.targetRepository,
      PRODUCER_RUN_ID: fixture.producerRunId,
      PRODUCER_RUN_ATTEMPT: fixture.producerRunAttempt,
      PRODUCER_RUN_URL: fixture.producerRunUrl,
      PLATFORM_GH_TOKEN: fixture.platformToken,
      CURRENT_TARGET_MAIN_SHA: fixture.targetSha,
      TARGET_API_EXIT_CODE: String(fixture.targetApiExitCode),
      GITHUB_OUTPUT: output,
      PATH: `${directory}:${process.env.PATH}`,
    },
  })
  const values = outputValues(readFileSync(output, "utf8"))
  const callLog = readFileSync(calls, "utf8").trim().split("\n").filter(Boolean)
  rmSync(directory, { recursive: true, force: true })
  return { ...result, fixture, values, callLog }
}

function runDispatch(fixture, values, overrides = {}) {
  const dispatch = step(workflow().document.jobs.publish, "Dispatch immutable Web image to Platform")
  const directory = mkdtempSync(path.join(tmpdir(), "aquila-web-dispatch-"))
  const summary = path.join(directory, "summary")
  const calls = path.join(directory, "calls")
  const gh = path.join(directory, "gh")
  writeFileSync(summary, "")
  writeFileSync(calls, "")
  writeFileSync(
    gh,
    `#!/usr/bin/env bash
[ "\${GH_TOKEN}" = "platform-token-fixture" ] || { echo "wrong token for Platform dispatch" >&2; exit 9; }
printf '%s\n' "$*" >> "${calls}"
`,
  )
  chmodSync(gh, 0o755)

  const result = spawnSync("bash", ["-c", dispatch.run], {
    encoding: "utf8",
    env: {
      ...process.env,
      GH_TOKEN: overrides.platformToken ?? fixture.platformToken,
      SCHEMA_VERSION: fixture.schemaVersion,
      SOURCE_REPOSITORY: fixture.sourceRepository,
      SOURCE_SHA: fixture.sourceSha,
      IMAGE_REF: fixture.imageRef,
      IMAGE_DIGEST: fixture.imageDigest,
      TARGET_REPOSITORY: fixture.targetRepository,
      TARGET_SHA: values.target_sha,
      DELIVERY_ID: values.delivery_id,
      PRODUCER_RUN_ID: fixture.producerRunId,
      PRODUCER_RUN_ATTEMPT: fixture.producerRunAttempt,
      PRODUCER_RUN_URL: fixture.producerRunUrl,
      GITHUB_STEP_SUMMARY: summary,
      PATH: `${directory}:${process.env.PATH}`,
    },
  })
  const callLog = readFileSync(calls, "utf8").trim().split("\n").filter(Boolean)
  const summaryText = readFileSync(summary, "utf8")
  rmSync(directory, { recursive: true, force: true })
  return { ...result, callLog, summaryText }
}

test("frontend image producer pins its immutable build, scan, and dispatch contract", () => {
  const { source, document } = workflow()
  const job = document.jobs.publish

  assert.deepEqual(document.true.push.branches, ["main"])
  assert.deepEqual(document.permissions, { contents: "read", packages: "write" })
  assert.deepEqual(document.concurrency, { group: "web-frontend-image-main", "cancel-in-progress": false })
  assert.equal(String(job.if), "github.repository == 'AquilaXk/aquila-blog-web' && github.ref == 'refs/heads/main'")

  const checkout = step(job, "Checkout Web main without persisted credentials")
  assert.match(checkout.uses, /^actions\/checkout@[a-f0-9]{40}$/)
  assert.equal(checkout.with["persist-credentials"], false)

  const sourceStep = step(job, "Validate canonical Web source SHA")
  assert.match(sourceStep.run, /^\s*if \[\[ ! "\$\{SOURCE_SHA\}" =~ \^\[a-f0-9\]\{40\}\$ \]\]; then/m)

  const handoffConfig = step(job, "Validate Platform handoff configuration")
  assert.equal(handoffConfig.env.REPO_SPLIT_SYNC_ENABLED, "${{ vars.REPO_SPLIT_SYNC_ENABLED }}")
  assert.equal(handoffConfig.env.REPO_SYNC_APP_CLIENT_ID, "${{ vars.REPO_SYNC_APP_CLIENT_ID }}")
  assert.equal(handoffConfig.env.REPO_SYNC_APP_PRIVATE_KEY, "${{ secrets.REPO_SYNC_APP_PRIVATE_KEY }}")
  assert.match(handoffConfig.run, /\[\[ "\$\{REPO_SPLIT_SYNC_ENABLED\}" == "true" \]\]/)
  assert.match(handoffConfig.run, /\[\[ -n "\$\{REPO_SYNC_APP_CLIENT_ID\}" \]\]/)
  assert.match(handoffConfig.run, /\[\[ -n "\$\{REPO_SYNC_APP_PRIVATE_KEY\}" \]\]/)
  assert.doesNotMatch(handoffConfig.run, /(?:echo|printf).*\$\{REPO_(?:SPLIT_SYNC_ENABLED|SYNC_APP_CLIENT_ID|SYNC_APP_PRIVATE_KEY)\}/)

  const build = step(job, "Build and push immutable Web image")
  assert.ok(job.steps.indexOf(handoffConfig) < job.steps.indexOf(build))
  assert.match(build.uses, /^docker\/build-push-action@[a-f0-9]{40}$/)
  assert.equal(build.with.context, ".")
  assert.equal(build.with.file, "Dockerfile.runtime")
  assert.equal(build.with.push, true)
  assert.equal(build.with.tags, "ghcr.io/aquilaxk/aquila-blog-web-front:sha-${{ github.sha }}")
  assert.equal(build.with["build-args"], "NEXT_PUBLIC_AQUILA_BUILD_SHA=${{ steps.source.outputs.source_sha }}")

  const digest = step(job, "Validate pushed image digest")
  assert.match(digest.run, /\^sha256:\[a-f0-9\]\{64\}\$/)
  assert.match(digest.run, /ghcr\.io\/aquilaxk\/aquila-blog-web-front@\$\{IMAGE_DIGEST\}/)
  assert.match(digest.run, /image_digest=%s/)
  assert.ok(job.steps.indexOf(build) < job.steps.indexOf(digest))

  const scan = step(job, "Pull and scan pushed immutable Web image")
  assert.match(scan.run, /docker pull "\$\{IMAGE_REF\}"/)
  assert.match(scan.run, /trivy image .*--ignorefile \.trivyignore\.yaml .*--severity HIGH,CRITICAL .*--exit-code 1.*"\$\{IMAGE_REF\}"/)
  assert.ok(job.steps.indexOf(digest) < job.steps.indexOf(scan))

  const freshness = step(job, "Check current Web source freshness")
  assert.equal(freshness.env.WEB_GH_TOKEN, "${{ github.token }}")
  assert.equal(freshness.env.PLATFORM_GH_TOKEN, undefined)
  assert.match(freshness.run, /repos\/\$\{SOURCE_REPOSITORY\}\/commits\/main/)
  assert.doesNotMatch(freshness.run, /AquilaXk\/aquila-blog\/commits\/main|PLATFORM_GH_TOKEN/)
  assert.ok(job.steps.indexOf(scan) < job.steps.indexOf(freshness))

  const token = step(job, "Create Platform dispatch token")
  assert.equal(token.if, "steps.freshness.outputs.should_dispatch == 'true'")
  assert.match(token.uses, /^actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1$/)
  assert.equal(token.with["client-id"], "${{ vars.REPO_SYNC_APP_CLIENT_ID }}")
  assert.equal(token.with.owner, "AquilaXk")
  assert.equal(token.with.repositories, "aquila-blog")
  assert.equal(token.with["permission-contents"], "write")
  assert.ok(job.steps.indexOf(freshness) < job.steps.indexOf(token))

  const prepare = step(job, "Prepare immutable Web image delivery")
  assert.equal(prepare.if, "steps.freshness.outputs.should_dispatch == 'true'")
  assert.equal(prepare.env.WEB_GH_TOKEN, undefined)
  assert.equal(prepare.env.PLATFORM_GH_TOKEN, "${{ steps.app-token.outputs.token }}")
  assert.equal(prepare.env.SCHEMA_VERSION, "1")
  assert.equal(prepare.env.SOURCE_REPOSITORY, "AquilaXk/aquila-blog-web")
  assert.equal(prepare.env.TARGET_REPOSITORY, "AquilaXk/aquila-blog")
  assert.match(prepare.run, /repos\/\$\{TARGET_REPOSITORY\}\/commits\/main/)
  assert.doesNotMatch(prepare.run, /CURRENT_WEB_MAIN_SHA|WEB_GH_TOKEN|aquila-blog-web\/commits\/main/)
  assert.equal(prepare.env.PRODUCER_RUN_ID, "${{ github.run_id }}")
  assert.equal(prepare.env.PRODUCER_RUN_ATTEMPT, "${{ github.run_attempt }}")
  assert.equal(prepare.env.PRODUCER_RUN_URL, "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}")
  assert.ok(job.steps.indexOf(token) < job.steps.indexOf(prepare))

  const dispatch = step(job, "Dispatch immutable Web image to Platform")
  assert.equal(dispatch.if, "steps.freshness.outputs.should_dispatch == 'true'")
  assert.equal(dispatch.env.GH_TOKEN, "${{ steps.app-token.outputs.token }}")
  assert.match(dispatch.run, /gh api --method POST "repos\/AquilaXk\/aquila-blog\/dispatches"/)
  assert.match(dispatch.run, /event_type="web_frontend_image_ready"/)
  for (const field of [
    "schema_version",
    "source_repository",
    "source_sha",
    "image_ref",
    "image_digest",
    "target_repository",
    "target_sha",
    "delivery_id",
    "producer_run_id",
    "producer_run_attempt",
    "producer_run_url",
  ]) {
    assert.match(dispatch.run, new RegExp(`client_payload\\[${field}\\]`), `missing payload field ${field}`)
  }
  assert.match(dispatch.run, /"client_payload\[image_ref\]=\$\{IMAGE_REF\}"/)
  assert.match(dispatch.run, /"client_payload\[source_sha\]=\$\{SOURCE_SHA\}"/)
  assert.ok(job.steps.indexOf(prepare) < job.steps.indexOf(dispatch))

  assert.doesNotMatch(source, /workflow_dispatch|personal access token|secrets\.[A-Z_]*PAT/i)
  for (const checkout of job.steps.filter((candidate) => String(candidate.uses ?? "").startsWith("actions/checkout@"))) {
    assert.equal(checkout.with?.repository, undefined, "producer must not checkout the Platform repository")
  }
  assert.equal((source.match(/web_frontend_image_ready/g) ?? []).length, 1)
  assert.equal((source.match(/gh api --method POST/g) ?? []).length, 1)
})

test("delivery preparation validates exact identities and emits one canonical payload", () => {
  const fresh = runFreshnessCheck()
  assert.equal(fresh.status, 0, fresh.stderr)
  assert.equal(fresh.values.should_dispatch, "true")
  assert.deepEqual(fresh.callLog, ["api repos/AquilaXk/aquila-blog-web/commits/main --jq .sha"])

  const prepared = runDeliveryPreparation()
  assert.equal(prepared.status, 0, prepared.stderr)
  assert.deepEqual(prepared.callLog, ["api repos/AquilaXk/aquila-blog/commits/main --jq .sha"])
  assert.equal(prepared.values.target_sha, prepared.fixture.targetSha)
  assert.equal(prepared.values.delivery_id, expectedDeliveryId(prepared.fixture))

  const dispatched = runDispatch(prepared.fixture, prepared.values)
  assert.equal(dispatched.status, 0, dispatched.stderr)
  assert.equal(dispatched.callLog.length, 1)
  const call = dispatched.callLog[0]
  for (const [field, value] of Object.entries({
    schema_version: prepared.fixture.schemaVersion,
    source_repository: prepared.fixture.sourceRepository,
    source_sha: prepared.fixture.sourceSha,
    image_ref: prepared.fixture.imageRef,
    image_digest: prepared.fixture.imageDigest,
    target_repository: prepared.fixture.targetRepository,
    target_sha: prepared.fixture.targetSha,
    delivery_id: prepared.values.delivery_id,
    producer_run_id: prepared.fixture.producerRunId,
    producer_run_attempt: prepared.fixture.producerRunAttempt,
    producer_run_url: prepared.fixture.producerRunUrl,
  })) {
    assert.match(call, new RegExp(`client_payload\\[${field}\\]=${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
  }
  assert.match(dispatched.summaryText, new RegExp(prepared.values.delivery_id))
  assert.match(dispatched.summaryText, new RegExp(prepared.fixture.producerRunUrl.replaceAll("/", "\\/")))
  assert.doesNotMatch(dispatched.summaryText, /web-token-fixture|platform-token-fixture/)
})

test("stale Web source is a successful no-op before Platform lookup", () => {
  const freshness = runFreshnessCheck({ currentWebMainSha: "d".repeat(40) })
  assert.equal(freshness.status, 0, freshness.stderr)
  assert.equal(freshness.values.should_dispatch, "false")
  assert.deepEqual(freshness.callLog, ["api repos/AquilaXk/aquila-blog-web/commits/main --jq .sha"])
  assert.match(freshness.summaryText, /status: stale source; dispatch skipped/)
  assert.doesNotMatch(freshness.summaryText, /web-token-fixture|platform-token-fixture/)
})

test("Web freshness fails closed before App token creation", () => {
  for (const overrides of [
    { sourceRepository: "AquilaXk/aquila-blog-web.evil" },
    { sourceSha: "A".repeat(40), currentWebMainSha: "A".repeat(40) },
    { sourceSha: "a".repeat(39), currentWebMainSha: "a".repeat(39) },
    { webApiExitCode: 1 },
    { webToken: "platform-token-fixture" },
  ]) {
    const freshness = runFreshnessCheck(overrides)
    assert.notEqual(freshness.status, 0, JSON.stringify(overrides))
    assert.notEqual(freshness.values.should_dispatch, "true", JSON.stringify(overrides))
  }
})

test("delivery preparation fails closed on malformed identities and Platform API failures", () => {
  for (const overrides of [
    { schemaVersion: "2" },
    { sourceRepository: "AquilaXk/aquila-blog-web.evil" },
    { sourceSha: "A".repeat(40) },
    { sourceSha: "a".repeat(39) },
    { imageDigest: `sha256:${"B".repeat(64)}`, imageRef: `ghcr.io/aquilaxk/aquila-blog-web-front@sha256:${"B".repeat(64)}` },
    { imageDigest: `sha256:${"b".repeat(63)}`, imageRef: `ghcr.io/aquilaxk/aquila-blog-web-front@sha256:${"b".repeat(63)}` },
    { imageRef: "ghcr.io/aquilaxk/aquila-blog-web-front:latest" },
    { targetRepository: "AquilaXk/aquila-blog.evil" },
    { targetSha: "C".repeat(40) },
    { targetSha: "c".repeat(39) },
    { targetApiExitCode: 1 },
    { platformToken: "web-token-fixture" },
  ]) {
    const prepared = runDeliveryPreparation(overrides)
    assert.notEqual(prepared.status, 0, JSON.stringify(overrides))
    assert.equal(prepared.values.delivery_id, undefined, JSON.stringify(overrides))
  }

  const valid = runDeliveryPreparation()
  assert.equal(valid.status, 0, valid.stderr)
  const wrongDispatchToken = runDispatch(valid.fixture, valid.values, { platformToken: "web-token-fixture" })
  assert.notEqual(wrongDispatchToken.status, 0)
  assert.match(wrongDispatchToken.stderr, /wrong token for Platform dispatch/)
})

test("delivery identity is stable across attempts and changes with immutable inputs", () => {
  const first = runDeliveryPreparation()
  const retry = runDeliveryPreparation({
    producerRunId: "32551475385",
    producerRunAttempt: "2",
    producerRunUrl: "https://github.com/AquilaXk/aquila-blog-web/actions/runs/32551475385",
  })
  assert.equal(first.status, 0, first.stderr)
  assert.equal(retry.status, 0, retry.stderr)
  assert.equal(first.values.delivery_id, retry.values.delivery_id)

  const changedSource = runDeliveryPreparation({ sourceSha: "d".repeat(40), currentWebMainSha: "d".repeat(40) })
  const changedDigestValue = `sha256:${"e".repeat(64)}`
  const changedDigest = runDeliveryPreparation({
    imageDigest: changedDigestValue,
    imageRef: `ghcr.io/aquilaxk/aquila-blog-web-front@${changedDigestValue}`,
  })
  const changedTarget = runDeliveryPreparation({ targetSha: "f".repeat(40) })
  for (const changed of [changedSource, changedDigest, changedTarget]) {
    assert.equal(changed.status, 0, changed.stderr)
    assert.notEqual(changed.values.delivery_id, first.values.delivery_id)
  }
})

test("Web CI executes the frontend image workflow contract test", () => {
  const ci = readFileSync(ciPath, "utf8")
  assert.match(ci, /node --test scripts\/contracts\/frontend-image-workflow\.test\.mjs/)
})

test("runtime image removes vulnerable Node tooling and upgrades the fixed OpenSSL packages", () => {
  const dockerfilePath = path.join(root, "Dockerfile.runtime")
  const source = readFileSync(dockerfilePath, "utf8")
  const runtimeStage = source.slice(source.lastIndexOf("FROM node:20-alpine"))

  assert.match(runtimeStage, /^[ \t]*&& apk upgrade --no-cache libcrypto3 libssl3 \\$/m)
  assert.match(runtimeStage, /^[ \t]*&& rm -rf \/usr\/local\/lib\/node_modules\/npm \/usr\/local\/bin\/npm \/usr\/local\/bin\/npx \\$/m)
})
