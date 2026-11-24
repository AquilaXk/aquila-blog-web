import { AsyncLocalStorage } from "node:async_hooks"
import { registerServerApiFetchMetricsFactory } from "src/apis/backend/serverMetricsBridge"
import { resolveRequestId } from "src/libs/server/requestId"
import {
  classifyBackendHttpResult,
  classifyBackendRoute,
  getRuntimeMetrics,
  type BackendFetchResult,
  type BackendFetchSource,
} from "src/libs/server/runtimeMetrics"

type ActiveApiFetchContext = {
  requestId: string
  clientIp?: string
  source: "ssr"
}

export type SsrApiFetchContextInput =
  | string
  | {
      requestId: string
      clientIp?: string
    }

type ApiFetchMetricsState = {
  storage: AsyncLocalStorage<ActiveApiFetchContext>
  registered: boolean
}

type ApiFetchMetricsGlobal = typeof globalThis & {
  __aquilaApiFetchMetricsState?: ApiFetchMetricsState
}

const getState = (): ApiFetchMetricsState => {
  const authority = globalThis as ApiFetchMetricsGlobal
  authority.__aquilaApiFetchMetricsState ??= {
    storage: new AsyncLocalStorage<ActiveApiFetchContext>(),
    registered: false,
  }
  return authority.__aquilaApiFetchMetricsState
}

export const hasActiveSsrApiFetchContext = (): boolean => Boolean(getState().storage.getStore())

export const runWithSsrApiFetchContext = async <T>(
  input: SsrApiFetchContextInput,
  handler: () => Promise<T>
): Promise<T> => {
  const normalized: ActiveApiFetchContext =
    typeof input === "string"
      ? { requestId: input, source: "ssr" }
      : {
          requestId: input.requestId,
          ...(input.clientIp ? { clientIp: input.clientIp } : {}),
          source: "ssr",
        }
  return await getState().storage.run(normalized, handler)
}

export const registerServerApiFetchMetrics = () => {
  const state = getState()
  if (state.registered) return

  registerServerApiFetchMetricsFactory((path, headers, requestedSource) => {
    const activeContext = state.storage.getStore()
    const requestId = activeContext?.requestId ?? resolveRequestId(headers.get("x-request-id"))
    const source: BackendFetchSource = requestedSource ?? activeContext?.source ?? "isr"
    const routeClass = classifyBackendRoute(path)
    const startedAt = performance.now()
    let observed = false
    headers.set("X-Request-Id", requestId)
    if (activeContext?.clientIp) {
      if (!headers.has("cf-connecting-ip")) headers.set("CF-Connecting-IP", activeContext.clientIp)
      if (!headers.has("x-internal-client-ip")) headers.set("X-Internal-Client-IP", activeContext.clientIp)
      if (!headers.has("x-forwarded-for")) headers.set("X-Forwarded-For", activeContext.clientIp)
    }
    const observe = (result: BackendFetchResult) => {
      if (observed) throw new Error("apiFetch metrics outcome was already observed")
      observed = true
      getRuntimeMetrics().observeBackendFetch({
        source,
        routeClass,
        result,
        durationSeconds: (performance.now() - startedAt) / 1_000,
      })
    }

    return {
      requestId,
      observe,
      observeStatus: (status: number) => observe(classifyBackendHttpResult(status)),
    }
  })
  state.registered = true
}
