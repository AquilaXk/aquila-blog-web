import { expect, test } from "@playwright/test"
import { mapPostDto } from "../../src/apis/backend/posts/PostApiMappers"
import type { ApiPostDto } from "../../src/apis/backend/posts/PostApiDtos"
import {
  toSnapshotPost,
  toRestoredPost,
} from "../../src/routes/Feed/FeedExplorerRestoreModel"
import { getRssPostDate } from "../../src/libs/rssFeed"
import { getSitemapPostLastmod } from "../../src/libs/sitemapPosts"
import type { TPost } from "../../src/types"

test("mapPostDto maps ApiPostDto into direct domain fields and legacy compatibility fields", () => {
  const apiPost: ApiPostDto = {
    id: 101,
    title: "Domain Model Post",
    createdAt: "2026-09-23T09:00:00Z",
    modifiedAt: "2026-09-23T09:30:00Z",
    published: true,
    listed: true,
    authorId: 42,
    authorName: "Aquila Author",
    authorUsername: "aquilaxk",
    authorProfileImgUrl: "https://example.com/avatar.png",
    likesCount: 5,
    hitCount: 120,
    tags: ["Architecture"],
    category: ["Engineering"],
    thumbnail: "https://example.com/thumb.png",
    summary: "A modern domain model summary",
    summarySource: "MANUAL",
  }

  const post = mapPostDto(apiPost)

  // Direct domain fields
  expect(post.id).toBe("101")
  expect(post.title).toBe("Domain Model Post")
  expect(post.createdAt).toBe("2026-09-23T09:00:00Z")
  expect(post.modifiedAt).toBe("2026-09-23T09:30:00Z")
  expect(post.published).toBe(true)
  expect(post.listed).toBe(true)
  expect(post.authorId).toBe(42)
  expect(post.authorName).toBe("Aquila Author")
  expect(post.authorUsername).toBe("aquilaxk")
  expect(post.authorProfileImgUrl).toBe("https://example.com/avatar.png")
  expect(post.likesCount).toBe(5)
  expect(post.hitCount).toBe(120)

  // Legacy compatibility fields
  expect(post.date).toEqual({ start_date: "2026-09-23" })
  expect(post.type).toEqual(["Post"])
  expect(post.status).toEqual(["Public"])
  expect(post.author).toEqual([
    {
      id: "42",
      name: "Aquila Author",
      profile_photo: "https://example.com/avatar.png",
    },
  ])
  expect(post.createdTime).toBe("2026-09-23T09:00:00Z")
  expect(post.modifiedTime).toBe("2026-09-23T09:30:00Z")
})

test("FeedExplorer snapshot and restore preserves domain fields and provides backward-compatible fallback", () => {
  const domainPost: TPost = {
    id: "202",
    title: "Restored Post",
    slug: "202",
    createdAt: "2026-09-20T12:00:00Z",
    modifiedAt: "2026-09-21T15:00:00Z",
    published: true,
    listed: true,
    authorId: 7,
    authorName: "Jane Doe",
    authorUsername: "janedoe",
    authorProfileImgUrl: "https://example.com/jane.png",
    summary: "Restored post summary",
    summarySource: "EXTRACTED",
    tags: ["Tech"],
    category: ["Backend"],
    likesCount: 10,
    hitCount: 50,
  }

  const snapshot = toSnapshotPost(domainPost)
  expect(snapshot.createdAt).toBe("2026-09-20T12:00:00Z")
  expect(snapshot.authorName).toBe("Jane Doe")

  const restored = toRestoredPost(snapshot)
  expect(restored.id).toBe("202")
  expect(restored.authorName).toBe("Jane Doe")
  expect(restored.createdAt).toBe("2026-09-20T12:00:00Z")
  expect(restored.modifiedAt).toBe("2026-09-21T15:00:00Z")
  expect(restored.author?.[0]?.name).toBe("Jane Doe")
  expect(restored.date?.start_date).toBe("2026-09-20")
})

test("RSS and Sitemap extract correct dates and lastmod from domain post", () => {
  const domainPost: TPost = {
    id: "303",
    title: "RSS Post",
    slug: "303",
    createdAt: "2026-09-01T10:00:00Z",
    modifiedAt: "2026-09-02T12:00:00Z",
    published: true,
    listed: true,
    authorName: "Admin",
    summary: "Summary",
    summarySource: "NONE",
  }

  const rssDate = getRssPostDate(domainPost)
  expect(rssDate.toISOString()).toBe("2026-09-02T12:00:00.000Z")

  const sitemapLastmod = getSitemapPostLastmod(domainPost)
  expect(sitemapLastmod).toBe("2026-09-02T12:00:00.000Z")
})
