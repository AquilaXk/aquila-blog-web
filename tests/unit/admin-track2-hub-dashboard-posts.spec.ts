import { expect, test } from "@playwright/test"
import {
  parsePostsWorkspaceQueryParams,
  serializePostsWorkspaceQueryParams,
} from "src/routes/Admin/adminPostsWorkspaceUrlModel"
import {
  BULK_ACTION_MAX_LIMIT,
  executeBulkPostAction,
} from "src/routes/Admin/adminPostsWorkspaceBulkModel"
import {
  DASHBOARD_COLLECTION_FAILED_LABEL,
  getTaskQueueTone,
  readSafeDashboardSnapshotMetrics,
  resolveDashboardDataUpdatedAt,
  resolveHealthCardDetail,
  type DashboardSnapshotPayload,
} from "src/routes/Admin/AdminDashboardWorkspaceModel"
import {
  deriveAdminHubActivityItems,
  deriveAdminHubOperationalMetrics,
  deriveAdminHubShareBars,
  mergeAdminHubOperationalRefresh,
} from "src/routes/Admin/AdminHubSurfaceModel"
import {
  ADMIN_POSTS_ROW_ATTR,
  handleAdminPostsListKeyDown,
} from "src/routes/Admin/AdminPostsWorkspaceListKeyboard"

test.describe("Track 2 — Admin Posts URL query synchronization", () => {
  test("preserves unlisted status and LIKES_COUNT sort across URL parse and serialize", () => {
    const parsed = parsePostsWorkspaceQueryParams({
      status: "unlisted",
      sort: "LIKES_COUNT",
      page: "2",
      pageSize: "30",
      kw: "  architecture  ",
    })

    expect(parsed.status).toBe("unlisted")
    expect(parsed.sort).toBe("LIKES_COUNT")
    expect(parsed.scope).toBe("active")
    expect(parsed.page).toBe("2")
    expect(parsed.pageSize).toBe("30")
    expect(parsed.kw).toBe("architecture")

    const serialized = serializePostsWorkspaceQueryParams(parsed)
    expect(serialized).toEqual({
      status: "unlisted",
      sort: "LIKES_COUNT",
      page: "2",
      pageSize: "30",
      kw: "architecture",
    })
  })

  test("falls back safely on unknown status, sort, and non-positive page inputs", () => {
    const parsed = parsePostsWorkspaceQueryParams({
      status: "invalid_status",
      sort: "DROP_TABLE",
      page: "-5",
      pageSize: "999",
    })

    expect(parsed.status).toBe("all")
    expect(parsed.sort).toBe("MODIFIED_AT")
    expect(parsed.page).toBe("1")
    expect(parsed.pageSize).toBe("20")
    expect(parsed.scope).toBe("active")
  })
})

test.describe("Track 2 — Admin Dashboard model & SSR partial payload safety", () => {
  test("returns the latest (Math.max) timestamp in resolveDashboardDataUpdatedAt", () => {
    const older = 1_700_000_000_000
    const newer = 1_700_000_060_000
    expect(resolveDashboardDataUpdatedAt(older, newer)).toBe(newer)
    expect(resolveDashboardDataUpdatedAt(newer, older)).toBe(newer)
    expect(resolveDashboardDataUpdatedAt(0, -10, Number.NaN, Number.POSITIVE_INFINITY)).toBe(0)
  })

  test("guards partial SSR dashboard snapshots without throwing TypeError", () => {
    const partialSnapshot = {
      generatedAt: "2026-11-18T12:00:00Z",
    } as unknown as DashboardSnapshotPayload

    expect(() => getTaskQueueTone(partialSnapshot)).not.toThrow()
    expect(getTaskQueueTone(partialSnapshot)).toBe("neutral")

    const safe = readSafeDashboardSnapshotMetrics(partialSnapshot)
    expect(safe).toEqual({
      readyPendingCount: 0,
      processingCount: 0,
      failedCount: 0,
      staleProcessingCount: 0,
      latestFailureAt: null,
      recentEventCount: 0,
      blockedEventCount: 0,
      latestEventAt: null,
      eligibleForPurgeCount: 0,
      blockedBySafetyThreshold: false,
      oldestEligiblePurgeAfter: null,
    })
  })

  test("binds health card detail to systemHealth status/checks without leaking snapshot failure", () => {
    const detailWithChecks = resolveHealthCardDetail({
      healthCollectionFailed: false,
      healthCollectionLabel: null,
      systemHealth: { status: "UP", checks: { db: "UP", redis: "UP" } },
      hasSnapshot: false,
      snapshotGeneratedAtLabel: DASHBOARD_COLLECTION_FAILED_LABEL,
    })
    expect(detailWithChecks).toBe("DB UP · Redis UP")

    const detailWithoutChecksWhenSnapshotFailed = resolveHealthCardDetail({
      healthCollectionFailed: false,
      healthCollectionLabel: null,
      systemHealth: { status: "UP" },
      hasSnapshot: false,
      snapshotGeneratedAtLabel: DASHBOARD_COLLECTION_FAILED_LABEL,
    })
    expect(detailWithoutChecksWhenSnapshotFailed).not.toContain(DASHBOARD_COLLECTION_FAILED_LABEL)
  })
})

