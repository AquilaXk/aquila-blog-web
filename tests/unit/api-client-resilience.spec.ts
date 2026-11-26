import { expect, test } from "@playwright/test"
import {
  apiFetch,
  ApiNetworkError,
  ApiTimeoutError,
  DEFAULT_UPLOAD_TIMEOUT_MS,
  evictBrowserRevalidateCacheEntries,
  fetchRawApiMutation,
} from "../../src/apis/backend/client"
import { invalidatePublicPostReadCaches } from "../../src/apis/backend/posts/PostApiCache"
import { resolveEditorUploadFailureRecovery } from "../../src/routes/Admin/editorFailureRecoveryModel"

const originalFetch = globalThis.fetch
const originalWindow = (globalThis as Record<string, unknown>).window

test.afterEach(() => {
  evictBrowserRevalidateCacheEntries(() => true)
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

test("fetchRawApiMutation attaches X-Aquila-CSRF, credentials, 90s default upload timeout, and maps timeout to ApiTimeoutError", async () => {
  expect(DEFAULT_UPLOAD_TIMEOUT_MS).toBe(90_000)

  const captured: Array<{ url: string; csrf: string | null; credentials: RequestCredentials | undefined; hasSignal: boolean }> = []
  globalThis.fetch = (async (input, init) => {
    const headers = new Headers(init?.headers)
    captured.push({
      url: String(input),
      csrf: headers.get("x-aquila-csrf"),
      credentials: init?.credentials,
      hasSignal: init?.signal instanceof AbortSignal,
    })
    return new Response(JSON.stringify({ data: { url: "/post/api/v1/images/ok.webp" } }), {
      status: 201,
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch

  const imageForm = new FormData()
  imageForm.append("file", new Blob(["png"], { type: "image/png" }), "sample.png")
  const imageRes = await fetchRawApiMutation("/post/api/v1/posts/images", {
    method: "POST",
    credentials: "include",
    body: imageForm,
  })
  expect(imageRes.status).toBe(201)

  const fileForm = new FormData()
  fileForm.append("file", new Blob(["pdf"], { type: "application/pdf" }), "guide.pdf")
  const fileRes = await fetchRawApiMutation("/post/api/v1/posts/files", {
    method: "POST",
    credentials: "include",
    body: fileForm,
  })
  expect(fileRes.status).toBe(201)

  expect(captured).toEqual([
    {
      url: "http://localhost:8080/post/api/v1/posts/images",
      csrf: "1",
      credentials: "include",
      hasSignal: true,
    },
    {
      url: "http://localhost:8080/post/api/v1/posts/files",
      csrf: "1",
      credentials: "include",
      hasSignal: true,
    },
  ])

  globalThis.fetch = ((_input, init) => {
    if (init?.signal?.aborted) {
      return Promise.reject(init.signal.reason ?? new DOMException("Aborted", "AbortError"))
    }
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(init.signal?.reason ?? new DOMException("Aborted", "AbortError")),
        { once: true }
      )
    })
  }) as typeof fetch

  let caughtTimeout: unknown = null
  try {
    await fetchRawApiMutation("/post/api/v1/posts/files", {
      method: "POST",
      body: fileForm,
      timeoutMs: 15,
    })
  } catch (error) {
    caughtTimeout = error
  }

  expect(caughtTimeout).toBeInstanceOf(ApiTimeoutError)
  expect((caughtTimeout as ApiTimeoutError).timeoutMs).toBe(15)
  const recovery = resolveEditorUploadFailureRecovery(caughtTimeout, {
    kind: "file",
    fileName: "guide.pdf",
    isOnline: true,
  })
  expect(recovery.result.errorType).toBe("timeout")
  expect(recovery.result.canRetry).toBe(true)

  const callerAbortController = new AbortController()
  const callerReason = new DOMException("Caller aborted", "AbortError")
  callerAbortController.abort(callerReason)
  await expect(
    fetchRawApiMutation("/post/api/v1/posts/images", {
      method: "POST",
      body: imageForm,
      signal: callerAbortController.signal,
    })
  ).rejects.toBe(callerReason)

  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch")
  }) as typeof fetch
  await expect(
    fetchRawApiMutation("/post/api/v1/posts/images", {
      method: "POST",
      body: imageForm,
    })
  ).rejects.toBeInstanceOf(ApiNetworkError)
})

test("public GET request policies omit credentials and enable ETag revalidate for wikilink-catalog, post detail, and backlinks", async () => {
  ;(globalThis as Record<string, unknown>).window = {
    location: { hostname: "localhost" },
  }

  const calls: Array<{ url: string; credentials: RequestCredentials | undefined; ifNoneMatch: string | null }> = []
  let catalogAttempts = 0

  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    calls.push({
      url,
      credentials: init?.credentials,
      ifNoneMatch: headers.get("if-none-match"),
    })
    if (url.endsWith("/post/api/v1/posts/wikilink-catalog")) {
      catalogAttempts += 1
      if (catalogAttempts === 1) {
        return new Response("busy", { status: 503 })
      }
      if (headers.get("if-none-match") === 'W/"cat-1"') {
        return new Response(null, { status: 304, headers: { etag: 'W/"cat-1"', "cache-control": "public, max-age=15" } })
      }
      return new Response(JSON.stringify({ items: [{ id: 35, title: "Catalog Target", createdAt: "2026-11-20T00:00:00Z" }] }), {
        status: 200,
        headers: { "content-type": "application/json", etag: 'W/"cat-1"' },
      })
    }
    if (url.endsWith("/post/api/v1/posts/42/backlinks")) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json", etag: 'W/"bl-42"' },
      })
    }
    return new Response(JSON.stringify({ id: 42, title: "Public Post" }), {
      status: 200,
      headers: { "content-type": "application/json", etag: 'W/"post-42"' },
    })
  }) as typeof fetch

  // 1st wikilink-catalog call hits 503 and retries once (retryCount = 1), omitting credentials.
  const catalog = await apiFetch<{ items: Array<{ id: number; title: string }> }>("/post/api/v1/posts/wikilink-catalog")
  expect(catalog.items).toHaveLength(1)
  expect(catalogAttempts).toBe(2)

  // 2nd wikilink-catalog call revalidates with cached ETag (cacheMode = revalidate) and handles 304.
  const catalogRevalidated = await apiFetch<{ items: Array<{ id: number; title: string }> }>("/post/api/v1/posts/wikilink-catalog")
  expect(catalogRevalidated).toEqual(catalog)

  await apiFetch<{ items: unknown[] }>("/post/api/v1/posts/42/backlinks")
  await apiFetch<{ id: number }>("/post/api/v1/posts/42")

  expect(calls.every((entry) => entry.credentials === "omit")).toBe(true)
  expect(calls.some((entry) => entry.url.endsWith("/wikilink-catalog") && entry.ifNoneMatch === 'W/"cat-1"')).toBe(true)
  expect(calls.some((entry) => entry.url.endsWith("/42/backlinks"))).toBe(true)
  expect(calls.some((entry) => entry.url.endsWith("/posts/42"))).toBe(true)

  await invalidatePublicPostReadCaches()

  const postEvictIfNoneMatch: Array<{ url: string; ifNoneMatch: string | null }> = []
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    postEvictIfNoneMatch.push({ url, ifNoneMatch: headers.get("if-none-match") })
    if (url.endsWith("/post/api/v1/posts/wikilink-catalog")) {
      return new Response(
        JSON.stringify({ items: [{ id: 36, title: "Updated Target", createdAt: "2026-11-26T00:00:00Z" }] }),
        { status: 200, headers: { "content-type": "application/json", etag: 'W/"cat-2"' } }
      )
    }
    return new Response(JSON.stringify({ items: [{ id: 99, title: "New Backlink", summary: "s" }] }), {
      status: 200,
      headers: { "content-type": "application/json", etag: 'W/"bl-42-2"' },
    })
  }) as typeof fetch

  const freshCatalog = await apiFetch<{ items: Array<{ id: number; title: string }> }>("/post/api/v1/posts/wikilink-catalog")
  await apiFetch<{ items: Array<{ id: number; title: string }> }>("/post/api/v1/posts/42/backlinks")
  expect(freshCatalog.items[0]?.title).toBe("Updated Target")
  expect(postEvictIfNoneMatch.every((entry) => entry.ifNoneMatch === null)).toBe(true)
})
