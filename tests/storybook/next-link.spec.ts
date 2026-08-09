import { expect, test, type Page } from "@playwright/test"

const expectStoryLink = async (page: Page, storyId: string, href: string) => {
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`)
  await expect(page.locator(`a[href="${href}"]`)).toBeVisible()
  expect(pageErrors).toEqual([])
}

test("AuthShell Login renders its signup link", async ({ page }) => {
  await expectStoryLink(page, "auth-authshell--login", "/signup")
})

test("AdminHubSurface Default renders its admin posts link", async ({ page }) => {
  await expectStoryLink(page, "admin-adminhubsurface--default", "/admin/posts")
})
