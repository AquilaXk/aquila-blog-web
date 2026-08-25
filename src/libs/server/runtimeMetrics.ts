import { collectDefaultMetrics, Gauge, Histogram, Registry } from "prom-client"

export const SSR_ROUTE_CLASS_VALUES = ["public", "auth", "admin", "editor", "system"] as const
export const SSR_RESULT_VALUES = ["props", "redirect", "not_found", "error"] as const
export const BACKEND_ROUTE_CLASS_VALUES = ["auth", "post", "cloud", "other"] as const
export const BACKEND_FETCH_RESULT_VALUES = [
  "2xx",
  "3xx",
  "4xx",
  "5xx",
  "timeout",
  "network_error",
  "aborted",
  "other_error",
] as const

type SsrRouteClass = (typeof SSR_ROUTE_CLASS_VALUES)[number]
type SsrResult = (typeof SSR_RESULT_VALUES)[number]
type BackendRouteClass = (typeof BACKEND_ROUTE_CLASS_VALUES)[number]
type BackendFetchResult = (typeof BACKEND_FETCH_RESULT_VALUES)[number]
type BackendFetchSource = "ssr" | "isr" | "proxy"

type SsrObservation = {
  routeClass: SsrRouteClass
  result: SsrResult
  durationSeconds: number
}

type BackendFetchObservation = {
  source: BackendFetchSource
  routeClass: BackendRouteClass
  result: BackendFetchResult
  durationSeconds: number
}

export type RuntimeMetrics = {
  registry: Registry
  observeSsrRequest: (observation: SsrObservation) => void
  observeBackendFetch: (observation: BackendFetchObservation) => void
}

const hasValue = <T extends readonly string[]>(values: T, value: string): value is T[number] =>
  values.includes(value as T[number])

const assertFiniteDuration = (durationSeconds: number) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new Error("Metric duration must be a non-negative finite number")
  }
}

export const createRuntimeMetrics = (): RuntimeMetrics => {
  const registry = new Registry()
  collectDefaultMetrics({ register: registry, prefix: "aquila_web_" })
  new Gauge({
    name: "aquila_web_process_uptime_seconds",
    help: "Process uptime in seconds.",
    registers: [registry],
    collect() {
      this.set(process.uptime())
    },
  })

  const ssrRequestDuration = new Histogram({
    name: "aquila_web_ssr_request_duration_seconds",
    help: "Duration of server-side rendered requests.",
    labelNames: ["route_class", "result"],
    registers: [registry],
  })
  const backendFetchDuration = new Histogram({
    name: "aquila_web_backend_fetch_duration_seconds",
    help: "Duration of server-side backend fetches.",
    labelNames: ["source", "route_class", "result"],
    registers: [registry],
  })

  return {
    registry,
    observeSsrRequest: ({ routeClass, result, durationSeconds }) => {
      if (!hasValue(SSR_ROUTE_CLASS_VALUES, routeClass)) throw new Error("Invalid SSR route class")
      if (!hasValue(SSR_RESULT_VALUES, result)) throw new Error("Invalid SSR result")
      assertFiniteDuration(durationSeconds)
      ssrRequestDuration.observe({ route_class: routeClass, result }, durationSeconds)
    },
    observeBackendFetch: ({ source, routeClass, result, durationSeconds }) => {
      if (!hasValue(["ssr", "isr", "proxy"] as const, source)) throw new Error("Invalid backend fetch source")
      if (!hasValue(BACKEND_ROUTE_CLASS_VALUES, routeClass)) throw new Error("Invalid backend route class")
      if (!hasValue(BACKEND_FETCH_RESULT_VALUES, result)) throw new Error("Invalid backend fetch result")
      assertFiniteDuration(durationSeconds)
      backendFetchDuration.observe({ source, route_class: routeClass, result }, durationSeconds)
    },
  }
}

let runtimeMetrics: RuntimeMetrics | undefined

export const initializeRuntimeMetrics = (): RuntimeMetrics => {
  runtimeMetrics ??= createRuntimeMetrics()
  return runtimeMetrics
}

export const getRuntimeMetrics = (): RuntimeMetrics => initializeRuntimeMetrics()
