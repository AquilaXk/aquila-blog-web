import { expect, test } from "@playwright/test"
import { buildAdminPagePropsFromMember } from "../../src/libs/server/adminPage"
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
