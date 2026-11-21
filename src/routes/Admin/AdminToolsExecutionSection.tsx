// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/QueueCard.tsx & StatusMenu.tsx (MIT)
import { apiFetch } from "src/apis/backend/client"
import AdminToolsExecutionRail from "src/routes/Admin/AdminToolsExecutionRail"
import {
  ActionRow,
  CalmMessage,
  CompactCodeList,
  CompactList,
  CompactListItem,
  DetailsPanel,
  DetailsSummary,
  DiagnosticHeader,
  DiagnosticPanel,
  DiagnosticsTabButton,
  DiagnosticsTabs,
  ExecutionLayout,
  ExecutionMain,
  FreshnessBadge,
  InlineNotice,
  MetricCard,
  MetricGrid,
  QuietButton,
  SectionHeading,
  SectionTitleBlock,
  WorkspaceSection,
} from "src/routes/Admin/AdminToolsWorkspace.styles"
import {
  SECTION_IDS,
  formatInstant,
  getFreshnessMeta,
  type DiagnosticTab,
  type JsonValue,
  type SectionKey,
  type SystemHealthPayload,
} from "src/routes/Admin/AdminToolsWorkspaceModel"
import { handleTablistKeyDown } from "./adminTablistKeyboard"
import type { ExecutionDiagnosticTab } from "./AdminToolsWorkspacePage"
import type {
  AuthSecurityEvent,
  UploadedFileCleanupDiagnostics,
} from "src/routes/Admin/AdminToolsWorkspacePageState"

export type AdminToolsExecutionSectionProps = {
  activeExecutionTab: ExecutionDiagnosticTab
  authFreshness: ReturnType<typeof getFreshnessMeta>
  authSecurityEvents: AuthSecurityEvent[]
  authSecurityEventsError: string
  cleanupDiagnostics: UploadedFileCleanupDiagnostics | null
  cleanupDiagnosticsError: string
  cleanupFreshness: ReturnType<typeof getFreshnessMeta>
  executeAction: <T extends JsonValue>(
    key: string,
    fn: () => Promise<T>,
    options?: {
      onSuccess?: (data: T) => void
      onError?: (message: string) => void
    }
  ) => Promise<T | null>
  fetchAuthSecurityEvents: () => Promise<void>
  fetchCleanupDiagnostics: () => Promise<void>
  fetchSystemHealthCached: () => Promise<SystemHealthPayload>
  focusSection: (section: SectionKey, tab?: DiagnosticTab) => void
  hasAuthDiagnostics: boolean
  hasCleanupDiagnostics: boolean
  isAuthLoading: boolean
  isBusy: boolean
  isCleanupLoading: boolean
  onSelectExecutionTab: (tab: ExecutionDiagnosticTab) => void
  setSystemHealthCheckedAt: (value: string | null) => void
}

