import { expect, test } from "@playwright/test"

const OPTIONAL_TRACKING_CONSENT_STORAGE_KEY = "privacy.optionalTrackingConsent.v1"

const fulfillAnonymousAuth = async (page: import("@playwright/test").Page) => {
  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: "{}" })
  })
}

test("anonymous settings privacy state exposes public controls without a retired login path", async ({ page }) => {
  await fulfillAnonymousAuth(page)

  await page.goto("/settings/privacy")

  await expect(page.getByRole("heading", { name: "개인정보 관리" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "선택 분석" })).toBeVisible()
  await expect(page.getByRole("link", { name: "로그인" })).toHaveCount(0)
  await expect(page.locator('a[href^="/login"]')).toHaveCount(0)
})

test("settings privacy keeps browser-local optional tracking and public policy/contact links only", async ({ page }) => {
  const retiredPrivacyRequests: string[] = []
  await fulfillAnonymousAuth(page)
  page.on("request", (request) => {
    if (/\/member\/api\/v1\/privacy\/(export|requests)(?:\?|$)/.test(new URL(request.url()).pathname)) {
      retiredPrivacyRequests.push(request.url())
    }
  })

  await page.goto("/settings/privacy")

  await expect(page.getByRole("heading", { name: "개인정보 관리" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "선택 분석" })).toBeVisible()
  await expect(page.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy")
  await expect(page.getByRole("link", { name: "이메일" })).toHaveAttribute("href", /^mailto:/)
  await expect(page.getByRole("heading", { name: "내보내기 스냅샷" })).toHaveCount(0)
  await expect(page.getByRole("region", { name: "개인정보 내보내기" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "처리 요청" })).toHaveCount(0)
  await expect(page.getByLabel("요청 사유")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "처리 요청 접수" })).toHaveCount(0)
  expect(retiredPrivacyRequests).toEqual([])

  // 1597: 내부 상태 덤프는 1차 정보에서 제거하고 요약 한 줄 + 접힘 상세로만 노출한다.
  await expect(page.getByText("선택 분석: 꺼짐")).toBeVisible()
  await expect(page.getByText("저장 경로")).toHaveCount(0)
  await expect(page.getByText("브라우저 거부 신호")).toHaveCount(0)
  await expect(page.getByText("선택한 곳")).toBeHidden()
  await page.getByText("내 선택 기록 자세히 보기").click()
  await expect(page.getByText("선택한 곳")).toBeVisible()

  await page.getByRole("button", { name: "선택 분석 켜기" }).click()
  await expect(page.getByText("선택 분석: 켜짐")).toBeVisible()
  const grantedConsent = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || "{}"), OPTIONAL_TRACKING_CONSENT_STORAGE_KEY)
  expect(grantedConsent).toMatchObject({
    version: 1,
    state: "granted",
    source: "settings",
    categories: {
      analytics: true,
      rum: true,
    },
  })
  expect(typeof grantedConsent.updatedAt).toBe("string")

  await page.getByRole("button", { name: "선택 분석 끄기" }).click()
  await expect(page.getByText("선택 분석: 꺼짐")).toBeVisible()
  const deniedConsent = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || "{}"), OPTIONAL_TRACKING_CONSENT_STORAGE_KEY)
  expect(deniedConsent).toMatchObject({
    version: 1,
    state: "denied",
    source: "settings",
    categories: {
      analytics: false,
      rum: false,
    },
  })

})

test("settings privacy page withdraws stored analytics consent while DNT is active", async ({ page }) => {
  await page.addInitScript(({ key }) => {
    Object.defineProperty(window, "doNotTrack", { configurable: true, value: "1" })
    Object.defineProperty(Navigator.prototype, "doNotTrack", { configurable: true, value: "yes" })
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        state: "granted",
        updatedAt: "2026-08-03T00:00:00Z",
        source: "settings",
        categories: { analytics: true, rum: true },
      })
    )
  }, { key: OPTIONAL_TRACKING_CONSENT_STORAGE_KEY })
  await fulfillAnonymousAuth(page)

  await page.goto("/settings/privacy")

  await expect(page.getByText("선택 분석: 꺼짐")).toBeVisible()
  const withdrawButton = page.getByRole("button", { name: "선택 분석 끄기" })
  await expect(withdrawButton).toBeEnabled()
  await withdrawButton.click()

  const deniedConsent = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || "{}"), OPTIONAL_TRACKING_CONSENT_STORAGE_KEY)
  expect(deniedConsent).toMatchObject({
    state: "denied",
    source: "settings",
    categories: { analytics: false, rum: false },
  })
})
