import { expect, test } from "@playwright/test"
import type { ServerResponse } from "node:http"
import { ApiError } from "../../src/apis/backend/client"
import { buildCanonicalPostDetailServerProps } from "../../src/libs/server/postDetailPage"

const originalFetch = globalThis.fetch
const originalBackend = process.env.BACKEND_INTERNAL_URL
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
