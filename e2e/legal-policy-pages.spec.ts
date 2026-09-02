import { expect, test } from "@playwright/test"
import { addPublicAboutSnapshotCookie, mockAvatarAsset, mockFeedEndpoints } from "./helpers/smokeFixtures"

const retiredLegalPaths = [
  "/privacy",
  "/terms",
  "/cookies",
  "/legal/history",
  "/legal/privacy/1.0.4",
  "/legal/terms/1.0.4",
  "/legal/cookies/1.0.4",
] as const

test.describe("retired public legal surface", () => {
  test("legal routes receive Next's direct normal 404 without redirects", async ({ page }) => {
    for (const legalPath of retiredLegalPaths) {
      const response = await page.goto(legalPath, { waitUntil: "domcontentloaded" })

      expect(response?.status(), legalPath).toBe(404)
      expect(page.url(), legalPath).toBe(new URL(legalPath, "http://127.0.0.1:3100").toString())
    }
  })

  test("footer omits legal-policy links", async ({ page }) => {
    await mockAvatarAsset(page)
    await addPublicAboutSnapshotCookie(page)
    await mockFeedEndpoints(page)
    await page.goto("/", { waitUntil: "domcontentloaded" })

    const footer = page.locator("footer")
    for (const label of ["개인정보처리방침", "이용약관", "쿠키 정책"]) {
      await expect(footer.getByRole("link", { name: label })).toHaveCount(0)
    }
  })
})
