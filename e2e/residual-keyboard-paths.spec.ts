import { expect, test } from "@playwright/test"
import { DESKTOP_VIEWPORT, prepareAdminPosts } from "./helpers/adaptivityFixtures"

test.describe("residual keyboard paths", () => {
  test("관리자 글 목록은 Arrow로 행 primary 포커스를 이동한다", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await prepareAdminPosts(page)
    await page.goto("/admin/posts")
    await expect(page.getByRole("heading", { name: "글 관리" })).toBeVisible()
    await page.getByRole("button", { name: "전체", exact: true }).click()

    const titleButtons = page.locator(`[data-admin-posts-row-primary="true"]`)
    await expect(titleButtons.first()).toBeVisible()
    const rowCount = await titleButtons.count()
    expect(rowCount).toBeGreaterThan(1)
    await titleButtons.first().focus()
    await expect(titleButtons.first()).toBeFocused()

    await page.keyboard.press("ArrowDown")
    await expect(titleButtons.nth(1)).toBeFocused()
    await page.keyboard.press("ArrowUp")
    await expect(titleButtons.first()).toBeFocused()
    await page.keyboard.press("End")
    await expect(titleButtons.nth(rowCount - 1)).toBeFocused()
    await page.keyboard.press("Home")
    await expect(titleButtons.first()).toBeFocused()

    const scrollBefore = await page.evaluate(() => window.scrollY)
    await page.keyboard.press("ArrowUp")
    await expect(titleButtons.first()).toBeFocused()
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(scrollBefore)
  })

})
