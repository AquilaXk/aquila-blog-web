import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import path from "node:path"

const root = path.resolve(__dirname, "../..")
const readProjectFile = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8")

test("admin cookie client contract", () => {
  const packageJson = JSON.parse(readProjectFile("package.json")) as {
    dependencies: Record<string, string>
    resolutions?: Record<string, string>
  }
  const lockfile = readProjectFile("yarn.lock")
  const adminProfileSource = readProjectFile("src/hooks/useAdminProfile.ts")
  const adminToolsSource = readProjectFile("src/routes/Admin/AdminToolsWorkspacePageState.ts")

  expect(packageJson.dependencies["cookies-next"]).toBe("6.1.1")
  expect(packageJson.resolutions?.cookie).toBeUndefined()
  expect(lockfile).toContain("cookies-next@6.1.1:")
  expect(lockfile).toContain('cookie "^1.0.1"')
  expect(lockfile).toMatch(/cookie@\^1\.0\.1:\n  version "1\.\d+\.\d+"/)

  for (const source of [adminProfileSource, adminToolsSource]) {
    expect(source).toContain('import { setCookie } from "cookies-next/client"')
    expect(source).toContain('sameSite: "lax"')
    expect(source).toContain("maxAge:")
    expect(source).toContain('secure: typeof window !== "undefined" && window.location.protocol === "https:"')
  }

  expect(adminProfileSource).toContain('const ADMIN_PROFILE_SNAPSHOT_COOKIE = "admin_profile_snapshot_v1"')
  expect(adminProfileSource).toContain("const ADMIN_PROFILE_SNAPSHOT_MAX_AGE_SECONDS = 60 * 30")
  expect(adminProfileSource).toContain('path: "/"')
  expect(adminProfileSource).toContain("maxAge: ADMIN_PROFILE_SNAPSHOT_MAX_AGE_SECONDS")

  expect(adminToolsSource).toContain('const ADMIN_TOOLS_MAIL_SNAPSHOT_COOKIE = "admin_tools_mail_snapshot_v1"')
  expect(adminToolsSource).toContain("const ADMIN_TOOLS_MAIL_SNAPSHOT_MAX_AGE_SECONDS = 60 * 30")
  expect(adminToolsSource).toContain('path: "/admin/tools"')
  expect(adminToolsSource).toContain("maxAge: ADMIN_TOOLS_MAIL_SNAPSHOT_MAX_AGE_SECONDS")
})
