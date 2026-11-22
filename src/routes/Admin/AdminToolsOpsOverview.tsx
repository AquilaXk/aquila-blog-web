// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/{QueueCard.tsx,QueueStats/QueueStats.tsx} (MIT)
import { AdminBullQueueCards, type BullQueueCardItem } from "src/routes/Admin/AdminBullQueueCards"
import {
  FreshnessBadge,
  ToolsHeaderButton,
  ToolsHeroActions,
  ToolsHeroCopy,
  ToolsHeroPanel,
  ToolsHeroTop,
  ToolsStatusChip,
  ToolsStatusDot,
} from "src/routes/Admin/AdminToolsWorkspace.styles"
import type { DashboardSnapshotPayload } from "src/routes/Admin/AdminDashboardWorkspaceModel"
import {
  CONNECTION_UNAVAILABLE_STATUS_LABEL,
  DATA_EMPTY_STATUS_LABEL,
  DATA_MISSING_STATUS_LABEL,
  SECTION_IDS,
  getFreshnessMeta,
  type DiagnosticTab,
  type JsonValue,
  type SectionKey,
  type SystemHealthPayload,
} from "src/routes/Admin/AdminToolsWorkspaceModel"
import type {
  AuthSecurityEvent,
  TaskQueueDiagnostics,
  UploadedFileCleanupDiagnostics,
} from "src/routes/Admin/AdminToolsWorkspacePageState"

export type OpsTone = "good" | "neutral" | "warn" | "danger"

export type OpsBar = {
  key: string
  label: string
  value: number
  height: number
  isZero: boolean
  tone: OpsTone
}

export type AdminToolsOpsOverviewProps = {
  authSecurityEvents: AuthSecurityEvent[]
  cleanupDiagnostics: UploadedFileCleanupDiagnostics | null
  dashboardSnapshot: DashboardSnapshotPayload | null
  executeAction: <T extends JsonValue>(
    key: string,
    fn: () => Promise<T>,
    options?: {
      onSuccess?: (data: T) => void
      onError?: (message: string) => void
    }
  ) => Promise<T | null>
  fetchSystemHealthCached: () => Promise<SystemHealthPayload>
  focusSection: (section: SectionKey, tab?: DiagnosticTab) => void
  loadingKey: string
  overviewStatusLabel: string
  queueStatusLabel: string
  recentCheckedLabel: string
  setSystemHealthCheckedAt: (value: string | null) => void
  systemHealthFreshness: ReturnType<typeof getFreshnessMeta>
  systemHealthQuery: { data?: SystemHealthPayload | null }
  systemHealthStatus: string
  taskQueueDiagnostics: TaskQueueDiagnostics | null
}

const toSafeCount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0

const toOpsTone = (value: string | null | undefined): OpsTone => {
  const normalized = value?.trim()
  if (!normalized || normalized === DATA_EMPTY_STATUS_LABEL) return "neutral"
  if (
    normalized === DATA_MISSING_STATUS_LABEL ||
    normalized === CONNECTION_UNAVAILABLE_STATUS_LABEL ||
    normalized.toUpperCase() === "UNKNOWN"
  ) {
    return "neutral"
  }
  if (/오류|실패|DOWN|CONNECTION_FAILED/i.test(normalized)) return "danger"
  if (/DEGRADED|WARN|점검|MISCONFIGURED/i.test(normalized)) return "warn"
  return "good"
}

const toToneBadgeCode = (tone: OpsTone) => {
  if (tone === "danger") return "점검 필요"
  if (tone === "warn") return "주의"
  if (tone === "good") return "정상"
  return "대기"
}

const readStringField = (payload: unknown, key: string) => {
  if (!payload || typeof payload !== "object") return ""
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === "string" ? value : ""
}

const readHealthCheck = (health: SystemHealthPayload | null | undefined, key: string) =>
  readStringField(health?.checks, key)

