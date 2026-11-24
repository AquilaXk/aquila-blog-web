// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/QueueStats/QueueStats.tsx (MIT), shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/section-cards.tsx (MIT)
import { formatShortDateTime, formatWithNormalizedHours } from "src/libs/utils"

export type DashboardTone = "neutral" | "good" | "warn" | "danger"

export type SystemHealthPayload = {
  status?: string
  checks?: {
    db?: string
    redis?: string
  } | null
}

export type DashboardSnapshotPayload = {
  generatedAt: string
  taskQueue: {
    pendingCount: number
    readyPendingCount: number
    processingCount: number
    failedCount: number
    staleProcessingCount: number
    oldestReadyPendingAgeSeconds: number | null
    latestFailureAt: string | null
    latestFailureMessage: string | null
  }
  authSecurity: {
    recentEventCount: number
    blockedEventCount: number
    latestEventAt: string | null
    latestBlockedAt: string | null
  }
  storageCleanup: {
    eligibleForPurgeCount: number
    blockedBySafetyThreshold: boolean
    oldestEligiblePurgeAfter: string | null
  }
  content?: {
    totalPosts: number
    publishedPosts: number
    draftPosts: number
    privatePosts: number
    deletedPosts?: number
    totalHitCount: number
    totalLikesCount: number
  }
}

export type DashboardContentKpiPayload = NonNullable<DashboardSnapshotPayload["content"]>

export type AdminDashboardInitialSnapshot = {
  systemHealth: SystemHealthPayload | null
  dashboard: DashboardSnapshotPayload | null
  systemHealthFetchedAt: string | null
  dashboardFetchedAt: string | null
}

export type DashboardKpiCard = {
  key: string
  label: string
  value: string
  detail: string
  badge?: string
  tone: DashboardTone
}

export type DashboardPriorityRow = {
  key: string
  title: string
  summary: string
  tone: DashboardTone
  href: string
  actionLabel: string
}

export type DashboardQuickAction = {
  key: string
  href: string
  label: string
}

export type DashboardChartBar = {
  key: string
  label: string
  value: number
  height: number
  tone: DashboardTone
}

export type DashboardLogRow = {
  key: string
  time: string
  message: string
  detail: string
  tone: DashboardTone
}

export type SafeDashboardSnapshotMetrics = {
  readyPendingCount: number
  processingCount: number
  failedCount: number
  staleProcessingCount: number
  latestFailureAt: string | null
  recentEventCount: number
  blockedEventCount: number
  latestEventAt: string | null
  eligibleForPurgeCount: number
  blockedBySafetyThreshold: boolean
  oldestEligiblePurgeAfter: string | null
}

export const EMPTY_INITIAL_SNAPSHOT: AdminDashboardInitialSnapshot = {
  systemHealth: null,
  dashboard: null,
  systemHealthFetchedAt: null,
  dashboardFetchedAt: null,
}

export const ADMIN_DASHBOARD_DISPLAY_TIME_ZONE = "Asia/Seoul"
export const DASHBOARD_DATA_MISSING_LABEL = "데이터 미수집"
export const DASHBOARD_BACKEND_CHECK_LABEL = "백엔드 확인 필요"
export const DASHBOARD_COLLECTION_FAILED_LABEL = "수집 실패 · 재시도"
export const DASHBOARD_REFRESH_LABEL = "새로고침"
export const DASHBOARD_REFRESHING_LABEL = "새로고침 중…"

export const resolveDashboardDataUpdatedAt = (...timestamps: number[]) => {
  let latest = 0
  for (let i = 0; i < timestamps.length; i += 1) {
    const value = timestamps[i]!
    if (Number.isFinite(value) && value > latest) {
      latest = value
    }
  }
  return latest
}

const DASHBOARD_FRESHNESS_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ADMIN_DASHBOARD_DISPLAY_TIME_ZONE,
})

export const formatDashboardFreshnessLabel = (dataUpdatedAtMs: number) => {
  if (!dataUpdatedAtMs) return null

  const formatted = formatWithNormalizedHours(
    DASHBOARD_FRESHNESS_FORMATTER,
    new Date(dataUpdatedAtMs)
  )

  return `${formatted} 기준`
}

export const isDashboardQueryCollectionFailed = (options: {
  isError: boolean
  isRefetchError: boolean
}) => options.isError || options.isRefetchError

export const resolveDashboardCollectionLabel = (options: {
  isError: boolean
  isRefetchError?: boolean
  hasData: boolean
}) => {
  if (
    isDashboardQueryCollectionFailed({
      isError: options.isError,
      isRefetchError: options.isRefetchError ?? false,
    })
  ) {
    return DASHBOARD_COLLECTION_FAILED_LABEL
  }
  if (!options.hasData) return DASHBOARD_DATA_MISSING_LABEL
  return null
}

