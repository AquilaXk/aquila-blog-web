import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  APPROVED_RECORD_KEYS,
  NativeImageEvidenceError,
  buildApprovedRecord,
  compareApprovedRecords,
  parseApprovedRecord,
  selectCommonAttestationRun,
} from "./native-image-evidence.mjs"

const scriptPath = new URL("./native-image-evidence.mjs", import.meta.url)

const input = (overrides = {}) => ({
  webSha: "a".repeat(40),
  imageDigest: `sha256:${"b".repeat(64)}`,
  platformSha: "c".repeat(40),
  deployRunId: "12345",
  deploymentIdentity: "d".repeat(64),
  ...overrides,
})

test("builds canonical compact records with the fixed native-image policy", () => {
  const record = buildApprovedRecord(input())

  assert.deepEqual(Object.keys(record), APPROVED_RECORD_KEYS)
  assert.deepEqual(record, {
    schema_version: "1",
    policy_id: "aquila-native-image-evidence-v1",
    web_repository: "AquilaXk/aquila-blog-web",
    web_sha: "a".repeat(40),
    image_subject: "ghcr.io/aquilaxk/aquila-blog-web-front",
    image_digest: `sha256:${"b".repeat(64)}`,
    provenance_predicate_type: "https://slsa.dev/provenance/v1",
    sbom_predicate_type: "https://spdx.dev/Document/v2.3",
    vulnerability_predicate_type: "https://cosign.sigstore.dev/attestation/vuln/v1",
    signer_workflow: "AquilaXk/aquila-blog-web/.github/workflows/frontend-image.yml@refs/heads/main",
    platform_sha: "c".repeat(40),
    deploy_run_id: "12345",
    deployment_identity: "d".repeat(64),
  })
})

test("rejects non-canonical records before they can become approved state", () => {
  const valid = buildApprovedRecord(input())
  const invalid = [
    { ...valid, unexpected: "field" },
    Object.fromEntries(Object.entries(valid).filter(([key]) => key !== "policy_id")),
    { ...valid, web_sha: "A".repeat(40) },
    { ...valid, image_digest: `sha256:${"b".repeat(63)}` },
    { ...valid, deploy_run_id: "0" },
    { ...valid, deployment_identity: "not-a-hash" },
    { ...valid, signer_workflow: "AquilaXk/aquila-blog-web/.github/workflows/other.yml@refs/heads/main" },
  ]

  for (const candidate of invalid) {
    assert.throws(() => parseApprovedRecord(JSON.stringify(candidate)), NativeImageEvidenceError)
  }
})

test("only permits newer Platform runs or an exact idempotent record", () => {
  const existing = buildApprovedRecord(input({ deployRunId: "12345" }))
  const newer = buildApprovedRecord(input({ deployRunId: "12346", deploymentIdentity: "e".repeat(64) }))
  const sameRunDifferentIdentity = buildApprovedRecord(input({ deploymentIdentity: "e".repeat(64) }))
  const older = buildApprovedRecord(input({ deployRunId: "12344", deploymentIdentity: "e".repeat(64) }))

  assert.equal(compareApprovedRecords(existing, existing), "idempotent")
  assert.equal(compareApprovedRecords(existing, newer), "replace")
  assert.throws(() => compareApprovedRecords(existing, sameRunDifferentIdentity), NativeImageEvidenceError)
  assert.throws(() => compareApprovedRecords(existing, older), NativeImageEvidenceError)
})

test("CLI builds from environment and validates a record from standard input", () => {
  const environment = {
    ...process.env,
    WEB_SHA: "a".repeat(40),
    IMAGE_DIGEST: `sha256:${"b".repeat(64)}`,
    PLATFORM_SHA: "c".repeat(40),
    DEPLOY_RUN_ID: "12345",
    DEPLOYMENT_IDENTITY: "d".repeat(64),
  }
  const built = spawnSync(process.execPath, [scriptPath.pathname, "build-approved-record"], {
    encoding: "utf8",
    env: environment,
  })
  assert.equal(built.status, 0, built.stderr)
  assert.deepEqual(JSON.parse(built.stdout), buildApprovedRecord(input()))

  const validated = spawnSync(process.execPath, [scriptPath.pathname, "validate-approved-record"], {
    encoding: "utf8",
    input: built.stdout,
  })
  assert.equal(validated.status, 0, validated.stderr)
  assert.equal(validated.stdout, built.stdout)
})

