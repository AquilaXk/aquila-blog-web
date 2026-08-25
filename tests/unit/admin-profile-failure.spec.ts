import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"

test("admin profile query propagates API failures instead of returning retained data", () => {
  const source = readFileSync(path.resolve(__dirname, "../../src/hooks/useAdminProfile.ts"), "utf8")

  expect(source).toContain('const nextProfile = await apiFetch<AdminProfile>("/member/api/v1/members/adminProfile")')
  expect(source).toContain("throwOnError: true")
  expect(source).not.toContain("catch {")
  expect(source).not.toContain("return initialProfile ?? null")
})
