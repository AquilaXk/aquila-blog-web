import type { Page } from "@playwright/test"
import {
  createPublicAdminProfileSnapshotFixture,
  PUBLIC_ADMIN_PROFILE_FIXTURE,
  PUBLIC_ADMIN_PROFILE_ROUTE,
} from "../../tests/fixtures/publicAdminProfileFixture"

export {
  createPublicAdminProfileSnapshotFixture,
  PUBLIC_ADMIN_PROFILE_FIXTURE,
  PUBLIC_ADMIN_PROFILE_ROUTE,
} from "../../tests/fixtures/publicAdminProfileFixture"

export const AVATAR_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0WkAAAAASUVORK5CYII="
export const AVATAR_PNG = Buffer.from(AVATAR_PNG_BASE64, "base64")

export const mockPublicAdminProfile = async (page: Page) => {
  await page.route(PUBLIC_ADMIN_PROFILE_ROUTE, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PUBLIC_ADMIN_PROFILE_FIXTURE),
    })
  })
}

export const mockAvatarAsset = async (page: Page) => {
  await page.route("**/avatar.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: AVATAR_PNG,
    })
  })
}

export const addPublicAboutSnapshotCookie = async (page: Page) => {
  await mockPublicAdminProfile(page)
  await page.context().addCookies([
    {
      name: "admin_profile_snapshot_v1",
      value: encodeURIComponent(JSON.stringify(createPublicAdminProfileSnapshotFixture())),
      url: "http://127.0.0.1:3100",
    },
  ])
}

export const createExplorePost = (overrides: Partial<Record<string, unknown>> & { title: string }) => ({
  id: 101,
  createdAt: "2026-03-16T00:00:00Z",
  modifiedAt: "2026-03-16T00:00:00Z",
  authorId: 1,
  authorName: "관리자",
  authorUsername: "aquila",
  authorProfileImgUrl: "/avatar.png",
  summary: "탐색 API 스모크",
  summarySource: "MANUAL",
  tags: ["테스트태그"],
  category: ["백엔드"],
  published: true,
  listed: true,
  likesCount: 0,
  commentsCount: 0,
  hitCount: 0,
  ...overrides,
})

export const createExplorePage = (
  title: string,
  tag = "테스트태그",
  overrides: Partial<Record<string, unknown>> = {}
) => ({
  content: [
    createExplorePost({
      title,
      tags: [tag],
      ...overrides,
    }),
  ],
  pageable: {
    pageNumber: 0,
    pageSize: 30,
    totalElements: 1,
    totalPages: 1,
  },
})

export const mockFeedEndpoints = async (page: Page) => {
  await mockPublicAdminProfile(page)

  await page.route("**/post/api/v1/posts/feed**", async (route) => {
    const url = new URL(route.request().url())
    const sort = url.searchParams.get("sort") || "CREATED_AT"

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createExplorePage(`정렬:${sort}`)),
    })
  })

  await page.route("**/post/api/v1/posts/search**", async (route) => {
    const url = new URL(route.request().url())
    const kw = url.searchParams.get("kw") || ""

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createExplorePage(kw ? `검색:${kw}` : "초기목록")),
    })
  })

  await page.route("**/post/api/v1/posts/explore**", async (route) => {
    const url = new URL(route.request().url())
    const kw = url.searchParams.get("kw") || ""
    const tag = url.searchParams.get("tag") || ""
    const sort = url.searchParams.get("sort") || "CREATED_AT"
    const title = kw
      ? `검색:${kw}`
      : tag
        ? `태그:${tag}`
        : `정렬:${sort}`

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createExplorePage(title, tag || "테스트태그")),
    })
  })

  await page.route("**/post/api/v1/posts/tags", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ tag: "테스트태그", count: 1 }]),
    })
  })
}