export const AdminToolsExecutionSection = (props: AdminToolsExecutionSectionProps) => {
  const {
    activeExecutionTab,
    authFreshness,
    authSecurityEvents,
    authSecurityEventsError,
    cleanupDiagnostics,
    cleanupDiagnosticsError,
    cleanupFreshness,
    executeAction,
    fetchAuthSecurityEvents,
    fetchCleanupDiagnostics,
    fetchSystemHealthCached,
    focusSection,
    hasAuthDiagnostics,
    hasCleanupDiagnostics,
    isAuthLoading,
    isBusy,
    isCleanupLoading,
    onSelectExecutionTab,
    setSystemHealthCheckedAt,
  } = props

  const sampleEligibleObjectKeys = Array.isArray(cleanupDiagnostics?.sampleEligibleObjectKeys)
    ? cleanupDiagnostics.sampleEligibleObjectKeys
    : []
  const safeAuthSecurityEvents = Array.isArray(authSecurityEvents) ? authSecurityEvents : []

  return (
    <WorkspaceSection id={SECTION_IDS.execution} data-ops-section="execution">
      <SectionHeading>
        <SectionTitleBlock>
          <h2>정리와 보안</h2>
        </SectionTitleBlock>
      </SectionHeading>

      <ExecutionLayout>
        <ExecutionMain>
          <DiagnosticsTabs
            role="tablist"
            aria-label="정리와 보안 도메인"
            onKeyDown={(event) =>
              handleTablistKeyDown(
                event,
                ["cleanup", "auth"] as const,
                activeExecutionTab,
                (tab) => onSelectExecutionTab(tab)
              )
            }
          >
            {(
              [
                { key: "cleanup", label: "파일 정리 진단" },
                { key: "auth", label: "인증 보안 기록" },
              ] as const
            ).map((tab) => (
              <DiagnosticsTabButton
                key={tab.key}
                id={`tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={activeExecutionTab === tab.key}
                aria-controls={`tabpanel-${tab.key}`}
                data-active={activeExecutionTab === tab.key}
                onClick={() => onSelectExecutionTab(tab.key)}
              >
                {tab.label}
              </DiagnosticsTabButton>
            ))}
          </DiagnosticsTabs>

          {activeExecutionTab === "cleanup" ? (
            <DiagnosticPanel
              role="tabpanel"
              id="tabpanel-cleanup"
              aria-labelledby="tab-cleanup"
            >
              <DiagnosticHeader>
                <div>
                  <strong>파일 정리 진단</strong>
                </div>
                <ActionRow>
                  {hasCleanupDiagnostics ? (
                    <FreshnessBadge data-tone={cleanupFreshness.tone}>
                      {cleanupFreshness.label}
                    </FreshnessBadge>
                  ) : null}
                  <QuietButton
                    type="button"
                    disabled={isBusy || isCleanupLoading}
                    onClick={() => void fetchCleanupDiagnostics()}
                  >
                    다시 확인
                  </QuietButton>
                </ActionRow>
              </DiagnosticHeader>

              {!!cleanupDiagnosticsError && (
                <InlineNotice data-tone="danger">{cleanupDiagnosticsError}</InlineNotice>
              )}
              {cleanupDiagnostics ? (
                <>
                  <MetricGrid>
                    <MetricCard>
                      <small>TEMP</small>
                      <strong>{cleanupDiagnostics.tempCount ?? 0}</strong>
                    </MetricCard>
                    <MetricCard>
                      <small>PENDING_DELETE</small>
                      <strong>{cleanupDiagnostics.pendingDeleteCount ?? 0}</strong>
                    </MetricCard>
                    <MetricCard>
                      <small>purge 후보</small>
                      <strong>{cleanupDiagnostics.eligibleForPurgeCount ?? 0}</strong>
                    </MetricCard>
                    <MetricCard>
                      <small>threshold</small>
                      <strong>{cleanupDiagnostics.cleanupSafetyThreshold ?? 0}</strong>
                    </MetricCard>
                  </MetricGrid>

                  {sampleEligibleObjectKeys.length > 0 && (
                    <DetailsPanel>
                      <DetailsSummary>
                        <span>샘플 object key</span>
                        <small>{sampleEligibleObjectKeys.length}개</small>
                      </DetailsSummary>
                      <CompactCodeList>
                        {sampleEligibleObjectKeys.map((key: string) => (
                          <code key={key}>{key}</code>
                        ))}
                      </CompactCodeList>
                    </DetailsPanel>
                  )}
                </>
              ) : (
                <CalmMessage>{isCleanupLoading ? "로딩 중" : "없음"}</CalmMessage>
              )}
            </DiagnosticPanel>
          ) : null}

          {activeExecutionTab === "auth" ? (
            <DiagnosticPanel
              role="tabpanel"
              id="tabpanel-auth"
              aria-labelledby="tab-auth"
            >
              <DiagnosticHeader>
                <div>
                  <strong>인증 보안 기록</strong>
                </div>
                <ActionRow>
                  {hasAuthDiagnostics ? (
                    <FreshnessBadge data-tone={authFreshness.tone}>
                      {authFreshness.label}
                    </FreshnessBadge>
                  ) : null}
                  <QuietButton
                    type="button"
                    disabled={isBusy || isAuthLoading}
                    onClick={() => void fetchAuthSecurityEvents()}
                  >
                    다시 확인
                  </QuietButton>
                </ActionRow>
              </DiagnosticHeader>

              {!!authSecurityEventsError && (
                <InlineNotice data-tone="danger">{authSecurityEventsError}</InlineNotice>
              )}

              {!hasAuthDiagnostics ? (
                <CalmMessage>{isAuthLoading ? "로딩 중" : "없음"}</CalmMessage>
              ) : safeAuthSecurityEvents.length > 0 ? (
                <CompactList>
                  {safeAuthSecurityEvents.map((event) => (
                    <CompactListItem key={event.id}>
                      <div>
                        <strong>{event.eventType}</strong>
                        <span>
                          memberId {event.memberId ?? "-"} ·{" "}
                          {event.loginIdentifier || "식별자 없음"}
                        </span>
                      </div>
                      <div>
                        <small>{formatInstant(event.createdAt)}</small>
                        <small>{event.reason || event.requestPath || "사유 없음"}</small>
                      </div>
                    </CompactListItem>
                  ))}
                </CompactList>
              ) : authSecurityEventsError ? null : (
                <CalmMessage>없음</CalmMessage>
              )}
            </DiagnosticPanel>
          ) : null}
        </ExecutionMain>

        <AdminToolsExecutionRail
          isBusy={isBusy}
          onFocusSection={focusSection}
          onPostCountCheck={() =>
            void executeAction("admPostCount", () => apiFetch("/post/api/v1/adm/posts/count"))
          }
          onSystemHealthCheck={() =>
            void executeAction("systemHealth", () => fetchSystemHealthCached(), {
              onSuccess: () => {
                setSystemHealthCheckedAt(new Date().toISOString())
              },
            })
          }
        />
      </ExecutionLayout>
    </WorkspaceSection>
  )
}
