// 참조 구현: felixmosh/bull-board (MIT) — 운영 진단 워크스페이스 독립 섹션 상태 및 자동 초기 조회
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { NextPage } from "next"
import { useRouter } from "next/router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { apiFetch } from "src/apis/backend/client"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import useAuthSession from "src/hooks/useAuthSession"
import type { DashboardSnapshotPayload } from "src/routes/Admin/AdminDashboardWorkspaceModel"
import {
  ACTION_META,
  CHECK_REQUIRED_STATUS_LABEL,
  CONNECTION_UNAVAILABLE_STATUS_LABEL,
  DATA_EMPTY_STATUS_LABEL,
  HEALTH_CACHE_MS,
  RESULTS_FILTER_STORAGE_KEY,
  SECTION_IDS,
  SYSTEM_HEALTH_QUERY_KEY,
  buildExecutionSummary,
  formatInstant,
  getDiagnosticFallbackStatusLabel,
  getFreshnessMeta,
  isExecutionResultFilter,
  isOperationalStatusMissing,
  normalizeOperationalStatusLabel,
  type DiagnosticTab,
  type ExecutionEntry,
  type ExecutionResultFilter,
  type JsonValue,
  type SectionKey,
  type SystemHealthPayload,
} from "src/routes/Admin/AdminToolsWorkspaceModel"
import {
  EMPTY_INITIAL_SNAPSHOT,
  type AdminToolsPageProps,
  type AuthSecurityEvent,
  type TaskQueueDiagnostics,
  type UploadedFileCleanupDiagnostics,
} from "src/routes/Admin/AdminToolsWorkspacePageState"
import { AdminToolsWorkspaceSections } from "src/routes/Admin/AdminToolsWorkspaceSections"

export type ExecutionDiagnosticTab = "cleanup" | "auth"