export const buildToolsOpsBars = (
  props: Pick<
    AdminToolsOpsOverviewProps,
    "authSecurityEvents" | "cleanupDiagnostics" | "dashboardSnapshot" | "taskQueueDiagnostics"
  >
): OpsBar[] => {
  const snapshot = props.dashboardSnapshot
  const hasSnapshotSubtree = Boolean(
    snapshot && (snapshot.taskQueue || snapshot.storageCleanup || snapshot.authSecurity)
  )
  const safeEvents = Array.isArray(props.authSecurityEvents) ? props.authSecurityEvents : []
  const hasCollectedData = Boolean(
    hasSnapshotSubtree || props.taskQueueDiagnostics || props.cleanupDiagnostics || safeEvents.length > 0
  )
  if (!hasCollectedData) return []

  const queueSrc = hasSnapshotSubtree ? snapshot?.taskQueue : props.taskQueueDiagnostics
  const readyVal = toSafeCount(queueSrc?.readyPendingCount)
  const processingVal = toSafeCount(queueSrc?.processingCount)
  const failedVal = toSafeCount(queueSrc?.failedCount)
  const staleVal = toSafeCount(queueSrc?.staleProcessingCount)
  const purgeVal = hasSnapshotSubtree
    ? toSafeCount(snapshot?.storageCleanup?.eligibleForPurgeCount)
    : toSafeCount(props.cleanupDiagnostics?.eligibleForPurgeCount)
  const authVal = hasSnapshotSubtree
    ? toSafeCount(snapshot?.authSecurity?.recentEventCount)
    : safeEvents.length

  const values: Array<{ key: string; label: string; value: number; tone: OpsTone }> = [
    { key: "ready", label: "대기", value: readyVal, tone: "neutral" },
    { key: "processing", label: "처리 중", value: processingVal, tone: "neutral" },
    { key: "failed", label: "실패", value: failedVal, tone: failedVal > 0 ? "danger" : "good" },
    { key: "stale", label: "지연", value: staleVal, tone: staleVal > 0 ? "danger" : "good" },
    { key: "purge", label: "정리 대상", value: purgeVal, tone: purgeVal > 0 ? "warn" : "good" },
    { key: "auth", label: "인증 기록", value: authVal, tone: authVal > 0 ? "neutral" : "good" },
  ]

  if (hasSnapshotSubtree) {
    const blockedVal = toSafeCount(snapshot?.authSecurity?.blockedEventCount)
    values.push({
      key: "blocked",
      label: "차단",
      value: blockedVal,
      tone: blockedVal > 0 ? "danger" : "good",
    })
  }

  const maxValue = Math.max(...values.map((bar) => bar.value), 1)
  return values.map((bar) => ({
    key: bar.key,
    label: bar.label,
    value: bar.value,
    height: bar.value > 0 ? Math.max(14, Math.round((bar.value / maxValue) * 100)) : 0,
    isZero: bar.value === 0,
    tone: bar.tone,
  }))
}

