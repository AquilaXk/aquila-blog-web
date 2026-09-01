import { IncomingMessage } from "http"
import { GetServerSideProps } from "next"
import type { AuthMember } from "src/hooks/useAuthSession"
import { AdminPageProps, buildAdminPagePropsFromMember, getAdminPageProps, readAdminProtectedBootstrap } from "src/libs/server/adminPage"
import { hasServerAuthCookie } from "src/libs/server/authSession"
import { serverApiFetchJson } from "src/libs/server/backend"
import { readServerSnapshot } from "src/libs/server/serverSnapshotCache"
import { appendSsrDebugTiming, timed } from "src/libs/server/serverTiming"
import { withSsrMetrics } from "src/libs/server/withSsrMetrics"
import {
  type SystemHealthPayload,
  type TaskRetryPolicy,
} from "src/routes/Admin/AdminToolsWorkspaceModel"

type TaskTypeDiagnostics = {
  taskType: string
  pendingCount: number
  readyPendingCount: number
  delayedPendingCount: number
  processingCount: number
  backlogCount?: number
  queueLagSeconds?: number | null
  failedCount: number
  staleProcessingCount: number
  label: string
  oldestReadyPendingAt: string | null
  oldestReadyPendingAgeSeconds: number | null
  latestFailureAt: string | null
  latestFailureMessage: string | null
  retryPolicy: TaskRetryPolicy
}

type TaskExecutionSample = {
  taskId: number
  taskType: string
  label: string
  aggregateType: string
  aggregateId: number
  status: string
  retryCount: number
  maxRetries: number
  modifiedAt: string
  nextRetryAt: string
  errorMessage: string | null
}

type TaskQueueDiagnostics = {
  pendingCount: number
  readyPendingCount: number
  delayedPendingCount: number
  processingCount: number
  completedCount: number
  failedCount: number
  staleProcessingCount: number
  oldestReadyPendingAt: string | null
  oldestProcessingAt: string | null
  oldestReadyPendingAgeSeconds: number | null
  oldestProcessingAgeSeconds: number | null
  processingTimeoutSeconds: number
  taskTypes: TaskTypeDiagnostics[]
  recentFailures: TaskExecutionSample[]
  staleProcessingSamples: TaskExecutionSample[]
}

type UploadedFileCleanupDiagnostics = {
  tempCount: number
  activeCount: number
  pendingDeleteCount: number
  deletedCount: number
  eligibleForPurgeCount: number
  cleanupSafetyThreshold: number
  blockedBySafetyThreshold: boolean
  oldestEligiblePurgeAfter: string | null
  sampleEligibleObjectKeys: string[]
}

type AuthSecurityEvent = {
  id: number
  createdAt: string
  eventType: "LOGIN_POLICY_APPLIED" | "IP_SECURITY_MISMATCH_BLOCKED" | string
  memberId: number | null
  loginIdentifier: string | null
  rememberLoginEnabled: boolean
  ipSecurityEnabled: boolean
  clientIpFingerprint: string | null
  requestPath: string | null
  reason: string | null
}

type AdminToolsInitialSnapshot = {
  systemHealth: SystemHealthPayload | null
  systemHealthFetchedAt: string | null
  taskQueueDiagnostics: TaskQueueDiagnostics | null
  taskQueueCheckedAt: string | null
  cleanupDiagnostics: UploadedFileCleanupDiagnostics | null
  cleanupCheckedAt: string | null
  authSecurityEvents: AuthSecurityEvent[]
  authSecurityCheckedAt: string | null
  seedPostId: string
}

type AdminToolsHealthSsrSnapshot = {
  systemHealth: SystemHealthPayload
  fetchedAt: string
}

type AdminToolsBootstrapPayload = {
  member: AuthMember
  health: SystemHealthPayload
}

type AdminToolsPageProps = AdminPageProps & {
  initialSnapshot: AdminToolsInitialSnapshot
}

const ADMIN_TOOLS_HEALTH_SSR_CACHE_KEY = "admin-tools:system-health"
const ADMIN_TOOLS_HEALTH_SSR_CACHE_TTL_MS = 10_000

async function readJsonIfOk<T>(req: IncomingMessage, path: string): Promise<T | null> {
  try {
    const value = await serverApiFetchJson<T>(req, path)
    return value ?? null
  } catch {
    return null
  }
}