test("CLI authorizes a create, replacement, or exact idempotent approved record", () => {
  const candidate = JSON.stringify(buildApprovedRecord(input()))
  const baseEnvironment = { ...process.env, CANDIDATE_APPROVED_RECORD: candidate }

  const created = spawnSync(process.execPath, [scriptPath.pathname, "authorize-replacement"], {
    encoding: "utf8",
    env: baseEnvironment,
  })
  assert.equal(created.status, 0, created.stderr)
  assert.equal(created.stdout, "create\n")

  const existing = buildApprovedRecord(input({ deployRunId: "12344", deploymentIdentity: "e".repeat(64) }))
  const replaced = spawnSync(process.execPath, [scriptPath.pathname, "authorize-replacement"], {
    encoding: "utf8",
    env: { ...baseEnvironment, EXISTING_APPROVED_RECORD: JSON.stringify(existing) },
  })
  assert.equal(replaced.status, 0, replaced.stderr)
  assert.equal(replaced.stdout, "replace\n")

  const idempotent = spawnSync(process.execPath, [scriptPath.pathname, "authorize-replacement"], {
    encoding: "utf8",
    env: { ...baseEnvironment, EXISTING_APPROVED_RECORD: candidate },
  })
  assert.equal(idempotent.status, 0, idempotent.stderr)
  assert.equal(idempotent.stdout, "idempotent\n")
})

test("CLI rejects invalid, older, and conflicting approved-record replacements", () => {
  const candidate = JSON.stringify(buildApprovedRecord(input()))
  const cases = [
    { environment: { CANDIDATE_APPROVED_RECORD: "" } },
    { environment: { CANDIDATE_APPROVED_RECORD: "{}" } },
    {
      environment: {
        CANDIDATE_APPROVED_RECORD: candidate,
        EXISTING_APPROVED_RECORD: JSON.stringify(buildApprovedRecord(input({ deployRunId: "12346", deploymentIdentity: "e".repeat(64) }))),
      },
    },
    {
      environment: {
        CANDIDATE_APPROVED_RECORD: candidate,
        EXISTING_APPROVED_RECORD: JSON.stringify(buildApprovedRecord(input({ deploymentIdentity: "e".repeat(64) }))),
      },
    },
  ]

  for (const { environment } of cases) {
    const result = spawnSync(process.execPath, [scriptPath.pathname, "authorize-replacement"], {
      encoding: "utf8",
      env: { ...process.env, ...environment },
    })
    assert.notEqual(result.status, 0)
  }
})

const runUri = (runId) => `https://github.com/AquilaXk/aquila-blog-web/actions/runs/${runId}/attempts/1`

const attestationEntry = (uri) => ({ verificationResult: { signature: { certificate: { runInvocationURI: uri } } } })

const writeAttestationSet = (entries) => {
  const directory = mkdtempSync(join(tmpdir(), "native-image-evidence-"))
  const paths = ["provenance", "sbom", "vulnerability"].map((name) => join(directory, `${name}.json`))
  for (let index = 0; index < paths.length; index += 1) writeFileSync(paths[index], JSON.stringify(entries[index]))
  return paths
}

test("selects a common verified run URI across all attestation arrays", () => {
  const expected = runUri(23)
  const paths = writeAttestationSet([
    [attestationEntry(runUri(22)), attestationEntry(expected), attestationEntry(expected)],
    [attestationEntry(expected)],
    [attestationEntry(runUri(24)), attestationEntry(expected)],
  ])

  assert.equal(selectCommonAttestationRun(paths), expected)
  assert.equal(selectCommonAttestationRun(paths, expected), expected)
})

test("rejects attestation arrays without a common run or with malformed run evidence", () => {
  const valid = attestationEntry(runUri(23))
  const noCommon = writeAttestationSet([[valid], [attestationEntry(runUri(24))], [valid]])
  const wrongRepository = writeAttestationSet([[attestationEntry("https://github.com/other/repo/actions/runs/23/attempts/1")], [valid], [valid]])
  const missingArray = writeAttestationSet([[valid], {}, [valid]])
  const emptyArray = writeAttestationSet([[valid], [], [valid]])

  for (const paths of [noCommon, wrongRepository, missingArray, emptyArray]) {
    assert.throws(() => selectCommonAttestationRun(paths), NativeImageEvidenceError)
  }
  assert.throws(() => selectCommonAttestationRun(writeAttestationSet([[valid], [valid], [valid]]), runUri(24)), NativeImageEvidenceError)
})

test("CLI verifies a selected attestation run URI from the supplied files", () => {
  const expected = runUri(23)
  const paths = writeAttestationSet([[attestationEntry(expected)], [attestationEntry(expected)], [attestationEntry(expected)]])
  const result = spawnSync(process.execPath, [scriptPath.pathname, "verify-attestation-set", ...paths, expected], {
    encoding: "utf8",
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, `${expected}\n`)
})
