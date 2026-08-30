import { expect, test } from "@playwright/test"
import { buildCanonicalPostDetailStaticPaths } from "../../src/libs/server/postDetailPage"

const originalFetch = globalThis.fetch

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test("declares request-time post rendering without a build-time backend call", async () => {
  let fetchCount = 0
  globalThis.fetch = (async () => {
    fetchCount += 1
    throw new Error("build-time backend access is not allowed")
  }) as typeof fetch

  await expect(buildCanonicalPostDetailStaticPaths()).resolves.toEqual({
    paths: [],
    fallback: "blocking",
  })
  expect(fetchCount).toBe(0)
})
