import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "../..")
const workflowPath = path.join(root, ".github/workflows/rescan-approved-web-image.yml")
const ciPath = path.join(root, ".github/workflows/ci.yml")

function workflow() {
  assert.equal(existsSync(workflowPath), true, "approved Web image rescan workflow must exist")
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

test("daily rescan accepts only the canonical approved record and exact OCI digest", () => {
  const { source, document } = workflow()
  assert.deepEqual(Object.keys(document.true), ["schedule"])
  assert.equal(document.true.schedule.length, 1)
  assert.doesNotMatch(source, /workflow_dispatch|image:latest|continue-on-error/)
  assert.deepEqual(document.permissions, { attestations: "read", contents: "read", packages: "read" })
  assert.deepEqual(document.concurrency, { group: "approved-web-image-daily-rescan", "cancel-in-progress": false })

  const job = document.jobs.rescan
  const record = step(job, "Validate approved Web deployment record")
  assert.equal(record.env.APPROVED_RECORD, "${{ vars.AQUILA_APPROVED_WEB_DEPLOYMENT_V1 }}")
  assert.match(record.run, /native-image-evidence\.mjs validate-approved-record/)

  const evidence = step(job, "Verify exact Web image attestations")
  assert.equal(evidence.env.GH_TOKEN, "${{ github.token }}")
  assert.match(evidence.run, /gh attestation verify "oci:\/\/\$\{IMAGE_REF\}"/)
  assert.match(evidence.run, /--source-digest "\$\{WEB_SHA\}"/)
  assert.match(evidence.run, /https:\/\/slsa\.dev\/provenance\/v1/)
  assert.match(evidence.run, /https:\/\/spdx\.dev\/Document\/v2\.3/)
  assert.match(evidence.run, /https:\/\/cosign\.sigstore\.dev\/attestation\/vuln\/v1/)
  assert.match(
    evidence.run,
    /native-image-evidence\.mjs verify-attestation-set \\\n\s+\/tmp\/web-image-provenance\.json \\\n\s+\/tmp\/web-image-sbom\.json \\\n\s+\/tmp\/web-image-vulnerability-attestation\.json/,
  )

  const scan = step(job, "Rescan approved immutable Web image")
  assert.match(scan.run, /docker pull "\$\{IMAGE_REF\}"/)
  assert.match(scan.run, /trivy image[\s\S]*--format cosign-vuln[\s\S]*--severity HIGH,CRITICAL[\s\S]*--exit-code 1[\s\S]*"\$\{IMAGE_REF\}"/)
  assert.ok(job.steps.indexOf(record) < job.steps.indexOf(evidence))
  assert.ok(job.steps.indexOf(evidence) < job.steps.indexOf(scan))
})

test("Web CI executes the approved image rescan workflow contract test", () => {
  const ci = readFileSync(ciPath, "utf8")
  assert.match(ci, /node --test scripts\/contracts\/rescan-approved-web-image-workflow\.test\.mjs/)
  assert.match(ci, /node --test scripts\/security\/native-image-evidence\.test\.mjs/)
})
