import { expect, test, type Page } from "@playwright/test"
import crypto from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { parse as parseYaml } from "yaml"
import { addPublicAboutSnapshotCookie, mockAvatarAsset, mockFeedEndpoints } from "./helpers/smokeFixtures"

type LegalPolicyFixture = {
  version: string
  contentSha256: string
  sections: Array<{ id: string; title: string }>
}

const currentLegalVersions = {
  privacy: "1.0.4",
  terms: "1.0.4",
  cookies: "1.0.4",
} as const
const internalPolicyTokens = [
  "법무·운영 확인 필요 항목",
  "reviewRequired",
  "출시 gate",
  "별도 이슈",
  "추후 확정",
  "구현 후 제공",
  "consent manager",
]

const readPolicyFixture = (kind: "privacy" | "terms" | "cookies"): LegalPolicyFixture =>
  parseYaml(
    readFileSync(
      path.join(process.cwd(), "legal", "policies", `${kind}.ko-KR.v${currentLegalVersions[kind]}.yaml`),
      "utf8",
    ),
  ) as LegalPolicyFixture

const expectCanonicalDownloadHash = async (page: Page, expectedHash: string) => {
  const downloadHref = await page.getByRole("link", { name: "원문 JSON 다운로드" }).getAttribute("href")
  expect(downloadHref).toBeTruthy()
  const encodedPayload = downloadHref!.replace("data:application/json;charset=utf-8,", "")
  const canonicalJson = decodeURIComponent(encodedPayload)
  expect(crypto.createHash("sha256").update(canonicalJson).digest("hex")).toBe(expectedHash)
}

const expectNoInternalPolicyTodos = async (page: Page) => {
  for (const token of internalPolicyTokens) {
    await expect(page.getByText(token, { exact: false })).toHaveCount(0)
  }
}

const expectPolicySections = async (page: Page, policy: LegalPolicyFixture, sectionIds: string[]) => {
  for (const sectionId of sectionIds) {
    const section = policy.sections.find((candidate) => candidate.id === sectionId)
    expect(section, `${policy.version} policy section ${sectionId}`).toBeTruthy()
    await expect(page.getByRole("heading", { name: section!.title, exact: true })).toBeVisible()
    await expect(page.locator(`[id="${sectionId}"]`)).toBeVisible()
  }
}