const AdminToolsPage: NextPage<AdminToolsPageProps> = ({
  initialMember,
  initialProfileSnapshot = null,
  initialSnapshot = EMPTY_INITIAL_SNAPSHOT,
}) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { me, authStatus } = useAuthSession()
  const sessionMember =
    authStatus === "loading" || authStatus === "unavailable"
      ? initialMember
      : me || initialMember

  const [loadingKey, setLoadingKey] = useState("")
  const [isQueueFetching, setIsQueueFetching] = useState(false)
  const [isCleanupFetching, setIsCleanupFetching] = useState(false)
  const [isAuthFetching, setIsAuthFetching] = useState(false)
  const [executions, setExecutions] = useState<ExecutionEntry[]>([])
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)
  const [resultsFilter, setResultsFilter] = useState<ExecutionResultFilter>("all")
  const [taskQueueDiagnostics, setTaskQueueDiagnostics] = useState<TaskQueueDiagnostics | null>(
    initialSnapshot.taskQueueDiagnostics
  )
  const [taskQueueDiagnosticsError, setTaskQueueDiagnosticsError] = useState("")
  const [taskQueueCheckedAt, setTaskQueueCheckedAt] = useState<string | null>(
    initialSnapshot.taskQueueCheckedAt
  )
  const [cleanupDiagnostics, setCleanupDiagnostics] =
    useState<UploadedFileCleanupDiagnostics | null>(initialSnapshot.cleanupDiagnostics)
  const [cleanupDiagnosticsError, setCleanupDiagnosticsError] = useState("")
  const [cleanupCheckedAt, setCleanupCheckedAt] = useState<string | null>(
    initialSnapshot.cleanupCheckedAt
  )
  const [authSecurityEvents, setAuthSecurityEvents] = useState<AuthSecurityEvent[]>(
    initialSnapshot.authSecurityEvents
  )
  const [authSecurityEventsError, setAuthSecurityEventsError] = useState("")
  const [authSecurityCheckedAt, setAuthSecurityCheckedAt] = useState<string | null>(
    initialSnapshot.authSecurityCheckedAt
  )
  const [systemHealthCheckedAt, setSystemHealthCheckedAt] = useState<string | null>(
    initialSnapshot.systemHealthFetchedAt
  )
  const [isQueueDiagnosticsOpen, setIsQueueDiagnosticsOpen] = useState(true)
  const [activeExecutionTab, setActiveExecutionTab] = useState<ExecutionDiagnosticTab>(() => {
    const queryTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab
    if (queryTab === "auth") return "auth"
    return "cleanup"
  })
  const [freshnessClock, setFreshnessClock] = useState<number | null>(null)

  useEffect(() => {
    const queryTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab
    if (queryTab === "queue" || queryTab === "diagnostics") {
      setIsQueueDiagnosticsOpen(true)
    } else if (queryTab === "cleanup" || queryTab === "auth") {
      setActiveExecutionTab(queryTab)
    } else if (queryTab === "recovery") {
      setActiveExecutionTab("cleanup")
    }
  }, [router.query.tab])

  const syncQueryTab = useCallback(
    (nextTab: DiagnosticTab | null) => {
      if (!router.isReady) return
      const nextQuery = { ...router.query }
      if (nextTab) {
        nextQuery.tab = nextTab
      } else {
        delete nextQuery.tab
      }
      void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
        shallow: true,
      })
    },
    [router]
  )

  const systemHealthQuery = useQuery({
    queryKey: SYSTEM_HEALTH_QUERY_KEY,
    queryFn: async (): Promise<SystemHealthPayload> =>
      apiFetch<SystemHealthPayload>("/system/api/v1/adm/health"),
    enabled: Boolean(sessionMember?.isAdmin),
    initialData: initialSnapshot.systemHealth ?? undefined,
    initialDataUpdatedAt: initialSnapshot.systemHealthFetchedAt
      ? new Date(initialSnapshot.systemHealthFetchedAt).getTime()
      : undefined,
    staleTime: HEALTH_CACHE_MS,
    gcTime: 60_000,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const initialDashboardSnapshot = initialSnapshot.dashboardSnapshot ?? undefined
  const initialDashboardSnapshotFetchedAt =
    initialSnapshot.dashboardSnapshotFetchedAt ?? initialSnapshot.systemHealthFetchedAt

  const dashboardSnapshotQuery = useQuery({
    queryKey: ["admin", "tools", "dashboard-snapshot"],
    queryFn: (): Promise<DashboardSnapshotPayload> =>
      apiFetch<DashboardSnapshotPayload>("/system/api/v1/adm/dashboard-snapshot"),
    enabled: Boolean(sessionMember?.isAdmin),
    initialData: initialDashboardSnapshot,
    initialDataUpdatedAt:
      initialDashboardSnapshot && initialDashboardSnapshotFetchedAt
        ? new Date(initialDashboardSnapshotFetchedAt).getTime()
        : undefined,
    staleTime: 30_000,
    gcTime: 120_000,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const fetchSystemHealthCached = async () =>
    queryClient.fetchQuery<SystemHealthPayload>({
      queryKey: SYSTEM_HEALTH_QUERY_KEY,
      queryFn: () => apiFetch<SystemHealthPayload>("/system/api/v1/adm/health?fresh=true"),
      staleTime: HEALTH_CACHE_MS,
    })

  const pushExecution = useCallback(
    (key: string, status: "success" | "error", payload: JsonValue, startedAt: string) => {
      const meta = ACTION_META[key] || {
        label: key,
        domain: "execution" as const,
        tone: "read" as const,
      }
      const entry: ExecutionEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        key,
        source: meta.label,
        domain: meta.domain,
        tone: meta.tone,
        status,
        startedAt,
        completedAt: new Date().toISOString(),
        summary: buildExecutionSummary(key, status, payload),
        payload,
      }

      setExecutions((prev) => [entry, ...prev].slice(0, 5))
      setSelectedExecutionId(entry.id)
    },
    []
  )

  const executeAction = useCallback(
    async <T extends JsonValue>(
      key: string,
      fn: () => Promise<T>,
      options?: {
        onSuccess?: (data: T) => void
        onError?: (message: string) => void
      }
    ) => {
      const startedAt = new Date().toISOString()

      try {
        setLoadingKey(key)
        const data = await fn()
        options?.onSuccess?.(data)
        pushExecution(key, "success", data, startedAt)
        return data
      } catch (error) {
        const message = toUserFacingMessage(error)
        options?.onError?.(message)
        pushExecution(key, "error", { error: message }, startedAt)
        return null
      } finally {
        setLoadingKey("")
      }
    },
    [pushExecution]
  )

  const fetchTaskQueueDiagnostics = useCallback(
    async (opts?: { silent?: boolean }) => {
      setIsQueueFetching(true)
      try {
        if (opts?.silent) {
          try {
            const diagnostics = await apiFetch<TaskQueueDiagnostics>("/system/api/v1/adm/tasks")
            setTaskQueueDiagnosticsError("")
            setTaskQueueDiagnostics(diagnostics)
            setTaskQueueCheckedAt(new Date().toISOString())
          } catch (error) {
            setTaskQueueDiagnosticsError(toUserFacingMessage(error))
          }
          return
        }
        await executeAction(
          "taskQueueStatus",
          () => apiFetch<TaskQueueDiagnostics>("/system/api/v1/adm/tasks"),
          {
            onSuccess: (diagnostics) => {
              setTaskQueueDiagnosticsError("")
              setTaskQueueDiagnostics(diagnostics)
              setTaskQueueCheckedAt(new Date().toISOString())
            },
            onError: (message) => {
              setTaskQueueDiagnosticsError(message)
            },
          }
        )
      } finally {
        setIsQueueFetching(false)
      }
    },
    [executeAction]
  )

  const fetchCleanupDiagnostics = useCallback(
    async (opts?: { silent?: boolean }) => {
      setIsCleanupFetching(true)
      try {
        if (opts?.silent) {
          try {
            const diagnostics = await apiFetch<UploadedFileCleanupDiagnostics>(
              "/system/api/v1/adm/storage/cleanup"
            )
            setCleanupDiagnosticsError("")
            setCleanupDiagnostics(diagnostics)
            setCleanupCheckedAt(new Date().toISOString())
          } catch (error) {
            setCleanupDiagnosticsError(toUserFacingMessage(error))
          }
          return
        }
        await executeAction(
          "cleanupStatus",
          () => apiFetch<UploadedFileCleanupDiagnostics>("/system/api/v1/adm/storage/cleanup"),
          {
            onSuccess: (diagnostics) => {
              setCleanupDiagnosticsError("")
              setCleanupDiagnostics(diagnostics)
              setCleanupCheckedAt(new Date().toISOString())
            },
            onError: (message) => {
              setCleanupDiagnosticsError(message)
            },
          }
        )
      } finally {
        setIsCleanupFetching(false)
      }
    },
    [executeAction]
  )

  const fetchAuthSecurityEvents = useCallback(
    async (opts?: { silent?: boolean }) => {
      setIsAuthFetching(true)
      try {
        if (opts?.silent) {
          try {
            const events = await apiFetch<AuthSecurityEvent[]>(
              "/system/api/v1/adm/auth/security-events?limit=30"
            )
            setAuthSecurityEventsError("")
            setAuthSecurityEvents(events)
            setAuthSecurityCheckedAt(new Date().toISOString())
          } catch (error) {
            setAuthSecurityEventsError(toUserFacingMessage(error))
          }
          return
        }
        await executeAction(
          "authSecurityEvents",
          () => apiFetch<AuthSecurityEvent[]>("/system/api/v1/adm/auth/security-events?limit=30"),
          {
            onSuccess: (events) => {
              setAuthSecurityEventsError("")
              setAuthSecurityEvents(events)
              setAuthSecurityCheckedAt(new Date().toISOString())
            },
            onError: (message) => {
              setAuthSecurityEventsError(message)
            },
          }
        )
      } finally {
        setIsAuthFetching(false)
      }
    },
    [executeAction]
  )

  const autoLoadedTabsRef = useRef({
    queue: Boolean(initialSnapshot.taskQueueDiagnostics),
    cleanup: Boolean(initialSnapshot.cleanupDiagnostics),
    auth: Boolean(initialSnapshot.authSecurityCheckedAt || initialSnapshot.authSecurityEvents.length),
  })

  useEffect(() => {
    if (!sessionMember?.isAdmin || !isQueueDiagnosticsOpen) return
    if (taskQueueDiagnostics || autoLoadedTabsRef.current.queue) return
    autoLoadedTabsRef.current.queue = true
    void fetchTaskQueueDiagnostics({ silent: true })
  }, [
    fetchTaskQueueDiagnostics,
    isQueueDiagnosticsOpen,
    sessionMember?.isAdmin,
    taskQueueDiagnostics,
  ])

  useEffect(() => {
    if (!sessionMember?.isAdmin) return
    if (activeExecutionTab === "cleanup") {
      if (cleanupDiagnostics || autoLoadedTabsRef.current.cleanup) return
      autoLoadedTabsRef.current.cleanup = true
      void fetchCleanupDiagnostics({ silent: true })
      return
    }
    if (authSecurityCheckedAt || authSecurityEvents.length > 0 || autoLoadedTabsRef.current.auth) {
      return
    }
    autoLoadedTabsRef.current.auth = true
    void fetchAuthSecurityEvents({ silent: true })
  }, [
    activeExecutionTab,
    authSecurityCheckedAt,
    authSecurityEvents.length,
    cleanupDiagnostics,
    fetchAuthSecurityEvents,
    fetchCleanupDiagnostics,
    sessionMember?.isAdmin,
  ])

  useEffect(() => {
    if (typeof window === "undefined") return
    const syncClock = () => setFreshnessClock(Date.now())
    syncClock()
    const interval = window.setInterval(syncClock, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (systemHealthCheckedAt || !systemHealthQuery.data) return
    setSystemHealthCheckedAt(new Date().toISOString())
  }, [systemHealthCheckedAt, systemHealthQuery.data])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const savedFilter = window.sessionStorage.getItem(RESULTS_FILTER_STORAGE_KEY)
      if (!savedFilter || !isExecutionResultFilter(savedFilter)) return
      setResultsFilter(savedFilter)
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.sessionStorage.setItem(RESULTS_FILTER_STORAGE_KEY, resultsFilter)
    } catch {}
  }, [resultsFilter])

  const filteredExecutions = useMemo(
    () =>
      executions.filter((entry) => {
        if (resultsFilter === "all") return true
        if (resultsFilter === "success") return entry.status === "success"
        if (resultsFilter === "error") return entry.status === "error"
        return getFreshnessMeta(entry.completedAt, freshnessClock).tone === "stale"
      }),
    [executions, freshnessClock, resultsFilter]
  )

  const resultFilterCounts = useMemo(() => {
    let success = 0
    let error = 0
    let stale = 0
    for (const entry of executions) {
      if (entry.status === "success") success += 1
      else if (entry.status === "error") error += 1
      if (getFreshnessMeta(entry.completedAt, freshnessClock).tone === "stale") stale += 1
    }
    return { all: executions.length, success, error, stale }
  }, [executions, freshnessClock])

  const selectedExecution = useMemo(() => {
    if (!filteredExecutions.length) return null
    return (
      filteredExecutions.find((entry) => entry.id === selectedExecutionId) ??
      filteredExecutions[0]
    )
  }, [filteredExecutions, selectedExecutionId])

  const rawSystemHealthStatus = systemHealthQuery.data?.status ?? null
  const hasSystemHealthStatus = !isOperationalStatusMissing(rawSystemHealthStatus)
  const isSystemHealthConnectionUnavailable =
    systemHealthQuery.isError && !hasSystemHealthStatus
  const systemHealthStatus = isSystemHealthConnectionUnavailable
    ? CONNECTION_UNAVAILABLE_STATUS_LABEL
    : normalizeOperationalStatusLabel(systemHealthQuery.data?.status)

  const taskQueueFreshness = getFreshnessMeta(taskQueueCheckedAt, freshnessClock)
  const cleanupFreshness = getFreshnessMeta(cleanupCheckedAt, freshnessClock)
  const authFreshness = getFreshnessMeta(authSecurityCheckedAt, freshnessClock)
  const systemHealthFreshness = getFreshnessMeta(systemHealthCheckedAt, freshnessClock)

  const isQueueLoading = isQueueFetching || loadingKey === "taskQueueStatus"
  const isCleanupLoading = isCleanupFetching || loadingKey === "cleanupStatus"
  const isAuthLoading = isAuthFetching || loadingKey === "authSecurityEvents"
  const hasTaskQueueDiagnostics = Boolean(taskQueueDiagnostics)
  const hasCleanupDiagnostics = Boolean(cleanupDiagnostics)
  const hasAuthDiagnostics =
    Boolean(authSecurityCheckedAt) || Boolean(authSecurityEvents.length)

  const handleSelectQueueTab = useCallback(() => {
    setIsQueueDiagnosticsOpen(true)
    syncQueryTab("queue")
    if (!taskQueueDiagnostics && !isQueueLoading) {
      void fetchTaskQueueDiagnostics()
    }
  }, [fetchTaskQueueDiagnostics, isQueueLoading, syncQueryTab, taskQueueDiagnostics])

  const handleToggleQueueDiagnosticsOpen = useCallback(() => {
    setIsQueueDiagnosticsOpen((prev) => !prev)
  }, [])

  const handleSelectExecutionTab = useCallback(
    (nextTab: ExecutionDiagnosticTab) => {
      setActiveExecutionTab(nextTab)
      syncQueryTab(nextTab)
      if (nextTab === "cleanup" && !cleanupDiagnostics && !isCleanupLoading) {
        void fetchCleanupDiagnostics()
      } else if (nextTab === "auth" && !hasAuthDiagnostics && !isAuthLoading) {
        void fetchAuthSecurityEvents()
      }
    },
    [
      cleanupDiagnostics,
      fetchAuthSecurityEvents,
      fetchCleanupDiagnostics,
      hasAuthDiagnostics,
      isAuthLoading,
      isCleanupLoading,
      syncQueryTab,
    ]
  )

  const queueStatusLabel = !hasTaskQueueDiagnostics
    ? getDiagnosticFallbackStatusLabel(isQueueLoading, taskQueueDiagnosticsError)
    : taskQueueDiagnostics?.staleProcessingCount &&
        taskQueueDiagnostics.staleProcessingCount > 0
      ? "오류"
      : taskQueueDiagnostics?.failedCount && taskQueueDiagnostics.failedCount > 0
        ? CHECK_REQUIRED_STATUS_LABEL
        : taskQueueDiagnostics
          ? "정상"
          : DATA_EMPTY_STATUS_LABEL

  const recentCheckedLabel = systemHealthCheckedAt
    ? formatInstant(systemHealthCheckedAt)
    : "-"

  const overviewStatusLabel = isSystemHealthConnectionUnavailable
    ? CONNECTION_UNAVAILABLE_STATUS_LABEL
    : hasSystemHealthStatus && rawSystemHealthStatus !== "UP"
      ? "오류"
      : !hasSystemHealthStatus
        ? DATA_EMPTY_STATUS_LABEL
        : "정상"

  const focusSection = useCallback(
    (section: SectionKey, tab?: DiagnosticTab) => {
      if (tab === "queue") {
        handleSelectQueueTab()
      } else if (tab === "cleanup" || tab === "auth") {
        handleSelectExecutionTab(tab)
      }
      if (typeof window !== "undefined") {
        document
          .getElementById(SECTION_IDS[section])
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    },
    [handleSelectExecutionTab, handleSelectQueueTab]
  )

  if (!sessionMember) return null

  return (
    <AdminToolsWorkspaceSections
      activeExecutionTab={activeExecutionTab}
      authFreshness={authFreshness}
      authSecurityEvents={authSecurityEvents}
      authSecurityEventsError={authSecurityEventsError}
      cleanupDiagnostics={cleanupDiagnostics}
      cleanupDiagnosticsError={cleanupDiagnosticsError}
      cleanupFreshness={cleanupFreshness}
      dashboardSnapshot={dashboardSnapshotQuery.data ?? initialDashboardSnapshot ?? null}
      executeAction={executeAction}
      executions={executions}
      fetchAuthSecurityEvents={() => fetchAuthSecurityEvents()}
      fetchCleanupDiagnostics={() => fetchCleanupDiagnostics()}
      fetchSystemHealthCached={fetchSystemHealthCached}
      fetchTaskQueueDiagnostics={() => fetchTaskQueueDiagnostics()}
      filteredExecutions={filteredExecutions}
      focusSection={focusSection}
      freshnessClock={freshnessClock}
      hasAuthDiagnostics={hasAuthDiagnostics}
      hasCleanupDiagnostics={hasCleanupDiagnostics}
      hasTaskQueueDiagnostics={hasTaskQueueDiagnostics}
      initialProfileSnapshot={initialProfileSnapshot}
      isAuthLoading={isAuthLoading}
      isCleanupLoading={isCleanupLoading}
      isQueueDiagnosticsOpen={isQueueDiagnosticsOpen}
      isQueueLoading={isQueueLoading}
      loadingKey={loadingKey}
      onSelectExecutionTab={handleSelectExecutionTab}
      onSelectQueueTab={handleSelectQueueTab}
      onToggleQueueDiagnosticsOpen={handleToggleQueueDiagnosticsOpen}
      overviewStatusLabel={overviewStatusLabel}
      queueStatusLabel={queueStatusLabel}
      recentCheckedLabel={recentCheckedLabel}
      resultFilterCounts={resultFilterCounts}
      resultsFilter={resultsFilter}
      selectedExecution={selectedExecution}
      sessionMember={sessionMember}
      setResultsFilter={setResultsFilter}
      setSelectedExecutionId={setSelectedExecutionId}
      setSystemHealthCheckedAt={setSystemHealthCheckedAt}
      systemHealthFreshness={systemHealthFreshness}
      systemHealthQuery={systemHealthQuery}
      systemHealthStatus={systemHealthStatus}
      taskQueueDiagnostics={taskQueueDiagnostics}
      taskQueueDiagnosticsError={taskQueueDiagnosticsError}
      taskQueueFreshness={taskQueueFreshness}
    />
  )
}

export default AdminToolsPage
