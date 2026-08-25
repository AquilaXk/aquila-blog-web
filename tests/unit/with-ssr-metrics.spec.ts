import { expect, test } from "@playwright/test"
import type { IncomingMessage, ServerResponse } from "http"
import { getRuntimeMetrics } from "src/libs/server/runtimeMetrics"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"

const createContext = (requestId?: string) => {
  const headers = new Map<string, string>()
  return {
    req: { headers: requestId ? { "x-request-id": requestId } : {} } as IncomingMessage,
    res: { setHeader: (key: string, value: string) => headers.set(key.toLowerCase(), value) } as ServerResponse,
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
