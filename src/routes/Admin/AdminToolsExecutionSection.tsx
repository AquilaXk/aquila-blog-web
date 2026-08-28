import { apiFetch } from "src/apis/backend/client"
import AdminToolsExecutionRail from "src/routes/Admin/AdminToolsExecutionRail"
import {
  ActionList,
  ActionRow,
  ActionRowButton,
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
  SandboxHeader,
  SandboxSection,
  SectionHeading,
  SectionTitleBlock,
  WorkspaceSection,
} from "src/routes/Admin/AdminToolsWorkspace.styles"
import { SECTION_IDS, formatInstant } from "src/routes/Admin/AdminToolsWorkspaceModel"

export const AdminToolsExecutionSection = (props: Record<string, any>) => {
  const {
    activeDiagnosticTab,
    advancedToolsOpen,
    authFreshness,
    authSecurityEvents,
    authSecurityEventsError,
    cleanupDiagnostics,
    cleanupDiagnosticsError,
    cleanupFreshness,
    executeAction,
    fetchAuthSecurityEvents,
    fetchCleanupDiagnostics,
    fetchSignupMailDiagnostics,
    fetchSystemHealthCached,
    hasAuthDiagnostics,
    hasCleanupDiagnostics,
    isAuthLoading,
    isBusy,
    isCleanupLoading,
    mailTestNotice,
    sendSignupTestMail,
    setActiveDiagnosticTab,
    setAdvancedToolsOpen,
    setSystemHealthCheckedAt,
    setTestEmail,
    testEmail,
    focusSection,
  } = props

  return (
    <WorkspaceSection id={SECTION_IDS.execution} data-ops-section="execution">
      <SectionHeading>
        <SectionTitleBlock>
          <h2>정리와 보안</h2>
        </SectionTitleBlock>
      </SectionHeading>

      <ExecutionLayout>
        <ExecutionMain>
          <DiagnosticsTabs role="tablist" aria-label="정리와 보안 도메인">
            {([
              { key: "cleanup", label: "파일 정리 진단" },
              { key: "auth", label: "인증 보안 기록" },
            ] as const).map((tab) => (
              <DiagnosticsTabButton
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeDiagnosticTab === tab.key}
                data-active={activeDiagnosticTab === tab.key}
                onClick={() => setActiveDiagnosticTab(tab.key)}
              >
                {tab.label}
              </DiagnosticsTabButton>
            ))}
          </DiagnosticsTabs>

          {activeDiagnosticTab === "cleanup" ? (
            <DiagnosticPanel>
              <DiagnosticHeader>
                <div>
                  <strong>파일 정리 진단</strong>
                </div>
                <ActionRow>
                  {hasCleanupDiagnostics ? <FreshnessBadge data-tone={cleanupFreshness.tone}>{cleanupFreshness.label}</FreshnessBadge> : null}
                  <QuietButton type="button" disabled={isBusy} onClick={() => void fetchCleanupDiagnostics()}>
                    다시 확인
                  </QuietButton>
                </ActionRow>
              </DiagnosticHeader>

              {!!cleanupDiagnosticsError && <InlineNotice data-tone="danger">{cleanupDiagnosticsError}</InlineNotice>}
              {cleanupDiagnostics ? (
                <>
                  <MetricGrid>
                    <MetricCard>
                      <small>TEMP</small>
                      <strong>{cleanupDiagnostics.tempCount}</strong>
                    </MetricCard>
                    <MetricCard>
                      <small>PENDING_DELETE</small>
                      <strong>{cleanupDiagnostics.pendingDeleteCount}</strong>
                    </MetricCard>
                    <MetricCard>
                      <small>purge 후보</small>
                      <strong>{cleanupDiagnostics.eligibleForPurgeCount}</strong>
                    </MetricCard>
                    <MetricCard>
                      <small>threshold</small>
                      <strong>{cleanupDiagnostics.cleanupSafetyThreshold}</strong>
                    </MetricCard>
                  </MetricGrid>

                  {!!cleanupDiagnostics.sampleEligibleObjectKeys.length && (
                    <DetailsPanel>
                      <DetailsSummary>
                        <span>샘플 object key</span>
                        <small>{cleanupDiagnostics.sampleEligibleObjectKeys.length}개</small>
                      </DetailsSummary>
                      <CompactCodeList>
                        {cleanupDiagnostics.sampleEligibleObjectKeys.map((key: string) => (
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

          {activeDiagnosticTab === "auth" ? (
            <DiagnosticPanel>
              <DiagnosticHeader>
                <div>
                  <strong>인증 보안 기록</strong>
                </div>
                <ActionRow>
                  {hasAuthDiagnostics ? <FreshnessBadge data-tone={authFreshness.tone}>{authFreshness.label}</FreshnessBadge> : null}
                  <QuietButton type="button" disabled={isBusy} onClick={() => void fetchAuthSecurityEvents()}>
                    다시 확인
                  </QuietButton>
                </ActionRow>
              </DiagnosticHeader>

              {!!authSecurityEventsError && <InlineNotice data-tone="danger">{authSecurityEventsError}</InlineNotice>}

              {!hasAuthDiagnostics ? (
                <CalmMessage>{isAuthLoading ? "로딩 중" : "없음"}</CalmMessage>
              ) : authSecurityEvents.length > 0 ? (
                <CompactList>
                  {authSecurityEvents.map((event: any) => (
                    <CompactListItem key={event.id}>
                      <div>
                        <strong>{event.eventType}</strong>
                        <span>
                          memberId {event.memberId ?? "-"} · {event.loginIdentifier || "식별자 없음"}
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

          <DetailsPanel open={advancedToolsOpen}>
            <DetailsSummary onClick={(event) => {
              event.preventDefault()
              setAdvancedToolsOpen((prev: boolean) => !prev)
            }}>
              <span>고급 도구</span>
              <small>{advancedToolsOpen ? "접기" : "열기"}</small>
            </DetailsSummary>
            {advancedToolsOpen ? (
              <ActionList>
                <ActionRowButton type="button" disabled={isBusy} onClick={() => void fetchSignupMailDiagnostics(true)}>
                  <span>SMTP 연결 확인</span>
                </ActionRowButton>
              </ActionList>
            ) : null}
          </DetailsPanel>

        </ExecutionMain>

        <AdminToolsExecutionRail
          isBusy={isBusy}
          mailTestNotice={mailTestNotice}
          onFocusSection={focusSection}
          onPostCountCheck={() => void executeAction("admPostCount", () => apiFetch("/post/api/v1/adm/posts/count"))}
          onSendSignupTestMail={() => void sendSignupTestMail()}
          onSystemHealthCheck={() =>
            void executeAction("systemHealth", () => fetchSystemHealthCached(), {
              onSuccess: () => {
                setSystemHealthCheckedAt(new Date().toISOString())
              },
            })
          }
          onTestEmailChange={setTestEmail}
          testEmail={testEmail}
        />
      </ExecutionLayout>
    </WorkspaceSection>
  )
}
