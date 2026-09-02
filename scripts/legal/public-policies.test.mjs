import assert from "node:assert/strict"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { buildCanonicalManifest, validatePublicPolicies } from "./validate-public-policies.mjs"

const repoRoot = path.resolve(import.meta.dirname, "../..")
const policySource = path.join(repoRoot, "legal/policies")
const exporter = path.join(repoRoot, "scripts/legal/export-policy-manifest.mjs")
const frontendMetadataPath = path.join(repoRoot, "src/apis/backend/legal.ts")
const activePolicyExpectations = {
  terms: {
    supersedes: "1.0.2",
    changeSummary: ["Align the service with an anonymously readable technical blog and internal-only administration."],
  },
  privacy: {
    supersedes: "1.0.3",
    changeSummary: ["Remove retired public-member and optional-tracking processing, and publish privacy@aquilaxk.site."],
  },
  cookies: {
    supersedes: "1.0.3",
    changeSummary: ["Remove retired member, preview, notification, legacy editor-draft, and optional-tracking storage from the current inventory."],
  },
}
const retiredActivePolicyTokens = [
  "Vercel",
  "Google Analytics",
  "NEXT_PUBLIC_RUM_SAMPLE_RATE",
  "privacy.optionalTrackingConsent.v1",
  "admin.editor.localDraft.v1",
  "admin.editor.localDraft.create.v2",
  "admin_tools_mail_snapshot_v1",
  "회원가입",
  "댓글",
  "OAuth",
]
const historicalPolicyRawSha256 = {
  "cookies.ko-KR.v1.0.0.yaml": "b1ac4dacabf5c9d7b2281fa577c5c26e238411207d5cc72b4e7d7ac88dc92905",
  "cookies.ko-KR.v1.0.1.yaml": "e01de46d8384de6363f630186e82109d6359fc4a4ad5fe99be1b1d3f0bb54cb1",
  "cookies.ko-KR.v1.0.2.yaml": "070c02bf222020c483e9cee6fe9c117d3dd03552e4e6a30d3af1355f9c851ae5",
  "cookies.ko-KR.v1.0.3.yaml": "7e405fc9029271388c28610c8dd72c86629568498bae23f7ecc33f130cdcbffd",
  "privacy.ko-KR.v1.0.0.yaml": "cbca98fdb182743566fed468a134ade8635b9a9a620f25546691e4a3d913ac71",
  "privacy.ko-KR.v1.0.1.yaml": "16685867d67a92005c7f52a18ea3dd2c49aa1014f041150c4df4bd1b7de4ebd1",
  "privacy.ko-KR.v1.0.2.yaml": "a92cb81a6a797662576202c9b57ffa76640faef5247279c1e2410408564d4ec5",
  "privacy.ko-KR.v1.0.3.yaml": "65336e556a31f972df5ea666fc35e97b4e59a17f824f90990e4df344e0a16b34",
  "terms.ko-KR.v1.0.0.yaml": "d4c985458cb998db8c1287f87b5d09abd2baa1a819d67301c6506b57ec89f5aa",
  "terms.ko-KR.v1.0.1.yaml": "050c58c63e5313893a300985cbf421b43d0a2bb92ca21a0153162d3809c5ea17",
  "terms.ko-KR.v1.0.2.yaml": "0d4a6b47e0707db8e39fc96dfbc25c18bb660b9bfda4149d08dfaf26c4d53b2e",
}

const copyPolicies = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aquila-public-policies-"))
  for (const name of fs.readdirSync(policySource)) {
    fs.copyFileSync(path.join(policySource, name), path.join(directory, name))
  }
  return directory
}

const writePolicy = (directory, name, policy) => {
  policy.contentSha256 = ""
  policy.contentSha256 = crypto.createHash("sha256").update(JSON.stringify(policy)).digest("hex")
  fs.writeFileSync(path.join(directory, name), `${JSON.stringify(policy, null, 2)}\n`)
}

test("publishes the approved 1.0.4 public-policy cutover", () => {
  const result = validatePublicPolicies({ policiesDir: policySource, frontendMetadataPath })

  assert.equal(result.ok, true)
  for (const [kind, expectation] of Object.entries(activePolicyExpectations)) {
    const policy = JSON.parse(fs.readFileSync(path.join(policySource, `${kind}.ko-KR.v1.0.4.yaml`), "utf8"))
    assert.equal(result.active[kind].version, "1.0.4")
    assert.equal(policy.status, "effective")
    assert.equal(policy.publishedAt, "2026-09-01T12:43:19Z")
    assert.equal(policy.effectiveAt, "2026-09-01T12:43:19Z")
    assert.equal(policy.supersedes, expectation.supersedes)
    assert.equal(policy.contactEmail, "privacy@aquilaxk.site")
    assert.deepEqual(policy.changeSummary, expectation.changeSummary)
    assert.equal(result.manifest.active[kind].contentSha256, policy.contentSha256)
    const activeText = JSON.stringify(policy)
    for (const token of retiredActivePolicyTokens) assert.equal(activeText.includes(token), false, `${kind}: ${token}`)
  }
})

