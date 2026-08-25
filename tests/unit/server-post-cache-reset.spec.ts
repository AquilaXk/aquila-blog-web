import { expect, test } from "@playwright/test"
import { ApiError } from "../../src/apis/backend/client"
import {
  getPostDetailById,
  getPostsBootstrap,
  resetPostsRequestCaches,
} from "../../src/apis/backend/posts/PostApiRequests"

const originalFetch = globalThis.fetch
const originalBackendInternalUrl = process.env.BACKEND_INTERNAL_URL

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const createDeferredResponse = () => {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const createPost = (title: string) => ({
  id: 101,
  createdAt: "2026-08-25T00:00:00Z",
  modifiedAt: "2026-08-25T00:00:00Z",
  authorId: 1,
  authorName: "Aquila",
  authorProfileImgUrl: "/avatar.png",
  title,
  summary: "Cache reset regression fixture",
  summarySource: "MANUAL",
  tags: ["cache"],
  category: ["backend"],
  published: true,
  listed: true,
  likesCount: 0,
  commentsCount: 0,
  hitCount: 0,
})

const createBootstrap = (title: string) => ({
  feed: {
    content: [createPost(title)],
    pageSize: 30,
    hasNext: false,
    nextCursor: null,
  },
  tags: [{ tag: "cache", count: 1 }],
})

const createDetail = (title: string) => ({
  ...createPost(title),
  content: "Detail content",
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

test("bootstrap reset isolates old and new in-flight cache generations", async () => {
  const oldResponse = createDeferredResponse()
  const newResponse = createDeferredResponse()
  const finalResponse = createDeferredResponse()
  const responses = [oldResponse, newResponse, finalResponse]
  let fetchCount = 0
  globalThis.fetch = (() => {
    const response = responses[fetchCount]
    fetchCount += 1
    if (!response) throw new Error("unexpected bootstrap fetch")
    return response.promise
  }) as typeof fetch

  const oldRequest = getPostsBootstrap({})
  resetPostsRequestCaches()
  const newRequest = getPostsBootstrap({})

  oldResponse.resolve(jsonResponse(200, createBootstrap("before reset")))
  await expect(oldRequest).resolves.toMatchObject({ posts: [{ title: "before reset" }] })

  newResponse.resolve(jsonResponse(503, { msg: "unavailable" }))
  await expect(newRequest).rejects.toBeInstanceOf(ApiError)

  const finalRequest = getPostsBootstrap({})
  finalResponse.resolve(jsonResponse(200, createBootstrap("after reset")))
  await expect(finalRequest).resolves.toMatchObject({ posts: [{ title: "after reset" }] })
  expect(fetchCount).toBe(3)
})

test("detail reset isolates old and new in-flight cache generations", async () => {
  const oldResponse = createDeferredResponse()
  const newResponse = createDeferredResponse()
  const finalResponse = createDeferredResponse()
  const responses = [oldResponse, newResponse, finalResponse]
  let fetchCount = 0
  globalThis.fetch = (() => {
    const response = responses[fetchCount]
    fetchCount += 1
    if (!response) throw new Error("unexpected detail fetch")
    return response.promise
  }) as typeof fetch

  const oldRequest = getPostDetailById("101")
  resetPostsRequestCaches()
  const newRequest = getPostDetailById("101")

  oldResponse.resolve(jsonResponse(200, createDetail("before reset")))
  await expect(oldRequest).resolves.toMatchObject({ title: "before reset" })

  newResponse.resolve(jsonResponse(503, { msg: "unavailable" }))
  await expect(newRequest).rejects.toBeInstanceOf(ApiError)

  const finalRequest = getPostDetailById("101")
  finalResponse.resolve(jsonResponse(200, createDetail("after reset")))
  await expect(finalRequest).resolves.toMatchObject({ title: "after reset" })
  expect(fetchCount).toBe(3)
})

test("detail 404 remains semantic not-found after reset", async () => {
  globalThis.fetch = (async () => jsonResponse(404, { msg: "not found" })) as typeof fetch

  await expect(getPostDetailById("101")).resolves.toBeNull()
})
