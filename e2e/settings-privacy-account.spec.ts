import { expect, test } from "@playwright/test"

const OPTIONAL_TRACKING_CONSENT_STORAGE_KEY = "privacy.optionalTrackingConsent.v1"

const authMember = {
  id: 901,
  createdAt: "2026-06-21T00:00:00Z",
  modifiedAt: "2026-06-22T00:00:00Z",
  username: "privacy-user",
  nickname: "권리행사",
  isAdmin: false,
}

const fulfillAuthMe = async (page: import("@playwright/test").Page) => {
  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authMember),
    })
  })
}

const fulfillPrivacyExport = async (page: import("@playwright/test").Page) => {
  await page.route("**/member/api/v1/privacy/export", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resultCode: "200-1",
        msg: "개인정보 내보내기 데이터를 조회했습니다.",
        data: {
          generatedAt: "2026-06-22T01:00:00Z",
          member: {
            id: authMember.id,
            email: "privacy-user@example.com",
            username: authMember.username,
            nickname: authMember.nickname,
            createdAt: authMember.createdAt,
            modifiedAt: authMember.modifiedAt,
          },
          latestLegalAcceptance: null,
        },
      }),
    })
  })
}

test("anonymous settings privacy state does not expose a retired public login path", async ({ page }) => {
  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: "{}" })
  })

  await page.goto("/settings/privacy")

  await expect(page.getByRole("heading", { name: "개인정보 관리" })).toBeVisible()
  await expect(page.getByRole("link", { name: "로그인" })).toHaveCount(0)
  await expect(page.locator('a[href^="/login"]')).toHaveCount(0)
})

test("settings privacy page exposes export snapshot and creates privacy request", async ({ page }) => {
  let createdRequestBody: Record<string, unknown> | null = null

  await fulfillAuthMe(page)
  await page.route("**/member/api/v1/privacy/export", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resultCode: "200-1",
        msg: "개인정보 내보내기 데이터를 조회했습니다.",
        data: {
          generatedAt: "2026-06-22T01:00:00Z",
          member: {
            id: authMember.id,
            email: "privacy-user@example.com",
            username: authMember.username,
            nickname: authMember.nickname,
            createdAt: authMember.createdAt,
            modifiedAt: authMember.modifiedAt,
          },
          latestLegalAcceptance: {
            termsVersion: "1.0.1",
            privacyVersion: "1.0.2",
            analyticsConsent: false,
            overseasTransferAcknowledged: true,
            acceptedAt: "2026-06-21T00:10:00Z",
          },
        },
      }),
    })
  })
  await page.route("**/member/api/v1/privacy/requests", async (route) => {
    createdRequestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        resultCode: "201-1",
        msg: "개인정보 처리 요청을 접수했습니다.",
        data: {
          item: {
            id: 77,
            memberId: authMember.id,
            type: "EXPORT",
            status: "RECEIVED",
            message: createdRequestBody?.message,
            requestedAt: "2026-06-22T01:01:00Z",
            dueAt: "2026-07-22T01:01:00Z",
            completedAt: null,
          },
        },
      }),
    })
  })

  await page.goto("/settings/privacy")

  await expect(page.getByRole("heading", { name: "개인정보 관리" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "선택 분석" })).toBeVisible()
  await expect(page.getByText("privacy-user@example.com")).toBeVisible()
  await expect(page.getByText("개인정보처리방침 1.0.2")).toBeVisible()

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

  await page.getByLabel("요청 사유").fill("가입 정보와 운영 로그 열람을 요청합니다.")
  await page.getByRole("button", { name: "처리 요청 접수" }).click()

  const successFeedback = page.getByRole("status").filter({ hasText: "개인정보 처리 요청을 접수했습니다." })
  await expect(successFeedback).toBeVisible()
  await expect(successFeedback).toHaveAttribute("data-tone", "success")
  await expect(page.getByText("접수 번호 77")).toBeVisible()
  expect(createdRequestBody).toMatchObject({
    type: "EXPORT",
    message: "가입 정보와 운영 로그 열람을 요청합니다.",
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
  await fulfillAuthMe(page)
  await fulfillPrivacyExport(page)

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

test("settings privacy request failure prefers server message with danger tone", async ({ page }) => {
  await fulfillAuthMe(page)
  await page.route("**/member/api/v1/privacy/export", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resultCode: "200-1",
        msg: "개인정보 내보내기 데이터를 조회했습니다.",
        data: {
          generatedAt: "2026-06-22T01:00:00Z",
          member: {
            id: authMember.id,
            email: "privacy-user@example.com",
            username: authMember.username,
            nickname: authMember.nickname,
            createdAt: authMember.createdAt,
            modifiedAt: authMember.modifiedAt,
          },
          latestLegalAcceptance: null,
        },
      }),
    })
  })
  await page.route("**/member/api/v1/privacy/requests", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        resultCode: "400-1",
        msg: "요청 사유가 너무 짧습니다.",
      }),
    })
  })

  await page.goto("/settings/privacy")
  await page.getByLabel("요청 사유").fill("짧음")
  await page.getByRole("button", { name: "처리 요청 접수" }).click()

  const alert = page.getByRole("alert").filter({ hasText: "요청 사유가 너무 짧습니다." })
  await expect(alert).toBeVisible()
  await expect(alert).toHaveAttribute("data-tone", "danger")
})
