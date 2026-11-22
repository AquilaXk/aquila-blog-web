// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/QueueCard.tsx & StatusMenu.tsx (MIT)
import {
  ActionRow,
  CalmMessage,
  CompactList,
  CompactListItem,
  DetailsPanel,
  DetailsSummary,
  DiagnosticPanel,
  FreshnessBadge,
  InlineNotice,
  MetricCard,
  MetricGrid,
  QuietButton,
  SectionHeading,
  SectionTitleBlock,
  SubtleMetaGrid,
  SubtleMetaItem,
  WorkspaceSection,
} from "src/routes/Admin/AdminToolsWorkspace.styles"
import {
  SECTION_IDS,
  formatAge,
  formatInstant,
  formatRetryPolicy,
  getFreshnessMeta,
} from "src/routes/Admin/AdminToolsWorkspaceModel"
import type { TaskQueueDiagnostics } from "src/routes/Admin/AdminToolsWorkspacePageState"
import { AdminTaskDlqReplaySection } from "src/routes/Admin/AdminTaskDlqReplaySection"
import { AdminSearchRuntimeControlSection } from "src/routes/Admin/AdminSearchRuntimeControlSection"

export type AdminToolsDiagnosticsSectionProps = {
  fetchTaskQueueDiagnostics: () => Promise<void>
  hasTaskQueueDiagnostics: boolean
  isBusy: boolean
  isQueueDiagnosticsOpen: boolean
  isQueueLoading: boolean
  onSelectQueueTab: () => void
  onToggleQueueDiagnosticsOpen: () => void
  taskQueueDiagnostics: TaskQueueDiagnostics | null
  taskQueueDiagnosticsError: string
  taskQueueFreshness: ReturnType<typeof getFreshnessMeta>
}

export const AdminToolsDiagnosticsSection = (props: AdminToolsDiagnosticsSectionProps) => {
  const {
    fetchTaskQueueDiagnostics,
    hasTaskQueueDiagnostics,
    isBusy,
    isQueueDiagnosticsOpen,
    isQueueLoading,
    onToggleQueueDiagnosticsOpen,
    taskQueueDiagnostics,
    taskQueueDiagnosticsError,
    taskQueueFreshness,
  } = props

  const taskTypes = Array.isArray(taskQueueDiagnostics?.taskTypes)
    ? taskQueueDiagnostics.taskTypes
    : []
  const recentFailures = Array.isArray(taskQueueDiagnostics?.recentFailures)
    ? taskQueueDiagnostics.recentFailures
    : []

  return (
    <WorkspaceSection id={SECTION_IDS.diagnostics} data-ops-section="diagnostics">
      <SectionHeading>
        <SectionTitleBlock>
          <h2>작업 큐</h2>
        </SectionTitleBlock>
        <ActionRow>
          {hasTaskQueueDiagnostics ? (
            <FreshnessBadge data-tone={taskQueueFreshness.tone}>
              {taskQueueFreshness.label}
            </FreshnessBadge>
          ) : null}
          <QuietButton
            type="button"
            disabled={isBusy || isQueueLoading}
            onClick={() => void fetchTaskQueueDiagnostics()}
          >
            다시 확인
          </QuietButton>
          <QuietButton
            type="button"
            aria-expanded={isQueueDiagnosticsOpen}
            aria-controls="tabpanel-queue"
            onClick={onToggleQueueDiagnosticsOpen}
          >
            {isQueueDiagnosticsOpen ? "진단 접기" : "진단 펼치기"}
          </QuietButton>
        </ActionRow>
      </SectionHeading>

      {isQueueDiagnosticsOpen ? (
        <DiagnosticPanel
          id="tabpanel-queue"
          aria-label="작업 큐 진단"
        >
          {!!taskQueueDiagnosticsError && (
            <InlineNotice data-tone="danger">{taskQueueDiagnosticsError}</InlineNotice>
          )}

          {taskQueueDiagnostics ? (
            <>
              <MetricGrid>
                <MetricCard>
                  <small>대기 중</small>
                  <strong>{taskQueueDiagnostics.readyPendingCount ?? 0}</strong>
                </MetricCard>
                <MetricCard>
                  <small>처리 중</small>
                  <strong>{taskQueueDiagnostics.processingCount ?? 0}</strong>
                </MetricCard>
                <MetricCard>
                  <small>최근 실패</small>
                  <strong>{taskQueueDiagnostics.failedCount ?? 0}</strong>
                </MetricCard>
                <MetricCard>
                  <small>지연 작업</small>
                  <strong>{taskQueueDiagnostics.staleProcessingCount ?? 0}</strong>
                </MetricCard>
              </MetricGrid>

              <SubtleMetaGrid>
                <SubtleMetaItem>
                  <span>가장 오래 대기 중</span>
                  <strong>
                    {formatAge(taskQueueDiagnostics.oldestReadyPendingAgeSeconds ?? null)}
                  </strong>
                </SubtleMetaItem>
                <SubtleMetaItem>
                  <span>가장 오래 처리 중</span>
                  <strong>
                    {formatAge(taskQueueDiagnostics.oldestProcessingAgeSeconds ?? null)}
                  </strong>
                </SubtleMetaItem>
                <SubtleMetaItem>
                  <span>처리 제한 시간</span>
                  <strong>{taskQueueDiagnostics.processingTimeoutSeconds ?? 0}초</strong>
                </SubtleMetaItem>
                <SubtleMetaItem>
                  <span>완료 작업</span>
                  <strong>{taskQueueDiagnostics.completedCount ?? 0}</strong>
                </SubtleMetaItem>
              </SubtleMetaGrid>
            </>
          ) : (
            <CalmMessage>{isQueueLoading ? "로딩 중" : "없음"}</CalmMessage>
          )}

          {taskTypes.length > 0 && (
            <DetailsPanel>
              <DetailsSummary>
                <span>작업 유형별 상태</span>
                <small>{taskTypes.length}개</small>
              </DetailsSummary>
              <CompactList>
                {taskTypes.map((taskType) => (
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

          {recentFailures.length > 0 && (
            <DetailsPanel>
              <DetailsSummary>
                <span>최근 실패 작업</span>
                <small>{recentFailures.length}건</small>
              </DetailsSummary>
              <CompactList>
                {recentFailures.map((sample) => (
                  <CompactListItem key={`failed-${sample.taskId}`}>
                    <div>
                      <strong>{sample.label}</strong>
                      <span>
                        #{sample.taskId} · {sample.taskType} · retry {sample.retryCount}/
                        {sample.maxRetries}
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
            taskTypeSuggestions={taskTypes.map((taskType) => taskType.taskType)}
            onTerminalReceipt={() => void fetchTaskQueueDiagnostics()}
          />
          <AdminSearchRuntimeControlSection disabled={isBusy} />
        </DiagnosticPanel>
      ) : null}
    </WorkspaceSection>
  )
}