export const hasDashboardSnapshot = (
  snapshot: DashboardSnapshotPayload | null | undefined
): snapshot is DashboardSnapshotPayload => Boolean(snapshot)

export const readSafeDashboardSnapshotMetrics = (
  snapshot: DashboardSnapshotPayload | null | undefined
): SafeDashboardSnapshotMetrics => ({
  readyPendingCount: snapshot?.taskQueue?.readyPendingCount ?? 0,
  processingCount: snapshot?.taskQueue?.processingCount ?? 0,
  failedCount: snapshot?.taskQueue?.failedCount ?? 0,
  staleProcessingCount: snapshot?.taskQueue?.staleProcessingCount ?? 0,
  latestFailureAt: snapshot?.taskQueue?.latestFailureAt ?? null,
  recentEventCount: snapshot?.authSecurity?.recentEventCount ?? 0,
  blockedEventCount: snapshot?.authSecurity?.blockedEventCount ?? 0,
  latestEventAt: snapshot?.authSecurity?.latestEventAt ?? null,
  eligibleForPurgeCount: snapshot?.storageCleanup?.eligibleForPurgeCount ?? 0,
  blockedBySafetyThreshold: Boolean(snapshot?.storageCleanup?.blockedBySafetyThreshold),
  oldestEligiblePurgeAfter: snapshot?.storageCleanup?.oldestEligiblePurgeAfter ?? null,
})

export const resolveHealthCardDetail = (options: {
  healthCollectionFailed: boolean
  healthCollectionLabel: string | null
  systemHealth: SystemHealthPayload | null | undefined
  hasSnapshot: boolean
  snapshotGeneratedAtLabel: string
  healthUpdatedAtMs?: number
}): string => {
  if (options.healthCollectionFailed) {
    return DASHBOARD_COLLECTION_FAILED_LABEL
  }
  if (!options.systemHealth) {
    return options.healthCollectionLabel ?? DASHBOARD_BACKEND_CHECK_LABEL
  }
  const checks = options.systemHealth.checks
  if (checks && (checks.db || checks.redis)) {
    const readCheckText = (entry: unknown) => {
      if (typeof entry === "string" && entry.trim()) return entry.trim()
      if (entry && typeof entry === "object" && "status" in entry) {
        const status = (entry as { status?: unknown }).status
        if (typeof status === "string" && status.trim()) return status.trim()
      }
      return "UNKNOWN"
    }
    return `DB ${readCheckText(checks.db)} · Redis ${readCheckText(checks.redis)}`
  }
  if (options.hasSnapshot && options.snapshotGeneratedAtLabel !== DASHBOARD_DATA_MISSING_LABEL) {
    return `스냅샷 ${options.snapshotGeneratedAtLabel}`
  }
  const freshness = options.healthUpdatedAtMs
    ? formatDashboardFreshnessLabel(options.healthUpdatedAtMs)
    : null
  return freshness ? `헬스 확인 ${freshness}` : "헬스체크 응답 확인"
}

export const formatInstant = (value: string | null | undefined) => {
  if (!value) return DASHBOARD_DATA_MISSING_LABEL

  const formatted = formatShortDateTime(value, "ko-KR", ADMIN_DASHBOARD_DISPLAY_TIME_ZONE)
  return formatted || value
}

export const formatAge = (seconds: number | null | undefined) => {
  if (seconds == null) return DASHBOARD_DATA_MISSING_LABEL
  if (seconds < 60) return `${seconds}초`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간`
  return `${Math.floor(seconds / 86400)}일`
}

export const getSystemHealthStatusLabel = (value: string | null | undefined) => {
  const normalized = value?.trim()
  if (!normalized || normalized === "UNKNOWN") return DASHBOARD_BACKEND_CHECK_LABEL
  if (normalized === "UP") return "서비스 정상"
  return normalized
}

export const getSystemHealthTone = (value: string | null | undefined): DashboardTone => {
  const normalized = value?.trim()
  if (!normalized || normalized === "UNKNOWN") return "neutral"
  return normalized === "UP" ? "good" : "warn"
}

export const getTaskQueueTone = (snapshot: DashboardSnapshotPayload | null | undefined): DashboardTone => {
  const queue = snapshot?.taskQueue
  if (!queue) return "neutral"
  if ((queue.failedCount ?? 0) > 0 || (queue.staleProcessingCount ?? 0) > 0) return "warn"
  if ((queue.readyPendingCount ?? 0) === 0 && (queue.processingCount ?? 0) === 0) return "good"
  return "neutral"
}
