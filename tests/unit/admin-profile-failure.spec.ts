import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { resolveShouldRefetchAdminProfile } from "../../src/layouts/RootLayout"

test("admin profile readers share the fail-closed request contract", () => {
  const hookSource = readFileSync(path.resolve(__dirname, "../../src/hooks/useAdminProfile.ts"), "utf8")
  const rootLayoutSource = readFileSync(path.resolve(__dirname, "../../src/layouts/RootLayout/index.tsx"), "utf8")
  const requestSource = readFileSync(path.resolve(__dirname, "../../src/libs/publicAdminProfileClient.ts"), "utf8")

  expect(hookSource).toContain("queryFn: fetchPublicAdminProfile")
  expect(hookSource).toContain("throwOnError: false")
  expect(rootLayoutSource).toContain('from "src/hooks/useAdminProfile"')
  expect(rootLayoutSource).toContain("useAdminProfile(initialAdminProfile,")
  expect(rootLayoutSource).not.toContain("fetchPublicAdminProfile")
  expect(requestSource).toContain('await import("src/apis/backend/client")')
  expect(requestSource).not.toContain("persistAdminProfileSnapshotCookie")
  expect(hookSource).not.toContain("return initialProfile ?? null")
  expect(rootLayoutSource).not.toContain("if (!response.ok) return null")
})

test("RootLayout avoids duplicate admin profile XHR when seed profile is present and valid", () => {
  const rootLayoutSource = readFileSync(path.resolve(__dirname, "../../src/layouts/RootLayout/index.tsx"), "utf8")
  expect(rootLayoutSource).toContain("enabled: shouldLoadAdminProfile")
  expect(rootLayoutSource).toContain("refetchOnMount: shouldRefetchAdminProfile")
  expect(rootLayoutSource).toContain("staleTimeMs: shouldRefetchAdminProfile ? 0 : undefined")
  expect(rootLayoutSource).toContain("const shouldRefetchAdminProfile =")
})

test("resolveShouldRefetchAdminProfile behaves correctly across route and seed states", () => {
  const dummyProfile = { username: "aquila", name: "Aquila", nickname: "Aquila" } as never

  // 1. Public route with valid seeded profile -> should NOT refetch on mount (duplicate XHR prevented)
  expect(
    resolveShouldRefetchAdminProfile({
      shouldLoadAdminProfile: true,
      isAdminRoute: false,
      initialAdminProfile: dummyProfile,
      initialAdminProfileShouldRefetch: false,
    })
  ).toBe(false)

  // 2. Public route without seed profile -> MUST refetch on mount
  expect(
    resolveShouldRefetchAdminProfile({
      shouldLoadAdminProfile: true,
      isAdminRoute: false,
      initialAdminProfile: null,
      initialAdminProfileShouldRefetch: true,
    })
  ).toBe(true)

  // 3. Public route with seed that requires refetch -> MUST refetch on mount
  expect(
    resolveShouldRefetchAdminProfile({
      shouldLoadAdminProfile: true,
      isAdminRoute: false,
      initialAdminProfile: dummyProfile,
      initialAdminProfileShouldRefetch: true,
    })
  ).toBe(true)

  // 4. Admin route -> always refetches fresh on mount
  expect(
    resolveShouldRefetchAdminProfile({
      shouldLoadAdminProfile: true,
      isAdminRoute: true,
      initialAdminProfile: dummyProfile,
      initialAdminProfileShouldRefetch: false,
    })
  ).toBe(true)

  // 5. Standalone surface (shouldLoadAdminProfile = false) -> never refetches
  expect(
    resolveShouldRefetchAdminProfile({
      shouldLoadAdminProfile: false,
      isAdminRoute: false,
      initialAdminProfile: null,
      initialAdminProfileShouldRefetch: true,
    })
  ).toBe(false)

  // 6. Admin login (shouldLoadAdminProfile = false) -> never refetches
  expect(
    resolveShouldRefetchAdminProfile({
      shouldLoadAdminProfile: false,
      isAdminRoute: true,
      initialAdminProfile: null,
      initialAdminProfileShouldRefetch: true,
    })
  ).toBe(false)
})


