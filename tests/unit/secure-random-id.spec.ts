import { expect, test } from "@playwright/test"
import { readFileSync } from "fs"
import path from "path"
import { createUploadPlaceholderId } from "../../src/components/markdown-editor/markdownEditorPasteDropModel"
import { generateIdempotencyKey } from "../../src/routes/Admin/EditorStudioWorkspaceControllerRootModel"
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

test("upload and post-write identifiers use UUID values with their public format intact", () => {
  const uploadIds = [createUploadPlaceholderId(), createUploadPlaceholderId()]
  const idempotencyKeys = [generateIdempotencyKey(), generateIdempotencyKey()]

  expect(uploadIds.every((value) => UUID_PATTERN.test(value))).toBe(true)
  expect(idempotencyKeys.every((value) => UUID_PATTERN.test(value))).toBe(true)
  expect(new Set([...uploadIds, ...idempotencyKeys]).size).toBe(4)
})

test("security identity generators have no timestamp or Math.random fallback", () => {
  const identitySources = [
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

  for (const source of identitySources) {
    expect(source).not.toContain("Math.random")
  }

  for (const generator of [
    createUploadPlaceholderId,
    generateIdempotencyKey,
  ]) {
    expect(generator.toString()).toContain("createSecureRandomUuid")
    expect(generator.toString()).not.toContain("Date.now")
    expect(generator.toString()).not.toContain("Math.random")
  }
})
