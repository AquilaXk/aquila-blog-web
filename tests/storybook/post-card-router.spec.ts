import { expect, test } from "@playwright/test"

test("PostCard routes its regular story through the Storybook router adapter", async ({ page }) => {
  await page.goto("/iframe.html?id=feed-postcard--regular&viewMode=story")

  const card = page.locator("[data-ui=feed-post-card]")
  await expect(card).toBeVisible()
  await card.click()

  await expect.poll(() =>
    page.evaluate(() =>
      (window as typeof window & { __AQUILA_STORYBOOK_ROUTER_PATH__?: string })
        .__AQUILA_STORYBOOK_ROUTER_PATH__
    )
  ).toBe("/posts/503")
})
