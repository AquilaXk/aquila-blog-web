// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/QueueCard.tsx (MIT), shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/section-cards.tsx (MIT)
import { useQuery } from "@tanstack/react-query"
import { NextPage } from "next"
import { useCallback, useState } from "react"
import { apiFetch } from "src/apis/backend/client"
import type { AdminProfile } from "src/hooks/useAdminProfile"
import type { AuthMember } from "src/hooks/useAuthSession"
import useAuthSession from "src/hooks/useAuthSession"
import { useLanguage } from "src/libs/language"
import { adminT } from "src/routes/Admin/adminI18n"
import {
  DASHBOARD_BACKEND_CHECK_LABEL,
  DASHBOARD_COLLECTION_FAILED_LABEL,
  DASHBOARD_DATA_MISSING_LABEL,
  EMPTY_INITIAL_SNAPSHOT,
  formatDashboardFreshnessLabel,
  formatInstant,
  getSystemHealthStatusLabel,
  getSystemHealthTone,
  getTaskQueueTone,
  hasDashboardSnapshot,
  isDashboardQueryCollectionFailed,
  readSafeDashboardSnapshotMetrics,
  resolveDashboardCollectionLabel,
  resolveDashboardDataUpdatedAt,
  resolveHealthCardDetail,
  type AdminDashboardInitialSnapshot,
  type DashboardChartBar,
  type DashboardKpiCard,
  type DashboardLogRow,
  type DashboardPriorityRow,
  type DashboardSnapshotPayload,
  type DashboardTone,
  type SystemHealthPayload,
} from "src/routes/Admin/AdminDashboardWorkspaceModel"
import { AdminDashboardWorkspaceView } from "src/routes/Admin/AdminDashboardWorkspaceView"

type AdminDashboardPageProps = {
  initialMember: AuthMember
  initialProfileSnapshot?: AdminProfile | null
  initialSnapshot: AdminDashboardInitialSnapshot
}

