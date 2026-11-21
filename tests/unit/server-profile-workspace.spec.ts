import { expect, test } from "@playwright/test"
import type { IncomingMessage } from "node:http"
import { registerServerApiFetchMetrics } from "../../src/libs/server/apiFetchMetrics"
import { fetchServerProfileWorkspace } from "../../src/libs/server/profileWorkspace"

for (const scenario of ["valid", "unavailable", "empty", "network"] as const) {
  test(`server workspace preserves ${scenario} response semantics`, async () => {
    registerServerApiFetchMetrics()
    const originalFetch = globalThis.fetch
    const workspace = { memberId: 1, draft: {}, published: {} }
    let calls = 0
    globalThis.fetch = (async (url) => {
      calls += 1
      expect(new URL(String(url)).pathname).toBe("/member/api/v1/adm/members/1/profileWorkspace")
      if (scenario === "network") throw new TypeError("Network unavailable")
      return new Response(JSON.stringify(scenario === "empty" ? null : workspace), {
        status: scenario === "unavailable" ? 503 : 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch
    try {
      const req = { url: "/admin/profile", headers: {} } as IncomingMessage
      const result = fetchServerProfileWorkspace(req, 1)
      if (scenario === "valid") await expect(result).resolves.toEqual(workspace)
      else await expect(result).rejects.toThrow()
      expect(calls).toBe(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
}
