import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
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
  assert.ok(job.steps.indexOf(build) < job.steps.indexOf(digest))

  const scan = step(job, "Pull and scan pushed immutable Web image")
  assert.match(scan.run, /docker pull "\$\{IMAGE_REF\}"/)
  assert.match(scan.run, /trivy image .*--ignorefile \.trivyignore\.yaml .*--severity HIGH,CRITICAL .*--exit-code 1.*"\$\{IMAGE_REF\}"/)
  assert.ok(job.steps.indexOf(digest) < job.steps.indexOf(scan))

  const token = step(job, "Create Platform dispatch token")
  assert.equal(token.if, undefined)
  assert.match(token.uses, /^actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1$/)
  assert.equal(token.with["client-id"], "${{ vars.REPO_SYNC_APP_CLIENT_ID }}")
  assert.equal(token.with.owner, "AquilaXk")
  assert.equal(token.with.repositories, "aquila-blog")
  assert.equal(token.with["permission-contents"], "write")
  assert.ok(job.steps.indexOf(scan) < job.steps.indexOf(token))

  const dispatch = step(job, "Dispatch immutable Web image to Platform")
  assert.equal(dispatch.if, undefined)
  assert.equal(dispatch.env.GH_TOKEN, "${{ steps.app-token.outputs.token }}")
  assert.match(dispatch.run, /gh api --method POST "repos\/AquilaXk\/aquila-blog\/dispatches"/)
  assert.match(dispatch.run, /event_type="web_frontend_image_ready"/)
  assert.match(dispatch.run, /"client_payload\[image_ref\]=\$\{IMAGE_REF\}"/)
  assert.match(dispatch.run, /"client_payload\[source_sha\]=\$\{SOURCE_SHA\}"/)
  assert.ok(job.steps.indexOf(token) < job.steps.indexOf(dispatch))

  assert.doesNotMatch(source, /workflow_dispatch|repository:\s*AquilaXk\/aquila-blog|personal access token|secrets\.[A-Z_]*PAT/i)
  assert.equal((source.match(/web_frontend_image_ready/g) ?? []).length, 1)
  assert.equal((source.match(/gh api --method POST/g) ?? []).length, 1)
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