export const AdminToolsOpsOverview = (props: AdminToolsOpsOverviewProps) => {
  const health = props.systemHealthQuery.data ?? null
  const isActionBusy = Boolean(props.loadingKey)
  const version = readStringField(health, "version") || "dev"
  const redisStatus = readHealthCheck(health, "redis") || props.systemHealthStatus
  const dbStatus = readHealthCheck(health, "db") || props.systemHealthStatus
  const snapshot = props.dashboardSnapshot
  const hasSnapshotQueue = Boolean(snapshot?.taskQueue)
  const hasSnapshotAuth = Boolean(snapshot?.authSecurity)
  const safeEvents = Array.isArray(props.authSecurityEvents) ? props.authSecurityEvents : []

  let blockedAuthCount = 0
  for (let i = 0; i < safeEvents.length; i += 1) {
    if (safeEvents[i]?.eventType === "IP_SECURITY_MISMATCH_BLOCKED") blockedAuthCount += 1
  }

  const queueSource = hasSnapshotQueue ? snapshot?.taskQueue : props.taskQueueDiagnostics
  const readyPendingCount = toSafeCount(queueSource?.readyPendingCount)
  const processingCount = toSafeCount(queueSource?.processingCount)
  const failedCount = toSafeCount(queueSource?.failedCount)
  const staleCount = toSafeCount(queueSource?.staleProcessingCount)

  const queueFailures = failedCount + staleCount
  const authFailures = hasSnapshotAuth
    ? toSafeCount(snapshot?.authSecurity?.blockedEventCount)
    : blockedAuthCount
  const totalAttentionCount = queueFailures + authFailures
  const queueValue =
    hasSnapshotQueue || props.taskQueueDiagnostics
      ? `${readyPendingCount}건 대기`
      : props.queueStatusLabel

  const systemTone = toOpsTone(props.systemHealthStatus)
  const queueTone = toOpsTone(props.queueStatusLabel)
  const attentionTone: OpsTone = queueFailures > 0 ? "danger" : authFailures > 0 ? "warn" : "good"
  const cacheTone = toOpsTone(redisStatus)
  const overviewTone = toOpsTone(props.overviewStatusLabel)

  const cleanupSource = props.dashboardSnapshot?.storageCleanup ?? props.cleanupDiagnostics
  const purgeCandidateCount = toSafeCount(cleanupSource?.eligibleForPurgeCount)
  const pendingDeleteCount = toSafeCount(props.cleanupDiagnostics?.pendingDeleteCount)
  const authTotalCount = hasSnapshotAuth
    ? toSafeCount(snapshot?.authSecurity?.recentEventCount)
    : safeEvents.length

  const queueCards: BullQueueCardItem[] = [
    {
      key: "system-health",
      title: "시스템 상태",
      subtitle: `빌드 ${version} · DB ${dbStatus} · Redis ${redisStatus}`,
      valueText: props.systemHealthStatus,
      badgeText: toToneBadgeCode(systemTone),
      tone: systemTone,
      segments: [],
      totalCount: 0,
    },
    {
      key: "task-queue",
      title: "작업 큐",
      subtitle:
        hasSnapshotQueue || props.taskQueueDiagnostics
          ? `처리 중 ${processingCount}건`
          : "스냅샷 대기",
      valueText: queueValue,
      badgeText: toToneBadgeCode(queueTone),
      tone: queueTone,
      actionLabel: "진단 보기",
      onAction: () => props.focusSection("diagnostics", "queue"),
      segments: [
        { key: "ready", label: "대기", value: readyPendingCount, tone: "info" },
        { key: "active", label: "처리", value: processingCount, tone: "primary" },
        { key: "failed", label: "실패", value: failedCount, tone: "danger" },
        { key: "stale", label: "지연", value: staleCount, tone: "warn" },
      ],
    },
    {
      key: "auth-security",
      title: "인증 · 주의 이벤트",
      subtitle: `큐 이상 ${queueFailures} · 차단 ${authFailures}`,
      valueText: `${totalAttentionCount}건`,
      badgeText: toToneBadgeCode(attentionTone),
      tone: attentionTone,
      actionLabel: "보안 기록",
      onAction: () => props.focusSection("execution", "auth"),
      segments: [
        { key: "events", label: "전체 기록", value: authTotalCount, tone: "info" },
        { key: "blocked", label: "차단", value: authFailures, tone: "danger" },
      ],
    },
    {
      key: "storage-cleanup",
      title: "캐시 · 스토리지 정리",
      subtitle: `삭제 대기 ${pendingDeleteCount}건 · Redis ${redisStatus === "UP" ? "정상" : redisStatus}`,
      valueText: `${purgeCandidateCount}건`,
      badgeText: toToneBadgeCode(cacheTone),
      tone: cacheTone,
      actionLabel: "정리 진단",
      onAction: () => props.focusSection("execution", "cleanup"),
      segments: [
        { key: "pending", label: "삭제 대기", value: pendingDeleteCount, tone: "neutral" },
        { key: "purge", label: "정리 후보", value: purgeCandidateCount, tone: "warn" },
      ],
    },
  ]

  return (
    <>
      <ToolsHeroPanel id={SECTION_IDS.overview} data-ops-section="overview">
        <ToolsHeroTop>
          <ToolsHeroCopy>
            <h1>운영 상태와 복구</h1>
            <ToolsStatusChip data-tone={overviewTone}>
              <ToolsStatusDot data-tone={overviewTone} aria-hidden="true" />
              {props.overviewStatusLabel}
            </ToolsStatusChip>
            <FreshnessBadge data-tone={props.systemHealthFreshness.tone}>
              {props.systemHealthFreshness.label}
            </FreshnessBadge>
          </ToolsHeroCopy>
          <ToolsHeroActions>
            <ToolsHeaderButton
              type="button"
              aria-disabled={isActionBusy}
              onClick={() =>
                isActionBusy
                  ? undefined
                  : void props.executeAction("systemHealth", props.fetchSystemHealthCached, {
                      onSuccess: () => props.setSystemHealthCheckedAt(new Date().toISOString()),
                    })
              }
            >
              상태 다시 확인
            </ToolsHeaderButton>
            <ToolsHeaderButton
              type="button"
              data-variant="primary"
              onClick={() => props.focusSection("execution")}
            >
              복구 섹션 이동
            </ToolsHeaderButton>
          </ToolsHeroActions>
        </ToolsHeroTop>
      </ToolsHeroPanel>

      <AdminBullQueueCards ariaLabel="운영 도구 서브시스템 큐 카드" cards={queueCards} />
    </>
  )
}
