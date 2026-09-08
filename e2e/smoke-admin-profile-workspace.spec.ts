import { expect, test } from "@playwright/test"
import { mockAvatarAsset, mockPublicAdminProfile } from "./helpers/smokeFixtures"
import type { ProfileWorkspaceContent } from "../src/libs/profileWorkspace"

const draft: ProfileWorkspaceContent = {
    profileImageUrl: "", profileRole: "", profileBio: "", aboutHeadline: "", aboutRole: "",
    aboutBio: "", aboutSections: [], aboutProjectSectionTitle: "", aboutProjects: [],
    blogTitle: "Aquila", homeIntroTitle: "", homeIntroDescription: "", blogDesign: "legacy",
    legacyBlogScheme: "light", serviceLinks: [], contactLinks: [],
}

for (const field of ["한 줄 역할", "계정 이름"]) {
  test(`a ${field} save conflict preserves edits without replay`, async ({ page }) => {
    await mockPublicAdminProfile(page)
    await page.route("**/member/api/v1/auth/me", (route) => route.fulfill({
      json: { id: 1, username: "owner", nickname: "Owner", isAdmin: true },
    }))
    await page.route("**/member/api/v1/adm/members/*/profileWorkspace", (route) => route.fulfill({
      json: { draft, published: draft, dirtyFromPublished: false },
    }))
    const requests: string[] = []
    await page.route(/\/member\/api\/v1\/adm\/members\/[^/]+\/(?:nickname|profileWorkspace\/draft)$/, (route) => {
      requests.push(route.request().method())
      return route.fulfill({ status: 409, json: { msg: "Profile conflict" } })
    })
    await page.goto("/admin/profile")
    await page.getByLabel(field, { exact: true }).fill("Unsaved value")
    await page.getByRole("button", { name: "초안 저장", exact: true }).click()
    // 서버의 영문 원문 대신 API 클라이언트가 정제한 충돌 안내를 표시한다.
    await expect(page.getByText(/저장 실패: 요청 충돌이 발생했습니다\. 다시 시도해주세요\./)).toBeVisible()
    await expect(page.getByRole("button", { name: "초안 저장", exact: true })).toBeEnabled()
    expect(requests).toEqual([field === "계정 이름" ? "PATCH" : "PUT"])
    await expect(page.getByLabel(field, { exact: true })).toHaveValue("Unsaved value")
  })
}

test("selecting a previous image saves the canonical draft without losing edits", async ({ page }) => {
  const member = { id: 1, username: "owner", nickname: "Owner", isAdmin: true }
  const writes: ProfileWorkspaceContent[] = []
  const retiredRequests: string[] = []
  await mockPublicAdminProfile(page)
  await mockAvatarAsset(page)
  await page.route("**/member/api/v1/auth/me", (route) => route.fulfill({ json: member }))
  await page.route("**/member/api/v1/adm/members/*/profileWorkspace", (route) => route.fulfill({
    json: { draft, published: draft, dirtyFromPublished: false },
  }))
  await page.route("**/member/api/v1/adm/members/*/profileImageFiles", (route) => route.fulfill({
    json: { images: [{ id: 1, imageUrl: "/avatar.png", isCurrent: false, status: "TEMP" }] },
  }))
  await page.route("**/member/api/v1/adm/members/*/profileImgUrl", (route) => {
    retiredRequests.push(route.request().method())
    return route.fulfill({ status: 410 })
  })
  await page.route("**/member/api/v1/adm/members/*/profileWorkspace/draft", (route) => {
    expect(route.request().method()).toBe("PUT")
    const saved = route.request().postDataJSON() as ProfileWorkspaceContent
    writes.push(saved)
    return route.fulfill({ json: { draft: saved, published: draft, dirtyFromPublished: true } })
  })
  await page.goto("/admin/profile")
  const nameBefore = await page.getByLabel("계정 이름", { exact: true }).inputValue()
  await page.getByLabel("한 줄 역할", { exact: true }).fill("Unsaved role")
  await page.getByLabel("짧은 소개", { exact: true }).fill("Unsaved biography")
  await page.getByRole("button", { name: "이미지 바꾸기", exact: true }).click()
  await page.getByRole("button", { name: "이전 프로필 이미지 적용", exact: true }).click()
  await expect(page.getByText("이전 프로필 이미지를 적용했습니다.", { exact: true })).toBeVisible()
  expect(writes).toEqual([{ ...draft, profileRole: "Unsaved role", profileBio: "Unsaved biography", profileImageUrl: "/avatar.png" }])
  expect(retiredRequests).toEqual([])
  await expect(page.getByLabel("한 줄 역할", { exact: true })).toHaveValue("Unsaved role")
  await expect(page.getByLabel("짧은 소개", { exact: true })).toHaveValue("Unsaved biography")
  await expect(page.getByLabel("계정 이름", { exact: true })).toHaveValue(nameBefore)
})

for (const status of [200, 503]) {
  test(`missing canonical workspace is not editable (HTTP ${status})`, async ({ page }) => {
    await mockPublicAdminProfile(page)
    await page.route("**/member/api/v1/auth/me", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: 1, username: "owner", nickname: "Owner", isAdmin: true }),
    }))
    await page.route("**/member/api/v1/adm/members/*/profileWorkspace", (route) => route.fulfill({
      status,
      contentType: "application/json",
      body: status === 200 ? "null" : JSON.stringify({ msg: "unavailable" }),
    }))
    await page.goto("/admin/profile")
    await expect(page.getByRole("heading", { name: "프로필을 불러오지 못했습니다" })).toBeVisible()
    await expect(page.getByRole("button", { name: "다시 불러오기", exact: true })).toBeVisible()
    await expect(page.getByRole("textbox")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /저장|발행/ })).toHaveCount(0)
  })
}
