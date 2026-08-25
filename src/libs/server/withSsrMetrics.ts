import type { GetServerSideProps, GetServerSidePropsResult, PreviewData } from "next"
import type { ParsedUrlQuery } from "node:querystring"
import { registerServerApiFetchMetrics, runWithSsrApiFetchContext } from "src/libs/server/apiFetchMetrics"
import { getRequestIdForRequest } from "src/libs/server/requestId"
import { getRuntimeMetrics, type RuntimeMetrics } from "src/libs/server/runtimeMetrics"

const resolveSsrResult = (result: GetServerSidePropsResult<unknown>) => {
  if ("redirect" in result) return "redirect" as const
  if ("notFound" in result) return "not_found" as const
  return "props" as const
}

export const withSsrMetrics = <Props extends { [key: string]: any }, Params extends ParsedUrlQuery = ParsedUrlQuery, Preview extends PreviewData = PreviewData>(
  routeClass: Parameters<RuntimeMetrics["observeSsrRequest"]>[0]["routeClass"],
  handler: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<Props, Params, Preview> => async (context) => {
  registerServerApiFetchMetrics()
  const requestId = getRequestIdForRequest(context.req)
  context.res.setHeader("X-Request-Id", requestId)
  const startedAt = performance.now()

  let result: GetServerSidePropsResult<Props>
  try {
    result = await runWithSsrApiFetchContext(requestId, async () => await handler(context))
  } catch (error) {
    getRuntimeMetrics().observeSsrRequest({
      routeClass,
      result: "error",
      durationSeconds: (performance.now() - startedAt) / 1_000,
    })
    throw error
  }

  getRuntimeMetrics().observeSsrRequest({
    routeClass,
    result: resolveSsrResult(result),
    durationSeconds: (performance.now() - startedAt) / 1_000,
  })
  return result
}
