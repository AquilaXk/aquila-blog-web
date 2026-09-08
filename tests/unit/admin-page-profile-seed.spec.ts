import { expect, test } from "@playwright/test"
import type { IncomingMessage } from "node:http"
import { buildAdminPagePropsFromMember, getAdminPageProps } from "../../src/libs/server/adminPage"
import { registerServerApiFetchMetrics } from "../../src/libs/server/apiFetchMetrics"
import { queryKey } from "../../src/constants/queryKey"

const member = { id: 1, username: "owner", nickname: "Owner", isAdmin: true }

test("member bootstrap keeps authentication without synthesizing a profile", () => {
  const props = buildAdminPagePropsFromMember(member)
  expect(props.initialProfileSnapshot).toBeNull()
  expect(props.initialMember).toBe(member)
  const queries = props.dehydratedState.queries
  expect(queries.find((query) => JSON.stringify(query.queryKey) === JSON.stringify(queryKey.authMe()))?.state.data).toEqual(member)
  expect(queries.find((query) => JSON.stringify(query.queryKey) === JSON.stringify(queryKey.authMeProbe()))?.state.data).toBe(true)
})

test("member bootstrap forwards an explicitly supplied canonical profile unchanged", () => {
  const profile = { username: "owner", name: "Published", nickname: "Published", profileImageUrl: "/published.svg", profileBio: "" }
  expect(buildAdminPagePropsFromMember(member, profile).initialProfileSnapshot).toBe(profile)
})

test("guarded admin props do not fetch a public profile or consume a snapshot cookie", async () => {
  registerServerApiFetchMetrics()
  const originalFetch = globalThis.fetch
  const paths: string[] = []
  globalThis.fetch = (async (url) => {
    paths.push(new URL(String(url)).pathname)
    return new Response(JSON.stringify(member), { headers: { "content-type": "application/json" } })
  }) as typeof fetch
  try {
    const req = {
      url: "/admin",
      headers: { cookie: "accessToken=test; admin_profile_snapshot_v1=untrusted" },
    } as IncomingMessage
    const result = await getAdminPageProps(req)
    expect(paths).toEqual(["/member/api/v1/auth/session"])
    expect("props" in result).toBe(true)
    if (!("props" in result)) throw new Error("Expected authenticated admin props")
    const props = await result.props
    expect(props.initialProfileSnapshot).toBeNull()
    expect(props.initialMember).toEqual(member)
  } finally {
    globalThis.fetch = originalFetch
  }
})
