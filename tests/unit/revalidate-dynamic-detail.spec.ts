import { expect, test } from "@playwright/test"
import type { NextApiRequest, NextApiResponse } from "next"
import handler from "../../src/pages/api/revalidate"

const originalToken = process.env.TOKEN_FOR_REVALIDATE
const originalFetch = globalThis.fetch
test.afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalToken === undefined) delete process.env.TOKEN_FOR_REVALIDATE
  else process.env.TOKEN_FOR_REVALIDATE = originalToken
})

for (const paths of [["/posts/101"], ["/", "/posts/101"], []]) {
  test(`revalidates only static artifacts for ${JSON.stringify(paths)}`, async () => {
    const credential = "test-only-revalidation-token"
    process.env.TOKEN_FOR_REVALIDATE = credential
    let fetchCount = 0
    globalThis.fetch = (async () => {
      fetchCount += 1
      throw new Error("No backend inventory is needed for dynamic detail paths")
    }) as typeof fetch
    const revalidated: string[] = []
    let payload: unknown
    const req = {
      method: "POST", headers: { "x-revalidate-token": credential }, query: {}, body: { paths },
    } as unknown as NextApiRequest
    const res = {
      revalidate: async (path: string) => { revalidated.push(path) },
      json: (value: unknown) => { payload = value },
      status: () => { throw new Error("Unexpected endpoint failure") },
    } as unknown as NextApiResponse
    await handler(req, res)
    expect(fetchCount).toBe(0)
    expect(revalidated).toEqual(paths.length === 1 ? [] : ["/"])
    expect(payload).toMatchObject({
      revalidated: revalidated.length > 0,
      paths: revalidated,
      count: revalidated.length,
    })
  })
}
