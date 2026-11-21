import { expect, test, type Page } from "@playwright/test"
import { AVATAR_PNG, mockPublicAdminProfile } from "./helpers/smokeFixtures"

// cloud SSR은 backend 단절 QA 계약의 인증 회원을 그대로 셸에 전달한다.
const member = { id: 1, username: "qa-admin", nickname: "QA Admin", isAdmin: true, blogTitle: "Legacy member title" }
const profile = {
  id: member.id,
  username: "owner",
  name: "Owner",
  nickname: "Canonical profile",
  profileImageUrl: "/canonical-avatar.png",
  blogTitle: "Canonical journal",
  isAdmin: true,
}

const mockAdminShellRequests = async (page: Page, bootstrapStatus: number) => {
  await mockPublicAdminProfile(page)
  await page.route("**/canonical-avatar.png", (route) => route.fulfill({ contentType: "image/png", body: AVATAR_PNG }))
  await page.route("**/member/api/v1/auth/me", (route) => route.fulfill({ json: member }))
  await page.route("**/member/api/v1/adm/members/bootstrap", (route) =>
    route.fulfill(
      bootstrapStatus === 200
        ? { json: { member, profile } }
        : { status: bootstrapStatus, json: { msg: "unavailable" } }
    )
  )
}

test("admin shell uses the protected canonical profile for its brand and avatar", async ({ page }) => {
  await mockAdminShellRequests(page, 200)
  await page.goto("/admin/cloud")

  await expect(page.getByText("Canonical journal", { exact: true })).toBeVisible()
  await expect(page.getByAltText(`${member.nickname} 프로필 이미지`)).toHaveAttribute("src", "/canonical-avatar.png")
  await expect(page.getByRole("link", { name: "글 관리", exact: true })).toBeVisible()
})

test("admin shell keeps navigation and shows an unavailable profile status after bootstrap failure", async ({ page }) => {
  await mockAdminShellRequests(page, 503)
  await page.goto("/admin/cloud")

  await expect(page.getByText("프로필 정보를 불러올 수 없습니다.", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "글 관리", exact: true })).toBeVisible()
  await expect(page.getByText("Legacy member title", { exact: true })).toHaveCount(0)
})

test("admin shell falls back to initials when the canonical avatar cannot load", async ({ page }) => {
  await mockAdminShellRequests(page, 200)
  await page.route("**/canonical-avatar.png", (route) => route.fulfill({ status: 404 }))
  await page.goto("/admin/cloud")

  await expect(page.getByText(member.nickname.slice(0, 2).toUpperCase(), { exact: true })).toBeVisible()
  await expect(page.getByAltText(`${member.nickname} 프로필 이미지`)).toHaveCount(0)
})
