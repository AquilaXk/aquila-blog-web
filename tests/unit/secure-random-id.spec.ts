import { expect, test } from "@playwright/test"
import { readFileSync } from "fs"
import path from "path"
import { createUploadPlaceholderId } from "../../src/components/markdown-editor/markdownEditorPasteDropModel"
import { generateIdempotencyKey } from "../../src/routes/Admin/EditorStudioWorkspaceControllerRootModel"
import { createApiErrorReportId } from "../../src/libs/rum/reportApiError"
import { createClientErrorId } from "../../src/libs/rum/reportClientError"
import { createSecureRandomUuid } from "../../src/libs/security/secureRandomUuid"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const sourcePath = (...parts: string[]) =>
  path.resolve(__dirname, "../../src", ...parts)

test("secure UUID owner fails closed when Web Crypto randomUUID is unavailable", () => {
  const fixedUuid = "123e4567-e89b-42d3-a456-426614174000"

  expect(createSecureRandomUuid({ randomUUID: () => fixedUuid })).toBe(
    fixedUuid
  )
  expect(() => createSecureRandomUuid({})).toThrow(
    "Secure random UUID is unavailable"
  )
})

test("RUM, upload, and post-write identifiers use UUID values with their public format intact", () => {
  const apiErrorId = createApiErrorReportId()
  const clientErrorId = createClientErrorId()
  const uploadIds = [createUploadPlaceholderId(), createUploadPlaceholderId()]
  const idempotencyKeys = [generateIdempotencyKey(), generateIdempotencyKey()]

  expect(apiErrorId.startsWith("err_")).toBe(true)
  expect(apiErrorId.length).toBeLessThanOrEqual(80)
  expect(apiErrorId.slice(4)).toMatch(UUID_PATTERN)
  expect(clientErrorId.startsWith("err_")).toBe(true)
  expect(clientErrorId.length).toBeLessThanOrEqual(80)
  expect(clientErrorId.slice(4)).toMatch(UUID_PATTERN)
  expect(uploadIds.every((value) => UUID_PATTERN.test(value))).toBe(true)
  expect(idempotencyKeys.every((value) => UUID_PATTERN.test(value))).toBe(true)
  expect(new Set([...uploadIds, ...idempotencyKeys]).size).toBe(4)
})

test("security identity generators have no timestamp or Math.random fallback", () => {
  const apiErrorSource = readFileSync(
    sourcePath("libs", "rum", "reportApiError.ts"),
    "utf8"
  )
  const identitySources = [
    readFileSync(sourcePath("libs", "rum", "reportClientError.ts"), "utf8"),
    readFileSync(
      sourcePath(
        "components",
        "markdown-editor",
        "markdownEditorPasteDropModel.ts"
      ),
      "utf8"
    ),
    readFileSync(
      sourcePath(
        "routes",
        "Admin",
        "EditorStudioWorkspaceControllerRootModel.ts"
      ),
      "utf8"
    ),
  ]

  expect(apiErrorSource.match(/Math\.random/g)).toHaveLength(1)
  expect(apiErrorSource).toContain("random: () => number = Math.random")
  for (const source of identitySources) {
    expect(source).not.toContain("Math.random")
  }

  for (const generator of [
    createApiErrorReportId,
    createClientErrorId,
    createUploadPlaceholderId,
    generateIdempotencyKey,
  ]) {
    expect(generator.toString()).toContain("createSecureRandomUuid")
    expect(generator.toString()).not.toContain("Date.now")
    expect(generator.toString()).not.toContain("Math.random")
  }
})
