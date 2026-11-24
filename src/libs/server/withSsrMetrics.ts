import type { GetServerSideProps, GetServerSidePropsResult, PreviewData } from "next"
import type { ServerResponse } from "node:http"
import type { ParsedUrlQuery } from "node:querystring"
import { registerServerApiFetchMetrics, runWithSsrApiFetchContext } from "src/libs/server/apiFetchMetrics"
import { resolveTrustedClientIp } from "src/libs/server/backend"
import { getRequestIdForRequest } from "src/libs/server/requestId"
import { getRuntimeMetrics, type RuntimeMetrics } from "src/libs/server/runtimeMetrics"
import { bindSsrResponse } from "src/libs/server/ssrBackendCookies"

const resolveSsrResult = (result: GetServerSidePropsResult<unknown>) => {
  if ("redirect" in result) return "redirect" as const
  if ("notFound" in result) return "not_found" as const
  return "props" as const
}

const isSharedCacheable = (cacheControl: number | string | string[] | undefined) => {
  const value = Array.isArray(cacheControl) ? cacheControl.join(",") : String(cacheControl ?? "")
  return /(?:^|,)\s*(?:public|s-maxage\s*=)/i.test(value)
}

const applyRequestIdResponsePolicy = (response: ServerResponse, requestId: string) => {
  if (response.headersSent) return
  const getHeader =
    typeof response.getHeader === "function"
      ? (name: string) => response.getHeader(name)
      : () => undefined
  const setCookie = getHeader("Set-Cookie")
  const cacheControl = getHeader("Cache-Control")
  if (
    (Array.isArray(setCookie) ? setCookie.length > 0 : Boolean(setCookie)) &&
    isSharedCacheable(cacheControl)
  ) {
    response.setHeader("Cache-Control", "private, no-store")
    response.setHeader("X-Request-Id", requestId)
    return
  }
  if (isSharedCacheable(cacheControl)) {
    if (typeof response.removeHeader === "function") {
      response.removeHeader("X-Request-Id")
    }
    return
  }
  response.setHeader("X-Request-Id", requestId)
}

export const withSsrMetrics = <Props extends { [key: string]: any }, Params extends ParsedUrlQuery = ParsedUrlQuery, Preview extends PreviewData = PreviewData>(
  routeClass: Parameters<RuntimeMetrics["observeSsrRequest"]>[0]["routeClass"],
  handler: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<Props, Params, Preview> => async (context) => {
  registerServerApiFetchMetrics()
  const requestId = getRequestIdForRequest(context.req)
  context.res.setHeader("X-Request-Id", requestId)
  const originalWriteHead = context.res.writeHead
  context.res.writeHead = function (this: ServerResponse, ...args: Parameters<typeof originalWriteHead>) {
    applyRequestIdResponsePolicy(this, requestId)
    return originalWriteHead.apply(this, args)
  } as typeof originalWriteHead
  const startedAt = performance.now()
  const clearSsrResponse = bindSsrResponse(context.req, context.res)

  try {
    let result: GetServerSidePropsResult<Props>
    try {
      const clientIp = resolveTrustedClientIp(context.req)
      result = await runWithSsrApiFetchContext(
        { requestId, ...(clientIp ? { clientIp } : {}) },
        async () => await handler(context)
      )
    } catch (error) {
      applyRequestIdResponsePolicy(context.res, requestId)
      getRuntimeMetrics().observeSsrRequest({
        routeClass,
        result: "error",
        durationSeconds: (performance.now() - startedAt) / 1_000,
      })
      throw error
    }

    applyRequestIdResponsePolicy(context.res, requestId)
    getRuntimeMetrics().observeSsrRequest({
      routeClass,
      result: resolveSsrResult(result),
      durationSeconds: (performance.now() - startedAt) / 1_000,
    })
    return result
  } finally {
    context.res.writeHead = originalWriteHead
    clearSsrResponse()
  }
}
