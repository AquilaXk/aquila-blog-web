import { expect, test } from "@playwright/test"
import { apiFetch } from "src/apis/backend/client"
import { getRuntimeMetrics } from "src/libs/server/runtimeMetrics"
import { registerServerApiFetchMetrics, runWithSsrApiFetchContext } from "src/libs/server/apiFetchMetrics"

test.beforeEach(() => {
  registerServerApiFetchMetrics()
})

test("server data-only apiFetch propagates one request ID and observes only bounded ISR labels", async () => {
  const originalFetch = globalThis.fetch
  const originalBackendUrl = process.env.BACKEND_INTERNAL_URL
  const capturedHeaders: Headers[] = []
  process.env.BACKEND_INTERNAL_URL = "http://backend.test"
  globalThis.fetch = (async (_input, init) => {
    capturedHeaders.push(new Headers(init?.headers))
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } })
  }) as typeof fetch

  try {
    const before = await metricCount("isr", "2xx")
    await expect(apiFetch<{ ok: boolean }>("/post/api/v1/posts/bootstrap")).resolves.toEqual({ ok: true })
    expect(capturedHeaders).toHaveLength(1)
    expect(capturedHeaders[0].get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i)
    const exposition = await getRuntimeMetrics().registry.metrics()
    expect(await metricCount("isr", "2xx")).toBe(before + 1)
    expect(exposition).not.toContain("request_id")
  } finally {
    globalThis.fetch = originalFetch
    if (originalBackendUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
    else process.env.BACKEND_INTERNAL_URL = originalBackendUrl
  }
})

test("SSR request context reuses its canonical ID and switches shared apiFetch to SSR source", async () => {
  const originalFetch = globalThis.fetch
  const originalBackendUrl = process.env.BACKEND_INTERNAL_URL
  const capturedHeaders: Headers[] = []
  process.env.BACKEND_INTERNAL_URL = "http://backend.test"
  globalThis.fetch = (async (_input, init) => {
    capturedHeaders.push(new Headers(init?.headers))
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } })
  }) as typeof fetch

  try {
    await runWithSsrApiFetchContext("req-active-ssr-1", async () => {
      await apiFetch<{ ok: boolean }>("/post/api/v1/posts/bootstrap")
    })
    expect(capturedHeaders[0].get("x-request-id")).toBe("req-active-ssr-1")
    const exposition = await getRuntimeMetrics().registry.metrics()
    expect(exposition).toContain('source="ssr",route_class="post",result="2xx"')
  } finally {
    globalThis.fetch = originalFetch
    if (originalBackendUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
    else process.env.BACKEND_INTERNAL_URL = originalBackendUrl
  }
})

const metricCount = async (source: string, result: string) => {
  const exposition = await getRuntimeMetrics().registry.metrics()
  const match = exposition.match(new RegExp(`aquila_web_backend_fetch_duration_seconds_count\\{source="${source}",route_class="post",result="${result}"\\} (\\d+)`))
  return Number(match?.[1] || 0)
}

test("server apiFetch classifies representative outcomes and observes each once", async () => {
  const originalFetch = globalThis.fetch
  const originalBackendUrl = process.env.BACKEND_INTERNAL_URL
  process.env.BACKEND_INTERNAL_URL = "http://backend.test"
  const assertOneOutcome = async (result: string, operation: () => Promise<unknown>) => {
    const before = await metricCount("isr", result)
    await operation()
    expect(await metricCount("isr", result)).toBe(before + 1)
  }

  try {
    globalThis.fetch = (async () => new Response("unavailable", { status: 503 })) as typeof fetch
    await assertOneOutcome("5xx", async () => { await apiFetch("/post/api/v1/posts/bootstrap").catch(() => undefined) })

    globalThis.fetch = (async () => new Response("not-json", { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch
    await assertOneOutcome("other_error", async () => { await apiFetch("/post/api/v1/posts/bootstrap").catch(() => undefined) })

    globalThis.fetch = (async () => { throw new TypeError("network") }) as typeof fetch
    await assertOneOutcome("network_error", async () => { await apiFetch("/post/api/v1/posts/bootstrap").catch(() => undefined) })

    globalThis.fetch = ((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError")))
    })) as typeof fetch
    await assertOneOutcome("timeout", async () => { await apiFetch("/post/api/v1/posts/bootstrap", { timeoutMs: 1 }).catch(() => undefined) })

    const controller = new AbortController()
    controller.abort()
    globalThis.fetch = (async () => { throw new DOMException("aborted", "AbortError") }) as typeof fetch
    await assertOneOutcome("aborted", async () => { await apiFetch("/post/api/v1/posts/bootstrap", { signal: controller.signal }).catch(() => undefined) })
  } finally {
    globalThis.fetch = originalFetch
    if (originalBackendUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
    else process.env.BACKEND_INTERNAL_URL = originalBackendUrl
  }
})
