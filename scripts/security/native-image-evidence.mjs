import { readFileSync } from "node:fs"

export const APPROVED_RECORD_KEYS = [
  "schema_version",
  "policy_id",
  "web_repository",
  "web_sha",
  "image_subject",
  "image_digest",
  "provenance_predicate_type",
  "sbom_predicate_type",
  "vulnerability_predicate_type",
  "signer_workflow",
  "platform_sha",
  "deploy_run_id",
  "deployment_identity",
]

const fixedValues = {
  schema_version: "1",
  policy_id: "aquila-native-image-evidence-v1",
  web_repository: "AquilaXk/aquila-blog-web",
  image_subject: "ghcr.io/aquilaxk/aquila-blog-web-front",
  provenance_predicate_type: "https://slsa.dev/provenance/v1",
  sbom_predicate_type: "https://spdx.dev/Document/v2.3",
  vulnerability_predicate_type: "https://cosign.sigstore.dev/attestation/vuln/v1",
  signer_workflow: "AquilaXk/aquila-blog-web/.github/workflows/frontend-image.yml@refs/heads/main",
}

const shaPattern = /^[a-f0-9]{40}$/
const digestPattern = /^sha256:[a-f0-9]{64}$/
const positiveIntegerPattern = /^[1-9][0-9]*$/
const identityPattern = /^[a-f0-9]{64}$/
const runInvocationUriPattern = /^https:\/\/github\.com\/AquilaXk\/aquila-blog-web\/actions\/runs\/[1-9][0-9]*\/attempts\/[1-9][0-9]*$/

export class NativeImageEvidenceError extends Error {
  constructor(message) {
    super(message)
    this.name = "NativeImageEvidenceError"
  }
}

const fail = (message) => {
  throw new NativeImageEvidenceError(message)
}

const canonicalJson = (record) => JSON.stringify(record)
const isMatchingString = (value, pattern) => typeof value === "string" && pattern.test(value)

const assertExactKeys = (record) => {
  if (!record || typeof record !== "object" || Array.isArray(record)) fail("approved record must be an object")
  const keys = Object.keys(record)
  if (keys.length !== APPROVED_RECORD_KEYS.length || keys.some((key, index) => key !== APPROVED_RECORD_KEYS[index])) {
    fail("approved record keys are invalid")
  }
}

const assertRecord = (record) => {
  assertExactKeys(record)
  for (const [key, value] of Object.entries(fixedValues)) {
    if (record[key] !== value) fail(`${key} is invalid`)
  }
  if (!isMatchingString(record.web_sha, shaPattern)) fail("web_sha is invalid")
  if (!isMatchingString(record.image_digest, digestPattern)) fail("image_digest is invalid")
  if (!isMatchingString(record.platform_sha, shaPattern)) fail("platform_sha is invalid")
  if (!isMatchingString(record.deploy_run_id, positiveIntegerPattern)) fail("deploy_run_id is invalid")
  if (!isMatchingString(record.deployment_identity, identityPattern)) fail("deployment_identity is invalid")
  return record
}

export const buildApprovedRecord = ({ webSha, imageDigest, platformSha, deployRunId, deploymentIdentity }) => {
  const record = {
    schema_version: fixedValues.schema_version,
    policy_id: fixedValues.policy_id,
    web_repository: fixedValues.web_repository,
    web_sha: webSha,
    image_subject: fixedValues.image_subject,
    image_digest: imageDigest,
    provenance_predicate_type: fixedValues.provenance_predicate_type,
    sbom_predicate_type: fixedValues.sbom_predicate_type,
    vulnerability_predicate_type: fixedValues.vulnerability_predicate_type,
    signer_workflow: fixedValues.signer_workflow,
    platform_sha: platformSha,
    deploy_run_id: deployRunId,
    deployment_identity: deploymentIdentity,
  }
  return assertRecord(record)
}

export const parseApprovedRecord = (raw) => {
  if (typeof raw !== "string" || raw.trim() === "") fail("approved record is required")
  let record
  try {
    record = JSON.parse(raw)
  } catch {
    fail("approved record is not valid JSON")
  }
  assertRecord(record)
  if (canonicalJson(record) !== raw.trim()) fail("approved record is not canonical JSON")
  return record
}

