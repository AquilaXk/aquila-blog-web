import { expect, test } from "@playwright/test"
import { QueryClient } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { QueryClientProvider } from "@tanstack/react-query"
import { refreshAdminProfileCache, useAdminProfile } from "../../src/hooks/useAdminProfile"
import { queryKey } from "../../src/constants/queryKey"
import { registerServerApiFetchMetrics } from "../../src/libs/server/apiFetchMetrics"
import "../../src/apis/backend/client"

const profile = { username: "owner", name: "Published", nickname: "Published", profileImageUrl: "", aboutSections: [], aboutProjects: [], aboutBio: "" }

for (const status of [200, 503]) {
  test(`canonical profile refresh preserves API data or explicit failure (${status})`, async () => {
    registerServerApiFetchMetrics()
    const queryClient = new QueryClient()
    queryClient.setQueryData(queryKey.adminProfile(), { ...profile, aboutBio: "Old content" })
    const originalFetch = globalThis.fetch
    const paths: string[] = []
    globalThis.fetch = (async (url) => {
      paths.push(new URL(String(url)).pathname)
      return new Response(JSON.stringify(status === 200 ? profile : { msg: "unavailable" }), {
        status, headers: { "content-type": "application/json" },
      })
    }) as typeof fetch
    try {
      expect(await refreshAdminProfileCache(queryClient)).toBe(status === 200)
      expect(paths).toEqual(["/member/api/v1/members/adminProfile"])
      expect(queryClient.getQueryData(queryKey.adminProfile())).toEqual(status === 200 ? profile : null)
    } finally {
      globalThis.fetch = originalFetch
      queryClient.clear()
    }
  })
}

test("explicitly cleared cache never revives the initial profile", () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(queryKey.adminProfile(), null)
  let observed: unknown = undefined
  const Probe = () => { observed = useAdminProfile(profile, { enabled: false }); return null }
  try {
    renderToString(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))
    expect(observed).toBeNull()
  } finally { queryClient.clear() }
})
