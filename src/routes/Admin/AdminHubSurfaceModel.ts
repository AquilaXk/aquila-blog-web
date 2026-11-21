// 참조 구현: shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/{section-cards.tsx,chart-area-interactive.tsx} (MIT), TryGhost/Ghost apps/admin/src/analytics/views/stats/overview/overview.tsx (MIT)
import { formatIsoDateTime } from "src/libs/utils"
import {
  ADMIN_HUB_DISPLAY_TIME_ZONE,
  ADMIN_HUB_GREETING_OPTIONS,
  ADMIN_HUB_GREETING_VARIANT_COUNT,
  mergeAdminHubOperationalRefresh,
  resolveAdminHubGreeting,
  type AdminHubDashboardSnapshotPayload,
  type AdminHubOperationalSnapshot,
  type AdminHubPageDto,
  type AdminHubPostListItem,
  type AdminHubSystemHealthPayload,
  type AdminHubTone,
} from "./AdminHubGreetingModel"

export {
  ADMIN_HUB_DISPLAY_TIME_ZONE,
  ADMIN_HUB_GREETING_OPTIONS,
  ADMIN_HUB_GREETING_VARIANT_COUNT,
  mergeAdminHubOperationalRefresh,
  resolveAdminHubGreeting,
  type AdminHubDashboardSnapshotPayload,
  type AdminHubOperationalSnapshot,
  type AdminHubPageDto,
  type AdminHubPostListItem,
  type AdminHubSystemHealthPayload,
  type AdminHubTone,
}

export type AdminHubDerivedMetric = {
  label: string
  value: string
  detail: string
  tone: AdminHubTone
}

export type AdminHubDerivedContentItem = {
  href: string
  title: string
  meta: string
  status: string
  views?: number
  tone: AdminHubTone
}

export type AdminHubDerivedActivityItem = {
  label: string
  value: string
  tone: AdminHubTone
}

export const HUB_CHART_LEFT = 42
export const HUB_CHART_RIGHT = 566
export const HUB_CHART_TOP = 24
export const HUB_CHART_BASELINE = 148

export const truncateAdminHubChartLabel = (title: string, maxChars = 11) =>
  title.length > maxChars ? `${title.slice(0, maxChars - 1)}…` : title

export const buildAdminHubAreaGeometry = (values: number[]) => {
  const count = values.length
  const maxVal = Math.max(1, ...values)
  const spanX = HUB_CHART_RIGHT - HUB_CHART_LEFT
  const spanY = HUB_CHART_BASELINE - HUB_CHART_TOP

  const coords = values.map((val, idx) => {
    const x = count === 1 ? HUB_CHART_LEFT + spanX / 2 : HUB_CHART_LEFT + (idx / (count - 1)) * spanX
    const y = HUB_CHART_BASELINE - (Math.max(0, val) / maxVal) * spanY
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, val }
  })

  if (coords.length === 0) {
    return { strokePath: "", areaPath: "", coords, maxVal: 0 }
  }
  if (coords.length === 1) {
    const p = coords[0]!
    const strokePath = `M ${HUB_CHART_LEFT} ${p.y} L ${HUB_CHART_RIGHT} ${p.y}`
    const areaPath = `${strokePath} L ${HUB_CHART_RIGHT} ${HUB_CHART_BASELINE} L ${HUB_CHART_LEFT} ${HUB_CHART_BASELINE} Z`
    return { strokePath, areaPath, coords, maxVal }
  }

  let strokePath = `M ${coords[0]!.x} ${coords[0]!.y}`
  for (let i = 0; i < coords.length - 1; i += 1) {
    const curr = coords[i]!
    const next = coords[i + 1]!
    const midX = Math.round(((curr.x + next.x) / 2) * 10) / 10
    strokePath += ` C ${midX} ${curr.y}, ${midX} ${next.y}, ${next.x} ${next.y}`
  }
  const firstX = coords[0]!.x
  const lastX = coords[coords.length - 1]!.x
  const areaPath = `${strokePath} L ${lastX} ${HUB_CHART_BASELINE} L ${firstX} ${HUB_CHART_BASELINE} Z`
  return { strokePath, areaPath, coords, maxVal }
}

