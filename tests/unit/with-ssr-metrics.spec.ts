import { expect, test } from "@playwright/test"
import type { IncomingMessage, ServerResponse } from "http"
import { getRuntimeMetrics } from "src/libs/server/runtimeMetrics"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"

const createContext = (requestId?: string) => {
  const headers = new Map<string, string>()
  let headersSent = false
  const response = {
    get headersSent() { return headersSent },
    setHeader: (key: string, value: string) => headers.set(key.toLowerCase(), value),
    getHeader: (key: string) => headers.get(key.toLowerCase()),
    removeHeader: (key: string) => headers.delete(key.toLowerCase()),
    writeHead: () => { headersSent = true },
    end: () => response.writeHead(),
  }
  return {
    req: { headers: requestId ? { "x-request-id": requestId } : {} } as IncomingMessage,
    res: response as ServerResponse,
    headers,
  }
}

test("SSR metrics record every Next outcome and return one stable response request ID", async () => {
  const cases = [
    [{ props: {} }, "props"],
    [{ redirect: { destination: "/login", permanent: false } }, "redirect"],
    [{ notFound: true }, "not_found"],
  ] as const

  for (const [value] of cases) {
    const context = createContext("req-ssr-1")
    await expect(withSsrMetrics("public", async () => value)(context as never)).resolves.toEqual(value)
    expect(context.headers.get("x-request-id")).toBe("req-ssr-1")
  }

  const errorContext = createContext()
  await expect(withSsrMetrics("public", async () => { throw new Error("boom") })(errorContext as never)).rejects.toThrow("boom")
  expect(errorContext.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i)

  const exposition = await getRuntimeMetrics().registry.metrics()
  for (const result of ["props", "redirect", "not_found", "error"]) {
    expect(exposition).toContain(`route_class="public",result="${result}"`)
  }
})

test("SSR request IDs stay private when shared responses finish or fail", async () => {
  const requestId = "req-shared-cache-1"
  const sentContext = createContext(requestId)
  const errorContext = createContext(requestId)
  const privateContext = createContext(requestId)

  await withSsrMetrics("public", async (context) => {
    context.res.setHeader("Cache-Control", "public, s-maxage=60")
    context.res.end()
    return { props: {} }
  })(sentContext as never)
  await expect(withSsrMetrics("public", async (context) => {
    context.res.setHeader("Cache-Control", "public, s-maxage=60")
    throw new Error("shared failure")
  })(errorContext as never)).rejects.toThrow("shared failure")
  await withSsrMetrics("public", async (context) => {
    context.res.setHeader("Cache-Control", "private, no-store")
    context.res.end()
    return { props: {} }
  })(privateContext as never)

  expect(sentContext.headers.get("x-request-id")).toBeUndefined()
  expect(errorContext.headers.get("x-request-id")).toBeUndefined()
  expect(privateContext.headers.get("x-request-id")).toBe(requestId)
})

test("SSR request IDs remain available on non-shared responses", async () => {
  const requestId = "req-private-cache-1"
  const context = createContext(requestId)

  await withSsrMetrics("public", async () => ({ props: {} }))(context as never)

  expect(context.headers.get("x-request-id")).toBe(requestId)
})