export const getServerSideProps: GetServerSideProps<AdminToolsPageProps> = withSsrMetrics<AdminToolsPageProps>("admin", async ({ req, res }) => {
  const ssrStartedAt = performance.now()
  const bootstrapResultPromise =
    hasServerAuthCookie(req)
      ? timed(() =>
          readAdminProtectedBootstrap<AdminToolsBootstrapPayload>(req, "/system/api/v1/adm/bootstrap", "/admin/tools")
        )
      : null

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
  let authDescription = "bootstrap"
  let systemHealthResult: {
    durationMs: number
    ok: true
    value: { value: AdminToolsHealthSsrSnapshot | null; source: string }
  }

  if (bootstrapResult?.ok && bootstrapResult.value.ok) {
    baseProps = buildAdminPagePropsFromMember(bootstrapResult.value.value.member)
    systemHealthResult = {
      durationMs: bootstrapResult.durationMs,
      ok: true,
      value: {
        value: {
          systemHealth: bootstrapResult.value.value.health,
          fetchedAt: new Date().toISOString(),
        },
        source: "bootstrap",
      },
    }
  } else {
    const systemHealthResultPromise =
      hasServerAuthCookie(req)
        ? timed(() =>
            readServerSnapshot<AdminToolsHealthSsrSnapshot>(
              ADMIN_TOOLS_HEALTH_SSR_CACHE_KEY,
              ADMIN_TOOLS_HEALTH_SSR_CACHE_TTL_MS,
              async () => {
                const systemHealth = await readJsonIfOk<SystemHealthPayload>(req, "/system/api/v1/adm/health")
                if (!systemHealth) return null
                return {
                  systemHealth,
                  fetchedAt: new Date().toISOString(),
                }
              }
            )
          )
        : null
    const baseResult = await timed(() => getAdminPageProps(req))
    if (!baseResult.ok) throw baseResult.error
    if ("redirect" in baseResult.value) return baseResult.value
    if (!("props" in baseResult.value)) return baseResult.value
    baseProps = await baseResult.value.props
    authDurationMs = baseResult.durationMs
    authDescription = "fallback"

    const fallbackSystemHealthResult =
      systemHealthResultPromise
        ? await systemHealthResultPromise
        : await timed(() =>
            readServerSnapshot<AdminToolsHealthSsrSnapshot>(
              ADMIN_TOOLS_HEALTH_SSR_CACHE_KEY,
              ADMIN_TOOLS_HEALTH_SSR_CACHE_TTL_MS,
              async () => {
                const systemHealth = await readJsonIfOk<SystemHealthPayload>(req, "/system/api/v1/adm/health")
                if (!systemHealth) return null
                return {
                  systemHealth,
                  fetchedAt: new Date().toISOString(),
                }
              }
            )
          )
    if (!fallbackSystemHealthResult.ok) throw fallbackSystemHealthResult.error
    systemHealthResult = fallbackSystemHealthResult
  }

  const healthSnapshot = systemHealthResult.ok ? systemHealthResult.value.value : null
  const systemHealth = healthSnapshot?.systemHealth ?? null
  const fetchedAt = healthSnapshot?.fetchedAt ?? null

  appendSsrDebugTiming(req, res, [
    {
      name: "admin-tools-auth",
      durationMs: authDurationMs,
      description: authDescription,
    },
    {
      name: "admin-tools-health",
      durationMs: systemHealthResult.durationMs,
      description: systemHealth ? (systemHealthResult.ok ? systemHealthResult.value.source : "ok") : "empty",
    },
    {
      name: "admin-tools-ssr-total",
      durationMs: performance.now() - ssrStartedAt,
      description: "ready",
    },
  ])

  return {
    props: {
      ...baseProps,
      initialSnapshot: {
        systemHealth,
        systemHealthFetchedAt: fetchedAt,
        taskQueueDiagnostics: null,
        taskQueueCheckedAt: null,
        cleanupDiagnostics: null,
        cleanupCheckedAt: null,
        authSecurityEvents: [],
        authSecurityCheckedAt: null,
        seedPostId: "",
      },
    },
  }
})

export { default } from "src/routes/Admin/AdminToolsWorkspacePage"
