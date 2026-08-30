import { expect, test } from "@playwright/test"
import { ApiError } from "../../src/apis/backend/client"
import { resetPostsRequestCaches } from "../../src/apis/backend/posts/PostApiRequests"
import { buildCanonicalPostDetailStaticPaths } from "../../src/libs/server/postDetailPage"

const originalFetch = globalThis.fetch
const originalBackendInternalUrl = process.env.BACKEND_INTERNAL_URL

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const createPost = (id: number) => ({
  id,
  createdAt: "2026-08-31T00:00:00Z",
  modifiedAt: "2026-08-31T00:00:00Z",
  authorId: 1,
  authorName: "Aquila",
  authorProfileImgUrl: "/avatar.png",
  title: `Post ${id}`,
  summary: "Static path regression fixture",
  summarySource: "MANUAL",
  tags: ["release"],
  category: ["engineering"],
  published: true,
  listed: true,
  likesCount: 0,
  hitCount: 0,
})

test.beforeEach(() => {
  process.env.BACKEND_INTERNAL_URL = "http://backend.test"
  resetPostsRequestCaches()
})

test.afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalBackendInternalUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
  else process.env.BACKEND_INTERNAL_URL = originalBackendInternalUrl
  resetPostsRequestCaches()
})

test("rejects static-path generation when the canonical bootstrap fails", async () => {
  globalThis.fetch = (async () => jsonResponse(503, { msg: "unavailable" })) as typeof fetch

  await expect(buildCanonicalPostDetailStaticPaths()).rejects.toBeInstanceOf(ApiError)
})

test("maps canonical bootstrap post IDs to static paths", async () => {
  globalThis.fetch = (async () =>
    jsonResponse(200, {
      feed: {
        content: [createPost(101), createPost(205)],
        pageSize: 16,
        hasNext: false,
        nextCursor: null,
      },
      tags: [{ tag: "release", count: 2 }],
    })) as typeof fetch

  await expect(buildCanonicalPostDetailStaticPaths()).resolves.toEqual({
    paths: [{ params: { id: "101" } }, { params: { id: "205" } }],
    fallback: "blocking",
  })
})
