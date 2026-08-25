import { AsyncLocalStorage } from "node:async_hooks"
import { registerServerApiFetchMetricsFactory } from "src/apis/backend/client"
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
  source: "ssr"
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

export const runWithSsrApiFetchContext = async <T>(requestId: string, handler: () => Promise<T>): Promise<T> =>
  await getState().storage.run({ requestId, source: "ssr" }, handler)

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
