import { expect, test } from "@playwright/test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { readAdminShellProfile, useAdminShellProfile } from "../../src/hooks/useAdminShellProfile"
import { registerServerApiFetchMetrics } from "../../src/libs/server/apiFetchMetrics"

const member = { id: 7, username: "owner", nickname: "Owner", isAdmin: true }
const profile = {
  id: 7,
  username: "owner",
  name: "Owner",
  nickname: "Canonical owner",
  profileImageUrl: "/canonical-avatar.png",
  blogTitle: "Canonical journal",
  isAdmin: true,
}

const withFetchResponse = async (response: Response, assertion: (requests: string[]) => Promise<void>) => {
  const originalFetch = globalThis.fetch
  const requests: string[] = []
  globalThis.fetch = (async (url) => {
    requests.push(String(url))
    return response
  }) as typeof fetch

  try {
    await assertion(requests)
  } finally {
    globalThis.fetch = originalFetch
  }
}

test("admin shell profile reads the member-scoped protected bootstrap once", async () => {
  registerServerApiFetchMetrics()
  await withFetchResponse(
    new Response(JSON.stringify({ member, profile }), { status: 200, headers: { "content-type": "application/json" } }),
    async (requests) => {
      await expect(readAdminShellProfile(member.id)).resolves.toEqual(profile)
      expect(requests).toHaveLength(1)
      expect(new URL(requests[0]).pathname).toBe("/member/api/v1/adm/members/bootstrap")
    }
  )
})

test("admin shell profile rejects a member mismatch, null profile, or malformed canonical image URL", async () => {
  for (const payload of [
    { member: { ...member, id: 8 }, profile },
    { member, profile: null },
    { member, profile: { ...profile, profileImageUrl: null } },
    { member, profile: { ...profile, blogTitle: 42 } },
  ]) {
    await withFetchResponse(
      new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } }),
      async (requests) => {
        registerServerApiFetchMetrics()
        await expect(readAdminShellProfile(member.id)).rejects.toThrow("canonical")
        expect(requests).toHaveLength(1)
      }
    )
  }
})

test("admin shell profile accepts an empty canonical image URL", async () => {
  registerServerApiFetchMetrics()
  await withFetchResponse(
    new Response(
      JSON.stringify({ member, profile: { ...profile, profileImageUrl: "" } }),
      { status: 200, headers: { "content-type": "application/json" } }
    ),
    async () => {
      await expect(readAdminShellProfile(member.id)).resolves.toEqual({ ...profile, profileImageUrl: "" })
    }
  )
})

test("admin shell profile does not try an alternate request after an HTTP failure", async () => {
  registerServerApiFetchMetrics()
  await withFetchResponse(
    new Response(JSON.stringify({ msg: "unavailable" }), { status: 503, headers: { "content-type": "application/json" } }),
    async (requests) => {
      await expect(readAdminShellProfile(member.id)).rejects.toMatchObject({ status: 503 })
      expect(requests).toHaveLength(1)
      expect(requests[0]).not.toContain("adminProfile")
    }
  )
})

test("admin shell uses its canonical SSR seed without member or configuration synthesis", () => {
  const queryClient = new QueryClient()
  let observed: ReturnType<typeof useAdminShellProfile> | undefined
  const Probe = () => {
    observed = useAdminShellProfile(member.id, profile)
    return null
  }

  try {
    renderToString(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))
    expect(observed?.profile).toEqual(profile)
  } finally {
    queryClient.clear()
  }
})

test("admin shell hides stale profile data after the protected query fails", async () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(["admin", "shell-profile", member.id], profile)
  await queryClient
    .fetchQuery({
      queryKey: ["admin", "shell-profile", member.id],
      queryFn: async () => {
        throw new Error("bootstrap unavailable")
      },
    })
    .catch(() => undefined)

  let observed: ReturnType<typeof useAdminShellProfile> | undefined
  const Probe = () => {
    observed = useAdminShellProfile(member.id, profile)
    return null
  }

  try {
    renderToString(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))
    expect(observed?.isError).toBe(true)
    expect(observed?.profile).toBeNull()
  } finally {
    queryClient.clear()
  }
})
