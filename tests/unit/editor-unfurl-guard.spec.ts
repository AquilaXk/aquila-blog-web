import { expect, test } from "@playwright/test"
import type { NextApiRequest, NextApiResponse } from "next"
import handler from "../../src/pages/api/editor/unfurl"

const createMockRes = () => {
  let statusCode = 200
  let jsonBody: unknown = null
  const headers = new Map<string, string>()

  const res = {
    setHeader(name: string, value: string) {
      headers.set(name, value)
      return this
    },
    status(code: number) {
      statusCode = code
      return this
    },
    json(body: unknown) {
      jsonBody = body
      return this
    },
  } as unknown as NextApiResponse

  return {
    res,
    getStatusCode: () => statusCode,
    getJsonBody: () => jsonBody,
  }
}

test.describe("editor unfurl admin guard", () => {
  const originalEnv = { ...process.env }

  test.afterEach(() => {
    process.env = { ...originalEnv }
  })

  test("rejects unauthenticated requests with 401 when QA bypass is disabled", async () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      configurable: true,
      enumerable: true,
      writable: true,
    })
    delete process.env.ADMIN_GUARD_QA_BYPASS
    delete process.env.ENABLE_QA_ROUTES
    delete process.env.BACKEND_INTERNAL_URL

    const req = {
      method: "GET",
      headers: {},
      query: { url: "https://github.com/aquilaxk/aquila-blog" },
    } as unknown as NextApiRequest

    const mock = createMockRes()
    await handler(req, mock.res)

    expect(mock.getStatusCode()).toBe(401)
    expect(mock.getJsonBody()).toEqual({
      ok: false,
      message: "관리자 세션이 필요합니다.",
    })
  })
})
