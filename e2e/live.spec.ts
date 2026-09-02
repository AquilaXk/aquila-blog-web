import { expect, test } from "@playwright/test"

const expectedFrontendCommitSha = process.env.E2E_EXPECTED_FRONT_COMMIT_SHA?.trim() || ""
const explicitLiveApiBaseUrl = process.env.E2E_API_BASE_URL?.trim() || ""

const isWebKitCorsAccessControlNoise = (message: string) =>
  /due to access control checks\./i.test(message) && /\/(?:www\.)?[\w.-]+\/_next\/data\/[^/\s]+\/[^?\s]+\.json/i.test(message)

test.describe("live critical error filter", () => {
  test("WebKit Next data prefetch access-control noise는 critical error에서 제외한다", () => {
    expect(isWebKitCorsAccessControlNoise("/blog.aquilaxk.site/_next/data/FsB_f7gB6UefGQbKBjMeG/index.json due to access control checks.")).toBe(true)
    expect(isWebKitCorsAccessControlNoise("https://api.blog.aquilaxk.site/member/api/v1/notifications/snapshot due to access control checks.")).toBe(false)
    expect(isWebKitCorsAccessControlNoise("TypeError: Cannot read properties of undefined")).toBe(false)
    expect(isWebKitCorsAccessControlNoise("https://cdn.example.com/widget.js due to access control checks.")).toBe(false)
  })
})

test.describe("live frontend build metadata", () => {
  test("custom domain이 배포 대상 commit의 front build를 서빙한다", async ({ page }) => {
    test.skip(!expectedFrontendCommitSha, "E2E_EXPECTED_FRONT_COMMIT_SHA is required")

    await page.goto("/admin/login?next=%2Fadmin")
    const buildSha = await page.evaluate(() => document.querySelector('meta[name="aquila-build-sha"]')?.getAttribute("content") ?? null)
    expect(buildSha).toBe(expectedFrontendCommitSha)
  })
})

test.describe("live public RSS feed", () => {
  test("/feed는 RSS XML discovery 계약을 만족한다", async ({ page }) => {
    const response = await page.request.get("/feed")
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/rss+xml")

    const body = await response.text()
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(body).toContain('<rss version="2.0">')
    expect(body).toContain("<channel>")
    expect(body).toContain("<link>https://blog.aquilaxk.site</link>")
    expect(body).toMatch(/<item>[\s\S]*<guid>https:\/\/blog\.aquilaxk\.site\/posts\/\d+<\/guid>[\s\S]*<\/item>/)
    expect(body).not.toContain("<!DOCTYPE")
  })
})

test.describe("live public release gate", () => {
  test.skip(!explicitLiveApiBaseUrl, "E2E_API_BASE_URL is required")
  test.setTimeout(90_000)

  test("deployment URL serves feed, search, detail, CSP, and HTTPS API readiness", async ({ page }) => {
    const homeResponse = await page.goto("/")
    expect(homeResponse?.ok()).toBe(true)
    expect(homeResponse?.headers()["content-security-policy"]).toContain("default-src")

    const firstPost = page.locator("a[data-ui='feed-post-card']").first()
    await expect(firstPost).toBeVisible()
    const detailPath = await firstPost.getAttribute("href")
    const title = (await firstPost.locator("h2").textContent())?.trim() || ""
    expect(detailPath).toMatch(/^\/posts\/[^/?#]+$/)
    expect(title).not.toBe("")

    const searchResponse = page.waitForResponse((response) => response.url().includes("/post/api/v1/posts/search") && response.ok())
    await page.getByLabel("Search posts by keyword").fill(title)
    await searchResponse
    await expect(page.locator(`a[href='${detailPath}']`).first()).toBeVisible()

    const detailResponse = await page.goto(detailPath || "/")
    expect(detailResponse?.ok()).toBe(true)
    await expect(page.getByRole("heading", { name: title }).first()).toBeVisible()

    const webOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL || page.url()).origin
    const readiness = await page.request.get(new URL("/actuator/health/readiness", webOrigin).toString())
    expect(readiness.status()).toBe(200)
  })
})

test.describe("live unauthenticated boundary", () => {
  test("image upload endpoint accepts the same-origin production preflight without CORS headers", async ({ page }) => {
    const webOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL || page.url()).origin
    expect(webOrigin).toMatch(/^https:\/\//)
    const response = await page.request.fetch(new URL("/post/api/v1/posts/images", webOrigin).toString(), {
      method: "OPTIONS",
      headers: {
        Origin: webOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-aquila-csrf",
      },
    })

    expect([200, 204]).toContain(response.status())
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined()
  })

  test("비로그인 사용자는 /admin 접근 시 로그인 페이지로 이동한다", async ({ page }) => {
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible()
  })
})
