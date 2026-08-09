import { expect, test, type Page } from "@playwright/test"

const expectStoryLink = async (page: Page, storyId: string, href: string) => {
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`)
  await expect(page.locator(`a[href="${href}"]`)).toBeVisible()
  expect(pageErrors).toEqual([])
}

const expectStoryLinkRouteWithoutNavigation = async (page: Page, storyId: string, href: string) => {
  const storyUrl = `/iframe.html?id=${storyId}&viewMode=story`
  await page.goto(storyUrl)
  await page.locator(`a[href="${href}"]`).click()

  await expect.poll(() =>
    page.evaluate(() =>
      (window as typeof window & { __AQUILA_STORYBOOK_ROUTER_PATH__?: string })
        .__AQUILA_STORYBOOK_ROUTER_PATH__
    )
  ).toBe(href)
  expect(page.url()).toBe(new URL(storyUrl, page.url()).toString())
}

test("AuthShell Login renders its signup link", async ({ page }) => {
  await expectStoryLink(page, "auth-authshell--login", "/signup")
})

test("AuthShell Login records its signup route without leaving the story", async ({ page }) => {
  await expectStoryLinkRouteWithoutNavigation(page, "auth-authshell--login", "/signup")
})

test("AdminHubSurface Default renders its admin posts link", async ({ page }) => {
  await expectStoryLink(page, "admin-adminhubsurface--default", "/admin/posts")
})

test("AdminHubSurface Default records its legacy route without leaving the story", async ({ page }) => {
  await expectStoryLinkRouteWithoutNavigation(page, "admin-adminhubsurface--default", "/admin/posts")
})
