import { expect, test } from "@playwright/test"
import { resolvePublicAdminProfileCacheControl, resolveStaticAdminProfileSeed } from "../../src/libs/server/adminProfile"
import { shouldRefetchAdminProfileSource } from "../../src/libs/adminProfileSource"

test("published profile seed preserves the API object and intentionally empty fields", async () => {
  const profile = {
    username: "owner", name: "Owner", nickname: "Owner", profileImageUrl: "/profile.svg",
    aboutHeadline: "", aboutProjects: [], serviceLinks: [], contactLinks: [],
  }
  const result = await resolveStaticAdminProfileSeed(async () => profile)
  expect(result.source).toBe("published")
  expect(result.profile).toBe(profile)
  expect(shouldRefetchAdminProfileSource(result.source)).toBe(false)
})

test("failed profile seed stays unavailable without generating a replacement profile", async () => {
  const result = await resolveStaticAdminProfileSeed(async () => { throw new Error("Unavailable") })
  expect(result).toEqual({ profile: null, source: "unavailable" })
  expect(shouldRefetchAdminProfileSource(result.source)).toBe(true)
  expect(resolvePublicAdminProfileCacheControl({ debugSsr: false, hasAuthCookie: false, source: result.source })).toBe("private, no-store")
})

test("only anonymous published profile responses use shared caching", () => {
  expect(resolvePublicAdminProfileCacheControl({ debugSsr: false, hasAuthCookie: false, source: "published" })).toContain("public,")
  expect(resolvePublicAdminProfileCacheControl({ debugSsr: false, hasAuthCookie: true, source: "published" })).toBe("private, no-store")
  expect(resolvePublicAdminProfileCacheControl({ debugSsr: true, hasAuthCookie: false, source: "published" })).toBe("private, no-store")
})
