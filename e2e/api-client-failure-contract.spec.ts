import { expect, test } from "@playwright/test"
import { mockAnonymousSession } from "./helpers/mobileLayoutFixtures"
import {
  addPublicAboutSnapshotCookie,
  mockFeedEndpoints,
  PUBLIC_ADMIN_PROFILE_ROUTE,
} from "./helpers/smokeFixtures"

test("seeded public profile 503 reaches the global error boundary", async ({ page }) => {
  await addPublicAboutSnapshotCookie(page)
  await mockAnonymousSession(page)
  await mockFeedEndpoints(page)
  await page.route(PUBLIC_ADMIN_PROFILE_ROUTE, async (route) => {
    await route.fulfill({
      status: 503,
      headers: { "x-request-id": "req-profile-503" },
      body: "unavailable",
    })
  })

  await page.goto("/")

  await expect(page.getByRole("heading", { name: "문제가 발생했습니다" })).toBeVisible()
  await expect(page.locator('[data-ui="feed-home-product-shell"]')).toHaveCount(0)
})

test("cached browser representation does not become success after a 503", async ({
  page,
}) => {
  let count = 0
  await page.route("**/post/api/v1/posts/feed**", async (route) => {
    count += 1
    if (count === 1)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { etag: '"v1"', "cache-control": "max-age=60" },
        body: JSON.stringify({ title: "cached" }),
      })
    return route.fulfill({
      status: 503,
      headers: { "x-request-id": "req-503" },
      body: "unavailable",
    })
  })
  await page.goto("/_qa/api-client-failure-contract")
  await page.getByRole("button", { name: "Run API failure contract" }).click()
  const result = page.getByTestId("qa-api-client-failure-result")
  await expect(result).toContainText('"seed":{"title":"cached"}')
  await expect(result).toContainText(
    '"outcome":{"kind":"error","error":{"name":"ApiError"'
  )
  await expect(result).not.toContainText('"outcome":{"kind":"error","data"')
})

test("transport failure does not return the cached representation", async ({
  page,
}) => {
  let count = 0
  await page.route("**/post/api/v1/posts/feed?mode=failure", async (route) => {
    count += 1
    if (count === 1)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { etag: '"v1"', "cache-control": "max-age=60" },
        body: JSON.stringify({ title: "cached" }),
      })
    return route.abort("failed")
  })
  await page.goto("/_qa/api-client-failure-contract")
  await page.getByRole("button", { name: "Run API failure contract" }).click()
  const result = page.getByTestId("qa-api-client-failure-result")
  await expect(result).toContainText('"seed":{"title":"cached"}')
  await expect(result).toContainText(
    '"outcome":{"kind":"error","error":{"name":"ApiNetworkError"'
  )
  await expect(result).not.toContainText('"outcome":{"kind":"error","data"')
})

test("short timeout does not return the cached representation", async ({
  page,
}) => {
  let count = 0
  await page.route("**/post/api/v1/posts/feed?mode=timeout", async (route) => {
    count += 1
    if (count === 1)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { etag: '"v1"', "cache-control": "max-age=60" },
        body: JSON.stringify({ title: "cached" }),
      })
    await new Promise((resolve) => setTimeout(resolve, 50))
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ title: "late" }),
    })
  })
  await page.goto("/_qa/api-client-failure-contract")
  await page.getByRole("button", { name: "Run API timeout contract" }).click()
  const result = page.getByTestId("qa-api-client-failure-result")
  await expect(result).toContainText('"seed":{"title":"cached"}')
  await expect(result).toContainText(
    '"outcome":{"kind":"error","error":{"name":"ApiTimeoutError"'
  )
  await expect(result).not.toContainText('"outcome":{"kind":"error","data"')
})

test("304 reuses the ETag representation as fresh data", async ({ page }) => {
  let ifNoneMatch: string | undefined
  let count = 0
  await page.route(
    "**/post/api/v1/posts/feed?mode=not-modified",
    async (route) => {
      count += 1
      if (count === 1)
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { etag: '"v1"', "cache-control": "max-age=60" },
          body: JSON.stringify({ title: "cached" }),
        })
      ifNoneMatch = route.request().headers()["if-none-match"]
      return route.fulfill({ status: 304 })
    }
  )
  await page.goto("/_qa/api-client-failure-contract")
  await page.getByRole("button", { name: "Run API 304 contract" }).click()
  const result = page.getByTestId("qa-api-client-failure-result")
  await expect(result).toContainText('"seed":{"title":"cached"}')
  await expect(result).toContainText(
    '"outcome":{"kind":"success","data":{"title":"cached"}'
  )
  expect(ifNoneMatch).toBe('"v1"')
})
