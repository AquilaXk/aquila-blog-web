import { expect, test, type Page } from "@playwright/test"
import { AVATAR_PNG } from "./helpers/smokeFixtures"

const qaUrl = (state = "valid") => `/_qa/profile-image-hydration?state=${state}`

const mockQaImage = async (page: Page) => {
  const requests: string[] = []
  await page.route("**/images/profile-image-state.png**", async (route) => {
    const url = new URL(route.request().url())
    requests.push(url.search)
    if (url.searchParams.get("state") === "valid" || url.searchParams.get("state") === "recovered") {
      await route.fulfill({ contentType: "image/png", body: AVATAR_PNG })
      return
    }
    await route.fulfill({ status: 404 })
  })
  return requests
}

test("profile image keeps a valid canonical image request", async ({ page }) => {
  const requests = await mockQaImage(page)
  await page.goto(qaUrl())

  await expect(page.getByTestId("qa-profile-image")).toHaveAttribute(
    "src",
    "/images/profile-image-state.png?state=valid"
  )
  await expect.poll(() => page.getByTestId("qa-profile-image").evaluate(
    (element) => element instanceof HTMLImageElement && element.naturalWidth > 0
  )).toBe(true)
  expect(requests).toEqual(["?state=valid"])
})

test("profile image renders a placeholder for an empty canonical source", async ({ page }) => {
  await mockQaImage(page)
  await page.goto(qaUrl())
  await page.getByRole("button", { name: "QA 이미지 비우기" }).click()

  await expect(page.getByTestId("qa-profile-image")).toHaveAttribute("role", "img")
  await expect(page.getByTestId("qa-profile-image")).not.toHaveAttribute("src")
})

test("small profile image uses a bounded unavailable icon for empty and broken sources", async ({ page }) => {
  await mockQaImage(page)
  await page.goto(qaUrl())

  for (const action of ["QA 이미지 비우기", "QA 이미지 실패"]) {
    await page.getByRole("button", { name: action }).click()
    const smallImage = page.getByTestId("qa-profile-image-small")
    const icon = smallImage.locator("svg")

    await expect(smallImage).toHaveAttribute("role", "img")
    await expect(smallImage).toHaveAttribute(
      "aria-label",
      "QA small administrator profile 이미지를 불러올 수 없습니다."
    )
    await expect(icon).toHaveAttribute("aria-hidden", "true")
    await expect(icon).toHaveAttribute("focusable", "false")
    await expect(icon).toBeVisible()
    await expect(smallImage.getByText("이미지 없음", { exact: true })).toHaveCount(0)

    const bounds = await icon.evaluate((element) => {
      const iconRect = element.getBoundingClientRect()
      const avatarRect = element.parentElement!.getBoundingClientRect()
      return {
        width: iconRect.width,
        height: iconRect.height,
        fits: iconRect.left >= avatarRect.left && iconRect.right <= avatarRect.right &&
          iconRect.top >= avatarRect.top && iconRect.bottom <= avatarRect.bottom,
      }
    })
    expect(bounds.width).toBeGreaterThan(0)
    expect(bounds.height).toBeGreaterThan(0)
    expect(bounds.fits).toBe(true)
  }
})

test("profile image does not request an alternate URL after a post-hydration failure", async ({ page }) => {
  const requests = await mockQaImage(page)
  const alternateRequests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/images/default-profile.svg") {
      alternateRequests.push(request.url())
    }
  })
  await page.goto(qaUrl())
  await page.getByRole("button", { name: "QA 이미지 실패" }).click()

  await expect(page.getByTestId("qa-profile-image")).toHaveAttribute("role", "img")
  expect(requests).toEqual(["?state=valid", "?state=broken"])
  expect(alternateRequests).toEqual([])
})

test("profile image permits a changed canonical source after a failure", async ({ page }) => {
  await mockQaImage(page)
  await page.goto(qaUrl())
  await page.getByRole("button", { name: "QA 이미지 실패" }).click()
  await expect(page.getByTestId("qa-profile-image")).toHaveAttribute("role", "img")
  await page.getByRole("button", { name: "QA 이미지 복구" }).click()

  await expect(page.getByTestId("qa-profile-image")).toHaveAttribute(
    "src",
    "/images/profile-image-state.png?state=recovered"
  )
})

test("profile image detects an already-complete hydration failure without an alternate image", async ({ page }) => {
  await page.addInitScript(() => {
    const completeDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete")
    const naturalWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalWidth")
    const isFailedPrimary = (image: HTMLImageElement) => image.getAttribute("src")?.includes("state=already-complete-broken") === true

    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get() { return isFailedPrimary(this) || completeDescriptor?.get?.call(this) || false },
    })
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() { return isFailedPrimary(this) ? 0 : naturalWidthDescriptor?.get?.call(this) || 0 },
    })
  })

  await page.goto(qaUrl("already-complete-broken"))
  await expect(page.getByTestId("qa-profile-image")).toHaveAttribute("role", "img")
  await expect(page.getByTestId("qa-profile-image")).toHaveAttribute(
    "aria-label",
    "QA administrator profile 이미지를 불러올 수 없습니다."
  )
})
