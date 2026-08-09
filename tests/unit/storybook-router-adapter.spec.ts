import { expect, test } from "@playwright/test"
import router, {
  getStorybookRouterPath,
  resetStorybookRouterPath,
} from "../../.storybook/next-router"

test.describe("storybook router adapter", () => {
  test("records a PostCard post path", async () => {
    resetStorybookRouterPath()

    await expect(router.push("/posts/503")).resolves.toBe(true)
    expect(getStorybookRouterPath()).toBe("/posts/503")
  })
})