test.describe("Track 2 — Admin Hub global KPI & refresh resilience", () => {
  const sampleSlice = Array.from({ length: 20 }, (_, idx) => ({
    id: 4100 + idx,
    title: `Post ${idx + 1}`,
    published: idx < 12,
    listed: true,
    tempDraft: idx >= 12,
    modifiedAt: "2026-11-18T10:00:00Z",
    hitCount: 10,
  }))

  test("prefers dashboardSnapshot.content global totals over the 20-post slice", () => {
    const result = deriveAdminHubOperationalMetrics({
      posts: {
        content: sampleSlice,
        pageable: { totalElements: 140 },
      },
      dashboard: {
        content: {
          totalPosts: 140,
          publishedPosts: 98,
          draftPosts: 30,
          privatePosts: 12,
          totalHitCount: 25400,
          totalLikesCount: 410,
        },
      },
    })

    const [publishedMetric, draftsMetric, viewsMetric] = result.metrics
    expect(publishedMetric?.label).toBe("PUBLISHED")
    expect(publishedMetric?.value).toBe((98).toLocaleString())
    expect(publishedMetric?.detail).toMatch(/전체 140건 중 발행/)

    expect(draftsMetric?.label).toBe("DRAFTS")
    expect(draftsMetric?.value).toBe((30).toLocaleString())
    expect(draftsMetric?.detail).toMatch(/전체 140건/)

    expect(viewsMetric?.label).toBe("VIEWS")
    expect(viewsMetric?.value).toBe((25400).toLocaleString())

    expect(result.recentContentItems).toHaveLength(5)
    for (const item of result.recentContentItems) {
      expect(item.meta.includes("#41")).toBe(false)
    }
  })

  test("falls back to recentPosts counts when dashboardSnapshot.content is absent and guards partial SSR fields", () => {
    const result = deriveAdminHubOperationalMetrics({
      posts: {
        content: sampleSlice,
        pageable: { totalElements: 20 },
      },
      dashboard: null,
    })

    expect(result.metrics[0]?.value).toBe("12")
    expect(result.metrics[1]?.value).toBe("8")
    expect(result.metrics[2]?.value).toBe("200")

    expect(() =>
      deriveAdminHubActivityItems({
        profileUpdatedText: "2026-11-18 10:00",
        profileCompletion: 80,
        linkCount: 2,
        dashboard: {} as never,
      })
    ).not.toThrow()
  })

  test("keeps prior Hub snapshot data intact when refresh endpoints fail", () => {
    const previous = {
      posts: { content: sampleSlice, pageable: { totalElements: 20 } },
      systemHealth: { status: "UP", checks: { db: "UP", redis: "UP" } },
      dashboard: {
        taskQueue: { readyPendingCount: 0, processingCount: 0, failedCount: 0, staleProcessingCount: 0 },
      },
      fetchedAt: "2026-11-18T10:00:00.000Z",
    }

    const merged = mergeAdminHubOperationalRefresh(previous, {
      posts: { status: "rejected", reason: new Error("503") },
      systemHealth: { status: "rejected", reason: new Error("503") },
      dashboard: { status: "rejected", reason: new Error("503") },
    })

    expect(merged.failedCount).toBe(3)
    expect(merged.snapshot.posts).toBe(previous.posts)
    expect(merged.snapshot.systemHealth).toBe(previous.systemHealth)
    expect(merged.snapshot.dashboard).toBe(previous.dashboard)
    expect(merged.snapshot.fetchedAt).toBe(previous.fetchedAt)
  })

  test("derives Readership Share bars directly from total view percentage shares", () => {
    const bars = deriveAdminHubShareBars([
      { href: "/admin/editor/1", title: "Alpha", views: 3421 },
      { href: "/admin/editor/2", title: "Beta", views: 2180 },
      { href: "/admin/editor/3", title: "Gamma", views: 1640 },
    ])
    expect(bars.map((bar) => ({ sharePct: bar.sharePct, widthPct: bar.widthPct }))).toEqual([
      { sharePct: 47, widthPct: 47 },
      { sharePct: 30, widthPct: 30 },
      { sharePct: 23, widthPct: 23 },
    ])
  })
})

test.describe("Track 2 — Admin Posts bulk limit fail-closed & keyboard shortcut safety", () => {
  test("rejects bulk post execution when selected IDs exceed BULK_ACTION_MAX_LIMIT (50) instead of truncating", async () => {
    const overLimitIds = Array.from({ length: BULK_ACTION_MAX_LIMIT + 5 }, (_, idx) => idx + 1)
    await expect(executeBulkPostAction("PUBLISH_LISTED", overLimitIds)).rejects.toThrow(/50/)
  })

  test("does not trigger restore button on 'e' shortcut when row has no primary edit link", () => {
    let restoreClicked = false
    const restoreButton = {
      click: () => {
        restoreClicked = true
      },
      matches: () => false,
      getAttribute: () => null,
    }
    const fakeRow = {
      querySelector: (selector: string) => {
        if (selector.includes("data-admin-posts-row-primary")) return null
        return restoreButton
      },
    }
    const fakeTarget = {
      closest: (selector: string) => (selector === `[${ADMIN_POSTS_ROW_ATTR}]` ? fakeRow : null),
    }
    let prevented = false

    handleAdminPostsListKeyDown(
      {
        key: "e",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target: fakeTarget as unknown as EventTarget,
        nativeEvent: { isComposing: false } as KeyboardEvent,
        preventDefault: () => {
          prevented = true
        },
      } as never,
      { querySelectorAll: () => [fakeRow] } as unknown as ParentNode
    )

    expect(restoreClicked).toBe(false)
    expect(prevented).toBe(false)
  })
})
