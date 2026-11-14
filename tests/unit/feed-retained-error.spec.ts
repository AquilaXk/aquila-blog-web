import { expect, test } from "@playwright/test"
import { resolveFeedVisiblePosts } from "../../src/routes/Feed/FeedExplorer"

test("retained feed cards stay visible when background revalidation fails", () => {
  expect(resolveFeedVisiblePosts([{ id: 1 }], [{ id: 2 }], true)).toEqual({
    pinnedPosts: [{ id: 1 }],
    regularPosts: [{ id: 2 }],
  })
  expect(resolveFeedVisiblePosts([{ id: 1 }], [{ id: 2 }], false)).toEqual({
    pinnedPosts: [{ id: 1 }],
    regularPosts: [{ id: 2 }],
  })
})
