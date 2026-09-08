import { expect, test } from "@playwright/test"
import { mockPublicAdminProfile } from "./helpers/smokeFixtures"

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
