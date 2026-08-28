import { expect, test } from "@playwright/test"

const OPTIONAL_TRACKING_CONSENT_STORAGE_KEY = "privacy.optionalTrackingConsent.v1"

test("cookies page lets an anonymous visitor inspect, grant, and revoke optional tracking", async ({ page }) => {
  await page.goto("/cookies#cookie-settings", { waitUntil: "domcontentloaded" })

  const settings = page.getByRole("region", { name: "선택 analytics와 RUM 설정" })
  await expect(settings).toBeVisible()
  await expect(settings.getByText("선택 분석: 꺼짐")).toBeVisible()

  await settings.getByRole("button", { name: "선택 분석 켜기" }).click()
  await expect(settings.getByText("선택 분석: 켜짐")).toBeVisible()
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || "{}"), OPTIONAL_TRACKING_CONSENT_STORAGE_KEY))
    .toMatchObject({ state: "granted", source: "settings", categories: { analytics: true, rum: true } })

  await settings.getByRole("button", { name: "선택 분석 끄기" }).click()
  await expect(settings.getByText("선택 분석: 꺼짐")).toBeVisible()
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || "{}"), OPTIONAL_TRACKING_CONSENT_STORAGE_KEY))
    .toMatchObject({ state: "denied", source: "settings", categories: { analytics: false, rum: false } })
})
