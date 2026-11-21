import { expect, test } from "@playwright/test"
import { apiFetch, evictBrowserRevalidateCacheEntries } from "../../src/apis/backend/client"

const originalFetch = globalThis.fetch
const originalWindow = (globalThis as Record<string, unknown>).window

test.afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) {
    delete (globalThis as Record<string, unknown>).window
  } else {
    ;(globalThis as Record<string, unknown>).window = originalWindow
  }
})

test("evictBrowserRevalidateCacheEntries passes pure request URL without credentials prefix and evicts matching in-flight GET request", async () => {
  ;(globalThis as Record<string, unknown>).window = {
    location: { hostname: "localhost" },
  }

  let fetchCalls = 0
  const resolvers: Array<(response: Response) => void> = []

  globalThis.fetch = (() => {
    fetchCalls += 1
    return new Promise<Response>((resolve) => {
      resolvers.push(resolve)
    })
  }) as typeof fetch

  const firstPromise = apiFetch<{ ok: boolean }>("/post/api/v1/posts/feed")
  const deduplicatedPromise = apiFetch<{ ok: boolean }>("/post/api/v1/posts/feed")
  expect(fetchCalls).toBe(1)

  const observedUrls: string[] = []
  evictBrowserRevalidateCacheEntries((url) => {
    observedUrls.push(url)
    return url === "http://localhost:8080/post/api/v1/posts/feed"
  })

  expect(observedUrls).toEqual(["http://localhost:8080/post/api/v1/posts/feed"])

  const secondPromise = apiFetch<{ ok: boolean }>("/post/api/v1/posts/feed")
  expect(fetchCalls).toBe(2)

  for (const resolve of resolvers) {
    resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
  }

  await expect(firstPromise).resolves.toEqual({ ok: true })
  await expect(deduplicatedPromise).resolves.toEqual({ ok: true })
  await expect(secondPromise).resolves.toEqual({ ok: true })
})
