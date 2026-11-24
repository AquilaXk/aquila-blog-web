import { expect, test } from "@playwright/test"
import type { ServerResponse } from "node:http"
import { ApiError } from "../../src/apis/backend/client"
import { buildCanonicalPostDetailServerProps } from "../../src/libs/server/postDetailPage"

const originalFetch = globalThis.fetch
const originalBackend = process.env.BACKEND_INTERNAL_URL
const originalTrustedProxyIps = process.env.TRUSTED_PROXY_IPS
const post = {
  id: 101, title: "Initially public", content: "Protected manuscript",
  summary: "Summary", summarySource: "MANUAL", authorId: 1, authorName: "Aquila",
  createdAt: "2026-09-01T00:00:00Z", modifiedAt: "2026-09-01T00:00:00Z",
  published: true, listed: false, tags: [], category: [], hitCount: 0, likesCount: 0,
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
})
const response = () => {
  const headers = new Map<string, unknown>()
  const res: Pick<ServerResponse, "setHeader"> = {
    setHeader(name, value) { headers.set(name, value); return this as ServerResponse },
  }
  return { res, headers }
}

test.beforeEach(() => { process.env.BACKEND_INTERNAL_URL = "http://backend.test" })
test.afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalBackend === undefined) delete process.env.BACKEND_INTERNAL_URL
  else process.env.BACKEND_INTERNAL_URL = originalBackend
  if (originalTrustedProxyIps === undefined) delete process.env.TRUSTED_PROXY_IPS
  else process.env.TRUSTED_PROXY_IPS = originalTrustedProxyIps
})

for (const status of [404, 503]) {
  test(`request-time detail cannot return prior body after origin ${status}`, async () => {
    let detailReads = 0
    globalThis.fetch = (async (input) => {
      if (String(input).includes("/posts/101")) {
        detailReads += 1
        return detailReads === 1 ? json(200, post) : json(status, { msg: "unavailable" })
      }
      return json(200, { username: "Aquila", nickname: "Aquila" })
    }) as typeof fetch
    const first = response()
    const initial = await buildCanonicalPostDetailServerProps("101", first.res)
    expect(JSON.stringify(initial)).toContain(post.content)
    expect(initial).not.toHaveProperty("revalidate")
    expect(first.headers.get("Cache-Control")).toBe("private, no-store")

    const next = response()
    const result = buildCanonicalPostDetailServerProps("101", next.res)
    if (status === 404) await expect(result).resolves.toEqual({ notFound: true })
    else await expect(result).rejects.toBeInstanceOf(ApiError)
    expect(detailReads).toBe(2)
    expect(next.headers.get("Cache-Control")).toBe("private, no-store")
  })
}

test("includes initialAdminProfile in props to prevent redundant hydration refetch", async () => {
  globalThis.fetch = (async (input) => {
    if (String(input).includes("/posts/101")) return json(200, post)
    return json(200, {
      username: "Aquila",
      name: "Aquila",
      nickname: "Aquila",
      profileImageUrl: "",
    })
  }) as typeof fetch
  const res = response()
  const result = await buildCanonicalPostDetailServerProps("101", res.res)
  if ("props" in result) {
    expect((result.props as Record<string, unknown>).initialAdminProfile).toMatchObject({
      username: "Aquila",
      nickname: "Aquila",
    })
  }
})

test("invalid post ID returns notFound without making network requests", async () => {
  let fetchCount = 0
  globalThis.fetch = (async () => {
    fetchCount += 1
    return json(200, { username: "Aquila", nickname: "Aquila" })
  }) as typeof fetch
  const res = response()
  const result = await buildCanonicalPostDetailServerProps("invalid-id", res.res)
  expect(result).toEqual({ notFound: true })
  expect(fetchCount).toBe(0)
})

test("resolves [[wikilink]] post targets on SSR when post content references internal posts", async () => {
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes("/posts/101")) {
      return json(200, {
        ...post,
        content: "See [[Target Architecture#Cache Layer|Cache Note]] and [[Missing Note]].",
      })
    }
    if (url.includes("/post/api/v1/posts/feed")) {
      return json(200, {
        content: [
          {
            id: 205,
            title: "Target Architecture",
            summary: "Target summary",
            summarySource: "MANUAL",
            authorId: 1,
            authorName: "Aquila",
            tags: ["Architecture"],
            published: true,
            listed: true,
            createdAt: "2026-09-02T00:00:00Z",
            modifiedAt: "2026-09-02T00:00:00Z",
          },
        ],
        pageable: { pageNumber: 1, pageSize: 100, totalElements: 1 },
      })
    }
    return json(200, { username: "Aquila", nickname: "Aquila", profileImageUrl: "" })
  }) as typeof fetch

  const res = response()
  const result = await buildCanonicalPostDetailServerProps("101", res.res)
  expect("props" in result).toBe(true)
  if ("props" in result) {
    expect((result.props as Record<string, unknown>).initialInternalLinkTargets).toEqual({
      "target architecture": "/posts/205",
    })
  }
})

