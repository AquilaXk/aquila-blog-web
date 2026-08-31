import { expect, test } from "@playwright/test"
import type { IncomingMessage } from "http"
import { readFileSync } from "node:fs"
import path from "node:path"
import { ApiError, ApiNetworkError, ApiTimeoutError } from "../../src/apis/backend/client"
import { readAdminProtectedBootstrap } from "../../src/libs/server/adminPage"
import { serverApiFetchJson } from "../../src/libs/server/backend"
import { registerServerApiFetchMetrics } from "src/libs/server/apiFetchMetrics"
import { getRuntimeMetrics } from "src/libs/server/runtimeMetrics"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"

const originalFetch = globalThis.fetch
const originalBackendInternalUrl = process.env.BACKEND_INTERNAL_URL
const originalNodeEnv = process.env.NODE_ENV

const createReq = (cookie = ""): IncomingMessage =>
  ({
    headers: { cookie },
    url: "/admin",
  }) as IncomingMessage

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const createSsrResponse = () => {
  const headers = new Map<string, string | string[]>()
  return {
    headersSent: false,
    setHeader: (name: string, value: string | string[]) => headers.set(name.toLowerCase(), value),
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    removeHeader: (name: string) => headers.delete(name.toLowerCase()),
    writeHead: () => undefined,
  }
}

test.beforeEach(() => {
  process.env.BACKEND_INTERNAL_URL = "http://backend.test"
  process.env.NODE_ENV = "test"
  registerServerApiFetchMetrics()
})

test.afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalBackendInternalUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
  else process.env.BACKEND_INTERNAL_URL = originalBackendInternalUrl
  process.env.NODE_ENV = originalNodeEnv
})

test("server metrics boundaries have no static runtime metrics dependency", () => {
  const sourcePaths = [
    "../../src/libs/server/backend.ts",
    "../../src/apis/backend/serverMetricsBridge.ts",
  ]
  for (const sourcePath of sourcePaths) {
    const source = readFileSync(path.resolve(__dirname, sourcePath), "utf8")
    expect(source).not.toContain('from "src/libs/server/runtimeMetrics"')
    expect(source).not.toContain("prom-client")
  }
})

test("serverApiFetchJson returns parsed JSON on success", async () => {
  let requestHeaders: Headers | undefined
  globalThis.fetch = (async (_input, init) => {
    requestHeaders = new Headers(init?.headers)
    return jsonResponse(200, { ok: true, value: 1 })
  }) as typeof fetch

  await expect(serverApiFetchJson<{ ok: boolean; value: number }>(createReq(), "/member/api/v1/auth/me")).resolves.toEqual({
    ok: true,
    value: 1,
  })
  expect(requestHeaders?.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i)
})

test("serverApiFetchJson forwards rotated backend cookies through the SSR response", async () => {
  const req = createReq("unrelated=keep; refresh=old; remove=stale")
  const res = createSsrResponse()
  res.setHeader("Set-Cookie", "existing=keep; Path=/")
  const observedCookies: string[] = []
  let calls = 0
  globalThis.fetch = (async (_input, init) => {
    observedCookies.push(new Headers(init?.headers).get("cookie") || "")
    calls += 1
    const headers = new Headers({ "content-type": "application/json" })
    if (calls === 1) {
      headers.append("Set-Cookie", "refresh=new-token; Path=/; HttpOnly")
      headers.append("Set-Cookie", "remove=; Max-Age=0; Path=/")
    } else {
      headers.append("Set-Cookie", "access=second-token; Path=/; Secure")
    }
    return new Response(JSON.stringify({ calls }), { status: 200, headers })
  }) as typeof fetch

  const handler = withSsrMetrics("auth", async () => {
    await serverApiFetchJson(req, "/member/api/v1/auth/session")
    await serverApiFetchJson(req, "/member/api/v1/auth/me")
    return { props: {} }
  })

  await handler({ req, res } as any)

  expect(observedCookies).toEqual([
    "unrelated=keep; refresh=old; remove=stale",
    "unrelated=keep; refresh=new-token",
  ])
  expect(res.getHeader("Set-Cookie")).toEqual([
    "existing=keep; Path=/",
    "refresh=new-token; Path=/; HttpOnly",
    "remove=; Max-Age=0; Path=/",
    "access=second-token; Path=/; Secure",
  ])
})

test("serverApiFetchJson applies backend cookies before throwing ApiError", async () => {
  const req = createReq("unrelated=keep; refresh=old")
  const res = createSsrResponse()
  globalThis.fetch = (async () => {
    const headers = new Headers({ "content-type": "application/json" })
    headers.append("Set-Cookie", "refresh=expired; Max-Age=0; Path=/; HttpOnly")
    return new Response(JSON.stringify({ msg: "unauthorized" }), { status: 401, headers })
  }) as typeof fetch

  const handler = withSsrMetrics("auth", async () => {
    await serverApiFetchJson(req, "/member/api/v1/auth/me")
    return { props: {} }
  })

  await expect(handler({ req, res } as any)).rejects.toBeInstanceOf(ApiError)
  expect(req.headers.cookie).toBe("unrelated=keep")
  expect(res.getHeader("Set-Cookie")).toEqual(["refresh=expired; Max-Age=0; Path=/; HttpOnly"])
})

