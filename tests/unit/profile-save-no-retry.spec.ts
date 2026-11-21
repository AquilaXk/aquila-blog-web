import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"

test("profile writes do not replay conflicts through the retired retry wrapper", () => {
  const model = readFileSync(path.resolve(__dirname, "../../src/routes/Admin/AdminProfileWorkspacePageModel.ts"), "utf8")
  expect(model).not.toContain("saveProfileCardWithConflictRetry")
  expect(existsSync(path.resolve(__dirname, "../../src/libs/profileCardSave.ts"))).toBe(false)
  expect(model).toContain('method: "PATCH"')
  expect(model).toContain('method: "PUT"')
})
