import { expect, test } from "@playwright/test"
import {
  BACKEND_FETCH_RESULT_VALUES,
  BACKEND_ROUTE_CLASS_VALUES,
  classifyBackendHttpResult,
  classifyBackendRoute,
  createRuntimeMetrics,
  SSR_RESULT_VALUES,
  SSR_ROUTE_CLASS_VALUES,
} from "src/libs/server/runtimeMetrics"

test("runtime metrics use one private registry with bounded labels and prefixed default process evidence", async () => {
  const metrics = createRuntimeMetrics()

  metrics.observeSsrRequest({ routeClass: "public", result: "props", durationSeconds: 0.125 })
  metrics.observeBackendFetch({ source: "ssr", routeClass: "post", result: "2xx", durationSeconds: 0.25 })
  const exposition = await metrics.registry.metrics()

  expect(exposition).toContain("aquila_web_ssr_request_duration_seconds")
  expect(exposition).toContain('route_class="public",result="props"')
  expect(exposition).toContain("aquila_web_backend_fetch_duration_seconds")
  expect(exposition).toContain('source="ssr",route_class="post",result="2xx"')
  expect(exposition).toContain("aquila_web_process_resident_memory_bytes")
  expect(exposition).toContain("aquila_web_nodejs_heap_size_used_bytes")
  expect(exposition).toContain("aquila_web_process_uptime_seconds")
  expect(exposition).toContain("aquila_web_process_start_time_seconds")
  expect(exposition).toContain("aquila_web_nodejs_eventloop_lag_seconds")
  expect(exposition).not.toContain("request_id")
  expect(exposition).not.toContain("path=")
  expect(exposition).not.toContain("status=")
})

test("runtime metric enums reject unbounded labels", () => {
  expect(SSR_ROUTE_CLASS_VALUES).toEqual(["public", "auth", "admin", "editor", "system"])
  expect(SSR_RESULT_VALUES).toEqual(["props", "redirect", "not_found", "error"])
  expect(BACKEND_ROUTE_CLASS_VALUES).toEqual(["auth", "post", "cloud", "other"])
  expect(BACKEND_FETCH_RESULT_VALUES).toEqual([
    "2xx",
    "3xx",
    "4xx",
    "5xx",
    "timeout",
    "network_error",
    "aborted",
    "other_error",
  ])

  const metrics = createRuntimeMetrics()
  expect(() =>
    metrics.observeSsrRequest({ routeClass: "post" as never, result: "props", durationSeconds: 0.1 })
  ).toThrow("Invalid SSR route class")
  expect(() =>
    metrics.observeBackendFetch({ source: "ssr", routeClass: "post", result: "418" as never, durationSeconds: 0.1 })
  ).toThrow("Invalid backend fetch result")
})

test("backend classifiers keep route and HTTP labels in their fixed enums", () => {
  expect(classifyBackendRoute("/member/api/v1/auth/me")).toBe("auth")
  expect(classifyBackendRoute("/post/api/v1/posts/bootstrap")).toBe("post")
  expect(classifyBackendRoute("/system/api/v1/adm/cloud/files")).toBe("cloud")
  expect(classifyBackendRoute("/system/api/v1/adm/health")).toBe("other")
  expect(classifyBackendHttpResult(204)).toBe("2xx")
  expect(classifyBackendHttpResult(302)).toBe("3xx")
  expect(classifyBackendHttpResult(404)).toBe("4xx")
  expect(classifyBackendHttpResult(503)).toBe("5xx")
})

test("node instrumentation dynamically delegates initialization without swallowing errors", async () => {
  const first = (await import("src/libs/server/runtimeMetrics")).initializeRuntimeMetrics()
  const second = (await import("src/libs/server/runtimeMetrics")).initializeRuntimeMetrics()
  expect(second).toBe(first)
  const source = await import("node:fs/promises").then((fs) => fs.readFile("instrumentation.ts", "utf8"))
  expect(source).toContain('process.env.NEXT_RUNTIME === "nodejs"')
  expect(source).toContain('import("./instrumentation.node")')
  expect(source).not.toContain("catch")
})