const resolvePostCategoryLabel = (category?: string | string[]): string | null => {
  if (typeof category === "string" && category.trim()) return category.trim()
  if (Array.isArray(category)) {
    for (let i = 0; i < category.length; i += 1) {
      const candidate = category[i]?.trim()
      if (candidate) return candidate
    }
  }
  return null
}

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0

export const deriveAdminHubOperationalMetrics = (input: {
  posts: AdminHubPageDto<AdminHubPostListItem> | null | undefined
  dashboard: AdminHubDashboardSnapshotPayload | null | undefined
}): {
  metrics: AdminHubDerivedMetric[]
  recentContentItems: AdminHubDerivedContentItem[]
} => {
  const postRows = Array.isArray(input.posts?.content) ? input.posts!.content : []
  const totalPostsElementCount = input.posts?.pageable?.totalElements

  let slicePublishedCount = 0
  let sliceDraftCount = 0
  let sliceViewsCount = 0
  const recentTopEntries: Array<{ modifiedMs: number; post: AdminHubPostListItem }> = []

  for (let index = 0; index < postRows.length; index += 1) {
    const post = postRows[index]!
    const isPublishedActive = post.published && post.tempDraft !== true
    if (isPublishedActive) slicePublishedCount += 1
    else sliceDraftCount += 1
    sliceViewsCount += post.hitCount ?? 0

    const parsedMs = Date.parse(post.modifiedAt)
    const modifiedMs = Number.isFinite(parsedMs) ? parsedMs : -Infinity
    if (recentTopEntries.length < 5 || modifiedMs > recentTopEntries[recentTopEntries.length - 1]!.modifiedMs) {
      let insertAt = recentTopEntries.length
      while (insertAt > 0 && recentTopEntries[insertAt - 1]!.modifiedMs < modifiedMs) {
        insertAt -= 1
      }
      recentTopEntries.splice(insertAt, 0, { modifiedMs, post })
      if (recentTopEntries.length > 5) recentTopEntries.pop()
    }
  }

  const recentContentItems: AdminHubDerivedContentItem[] = recentTopEntries.map(({ post }) => {
    const categoryLabel = resolvePostCategoryLabel(post.category)
    const dateLabel = formatIsoDateTime(post.modifiedAt)
    const meta = categoryLabel ? `${categoryLabel} · ${dateLabel}` : dateLabel
    const safeViews = isFiniteNonNegative(post.hitCount) ? post.hitCount : 0

    const status = post.tempDraft
      ? "DRAFT"
      : post.published
        ? post.listed
          ? "PUBLISHED"
          : "UNLISTED"
        : "PRIVATE"
    const tone: AdminHubTone = post.tempDraft
      ? "warn"
      : post.published
        ? post.listed
          ? "good"
          : "warn"
        : "neutral"

    return {
      href: `/admin/editor/${post.id}`,
      title: post.title?.trim() || "제목 없는 글",
      meta,
      status,
      views: safeViews,
      tone,
    }
  })

  const g = input.dashboard?.content
  const hasGlobal =
    g != null &&
    isFiniteNonNegative(g.totalPosts) &&
    isFiniteNonNegative(g.publishedPosts) &&
    isFiniteNonNegative(g.draftPosts) &&
    isFiniteNonNegative(g.totalHitCount)

  const totalText = hasGlobal ? g.totalPosts!.toLocaleString() : ""
  const fallbackDetail =
    typeof totalPostsElementCount === "number" && totalPostsElementCount > postRows.length
      ? `최근 ${postRows.length}건 표본 (전체 ${totalPostsElementCount.toLocaleString()}건)`
      : typeof totalPostsElementCount === "number"
        ? `전체 ${totalPostsElementCount.toLocaleString()}건 집계`
        : "최근 20건 표본"

  const publishedVal = hasGlobal ? g.publishedPosts! : slicePublishedCount
  const draftVal = hasGlobal ? g.draftPosts! : sliceDraftCount
  const viewsVal = hasGlobal ? g.totalHitCount! : sliceViewsCount
  const privatePosts = hasGlobal && isFiniteNonNegative(g.privatePosts) ? g.privatePosts : 0
  const likesCount = hasGlobal && isFiniteNonNegative(g.totalLikesCount) ? g.totalLikesCount : null

  const fourthMetric: AdminHubDerivedMetric =
    likesCount !== null
      ? {
          label: "LIKES",
          value: likesCount.toLocaleString(),
          detail: `전체 ${totalText}건 누적 공감`,
          tone: likesCount > 0 ? "good" : "neutral",
        }
      : input.dashboard?.taskQueue != null
        ? (() => {
            const q = input.dashboard.taskQueue
            const ready = q.readyPendingCount ?? 0
            const proc = q.processingCount ?? 0
            const incidents = (q.failedCount ?? 0) + (q.staleProcessingCount ?? 0)
            return {
              label: "QUEUE",
              value: `${(ready + proc).toLocaleString()}`,
              detail: `대기 ${ready} · 처리 ${proc} · 실패 ${q.failedCount ?? 0}`,
              tone: incidents > 0 ? "warn" : "good",
            }
          })()
        : {
            label: "LIKES",
            value: "데이터 미수집",
            detail: fallbackDetail,
            tone: "neutral",
          }

  return {
    metrics: [
      {
        label: "PUBLISHED",
        value: publishedVal.toLocaleString(),
        detail: hasGlobal ? `전체 ${totalText}건 중 발행` : fallbackDetail,
        tone: publishedVal > 0 ? "good" : "neutral",
      },
      {
        label: "DRAFTS",
        value: draftVal.toLocaleString(),
        detail: hasGlobal
          ? privatePosts > 0
            ? `전체 ${totalText}건 중 초안 · 비공개 ${privatePosts.toLocaleString()}건`
            : `전체 ${totalText}건 중 초안`
          : fallbackDetail,
        tone: draftVal > 0 ? "warn" : "neutral",
      },
      {
        label: "VIEWS",
        value: viewsVal.toLocaleString(),
        detail: hasGlobal
          ? likesCount !== null
            ? `전체 ${totalText}건 누적 · 좋아요 ${likesCount.toLocaleString()}개`
            : `전체 ${totalText}건 누적 조회`
          : fallbackDetail,
        tone: viewsVal > 0 ? "good" : "neutral",
      },
      fourthMetric,
    ],
    recentContentItems,
  }
}

