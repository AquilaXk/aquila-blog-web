// 참조 구현: TryGhost/Ghost apps/admin/src/analytics/views/stats/overview/overview.tsx (MIT)
import { GetServerSideProps, NextPage } from "next"
import dynamic from "next/dynamic"
import { IncomingMessage } from "http"
import { randomInt } from "node:crypto"
import { useCallback, useRef, useState } from "react"
import { apiFetch } from "src/apis/backend/client"
import type { AuthMember } from "src/hooks/useAuthSession"
import { type AdminProfile } from "src/hooks/useAdminProfile"
import { AdminPageProps, buildAdminPagePropsFromMember, getAdminPageProps, readAdminProtectedBootstrap } from "src/libs/server/adminPage"
import { hasServerAuthCookie } from "src/libs/server/authSession"
import { serverApiFetchJson } from "src/libs/server/backend"
import { appendSsrDebugTiming, timed } from "src/libs/server/serverTiming"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"
import {
  ADMIN_HUB_GREETING_VARIANT_COUNT,
  mergeAdminHubOperationalRefresh,
  resolveAdminHubGreeting,
  type AdminHubDashboardSnapshotPayload,
  type AdminHubOperationalSnapshot,
  type AdminHubPageDto,
  type AdminHubPostListItem,
  type AdminHubSystemHealthPayload,
  type AdminHubTone,
} from "src/routes/Admin/AdminHubGreetingModel"
import AdminShell from "src/routes/Admin/AdminShell"

const AdminHubSurface = dynamic(() => import("src/routes/Admin/AdminHubSurface"), {
  loading: () => <div aria-hidden="true" style={{ minHeight: "32rem" }} />,
})

type AdminHubPageProps = AdminPageProps & {
  initialGreeting: string
  initialProfileSnapshot: AdminProfile | null
  initialOperationalSnapshot: AdminHubOperationalSnapshot
}

type AdminHubBootstrapPayload = {
  member: AuthMember
  profile: AdminProfile
}

const EMPTY_OPERATIONAL_SNAPSHOT: AdminHubOperationalSnapshot = {
  posts: null,
  systemHealth: null,
  dashboard: null,
  fetchedAt: null,
}

async function readJsonIfOk<T>(req: IncomingMessage, path: string): Promise<T | null> {
  const value = await serverApiFetchJson<T>(req, path)
  return value ?? null
}

const buildAdminHubPostListEndpoint = () => "/post/api/v1/adm/posts?page=1&pageSize=20&kw=&sort=MODIFIED_AT"

const readAdminHubOperationalSnapshot = async (req: IncomingMessage): Promise<AdminHubOperationalSnapshot> => {
  const [posts, systemHealth, dashboard] = await Promise.all([
    readJsonIfOk<AdminHubPageDto<AdminHubPostListItem>>(req, buildAdminHubPostListEndpoint()),
    readJsonIfOk<AdminHubSystemHealthPayload>(req, "/system/api/v1/adm/health"),
    readJsonIfOk<AdminHubDashboardSnapshotPayload>(req, "/system/api/v1/adm/dashboard-snapshot"),
  ])
  return {
    posts,
    systemHealth,
    dashboard,
    fetchedAt: posts || systemHealth || dashboard ? new Date().toISOString() : null,
  }
}

const DASHBOARD_DATA_MISSING_LABEL = "데이터 미수집"

const getSystemHealthStatusLabel = (value: string | null | undefined) => {
  const normalized = value?.trim()
  if (!normalized || normalized === "UNKNOWN") return "백엔드 확인 필요"
  if (normalized === "UP") return "서비스 정상"
  return normalized
}

const getSystemHealthTone = (value: string | null | undefined): AdminHubTone => {
  const normalized = value?.trim()
  if (!normalized || normalized === "UNKNOWN") return "neutral"
  return normalized === "UP" ? "good" : "warn"
}

const getDependencyStatusLabel = (value: string | null | undefined) => {
  const normalized = value?.trim()
  if (normalized === "UP") return "정상"
  if (normalized === "DOWN") return "장애"
  if (normalized === "DISABLED") return "비활성"
  return normalized || DASHBOARD_DATA_MISSING_LABEL
}

const getDependencyStatusTone = (value: string | null | undefined): AdminHubTone => {
  const normalized = value?.trim()
  if (!normalized || normalized === "DISABLED") return "neutral"
  if (normalized === "UP") return "good"
  return "warn"
}

