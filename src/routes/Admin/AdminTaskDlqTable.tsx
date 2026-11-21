// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/QueueCard.tsx & QueueStats.tsx (MIT)
import styled from "@emotion/styled"
import { useMemo, useRef } from "react"
import type { TaskDlqItem } from "src/apis/backend/tasks"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderSubtle,
  adminStatusDangerBg,
  adminStatusDangerDot,
  adminStatusDangerText,
  adminStatusWarnDot,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTerminalBg,
  adminTerminalDanger,
  adminTerminalMuted,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
import { formatInstant } from "src/routes/Admin/AdminToolsWorkspaceModel"
import {
  ActionRow,
  InlineNotice,
  QuietButton,
  SubSectionHeading,
} from "src/routes/Admin/AdminToolsWorkspace.styles"
import { computeShiftRangeSelection } from "./cloudUploadQueueModel"

export type AdminTaskDlqTableProps = {
  tasks: TaskDlqItem[]
  errorMessage?: string
  isLoading?: boolean
  selectedTaskIds: ReadonlySet<number>
  onSelectedTaskIdsChange: (next: ReadonlySet<number>) => void
  onReplaySelected: (selectedIds: number[]) => void
  onRetryFetch?: () => void
  disabled?: boolean
}

export const AdminTaskDlqTable = ({
  tasks,
  errorMessage = "",
  isLoading = false,
  selectedTaskIds,
  onSelectedTaskIdsChange,
  onReplaySelected,
  onRetryFetch,
  disabled = false,
}: AdminTaskDlqTableProps) => {
  const lastSelectedRowIndexRef = useRef<number | null>(null)
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks])
  const taskIdIndexMap = useMemo(
    () => new Map(tasks.map((t, i) => [t.id, i])),
    [tasks]
  )

  const allSelected =
    tasks.length > 0 && tasks.every((t) => selectedTaskIds.has(t.id))

  const handleToggleAll = () => {
    if (allSelected) {
      onSelectedTaskIdsChange(new Set())
    } else {
      onSelectedTaskIdsChange(new Set(taskIds))
    }
    lastSelectedRowIndexRef.current = null
  }

  const handleToggleRow = (taskId: number, shiftKey = false) => {
    const currentIndex = taskIdIndexMap.get(taskId) ?? -1
    if (currentIndex === -1) return

    if (shiftKey && lastSelectedRowIndexRef.current !== null) {
      const rangeIds = computeShiftRangeSelection(
        lastSelectedRowIndexRef.current,
        currentIndex,
        taskIds
      )
      const next = new Set(selectedTaskIds)
      for (const id of rangeIds) {
        next.add(id)
      }
      onSelectedTaskIdsChange(next)
    } else {
      const next = new Set(selectedTaskIds)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      onSelectedTaskIdsChange(next)
    }
    lastSelectedRowIndexRef.current = currentIndex
  }

  return (
    <DlqTableBlock as="section" aria-label="실패 태스크 목록 (DLQ)">
      <SubSectionHeading>
        <strong>실패 태스크 목록 (DLQ)</strong>
        <small>
          {errorMessage ? "조회 오류" : `${tasks.length}건 대기 중`}
        </small>
      </SubSectionHeading>

      {tasks.length > 0 ? (
        <ActionRow>
          <QuietButton
            type="button"
            disabled={disabled || selectedTaskIds.size === 0}
            onClick={() => onReplaySelected(Array.from(selectedTaskIds))}
          >
            선택한 태스크만 리플레이 ({selectedTaskIds.size}개)
          </QuietButton>
          <QuietButton
            type="button"
            disabled={disabled}
            onClick={handleToggleAll}
          >
            {allSelected ? "전체 선택 해제" : "전체 선택"}
          </QuietButton>
        </ActionRow>
      ) : null}

      {isLoading ? (
        <DlqEmptyText>DLQ 태스크 목록 로딩 중...</DlqEmptyText>
      ) : errorMessage ? (
        <DlqErrorState>
          <InlineNotice data-tone="danger" role="alert">
            DLQ 목록을 불러오지 못했습니다. {errorMessage}
          </InlineNotice>
          {onRetryFetch ? (
            <ActionRow>
              <QuietButton
                type="button"
                disabled={isLoading}
                onClick={onRetryFetch}
              >
                목록 다시 불러오기
              </QuietButton>
            </ActionRow>
          ) : null}
        </DlqErrorState>
      ) : tasks.length === 0 ? (
        <DlqEmptyText>현재 DLQ에 격리된 실패 태스크가 없습니다.</DlqEmptyText>
      ) : (
        <DlqTableScroll>
          <DlqTable>
            <thead>
              <tr>
                <th className="checkCol">
                  <input
                    type="checkbox"
                    aria-label="DLQ 전체 선택"
                    checked={allSelected}
                    disabled={disabled}
                    onChange={handleToggleAll}
                  />
                </th>
                <th>ID</th>
                <th>유형</th>
                <th>대상</th>
                <th>재시도</th>
                <th>실패 원인</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const checked = selectedTaskIds.has(task.id)
                const rawError = task.errorMessage?.trim() || ""
                const safeMax = Math.max(1, task.maxRetries || 1)
                const retryRatio = Math.min(100, Math.round((task.retryCount / safeMax) * 100))
                const isExhausted = task.retryCount >= safeMax
                return (
                  <tr key={task.id} data-checked={checked ? "true" : "false"}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`태스크 #${task.id} 선택`}
                        checked={checked}
                        disabled={disabled}
                        onClick={(e) => handleToggleRow(task.id, e.shiftKey)}
                        onChange={() => {}}
                      />
                    </td>
                    <td>
                      <JobIdBadge>#{task.id}</JobIdBadge>
                    </td>
                    <td>
                      <JobTypePill>{task.taskType}</JobTypePill>
                    </td>
                    <td className="mono">
                      {task.aggregateType} #{task.aggregateId}
                    </td>
                    <td>
                      <RetryGaugeCell>
                        <span>
                          {task.retryCount} / {task.maxRetries}
                        </span>
                        <RetryGaugeTrack aria-hidden="true">
                          <RetryGaugeFill
                            data-exhausted={isExhausted ? "true" : "false"}
                            style={{ width: `${retryRatio}%` }}
                          />
                        </RetryGaugeTrack>
                      </RetryGaugeCell>
                    </td>
                    <td className="errorCol">
                      {rawError ? (
                        <DlqErrorDetails>
                          <DlqErrorSummary>
                            <span className="preview">{rawError}</span>
                            <span className="toggleBadge">스택 보기</span>
                          </DlqErrorSummary>
                          <DlqErrorPre>
                            {rawError}
                            {task.modifiedAt ? (
                              <span className="timestamp">
                                {`\n최근 갱신: ${formatInstant(task.modifiedAt)}`}
                              </span>
                            ) : null}
                          </DlqErrorPre>
                        </DlqErrorDetails>
                      ) : (
                        <DlqMutedError>에러 메시지 없음</DlqMutedError>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </DlqTable>
        </DlqTableScroll>
      )}
    </DlqTableBlock>
  )
}

const DlqTableBlock = styled.div`
  display: grid;
  gap: 0.6rem;
  margin-top: 0.65rem;
  margin-bottom: 0.65rem;
`

const DlqErrorState = styled.div`
  display: grid;
  gap: 0.5rem;
`

const DlqEmptyText = styled.p`
  margin: 0;
  padding: 0.8rem 0.95rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceRaised};
  font-size: 0.83rem;
  color: ${adminTextSecondary};
`

const DlqMutedError = styled.span`
  color: ${adminTextMuted};
  font-size: 0.76rem;
`

const DlqTableScroll = styled.div`
  overflow-x: auto;
  border: 0;
  border-radius: 0;
  background: transparent;
`

const DlqTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  text-align: left;

  thead tr {
    background: transparent;
    border-bottom: 1px solid ${adminBorder};
  }

  th,
  td {
    padding: 0.6rem 0.65rem;
    color: ${adminTextPrimary};
    vertical-align: top;
  }

  th {
    color: ${adminTextSecondary};
    font-size: 0.74rem;
    font-weight: 700;
  }

  th.checkCol {
    width: 36px;
    padding-left: 0.15rem;
  }

  td:first-of-type {
    padding-left: 0.15rem;
  }

  input[type="checkbox"] {
    width: 15px;
    height: 15px;
    accent-color: ${adminTeal};
  }

  tbody tr {
    border-bottom: 1px solid ${adminBorderSubtle};
  }

  tbody tr:last-of-type {
    border-bottom: 0;
  }

  tbody tr:hover {
    background: ${adminSurfaceRaised};
  }

  tbody tr[data-checked="true"] {
    background: ${adminSurfaceMuted};
  }

  td.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.76rem;
    color: ${adminTextSecondary};
  }

  td.errorCol {
    min-width: 240px;
    max-width: 400px;
  }