test("keeps every historical public-policy byte sequence immutable", () => {
  for (const [name, expectedHash] of Object.entries(historicalPolicyRawSha256)) {
    const bytes = fs.readFileSync(path.join(policySource, name))
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), expectedHash, name)
  }
})

test("a newer draft neither replaces active metadata nor changes the canonical manifest", () => {
  const directory = copyPolicies()
  const baseline = buildCanonicalManifest(validatePublicPolicies({ policiesDir: directory, frontendMetadataPath }).active)
  const draft = JSON.parse(fs.readFileSync(path.join(directory, "terms.ko-KR.v1.0.2.yaml"), "utf8"))
  draft.version = "9.0.0"
  draft.status = "draft"
  writePolicy(directory, "terms.ko-KR.v9.0.0.yaml", draft)

  const result = validatePublicPolicies({ policiesDir: directory, frontendMetadataPath })

  assert.equal(result.ok, true)
  assert.deepEqual(buildCanonicalManifest(result.active), baseline)
})

test("rejects a policy whose canonical content hash drifts", () => {
  const directory = copyPolicies()
  const policyPath = path.join(directory, "privacy.ko-KR.v1.0.3.yaml")
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"))
  policy.contentSha256 = "0".repeat(64)
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`)

  const result = validatePublicPolicies({ policiesDir: directory, frontendMetadataPath })

  assert.equal(result.ok, false)
  assert.match(result.errors.join("\n"), /contentSha256 mismatch/)
})

test("canonical manifest contains policy identity only, while frontend acceptance metadata excludes cookies", () => {
  const result = validatePublicPolicies({ policiesDir: policySource, frontendMetadataPath })
  const manifest = buildCanonicalManifest(result.active)

  assert.equal(result.ok, true)
  assert.equal("repository" in manifest, false)
  assert.equal("commit" in manifest, false)
  assert.equal(JSON.stringify(manifest).includes("cookies"), true)
  const acceptanceSource = fs.readFileSync(frontendMetadataPath, "utf8")
  assert.doesNotMatch(acceptanceSource, /^\s*cookies:/m)
})

test("check mode rejects stale canonical manifest bytes without rewriting them", () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "legal-manifest-")), "manifest.json")
  fs.writeFileSync(output, "{}\n")
  const result = spawnSync(process.execPath, [exporter, "--check", "--output", output], { cwd: repoRoot, encoding: "utf8" })
  assert.notEqual(result.status, 0)
  assert.equal(fs.readFileSync(output, "utf8"), "{}\n")
})

test("exporter rejects output without a value with a controlled usage error", () => {
  const result = spawnSync(process.execPath, [exporter, "--output"], { cwd: repoRoot, encoding: "utf8" })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /expected optional --check and --output <path>/)
})

test("rejects effective reviewRequired, retired signup metadata, and frontend acceptance hash drift", () => {
  const directory = copyPolicies()
  const policyPath = path.join(directory, "privacy.ko-KR.v1.0.3.yaml")
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"))
  policy.reviewRequired = ["internal"]
  writePolicy(directory, "privacy.ko-KR.v1.0.3.yaml", policy)
  assert.match(validatePublicPolicies({ policiesDir: directory, frontendMetadataPath }).errors.join("\n"), /must not contain reviewRequired/)
  const metadata = path.join(directory, "legal.ts")
  fs.writeFileSync(metadata, fs.readFileSync(frontendMetadataPath, "utf8").replace(/contentSha256: "[a-f0-9]{64}"/, `contentSha256: "${"0".repeat(64)}"`))
  assert.match(validatePublicPolicies({ policiesDir: policySource, frontendMetadataPath: metadata }).errors.join("\n"), /terms contentSha256 mismatch/)
  const retiredMetadata = path.join(directory, "retired-legal.ts")
  fs.writeFileSync(
    retiredMetadata,
    fs.readFileSync(frontendMetadataPath, "utf8").replace(
      "export const ACTIVE_LEGAL_DOCUMENTS = {",
      'export const ACTIVE_LEGAL_DOCUMENTS = {\n  signupPolicyVersion: "1.0.3",',
    ),
  )
  assert.match(validatePublicPolicies({ policiesDir: policySource, frontendMetadataPath: retiredMetadata }).errors.join("\n"), /retired signupPolicyVersion/)
})
