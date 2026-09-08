import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"

test("admin profile readers share the fail-closed request contract", () => {
  const hookSource = readFileSync(path.resolve(__dirname, "../../src/hooks/useAdminProfile.ts"), "utf8")
  const rootLayoutSource = readFileSync(path.resolve(__dirname, "../../src/layouts/RootLayout/index.tsx"), "utf8")
  const requestSource = readFileSync(path.resolve(__dirname, "../../src/libs/publicAdminProfileClient.ts"), "utf8")

  expect(hookSource).toContain("queryFn: fetchPublicAdminProfile")
  expect(hookSource).toContain("throwOnError: true")
  expect(rootLayoutSource).toContain('from "src/hooks/useAdminProfile"')
  expect(rootLayoutSource).toContain("useAdminProfile(initialAdminProfile,")
  expect(rootLayoutSource).not.toContain("fetchPublicAdminProfile")
  expect(requestSource).toContain('await import("src/apis/backend/client")')
  expect(requestSource).toContain("return await apiFetch<AdminProfile>(PUBLIC_ADMIN_PROFILE_PATH)")
  expect(requestSource).not.toContain("persistAdminProfileSnapshotCookie")
  expect(hookSource).not.toContain("return initialProfile ?? null")
  expect(rootLayoutSource).not.toContain("if (!response.ok) return null")
})