export const deriveAdminHubActivityItems = (input: {
  profileUpdatedText: string
  profileCompletion: number
  linkCount: number
  dashboard: AdminHubDashboardSnapshotPayload | null | undefined
}): AdminHubDerivedActivityItem[] => {
  const items: AdminHubDerivedActivityItem[] = []
  const dashboard = input.dashboard
  if (!dashboard) return items

  if (dashboard.taskQueue != null) {
    const readyPendingCount = dashboard.taskQueue.readyPendingCount ?? 0
    const processingCount = dashboard.taskQueue.processingCount ?? 0
    const queueIncidentCount =
      (dashboard.taskQueue.failedCount ?? 0) + (dashboard.taskQueue.staleProcessingCount ?? 0)
    items.push({
      label: "비동기 작업",
      value: `대기 ${readyPendingCount} · 처리 ${processingCount} · 이상 ${queueIncidentCount}`,
      tone: queueIncidentCount > 0 ? "warn" : "good",
    })
  }

  if (dashboard.authSecurity != null || dashboard.storageCleanup != null) {
    const blockedEventCount = dashboard.authSecurity?.blockedEventCount ?? 0
    const eligibleForPurgeCount = dashboard.storageCleanup?.eligibleForPurgeCount ?? 0
    items.push({
      label: "보안 · 정리",
      value: `차단 ${blockedEventCount} · 정리 ${eligibleForPurgeCount}`,
      tone:
        blockedEventCount > 0 || Boolean(dashboard.storageCleanup?.blockedBySafetyThreshold)
          ? "warn"
          : "neutral",
    })
  }

  return items
}
