import { expect, test } from "@playwright/test"

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim() || ""
  expect(value, `${name} is required`).not.toBe("")
  return value
}

test.describe("verified Platform Web deployment", () => {
  test.setTimeout(90_000)

  test("exact custom domain serves the expected Web build and same-origin readiness", async ({ page }) => {
    const expectedDomain = requiredEnv("E2E_EXPECTED_DOMAIN")
    const expectedWebSha = requiredEnv("E2E_EXPECTED_FRONT_COMMIT_SHA")
    const expectedOrigin = new URL(expectedDomain).origin

    expect(expectedDomain).toBe(expectedOrigin)
    expect(expectedWebSha).toMatch(/^[a-f0-9]{40}$/)

    const home = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(home, "home navigation must return a response").not.toBeNull()
    expect(home?.ok(), "home response must be successful").toBe(true)
    expect(new URL(page.url()).origin).toBe(expectedOrigin)

    for (let request = home?.request(); request; request = request.redirectedFrom()) {
      expect(new URL(request.url()).origin, "redirect chain must stay on the verified domain").toBe(expectedOrigin)
    }

    const headers = home?.headers() || {}
    expect(headers["x-vercel-id"]).toBeUndefined()
    expect(headers["x-vercel-cache"]).toBeUndefined()
    expect(headers.server || "").not.toMatch(/vercel/i)

    const servedWebSha = await page.locator('meta[name="aquila-build-sha"]').getAttribute("content")
    expect(servedWebSha).toBe(expectedWebSha)

    const readiness = await page.request.get(new URL("/actuator/health/readiness", expectedOrigin).toString(), {
      maxRedirects: 0,
    })
    expect(readiness.status()).toBe(200)
    expect(new URL(readiness.url()).origin).toBe(expectedOrigin)
  })
})