test("serverApiFetchJson normalizes empty success responses to null", async () => {
  globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch
  await expect(serverApiFetchJson(createReq(), "/member/api/v1/auth/logout")).resolves.toBeNull()

  globalThis.fetch = (async () =>
    new Response("", {
      status: 200,
      headers: { "content-length": "0" },
    })) as typeof fetch
  await expect(serverApiFetchJson(createReq(), "/member/api/v1/auth/me")).resolves.toBeNull()

  globalThis.fetch = (async () => new Response("", { status: 200 })) as typeof fetch
  await expect(serverApiFetchJson(createReq(), "/member/api/v1/auth/me")).resolves.toBeNull()
})

test("serverApiFetchJson throws ApiError with status/body/userMessage on HTTP failure", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ msg: "권한이 없습니다." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    })) as typeof fetch

  try {
    await serverApiFetchJson(createReq(), "/system/api/v1/adm/bootstrap")
    throw new Error("expected ApiError")
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(403)
    expect(apiError.userMessage).toBe("권한이 없습니다.")
    expect(apiError.body).toContain("권한이 없습니다.")
    expect(apiError.requestId).toMatch(/^[0-9a-f-]{36}$/i)
  }
})

test("serverApiFetchJson wraps JSON Content-Type parse failure as ApiError", async () => {
  const count = async (result: string) => {
    const exposition = await getRuntimeMetrics().registry.metrics()
    return Number(exposition.match(new RegExp(`aquila_web_backend_fetch_duration_seconds_count\\{source="ssr",route_class="auth",result="${result}"\\} (\\d+)`))?.[1] || 0)
  }
  const beforeOther = await count("other_error")
  const beforeSuccess = await count("2xx")
  globalThis.fetch = (async () =>
    new Response("{not-json", {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch

  try {
    await serverApiFetchJson(createReq(), "/member/api/v1/auth/me")
    throw new Error("expected ApiError")
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(200)
    expect((error as ApiError).requestId).toMatch(/^[0-9a-f-]{36}$/i)
  }
  expect(await count("other_error")).toBe(beforeOther + 1)
  expect(await count("2xx")).toBe(beforeSuccess)
})

test("serverApiFetchJson propagates an observer failure without retrying observation", async () => {
  const runtimeMetrics = getRuntimeMetrics()
  const originalObserve = runtimeMetrics.observeBackendFetch
  const observerFailure = new Error("metrics observer failed")
  let observeCalls = 0
  runtimeMetrics.observeBackendFetch = () => {
    observeCalls += 1
    throw observerFailure
  }
  globalThis.fetch = (async () => jsonResponse(200, { ok: true })) as typeof fetch

  try {
    await expect(serverApiFetchJson(createReq(), "/member/api/v1/auth/me")).rejects.toBe(observerFailure)
    expect(observeCalls).toBe(1)
  } finally {
    runtimeMetrics.observeBackendFetch = originalObserve
  }
})

test("serverApiFetchJson wraps transport TypeError as ApiNetworkError", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed")
  }) as typeof fetch

  await expect(serverApiFetchJson(createReq(), "/member/api/v1/auth/me")).rejects.toBeInstanceOf(ApiNetworkError)
})

test("serverApiFetchJson wraps abort timeout as ApiTimeoutError", async () => {
  globalThis.fetch = ((_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"))
      })
    })) as typeof fetch

  await expect(
    serverApiFetchJson(createReq(), "/member/api/v1/auth/me", { timeoutMs: 1 })
  ).rejects.toBeInstanceOf(ApiTimeoutError)
})

test("admin bootstrap 401 without auth cookie redirects to login", async () => {
  globalThis.fetch = (async () => jsonResponse(401, { msg: "unauthorized" })) as typeof fetch

  await expect(readAdminProtectedBootstrap(createReq(), "/member/api/v1/adm/members/bootstrap", "/admin")).resolves.toEqual({
    ok: false,
    destination: "/admin/login?next=%2Fadmin",
  })
})

test("admin bootstrap 403 without auth cookie redirects home", async () => {
  globalThis.fetch = (async () => jsonResponse(403, { msg: "forbidden" })) as typeof fetch

  await expect(readAdminProtectedBootstrap(createReq(), "/member/api/v1/adm/members/bootstrap", "/admin")).resolves.toEqual({
    ok: false,
    destination: "/",
  })
})

test("admin bootstrap 5xx throws instead of destination null", async () => {
  globalThis.fetch = (async () => jsonResponse(503, { msg: "unavailable" })) as typeof fetch

  try {
    await readAdminProtectedBootstrap(createReq("apiKey=test"), "/member/api/v1/adm/members/bootstrap", "/admin")
    throw new Error("expected ApiError")
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(503)
  }
})

test("admin bootstrap network failure throws instead of destination null", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed")
  }) as typeof fetch

  await expect(
    readAdminProtectedBootstrap(createReq("apiKey=test"), "/member/api/v1/adm/members/bootstrap", "/admin")
  ).rejects.toBeInstanceOf(ApiNetworkError)
})