test("forwards sanitized visitor CF-Connecting-IP on detail SSR backend requests", async () => {
  const capturedDetailHeaders: Array<Record<string, string>> = []
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    if (url.includes("/posts/101")) {
      const headers = new Headers(init?.headers)
      capturedDetailHeaders.push({
        cfConnectingIp: headers.get("cf-connecting-ip") ?? "",
        xForwardedFor: headers.get("x-forwarded-for") ?? "",
      })
      return json(200, post)
    }
    return json(200, { username: "Aquila", nickname: "Aquila", profileImageUrl: "" })
  }) as typeof fetch

  const res = response()
  await buildCanonicalPostDetailServerProps("101", res.res, {
    headers: {
      cookie: "aquila_lang=ko",
      "cf-connecting-ip": "198.51.100.77",
    },
    socket: { remoteAddress: "127.0.0.1" },
  })

  expect(capturedDetailHeaders).toEqual([
    {
      cfConnectingIp: "198.51.100.77",
      xForwardedFor: "198.51.100.77",
    },
  ])
})

test("untrusted SSR peer strips CF-Connecting-IP and X-Internal-Client-IP and forwards only X-Forwarded-For", async () => {
  delete process.env.TRUSTED_PROXY_IPS
  const capturedDetailHeaders: Array<{ cfConnectingIp: string | null; xInternalClientIp: string | null; xForwardedFor: string | null }> = []
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    if (url.includes("/posts/101")) {
      const headers = new Headers(init?.headers)
      capturedDetailHeaders.push({
        cfConnectingIp: headers.get("cf-connecting-ip"),
        xInternalClientIp: headers.get("x-internal-client-ip"),
        xForwardedFor: headers.get("x-forwarded-for"),
      })
      return json(200, post)
    }
    return json(200, { username: "Aquila", nickname: "Aquila", profileImageUrl: "" })
  }) as typeof fetch

  const res = response()
  await buildCanonicalPostDetailServerProps("101", res.res, {
    headers: {
      "cf-connecting-ip": "1.2.3.4",
    },
    socket: { remoteAddress: "203.0.113.50" },
  })

  expect(capturedDetailHeaders).toEqual([
    {
      cfConnectingIp: null,
      xInternalClientIp: null,
      xForwardedFor: "203.0.113.50",
    },
  ])
})

test("CIDR trusted peer in TRUSTED_PROXY_IPS forwards visitor CF-Connecting-IP on detail SSR", async () => {
  process.env.TRUSTED_PROXY_IPS = "172.16.0.0/12"
  const capturedDetailHeaders: Array<{ cfConnectingIp: string | null; xInternalClientIp: string | null; xForwardedFor: string | null }> = []
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    if (url.includes("/posts/101")) {
      const headers = new Headers(init?.headers)
      capturedDetailHeaders.push({
        cfConnectingIp: headers.get("cf-connecting-ip"),
        xInternalClientIp: headers.get("x-internal-client-ip"),
        xForwardedFor: headers.get("x-forwarded-for"),
      })
      return json(200, post)
    }
    return json(200, { username: "Aquila", nickname: "Aquila", profileImageUrl: "" })
  }) as typeof fetch

  const res = response()
  await buildCanonicalPostDetailServerProps("101", res.res, {
    headers: {
      "cf-connecting-ip": "198.51.100.77",
    },
    socket: { remoteAddress: "::ffff:172.18.0.3" },
  })

  expect(capturedDetailHeaders).toEqual([
    {
      cfConnectingIp: "198.51.100.77",
      xInternalClientIp: "198.51.100.77",
      xForwardedFor: "198.51.100.77",
    },
  ])
})

test("resolves [[wikilink]] targets via wikilink-catalog before feed fallback", async () => {
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes("/post/api/v1/posts/wikilink-catalog")) {
      return json(200, {
        items: [
          {
            id: 712,
            title: "Older Deep Archive Post",
            createdAt: "2024-01-15T00:00:00Z",
          },
        ],
      })
    }
    if (url.includes("/posts/101")) {
      return json(200, {
        ...post,
        content: "Background in [[Older Deep Archive Post|Archive]].",
      })
    }
    return json(200, { username: "Aquila", nickname: "Aquila", profileImageUrl: "" })
  }) as typeof fetch

  const res = response()
  const result = await buildCanonicalPostDetailServerProps("101", res.res)
  expect("props" in result).toBe(true)
  if ("props" in result) {
    expect((result.props as Record<string, unknown>).initialInternalLinkTargets).toEqual({
      "older deep archive post": "/posts/712",
    })
  }
})

