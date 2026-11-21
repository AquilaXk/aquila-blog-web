import { expect, test } from "@playwright/test"
import { resolveStaticAdminProfileSeed } from "../../src/libs/server/adminProfile"

const profile = { username: "owner", name: "", nickname: "", profileImageUrl: "" }

test("canonical profile seeds preserve the original object and empty values", async () => {
  const result = await resolveStaticAdminProfileSeed(async () => profile)
  expect(result.source).toBe("published")
  expect(result.profile).toBe(profile)
})

test("malformed canonical profiles stay unavailable instead of becoming published seeds", async () => {
  for (const value of [
    null, [], {}, { ...profile, profileImageUrl: 3 },
    { ...profile, blogTitle: false }, { ...profile, aboutSections: "bad" },
    { ...profile, aboutSections: [{ title: "Timeline", items: [3] }] },
    { ...profile, aboutProjects: [{ href: {} }] },
    { ...profile, contactLinks: [{ label: 3, href: "/" }] },
  ]) {
    expect(await resolveStaticAdminProfileSeed(async () => value)).toEqual({ profile: null, source: "unavailable" })
  }
})