const AdminDashboardPage: NextPage<AdminDashboardPageProps> = ({
  initialMember,
  initialProfileSnapshot = null,
  initialSnapshot = EMPTY_INITIAL_SNAPSHOT,
}) => {
  const { language } = useLanguage()
  const { me, authStatus } = useAuthSession()
  const sessionMember = authStatus === "loading" || authStatus === "unavailable" ? initialMember : me || initialMember
  const systemHealthQuery = useQuery({
    queryKey: ["admin", "dashboard", "system-health"],
    queryFn: (): Promise<SystemHealthPayload> => apiFetch<SystemHealthPayload>("/system/api/v1/adm/health"),
    enabled: Boolean(sessionMember?.isAdmin),
    initialData: initialSnapshot.systemHealth ?? undefined,
    initialDataUpdatedAt:
      initialSnapshot.systemHealth && initialSnapshot.systemHealthFetchedAt
        ? new Date(initialSnapshot.systemHealthFetchedAt).getTime()
        : undefined,
    staleTime: 30_000,
    gcTime: 120_000,
    retry: 1,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: false,
  })
  const dashboardSnapshotQuery = useQuery({
    queryKey: ["admin", "dashboard", "snapshot"],
    queryFn: (): Promise<DashboardSnapshotPayload> => apiFetch<DashboardSnapshotPayload>("/system/api/v1/adm/dashboard-snapshot"),
    enabled: Boolean(sessionMember?.isAdmin),
    initialData: initialSnapshot.dashboard ?? undefined,
    initialDataUpdatedAt:
      initialSnapshot.dashboard && initialSnapshot.dashboardFetchedAt
        ? new Date(initialSnapshot.dashboardFetchedAt).getTime()
        : undefined,
    staleTime: 30_000,
    gcTime: 120_000,
    retry: 1,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: false,
  })

  const [isManualRefreshing, setIsManualRefreshing] = useState(false)
  const handleRefresh = useCallback(() => {
    if (isManualRefreshing) return
    setIsManualRefreshing(true)
    void Promise.all([systemHealthQuery.refetch(), dashboardSnapshotQuery.refetch()]).finally(() => {
      setIsManualRefreshing(false)
    })
  }, [dashboardSnapshotQuery, isManualRefreshing, systemHealthQuery])

  if (!sessionMember) return null

  const healthCollectionFailed = isDashboardQueryCollectionFailed(systemHealthQuery)
  const snapshotCollectionFailed = isDashboardQueryCollectionFailed(dashboardSnapshotQuery)
  const collectionFailed = healthCollectionFailed || snapshotCollectionFailed
  const isRefreshing = isManualRefreshing
  const freshnessLabel = formatDashboardFreshnessLabel(
    resolveDashboardDataUpdatedAt(systemHealthQuery.dataUpdatedAt, dashboardSnapshotQuery.dataUpdatedAt)
  )
  const systemHealthData = systemHealthQuery.data ?? initialSnapshot.systemHealth
  const rawSystemHealthStatus = systemHealthData?.status ?? null
  const dashboardSnapshot = dashboardSnapshotQuery.data ?? initialSnapshot.dashboard
  const hasSnapshot = hasDashboardSnapshot(dashboardSnapshot)
  const safeMetrics = readSafeDashboardSnapshotMetrics(dashboardSnapshot)

  const snapshotCollectionLabel = resolveDashboardCollectionLabel({
    isError: dashboardSnapshotQuery.isError,
    isRefetchError: dashboardSnapshotQuery.isRefetchError,
    hasData: hasSnapshot,
  })
  const healthCollectionLabel = resolveDashboardCollectionLabel({
    isError: systemHealthQuery.isError,
    isRefetchError: systemHealthQuery.isRefetchError,
    hasData: Boolean(systemHealthData),
  })
  const dashboardStatusLabel = getSystemHealthStatusLabel(rawSystemHealthStatus)
  const dashboardStatusTone = getSystemHealthTone(rawSystemHealthStatus)
  const dashboardSnapshotGeneratedAt = hasSnapshot
    ? formatInstant(dashboardSnapshot.generatedAt)
    : snapshotCollectionLabel ?? DASHBOARD_DATA_MISSING_LABEL
  const healthCardDetail = resolveHealthCardDetail({
    healthCollectionFailed,
    healthCollectionLabel,
    systemHealth: systemHealthData,
    hasSnapshot,
    snapshotGeneratedAtLabel: dashboardSnapshotGeneratedAt,
    healthUpdatedAtMs: systemHealthQuery.dataUpdatedAt,
  })
  const taskQueueDetail = hasSnapshot
    ? `실패 ${safeMetrics.failedCount} · 정체 ${safeMetrics.staleProcessingCount}`
    : snapshotCollectionLabel ?? DASHBOARD_DATA_MISSING_LABEL
  const authSecurityDetail = hasSnapshot
    ? `최근 기록 ${safeMetrics.recentEventCount}건`
    : snapshotCollectionLabel ?? DASHBOARD_DATA_MISSING_LABEL
  const missingOrFailedLabel = snapshotCollectionLabel ?? DASHBOARD_DATA_MISSING_LABEL
  const missingOrFailedTone: DashboardTone = snapshotCollectionFailed ? "warn" : "neutral"

  const kpiCards: DashboardKpiCard[] = [
    {
      key: "health",
      label: "서비스 상태",
      value:
        healthCollectionLabel === DASHBOARD_COLLECTION_FAILED_LABEL && !systemHealthData
          ? DASHBOARD_COLLECTION_FAILED_LABEL
          : dashboardStatusLabel,
      badge: rawSystemHealthStatus?.trim() || "PROBE",
      detail: healthCardDetail,
      tone: healthCollectionFailed ? "warn" : dashboardStatusTone,
    },
    {
      key: "tasks",
      label: "작업 큐",
      value: hasSnapshot
        ? `${safeMetrics.readyPendingCount} / ${safeMetrics.processingCount}`
        : missingOrFailedLabel,
      badge: hasSnapshot ? "READY/PROC" : "QUEUE",
      detail: taskQueueDetail,
      tone: hasSnapshot ? getTaskQueueTone(dashboardSnapshot) : missingOrFailedTone,
    },
    {
      key: "auth-security",
      label: "인증 이상",
      value: hasSnapshot ? `${safeMetrics.blockedEventCount}건` : missingOrFailedLabel,
      badge: hasSnapshot && safeMetrics.blockedEventCount > 0 ? "ALERT" : "GUARD",
      detail: authSecurityDetail,
      tone: hasSnapshot ? (safeMetrics.blockedEventCount > 0 ? "warn" : "good") : missingOrFailedTone,
    },
  ]

  if (hasSnapshot && dashboardSnapshot.content) {
    const content = dashboardSnapshot.content
    const totalPosts = content.totalPosts ?? 0
    const publishedPosts = content.publishedPosts ?? 0
    const draftPosts = content.draftPosts ?? 0
    const privatePosts = content.privatePosts ?? 0
    const totalHitCount = content.totalHitCount ?? 0
    const totalLikesCount = content.totalLikesCount ?? 0
    kpiCards.push(
      {
        key: "content-status",
        label: adminT("kpiContentStatus", language),
        value: `${totalPosts.toLocaleString()}건`,
        badge: adminT("kpiTotalPosts", language),
        detail:
          language === "en"
            ? `Pub ${publishedPosts} · Draft ${draftPosts} · Priv ${privatePosts}`
            : `발행 ${publishedPosts} · 초안 ${draftPosts} · 비공개 ${privatePosts}`,
        tone: "neutral",
      },
      {
        key: "engagement",
        label: adminT("kpiEngagement", language),
        value: totalHitCount.toLocaleString(),
        badge: language === "en" ? "VIEWS" : "누적 조회",
        detail:
          language === "en"
            ? `${totalLikesCount.toLocaleString()} likes`
            : `좋아요 ${totalLikesCount.toLocaleString()}개`,
        tone: "good",
      }
    )
  } else {
    const queueAlerts = safeMetrics.failedCount + safeMetrics.staleProcessingCount
    kpiCards.push(
      {
        key: "storage-cleanup",
        label: "스토리지 정리",
        value: hasSnapshot ? `${safeMetrics.eligibleForPurgeCount}건` : missingOrFailedLabel,
        badge: hasSnapshot && safeMetrics.blockedBySafetyThreshold ? "HOLD" : "PURGE",
        detail: hasSnapshot
          ? safeMetrics.blockedBySafetyThreshold
            ? "안전 임계값 보류"
            : "영구 정리 후보"
          : missingOrFailedLabel,
        tone: hasSnapshot
          ? safeMetrics.blockedBySafetyThreshold || safeMetrics.eligibleForPurgeCount > 0
            ? "warn"
            : "good"
          : missingOrFailedTone,
      },
      {
        key: "queue-incidents",
        label: "큐 이상 감지",
        value: hasSnapshot ? `${queueAlerts}건` : missingOrFailedLabel,
        badge: hasSnapshot && queueAlerts > 0 ? "INCIDENT" : "CLEAN",
        detail: hasSnapshot
          ? `실패 ${safeMetrics.failedCount} · 지연 ${safeMetrics.staleProcessingCount}`
          : missingOrFailedLabel,
        tone: hasSnapshot ? (queueAlerts > 0 ? "danger" : "good") : missingOrFailedTone,
      }
    )
  }

  const priorityRows: DashboardPriorityRow[] = hasSnapshot ? [
    {
      key: "task-queue",
      title: "작업 큐",
      summary: `ready ${safeMetrics.readyPendingCount} · failed ${safeMetrics.failedCount} · stale ${safeMetrics.staleProcessingCount}`,
      tone: getTaskQueueTone(dashboardSnapshot),
      href: "/admin/tools",
      actionLabel: "도구 열기",
    },
    {
      key: "auth-security",
      title: "인증 보안",
      summary: `차단 ${safeMetrics.blockedEventCount} · 최근 ${safeMetrics.recentEventCount}`,
      tone: safeMetrics.blockedEventCount > 0 ? "warn" : "good",
      href: "/admin/tools?tab=auth",
      actionLabel: "기록 보기",
    },
    {
      key: "storage-cleanup",
      title: "스토리지 정리",
      summary: safeMetrics.blockedBySafetyThreshold
        ? "안전 임계값으로 purge 보류"
        : `purge 대상 ${safeMetrics.eligibleForPurgeCount}건`,
      tone:
        safeMetrics.blockedBySafetyThreshold || safeMetrics.eligibleForPurgeCount > 0
          ? "warn"
          : "good",
      href: "/admin/tools?tab=cleanup",
      actionLabel: "정리 진단",
    },
  ] : [
    {
      key: "snapshot-missing",
      title: "운영 스냅샷",
      summary: snapshotCollectionFailed
        ? DASHBOARD_COLLECTION_FAILED_LABEL
        : `${DASHBOARD_DATA_MISSING_LABEL} · ${DASHBOARD_BACKEND_CHECK_LABEL}`,
      tone: missingOrFailedTone,
      href: "/admin/tools?tab=queue",
      actionLabel: "진단 열기",
    },
  ]

  const rawChartBars: Array<{ key: string; label: string; value: number; tone: DashboardTone }> = hasSnapshot
    ? [
        {
          key: "ready",
          label: "ready",
          value: safeMetrics.readyPendingCount,
          tone: safeMetrics.readyPendingCount > 0 ? "good" : "neutral",
        },
        {
          key: "processing",
          label: "processing",
          value: safeMetrics.processingCount,
          tone: "neutral",
        },
        {
          key: "failed",
          label: "failed",
          value: safeMetrics.failedCount,
          tone: safeMetrics.failedCount > 0 ? "danger" : "neutral",
        },
        {
          key: "stale",
          label: "stale",
          value: safeMetrics.staleProcessingCount,
          tone: safeMetrics.staleProcessingCount > 0 ? "warn" : "neutral",
        },
        {
          key: "auth-recent",
          label: "auth",
          value: safeMetrics.recentEventCount,
          tone: "neutral",
        },
        {
          key: "auth-blocked",
          label: "blocked",
          value: safeMetrics.blockedEventCount,
          tone: safeMetrics.blockedEventCount > 0 ? "danger" : "neutral",
        },
        {
          key: "purge",
          label: "purge",
          value: safeMetrics.eligibleForPurgeCount,
          tone: safeMetrics.eligibleForPurgeCount > 0 ? "warn" : "neutral",
        },
      ]
    : []

  let maxChartBarValue = 1
  for (let i = 0; i < rawChartBars.length; i += 1) {
    const val = rawChartBars[i]!.value
    if (val > maxChartBarValue) maxChartBarValue = val
  }

  const chartBars: DashboardChartBar[] = rawChartBars.map((item) => ({
    key: item.key,
    label: item.label,
    value: item.value,
    height: item.value > 0 ? Math.max(8, Math.round((item.value / maxChartBarValue) * 100)) : 0,
    tone: item.tone,
  }))

  const generatedInstantLabel = hasSnapshot ? formatInstant(dashboardSnapshot.generatedAt) : missingOrFailedLabel
  const logRows: DashboardLogRow[] = hasSnapshot
    ? [
        {
          key: "snapshot",
          time: generatedInstantLabel,
          message: "운영 스냅샷 수집",
          detail: `system=${dashboardStatusLabel}`,
          tone: dashboardStatusTone,
        },
        {
          key: "task-queue",
          time: safeMetrics.latestFailureAt
            ? formatInstant(safeMetrics.latestFailureAt)
            : generatedInstantLabel,
          message: "작업 큐 상태",
          detail: `ready=${safeMetrics.readyPendingCount} failed=${safeMetrics.failedCount} stale=${safeMetrics.staleProcessingCount}`,
          tone: safeMetrics.failedCount > 0 ? "danger" : getTaskQueueTone(dashboardSnapshot),
        },
        {
          key: "auth-security",
          time: safeMetrics.latestEventAt
            ? formatInstant(safeMetrics.latestEventAt)
            : generatedInstantLabel,
          message: "인증 이벤트",
          detail: `recent=${safeMetrics.recentEventCount} blocked=${safeMetrics.blockedEventCount}`,
          tone: safeMetrics.blockedEventCount > 0 ? "warn" : "good",
        },
        {
          key: "storage-cleanup",
          time: safeMetrics.oldestEligiblePurgeAfter
            ? formatInstant(safeMetrics.oldestEligiblePurgeAfter)
            : generatedInstantLabel,
          message: "스토리지 정리",
          detail: safeMetrics.blockedBySafetyThreshold
            ? "safety_threshold=blocked"
            : `eligible=${safeMetrics.eligibleForPurgeCount}`,
          tone:
            safeMetrics.blockedBySafetyThreshold || safeMetrics.eligibleForPurgeCount > 0
              ? "warn"
              : "good",
        },
      ]
    : [
        {
          key: "snapshot-missing",
          time: missingOrFailedLabel,
          message: snapshotCollectionFailed ? "운영 스냅샷 수집 실패" : "운영 스냅샷 미수집",
          detail: snapshotCollectionFailed ? DASHBOARD_COLLECTION_FAILED_LABEL : DASHBOARD_BACKEND_CHECK_LABEL,
          tone: missingOrFailedTone,
        },
      ]

  const chartEmptyLabel = snapshotCollectionFailed
    ? DASHBOARD_COLLECTION_FAILED_LABEL
    : `${DASHBOARD_DATA_MISSING_LABEL} · ${DASHBOARD_BACKEND_CHECK_LABEL}`

  return (
    <AdminDashboardWorkspaceView
      chartBars={chartBars}
      chartEmptyLabel={chartEmptyLabel}
      collectionFailed={collectionFailed}
      snapshotCollectionFailed={snapshotCollectionFailed}
      dashboardStatusLabel={dashboardStatusLabel}
      dashboardStatusTone={dashboardStatusTone}
      freshnessLabel={freshnessLabel}
      initialProfileSnapshot={initialProfileSnapshot}
      isRefreshing={isRefreshing}
      kpiCards={kpiCards}
      logRows={logRows}
      onRefresh={handleRefresh}
      priorityRows={priorityRows}
      sessionMember={sessionMember}
    />
  )
}

export default AdminDashboardPage
