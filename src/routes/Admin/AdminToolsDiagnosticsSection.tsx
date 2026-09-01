import {
  CalmMessage,
  CompactList,
  CompactListItem,
  DetailsPanel,
  DetailsSummary,
  DiagnosticHeader,
  DiagnosticPanel,
  DiagnosticsTabButton,
  DiagnosticsTabs,
  FreshnessBadge,
  InlineNotice,
  MetricCard,
  MetricGrid,
  QuietButton,
  SectionHeading,
  SectionTitleBlock,
  SubtleMetaGrid,
  SubtleMetaItem,
  ActionRow,
  WorkspaceSection,
} from "src/routes/Admin/AdminToolsWorkspace.styles"
import {
  SECTION_IDS,
  formatAge,
  formatInstant,
  formatRetryPolicy,
} from "src/routes/Admin/AdminToolsWorkspaceModel"
import { AdminTaskDlqReplaySection } from "src/routes/Admin/AdminTaskDlqReplaySection"
import { AdminSearchRuntimeControlSection } from "src/routes/Admin/AdminSearchRuntimeControlSection"

export const AdminToolsDiagnosticsSection = (props: Record<string, any>) => {
  const {
    activeDiagnosticTab,
    fetchTaskQueueDiagnostics,
    hasTaskQueueDiagnostics,
    isBusy,
    isQueueLoading,
    setActiveDiagnosticTab,
    taskQueueDiagnostics,
    taskQueueDiagnosticsError,
    taskQueueFreshness,
  } = props

  return (
    <WorkspaceSection id={SECTION_IDS.diagnostics} data-ops-section="diagnostics">
      <SectionHeading>
        <SectionTitleBlock>
          <h2>작업 큐</h2>
        </SectionTitleBlock>
      </SectionHeading>

      <DiagnosticsTabs role="tablist" aria-label="작업 큐 도메인">
        {([
          { key: "queue", label: "작업 큐 진단" },
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

      {activeDiagnosticTab === "queue" ? (
        <DiagnosticPanel>
          <DiagnosticHeader>
            <div>
              <strong>작업 큐 진단</strong>
            </div>
            <ActionRow>
              {hasTaskQueueDiagnostics ? <FreshnessBadge data-tone={taskQueueFreshness.tone}>{taskQueueFreshness.label}</FreshnessBadge> : null}
              <QuietButton type="button" disabled={isBusy} onClick={() => void fetchTaskQueueDiagnostics()}>
                다시 확인
              </QuietButton>
            </ActionRow>
          </DiagnosticHeader>

          {!!taskQueueDiagnosticsError && <InlineNotice data-tone="danger">{taskQueueDiagnosticsError}</InlineNotice>}

          {taskQueueDiagnostics ? (
            <>
              <MetricGrid>
                <MetricCard>
                  <small>ready</small>
                  <strong>{taskQueueDiagnostics.readyPendingCount}</strong>
                </MetricCard>
                <MetricCard>
                  <small>processing</small>
                  <strong>{taskQueueDiagnostics.processingCount}</strong>
                </MetricCard>
                <MetricCard>
                  <small>최근 실패</small>
                  <strong>{taskQueueDiagnostics.failedCount}</strong>
                </MetricCard>
                <MetricCard>
                  <small>stale</small>
                  <strong>{taskQueueDiagnostics.staleProcessingCount}</strong>
                </MetricCard>
              </MetricGrid>

              <SubtleMetaGrid>
                <SubtleMetaItem>
                  <span>가장 오래 대기 중</span>
                  <strong>{formatAge(taskQueueDiagnostics.oldestReadyPendingAgeSeconds)}</strong>
                </SubtleMetaItem>
                <SubtleMetaItem>
                  <span>가장 오래 처리 중</span>
                  <strong>{formatAge(taskQueueDiagnostics.oldestProcessingAgeSeconds)}</strong>
                </SubtleMetaItem>
                <SubtleMetaItem>
                  <span>processing timeout</span>
                  <strong>{taskQueueDiagnostics.processingTimeoutSeconds}초</strong>
                </SubtleMetaItem>
                <SubtleMetaItem>
                  <span>완료 작업</span>
                  <strong>{taskQueueDiagnostics.completedCount}</strong>
                </SubtleMetaItem>
              </SubtleMetaGrid>
            </>
          ) : (
            <CalmMessage>{isQueueLoading ? "로딩 중" : "없음"}</CalmMessage>
          )}

          {!!taskQueueDiagnostics?.taskTypes.length && (
            <DetailsPanel>
              <DetailsSummary>
                <span>작업 유형별 상태</span>
                <small>{taskQueueDiagnostics.taskTypes.length}개</small>
              </DetailsSummary>
              <CompactList>
                {taskQueueDiagnostics.taskTypes.map((taskType: any) => (
                  <CompactListItem key={taskType.taskType}>
                    <div>
                      <strong>{taskType.label}</strong>
                      <span>{taskType.taskType}</span>
                    </div>
                    <div>
                      <small>ready {taskType.readyPendingCount}</small>
                      <small>failed {taskType.failedCount}</small>
                      <small>{formatRetryPolicy(taskType.retryPolicy)}</small>
                    </div>
                  </CompactListItem>
                ))}
              </CompactList>
            </DetailsPanel>
          )}

          {!!taskQueueDiagnostics?.recentFailures.length && (
            <DetailsPanel>
              <DetailsSummary>
                <span>최근 실패 작업</span>
                <small>{taskQueueDiagnostics.recentFailures.length}건</small>
              </DetailsSummary>
              <CompactList>
                {taskQueueDiagnostics.recentFailures.map((sample: any) => (
                  <CompactListItem key={`failed-${sample.taskId}`}>
                    <div>
                      <strong>{sample.label}</strong>
                      <span>
                        #{sample.taskId} · {sample.taskType} · retry {sample.retryCount}/{sample.maxRetries}
                      </span>
                    </div>
                    <div>
                      <small>{formatInstant(sample.modifiedAt)}</small>
                      <small>{sample.errorMessage || "오류 메시지 없음"}</small>
                    </div>
                  </CompactListItem>
                ))}
              </CompactList>
            </DetailsPanel>
          )}

          <AdminTaskDlqReplaySection
            disabled={isBusy}
            taskTypeSuggestions={taskQueueDiagnostics?.taskTypes.map((taskType: any) => taskType.taskType) || []}
            onTerminalReceipt={() => void fetchTaskQueueDiagnostics()}
          />
          <AdminSearchRuntimeControlSection disabled={isBusy} />
        </DiagnosticPanel>
      ) : null}
    </WorkspaceSection>
  )
}
