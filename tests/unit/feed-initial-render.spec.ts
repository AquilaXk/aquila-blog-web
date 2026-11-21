import { expect, test } from "@playwright/test"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import useExplorePostsQuery from "../../src/hooks/useExplorePostsQuery"
import { queryKey } from "../../src/constants/queryKey"
import { FEED_EXPLORE_PAGE_SIZE } from "../../src/constants/feed"

const renderInitialFeed = (enabled: boolean, seeded: boolean) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  if (seeded) {
    client.setQueryData(queryKey.postsFeedInfinite({
      pageSize: FEED_EXPLORE_PAGE_SIZE, order: "desc", sortMode: "latest",
    }), {
      pages: [{ posts: [], hasNext: false, paginationMode: "cursor", nextCursor: null }],
      pageParams: [null],
    })
  }
  const Probe = () => {
    const { isInitialLoading, isInitialLoadError } = useExplorePostsQuery({ kw: "", enabled })
    return createElement("output", null,
      isInitialLoadError ? "error" : isInitialLoading ? "loading" : "ready")
  }
  try {
    return renderToString(createElement(QueryClientProvider, { client }, createElement(Probe)))
  } finally {
    client.clear()
  }
}

test("데이터 없는 첫 렌더는 router 준비 여부와 무관하게 로딩을 유지한다", () => {
  expect(renderInitialFeed(false, false)).toBe("<output>loading</output>")
  expect(renderInitialFeed(true, false)).toBe("<output>loading</output>")
})

test("서버가 확인한 빈 피드는 로딩이 아닌 완료 상태를 유지한다", () => {
  expect(renderInitialFeed(false, true)).toBe("<output>ready</output>")
  expect(renderInitialFeed(true, true)).toBe("<output>ready</output>")
})