export const getServerSideProps: GetServerSideProps<AdminHubPageProps> = withSsrMetrics<AdminHubPageProps>("admin", async ({ req, res }) => {
  const ssrStartedAt = performance.now()
  const requestInstant = new Date()
  const greetingVariantIndex = randomInt(ADMIN_HUB_GREETING_VARIANT_COUNT)
  const hasAuthCookie = hasServerAuthCookie(req)
  const bootstrapResultPromise =
    hasAuthCookie
      ? timed(() =>
          readAdminProtectedBootstrap<AdminHubBootstrapPayload>(req, "/member/api/v1/adm/members/bootstrap", "/admin")
        )
      : null
  const operationalResultPromise = hasAuthCookie ? timed(() => readAdminHubOperationalSnapshot(req)) : null

  const bootstrapResult = bootstrapResultPromise ? await bootstrapResultPromise : null
  if (bootstrapResult && !bootstrapResult.ok) {
    throw bootstrapResult.error
  }
  if (bootstrapResult?.ok && !bootstrapResult.value.ok && bootstrapResult.value.destination) {
    return {
      redirect: {
        destination: bootstrapResult.value.destination,
        permanent: false,
      },
    }
  }

  let baseProps: AdminPageProps
  let authDurationMs = 0
  let authDescription: string = "bootstrap"
  let profileDurationMs = 0
  let profileDescription: string
  let profileSnapshot: AdminProfile | null = null
  let operationalSnapshot = EMPTY_OPERATIONAL_SNAPSHOT
  let operationalDurationMs = 0
  let operationalDescription = hasAuthCookie ? "unavailable" : "no-auth-cookie"

  if (bootstrapResult?.ok && bootstrapResult.value.ok) {
    baseProps = buildAdminPagePropsFromMember(bootstrapResult.value.value.member)
    profileSnapshot = bootstrapResult.value.value.profile
    profileDurationMs = bootstrapResult.durationMs
    profileDescription = "bootstrap"
  } else {
    const baseResult = await timed(() => getAdminPageProps(req))
    if (!baseResult.ok) throw baseResult.error
    if ("redirect" in baseResult.value) return baseResult.value
    if (!("props" in baseResult.value)) return baseResult.value
    baseProps = await baseResult.value.props
    authDurationMs = baseResult.durationMs
    authDescription = "fallback"
    profileDescription = "unavailable"
  }

  if (operationalResultPromise) {
    const operationalResult = await operationalResultPromise
    if (!operationalResult.ok) throw operationalResult.error
    operationalSnapshot = operationalResult.value
    operationalDurationMs = operationalResult.durationMs
    operationalDescription = operationalSnapshot.fetchedAt ? "ok" : "empty"
  }

  appendSsrDebugTiming(req, res, [
    {
      name: "admin-auth-session",
      durationMs: authDurationMs,
      description: authDescription,
    },
    {
      name: "admin-profile",
      durationMs: profileDurationMs,
      description: profileDescription,
    },
    {
      name: "admin-hub-operational",
      durationMs: operationalDurationMs,
      description: operationalDescription,
    },
    {
      name: "admin-ssr-total",
      durationMs: performance.now() - ssrStartedAt,
      description: "ready",
    },
  ])

  return {
    props: {
      ...baseProps,
      initialGreeting: resolveAdminHubGreeting(requestInstant, greetingVariantIndex),
      initialProfileSnapshot: profileSnapshot,
      initialOperationalSnapshot: operationalSnapshot,
    },
  }
})

const AdminHubPage: NextPage<AdminHubPageProps> = ({
  initialMember,
  initialGreeting,
  initialProfileSnapshot,
  initialOperationalSnapshot,
}) => {
  const sessionMember = initialMember
  const adminProfile = initialProfileSnapshot
  const displayName = sessionMember?.nickname || sessionMember?.username || "관리자"

  const [operationalSnapshot, setOperationalSnapshot] = useState(initialOperationalSnapshot)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const isRefreshingRef = useRef(false)

  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    setIsRefreshing(true)
    try {
      const [postsResult, healthResult, dashboardResult] = await Promise.allSettled([
        apiFetch<AdminHubPageDto<AdminHubPostListItem>>(buildAdminHubPostListEndpoint()),
        apiFetch<AdminHubSystemHealthPayload>("/system/api/v1/adm/health"),
        apiFetch<AdminHubDashboardSnapshotPayload>("/system/api/v1/adm/dashboard-snapshot"),
      ])

      let failedCount = 0
      let succeededCount = 0
      setOperationalSnapshot((previous) => {
        const merged = mergeAdminHubOperationalRefresh(previous, {
          posts: postsResult,
          systemHealth: healthResult,
          dashboard: dashboardResult,
        })
        failedCount = merged.failedCount
        succeededCount = merged.succeededCount
        return merged.snapshot
      })

      setRefreshError(
        failedCount > 0
          ? succeededCount === 0
            ? "상태 새로고침에 실패했습니다. 마지막으로 확인된 데이터를 유지합니다."
            : "일부 상태 지표를 갱신하지 못해 이전 데이터를 유지합니다."
          : null
      )
    } finally {
      isRefreshingRef.current = false
      setIsRefreshing(false)
    }
  }, [])

  const healthChecks = operationalSnapshot?.systemHealth?.checks
  const serviceStatusItems = [
    {
      label: "Public API",
      value: getSystemHealthStatusLabel(operationalSnapshot?.systemHealth?.status),
      tone: getSystemHealthTone(operationalSnapshot?.systemHealth?.status),
    },
    {
      label: "PostgreSQL",
      value: getDependencyStatusLabel(healthChecks?.db),
      tone: getDependencyStatusTone(healthChecks?.db),
    },
    {
      label: "Redis",
      value: getDependencyStatusLabel(healthChecks?.redis),
      tone: getDependencyStatusTone(healthChecks?.redis),
    },
  ]

  if (!sessionMember) return null

  return (
    <AdminShell currentSection="hub" member={sessionMember} profileSnapshot={initialProfileSnapshot}>
      <AdminHubSurface
        displayName={displayName}
        greeting={initialGreeting}
        primaryAction={{ href: "/admin/editor/new", cta: "새 글 작성", secondaryHref: "/admin/posts" }}
        serviceStatusItems={serviceStatusItems}
        operationalSnapshot={operationalSnapshot}
        adminProfile={adminProfile}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshError={refreshError}
      />
    </AdminShell>
  )
}

export default AdminHubPage
