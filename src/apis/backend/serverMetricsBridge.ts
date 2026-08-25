export type ServerApiFetchMetricsResult =
  | "2xx"
  | "3xx"
  | "4xx"
  | "5xx"
  | "timeout"
  | "network_error"
  | "aborted"
  | "other_error"

export type ServerApiFetchMetricsSource = "ssr"

export type ServerApiFetchMetricsContext = {
  requestId: string
  observe: (result: ServerApiFetchMetricsResult) => void
  observeStatus: (status: number) => void
}

export type ServerApiFetchMetricsFactory = (
  path: string,
  headers: Headers,
  source?: ServerApiFetchMetricsSource
) => ServerApiFetchMetricsContext

type ServerApiFetchMetricsGlobal = typeof globalThis & {
  __aquilaServerApiFetchMetricsFactory?: ServerApiFetchMetricsFactory
}

const serverApiFetchMetricsGlobal = globalThis as ServerApiFetchMetricsGlobal

export const registerServerApiFetchMetricsFactory = (factory: ServerApiFetchMetricsFactory) => {
  serverApiFetchMetricsGlobal.__aquilaServerApiFetchMetricsFactory = factory
}

export const createServerApiFetchMetricsContext = (
  path: string,
  headers: Headers,
  source?: ServerApiFetchMetricsSource
): ServerApiFetchMetricsContext => {
  const factory = serverApiFetchMetricsGlobal.__aquilaServerApiFetchMetricsFactory
  if (!factory) throw new Error("Server apiFetch metrics factory is unavailable")
  return factory(path, headers, source)
}
