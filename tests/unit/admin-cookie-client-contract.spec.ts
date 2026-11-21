import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import path from "node:path"

const root = path.resolve(__dirname, "../..")
const readProjectFile = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8")

test("admin cookie client contract and clean-room dependency removal", () => {
  const packageJson = JSON.parse(readProjectFile("package.json")) as {
    dependencies: Record<string, string>
    resolutions?: Record<string, string>
  }
  const lockfile = readProjectFile("yarn.lock")
  const adminProfileSource = readProjectFile("src/hooks/useAdminProfile.ts")
  const publicAdminProfileClientSource = readProjectFile("src/libs/publicAdminProfileClient.ts")

  expect(packageJson.dependencies["cookies-next"]).toBeUndefined()
  expect(packageJson.dependencies["next-sitemap"]).toBeUndefined()
  expect(packageJson.dependencies["remark-github-blockquote-alert"]).toBeUndefined()
  expect(packageJson.resolutions?.cookie).toBeUndefined()
  expect(lockfile).not.toContain("cookies-next@")
  expect(lockfile).not.toContain("next-sitemap@")
  expect(lockfile).not.toContain("remark-github-blockquote-alert@")

  expect(adminProfileSource).not.toContain("cookies-next/client")
  expect(publicAdminProfileClientSource).not.toContain('import { setCookie } from "cookies-next/client"')
  expect(publicAdminProfileClientSource).not.toContain("cookies-next/client")
  expect(publicAdminProfileClientSource).not.toContain("admin_profile_snapshot_v1")
})