test.describe("legal policy public pages", () => {
  test("effective policy pages expose public notices without internal review todos", async ({ page }) => {
    const privacyPolicy = readPolicyFixture("privacy")
    const termsPolicy = readPolicyFixture("terms")
    const cookiesPolicy = readPolicyFixture("cookies")

    await page.goto("/privacy", { waitUntil: "domcontentloaded" })

    await expect(page).toHaveTitle(/개인정보처리방침/)
    await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /index/)
    await expect(page.getByRole("heading", { name: "개인정보처리방침" })).toBeVisible()
    await expectPolicySections(page, privacyPolicy, [
      "privacy-collection-items",
      "privacy-processors",
      "privacy-overseas-transfer",
      "privacy-rights",
      "privacy-cookies-storage",
      "privacy-officer",
      "privacy-remedy",
    ])
    await expect(page.getByText("illusiveman7@gmail.com")).toHaveCount(0)
    await expectNoInternalPolicyTodos(page)
    await expect(page.getByRole("link", { name: "AquilaLog 개인정보 문의 및 데이터 삭제 요청" })).toHaveAttribute(
      "href",
      "mailto:privacy@aquilaxk.site?subject=AquilaLog%20%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%20%EB%AC%B8%EC%9D%98%20%EB%B0%8F%20%EB%8D%B0%EC%9D%B4%ED%84%B0%20%EC%82%AD%EC%A0%9C%20%EC%9A%94%EC%B2%AD",
    )
    await expect(page.getByRole("link", { name: "현재 버전" })).toHaveCount(0)
    await expect(page.getByRole("navigation", { name: "정책 목차" }).getByRole("link")).toHaveCount(
      privacyPolicy.sections.length,
    )
    await expect(page.getByLabel("정책 섹션 이동")).toHaveValue("privacy-controller")
    await expect(page.getByRole("link", { name: "처리하는 개인정보 항목과 수집 방법 섹션 링크" })).toHaveAttribute(
      "href",
      "#privacy-collection-items",
    )
    await expect(page.getByText("문서 무결성 정보")).toBeVisible()
    await expectCanonicalDownloadHash(page, privacyPolicy.contentSha256)

    await page.goto("/terms", { waitUntil: "domcontentloaded" })

    await expect(page).toHaveTitle(/이용약관/)
    await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /index/)
    await expect(page.getByRole("heading", { name: "이용약관" })).toBeVisible()
    await expectPolicySections(page, termsPolicy, [
      "terms-contract",
      "terms-content",
      "terms-prohibited",
      "terms-maintenance",
      "terms-notice",
    ])
    await expect(page.getByRole("link", { name: "AquilaLog 이용약관 문의" })).toHaveAttribute(
      "href",
      "mailto:privacy@aquilaxk.site?subject=AquilaLog%20%EC%9D%B4%EC%9A%A9%EC%95%BD%EA%B4%80%20%EB%AC%B8%EC%9D%98",
    )
    await expect(page.getByText("illusiveman7@gmail.com")).toHaveCount(0)
    await expectNoInternalPolicyTodos(page)
    await expect(page.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy")

    await page.goto("/cookies", { waitUntil: "domcontentloaded" })

    await expect(page).toHaveTitle(/쿠키 정책/)
    await expect(page.getByRole("heading", { name: "쿠키 정책", exact: true })).toBeVisible()
    await expectPolicySections(page, cookiesPolicy, ["cookies-essential", "cookies-analytics", "cookies-control"])
    await expect(page.getByRole("link", { name: "현재 버전" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "AquilaLog 쿠키 및 브라우저 저장소 문의" })).toHaveAttribute(
      "href",
      "mailto:privacy@aquilaxk.site?subject=AquilaLog%20%EC%BF%A0%ED%82%A4%20%EB%B0%8F%20%EB%B8%8C%EB%9D%BC%EC%9A%B0%EC%A0%80%20%EC%A0%80%EC%9E%A5%EC%86%8C%20%EB%AC%B8%EC%9D%98",
    )
    await expectCanonicalDownloadHash(page, cookiesPolicy.contentSha256)
    await page.goto(`/legal/cookies/${currentLegalVersions.cookies}`, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("link", { name: "현재 버전" })).toHaveAttribute("href", "/cookies")
    await expectNoInternalPolicyTodos(page)

    await page.goto("/legal/history", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "정책 변경 이력" })).toBeVisible()
    const currentPrivacyHistoryItem = page
      .locator("article")
      .filter({ has: page.getByText(`버전 ${currentLegalVersions.privacy}`) })
      .filter({ has: page.getByRole("heading", { name: "개인정보처리방침" }) })
    await expect(currentPrivacyHistoryItem.getByRole("link", { name: "버전 문서" })).toHaveAttribute(
      "href",
      `/legal/privacy/${currentLegalVersions.privacy}`,
    )
    const retiredPrivacyHistoryItem = page
      .locator("article")
      .filter({ has: page.getByText("버전 1.0.3") })
      .filter({ has: page.getByRole("heading", { name: "개인정보처리방침" }) })
    await expect(retiredPrivacyHistoryItem.getByRole("link", { name: "버전 문서" })).toHaveAttribute(
      "href",
      "/legal/privacy/1.0.3",
    )
    const retiredCookieHistoryItem = page
      .locator("article")
      .filter({ has: page.getByText("버전 1.0.3") })
      .filter({ has: page.getByRole("heading", { name: "쿠키 정책" }) })
    await expect(retiredCookieHistoryItem.getByRole("link", { name: "버전 문서" })).toHaveAttribute(
      "href",
      "/legal/cookies/1.0.3",
    )
    const currentTermsHistoryItem = page
      .locator("article")
      .filter({ has: page.getByText(`버전 ${currentLegalVersions.terms}`) })
      .filter({ has: page.getByRole("heading", { name: "이용약관" }) })
    await expect(currentTermsHistoryItem.getByRole("link", { name: "버전 문서" })).toHaveAttribute(
      "href",
      `/legal/terms/${currentLegalVersions.terms}`,
    )
    const legacyPrivacyHistoryItem = page
      .locator("article")
      .filter({ has: page.getByText("버전 1.0.1") })
      .filter({ has: page.getByRole("heading", { name: "개인정보처리방침" }) })
    await expect(legacyPrivacyHistoryItem.getByRole("link", { name: "버전 문서" })).toHaveAttribute(
      "href",
      "/legal/privacy/1.0.1",
    )
    const currentCookiesHistoryItem = page
      .locator("article")
      .filter({ has: page.getByText(`버전 ${currentLegalVersions.cookies}`) })
      .filter({ has: page.getByRole("heading", { name: "쿠키 정책" }) })
    await expect(currentCookiesHistoryItem.getByRole("link", { name: "현재 문서" })).toHaveAttribute("href", "/cookies")
    const legacyCookiesHistoryItem = page
      .locator("article")
      .filter({ has: page.getByText("버전 1.0.2") })
      .filter({ has: page.getByRole("heading", { name: "쿠키 정책" }) })
    await expect(legacyCookiesHistoryItem.getByRole("link", { name: "버전 문서" })).toHaveAttribute(
      "href",
      "/legal/cookies/1.0.2",
    )

    const legacyPrivacyResponse = await page.goto("/legal/privacy/1.0.1", { waitUntil: "domcontentloaded" })
    expect(legacyPrivacyResponse?.status()).toBe(200)
    await expect(page.getByRole("link", { name: "현재 버전" })).toHaveAttribute("href", "/privacy")

    const legacyCookiesResponse = await page.goto("/legal/cookies/1.0.2", { waitUntil: "domcontentloaded" })
    expect(legacyCookiesResponse?.status()).toBe(200)
    await expect(page.getByRole("link", { name: "현재 버전" })).toHaveAttribute("href", "/cookies")

    const unsupportedResponse = await page.goto("/legal/privacy/9.9.9", { waitUntil: "domcontentloaded" })
    expect(unsupportedResponse?.status()).toBe(404)
  })

  test("public auth routes are absent while legal policies remain available", async ({ page }) => {
    const loginResponse = await page.goto("/login", { waitUntil: "domcontentloaded" })
    expect(loginResponse?.status()).toBe(404)

    const signupResponse = await page.goto("/signup", { waitUntil: "domcontentloaded" })
    expect(signupResponse?.status()).toBe(404)

    const privacyResponse = await page.goto("/privacy", { waitUntil: "domcontentloaded" })
    expect(privacyResponse?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: "개인정보처리방침" })).toBeVisible()

    const termsResponse = await page.goto("/terms", { waitUntil: "domcontentloaded" })
    expect(termsResponse?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: "이용약관" })).toBeVisible()
  })

  test("footer links to legal policies without an optional-tracking settings surface", async ({ page }) => {
    await mockAvatarAsset(page)
    await addPublicAboutSnapshotCookie(page)
    await mockFeedEndpoints(page)
    await page.goto("/", { waitUntil: "domcontentloaded" })

    const footer = page.locator("footer")

    await expect(footer.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute(
      "href",
      "/privacy",
    )
    await expect(footer.getByRole("link", { name: "이용약관" })).toHaveAttribute(
      "href",
      "/terms",
    )
    await expect(footer.getByRole("link", { name: "쿠키 정책" })).toHaveAttribute("href", "/cookies")
    await expect(footer.getByRole("link", { name: "쿠키 설정" })).toHaveCount(0)
  })
})
