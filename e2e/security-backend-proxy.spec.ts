import { EventEmitter } from "node:events"
import { expect, test } from "@playwright/test"
import handler from "../src/pages/api/backend/[...path]"
import { getRuntimeMetrics } from "src/libs/server/runtimeMetrics"

type CapturedFetch = {
  url: string
  headers: Headers
}

const createMockResponse = () => {
  const response = {
    statusCode: 200,
    headers: new Map<string, string | string[]>(),
    jsonBody: undefined as unknown,
    ended: false,
    status(code: number) {
      this.statusCode = code
      return this
    },
    setHeader(key: string, value: string | string[]) {
      this.headers.set(key, value)
      return this
    },
    write() {
      return true
    },
    end() {
      this.ended = true
      return this
    },
    json(body: unknown) {
      this.jsonBody = body
      this.setHeader("content-type", "application/json")
      this.end()
      return body
    },
  }
  return response
}

const invokeBackendProxy = async ({
  method = "GET",
  headers,
  path = ["member", "api", "v1", "auth", "login"],
}: {
  method?: string
  headers: Record<string, string | string[]>
  path?: string[]
}) => {
  const previousBackendUrl = process.env.BACKEND_INTERNAL_URL
  const previousFetch = globalThis.fetch
  const captured: CapturedFetch[] = []
  process.env.BACKEND_INTERNAL_URL = "http://backend.internal"
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: String(url),
      headers: new Headers(init?.headers),
    })
    return new Response(null, { status: 204, headers: { "x-request-id": "upstream-mismatch-id" } })
  }) as typeof fetch

  try {
    const req = Object.assign(new EventEmitter(), {
      method,
      headers,
      query: { path },
      url: `/api/backend/${path.join("/")}`,
      socket: { remoteAddress: "10.0.0.8" },
      pause() {
        return this
      },
    })
    const res = createMockResponse()

    await handler(req as never, res as never)

    return { captured, res }
  } finally {
    if (previousBackendUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
    else process.env.BACKEND_INTERNAL_URL = previousBackendUrl
    globalThis.fetch = previousFetch
  }
}

test.describe("backend proxy forwarded header boundary", () => {
  test("strips spoofable forwarding headers before upstream fetch", async () => {
    const { captured, res } = await invokeBackendProxy({
      headers: {
        host: "blog.aquilaxk.site",
        cookie: "accessToken=token",
        "x-request-id": "req-proxy-1",
        "x-forwarded-for": "203.0.113.9",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "http",
        "x-real-ip": "203.0.113.10",
        "cf-connecting-ip": "203.0.113.11",
        "true-client-ip": "203.0.113.12",
        forwarded: "for=203.0.113.13;proto=http;host=evil.example",
      },
    })

    expect(res.statusCode).toBe(204)
    expect(captured).toHaveLength(1)
    const headers = captured[0].headers

    expect(headers.get("cookie")).toBe("accessToken=token")
    expect(headers.get("x-request-id")).toBe("req-proxy-1")
    expect(res.headers.get("X-Request-Id")).toBe("req-proxy-1")
    expect(headers.get("x-forwarded-host")).toBe("blog.aquilaxk.site")
    expect(headers.get("x-forwarded-proto")).toBe("https")
    expect(headers.get("x-forwarded-for")).toBe("10.0.0.8")
    expect(headers.get("x-real-ip")).toBeNull()
    expect(headers.get("cf-connecting-ip")).toBeNull()
    expect(headers.get("true-client-ip")).toBeNull()
    expect(headers.get("forwarded")).toBeNull()
  })

  test("rejects proxy request bodies above the JSON-sized default before upstream fetch", async () => {
    const { captured, res } = await invokeBackendProxy({
      method: "POST",
      headers: {
        host: "blog.aquilaxk.site",
        "content-type": "application/json",
        "content-length": String(1 * 1024 * 1024 + 1),
      },
    })

    expect(res.statusCode).toBe(413)
    expect(captured).toHaveLength(0)
  })

  test("rejects an invalid proxy path without upstream traffic and records the canonical request ID", async () => {
    const before = await getRuntimeMetrics().registry.metrics()
    const beforeCount = Number(before.match(/aquila_web_backend_fetch_duration_seconds_count\{source="proxy",route_class="other",result="4xx"\} (\d+)/)?.[1] || 0)
    const { captured, res } = await invokeBackendProxy({
      headers: { host: "blog.aquilaxk.site", "x-request-id": "req-invalid-proxy-1" },
      path: ["invalid"],
    })

    expect(captured).toHaveLength(0)
    expect(res.statusCode).toBe(400)
    expect(res.headers.get("X-Request-Id")).toBe("req-invalid-proxy-1")
    expect(res.jsonBody).toEqual({ message: "Invalid backend proxy path.", requestId: "req-invalid-proxy-1" })
    const after = await getRuntimeMetrics().registry.metrics()
    const afterCount = Number(after.match(/aquila_web_backend_fetch_duration_seconds_count\{source="proxy",route_class="other",result="4xx"\} (\d+)/)?.[1] || 0)
    expect(afterCount).toBe(beforeCount + 1)
  })
})