export const compareApprovedRecords = (existing, candidate) => {
  assertRecord(existing)
  assertRecord(candidate)
  const existingRun = BigInt(existing.deploy_run_id)
  const candidateRun = BigInt(candidate.deploy_run_id)
  if (candidateRun > existingRun) return "replace"
  if (candidateRun < existingRun) fail("candidate deploy_run_id is older than the approved record")
  if (
    existing.deployment_identity === candidate.deployment_identity &&
    canonicalJson(existing) === canonicalJson(candidate)
  ) return "idempotent"
  fail("candidate conflicts with the approved deploy_run_id")
}

const parseAttestationRunUris = (path) => {
  let entries
  try {
    entries = JSON.parse(readFileSync(path, "utf8"))
  } catch {
    fail("attestation evidence is not valid JSON")
  }
  if (!Array.isArray(entries) || entries.length === 0) fail("attestation evidence must be a nonempty JSON array")

  return new Set(entries.map((entry) => {
    const runInvocationURI = entry?.verificationResult?.signature?.certificate?.runInvocationURI
    if (typeof runInvocationURI !== "string" || !runInvocationUriPattern.test(runInvocationURI)) {
      fail("attestation run invocation URI is invalid")
    }
    return runInvocationURI
  }))
}

export const selectCommonAttestationRun = (paths, expectedRunUri) => {
  if (!Array.isArray(paths) || paths.length !== 3 || paths.some((path) => typeof path !== "string" || path === "")) {
    fail("three attestation evidence files are required")
  }
  if (expectedRunUri !== undefined && !runInvocationUriPattern.test(expectedRunUri)) {
    fail("expected attestation run invocation URI is invalid")
  }

  const [first, ...rest] = paths.map(parseAttestationRunUris)
  const selected = [...first].find((uri) => rest.every((uris) => uris.has(uri)))
  if (!selected) fail("attestation evidence has no common run invocation URI")
  if (expectedRunUri !== undefined && selected !== expectedRunUri) {
    if (!first.has(expectedRunUri) || rest.some((uris) => !uris.has(expectedRunUri))) {
      fail("expected attestation run invocation URI is missing")
    }
    return expectedRunUri
  }
  return selected
}

const readCliRecord = (argument) => {
  if (argument !== undefined) return argument
  return readFileSync(0, "utf8")
}

const runCli = () => {
  const [command, ...arguments_] = process.argv.slice(2)
  if (command === "build-approved-record" && arguments_.length === 0) {
    const record = buildApprovedRecord({
      webSha: process.env.WEB_SHA,
      imageDigest: process.env.IMAGE_DIGEST,
      platformSha: process.env.PLATFORM_SHA,
      deployRunId: process.env.DEPLOY_RUN_ID,
      deploymentIdentity: process.env.DEPLOYMENT_IDENTITY,
    })
    process.stdout.write(`${canonicalJson(record)}\n`)
    return
  }
  if (command === "validate-approved-record" && arguments_.length <= 1) {
    const record = parseApprovedRecord(readCliRecord(arguments_[0]))
    process.stdout.write(`${canonicalJson(record)}\n`)
    return
  }
  if (command === "authorize-replacement" && arguments_.length === 0) {
    const candidate = parseApprovedRecord(process.env.CANDIDATE_APPROVED_RECORD)
    const existingRaw = process.env.EXISTING_APPROVED_RECORD
    const decision = existingRaw === undefined ? "create" : compareApprovedRecords(parseApprovedRecord(existingRaw), candidate)
    process.stdout.write(`${decision}\n`)
    return
  }
  if (command === "verify-attestation-set" && (arguments_.length === 3 || arguments_.length === 4)) {
    const [provenancePath, sbomPath, vulnerabilityPath, expectedRunUri] = arguments_
    process.stdout.write(`${selectCommonAttestationRun([provenancePath, sbomPath, vulnerabilityPath], expectedRunUri)}\n`)
    return
  }
  throw new NativeImageEvidenceError(
    "usage: build-approved-record | validate-approved-record [record-json] | authorize-replacement | verify-attestation-set <provenance.json> <sbom.json> <vulnerability.json> [expected-run-uri]",
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runCli()
  } catch (error) {
    const message = error instanceof Error ? error.message : "native image evidence validation failed"
    process.stderr.write(`Native image evidence failed: ${message}\n`)
    process.exitCode = 1
  }
}