`

const JobIdBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.42rem;
  border-radius: 5px;
  background: ${adminSurfaceMuted};
  color: ${adminTextPrimary};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.74rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`

const JobTypePill = styled.strong`
  display: inline-flex;
  align-items: center;
  padding: 0.14rem 0.5rem;
  border-radius: 6px;
  border: 0;
  background: ${adminSurfaceMuted};
  color: ${adminTextPrimary};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.74rem;
  font-weight: 680;
`

const RetryGaugeCell = styled.div`
  display: grid;
  gap: 0.28rem;
  min-width: 68px;

  span {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.74rem;
    font-weight: 680;
    font-variant-numeric: tabular-nums;
    color: ${adminTextPrimary};
  }
`

const RetryGaugeTrack = styled.div`
  width: 100%;
  height: 5px;
  border-radius: 999px;
  background: ${adminSurfaceMuted};
  overflow: hidden;
`

const RetryGaugeFill = styled.div<{ "data-exhausted"?: string }>`
  height: 100%;
  border-radius: 999px;
  background: ${({ "data-exhausted": exhausted }) =>
    exhausted === "true" ? adminStatusDangerDot : adminStatusWarnDot};
`

const DlqErrorDetails = styled.details`
  display: grid;
  gap: 0.38rem;
`

const DlqErrorSummary = styled.summary`
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  color: ${adminStatusDangerText};
  ${focusVisibleRing}

  &::-webkit-details-marker {
    display: none;
  }

  .preview {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
  }

  .toggleBadge {
    flex: none;
    padding: 0.1rem 0.46rem;
    border-radius: 999px;
    border: 0;
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
    font-size: 0.68rem;
    font-weight: 700;
  }
`

const DlqErrorPre = styled.pre`
  margin: 0.35rem 0 0;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 0;
  background: ${adminTerminalBg};
  color: ${adminTerminalDanger};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.74rem;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  .timestamp {
    color: ${adminTerminalMuted};
  }
`
