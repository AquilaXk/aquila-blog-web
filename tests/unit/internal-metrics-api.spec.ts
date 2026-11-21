import { expect, test } from "@playwright/test"
import { createMetricsHandler } from "src/pages/api/internal/metrics"

const testToken = "unit-metrics-token-for-contract-validation"

const createResponse = () => {
  const response = {
    statusCode: 200,
    headers: new Map<string, string>(),
    body: "",
    setHeader(key: string, value: string) {
      this.headers.set(key.toLowerCase(), value)
      return this
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    send(body: string) {
      this.body = body
      return this
    },
  }
  return response
}

const invoke = async (options: {
  method?: string
  authorization?: string
  token?: string
  metrics?: () => Promise<string>
} = {}) => {
  const { method = "GET", authorization, metrics } = options
  const token = "token" in options ? options.token : testToken
  const response = createResponse()
  const handler = createMetricsHandler({
    token,
    registry: {
      contentType: "text/plain; version=0.0.4",
      metrics: metrics ?? (async () => "aquila_web_process_uptime_seconds 1\n"),
    },
  })
  await handler({ method, headers: authorization ? { authorization } : {} } as never, response as never)
  return response
}

test("metrics endpoint fails closed when the configured token is undefined or blank", async () => {
  for (const token of [undefined, "   ", "short-metrics-token"]) {
    const response = await invoke({ token })
    expect(response.statusCode).toBe(503)
    expect(response.body).toBe("Service Unavailable")
  }
})

test("metrics endpoint rejects missing and wrong bearer credentials", async () => {
  for (const authorization of [undefined, "Bearer wrong-token"]) {
    const response = await invoke({ authorization })
    expect(response.statusCode).toBe(401)
    expect(response.body).toBe("Unauthorized")
  }
})

test("metrics endpoint allows only GET", async () => {
  const response = await invoke({ method: "POST", authorization: `Bearer ${testToken}` })
  expect(response.statusCode).toBe(405)
  expect(response.headers.get("allow")).toBe("GET")
})

test("metrics endpoint returns no diagnostics when exposition fails", async () => {
  const response = await invoke({ authorization: `Bearer ${testToken}`, metrics: async () => { throw new Error("registry failure") } })
  expect(response.statusCode).toBe(500)
  expect(response.body).toBe("Internal Server Error")
})

test("metrics endpoint returns Prometheus exposition only for an exact bearer token", async () => {
  const response = await invoke({ authorization: `Bearer ${testToken}` })
  expect(response.statusCode).toBe(200)
  expect(response.headers.get("content-type")).toBe("text/plain; version=0.0.4")
  expect(response.body).toBe("aquila_web_process_uptime_seconds 1\n")
})
