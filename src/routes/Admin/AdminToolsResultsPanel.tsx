// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/QueueCard.tsx (MIT)
import styled from "@emotion/styled"
import { useState } from "react"
import { focusVisibleRing } from "src/design-system/focusRing"
import { control } from "src/design-system/tokens"
import {
  adminBorderSubtle,
  adminControlText,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTerminalBg,
  adminTerminalFg,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
import {
  formatInstant,
  getFreshnessMeta,
  SECTION_IDS,
  type ExecutionEntry,
  type ExecutionResultFilter,
} from "src/routes/Admin/AdminToolsWorkspaceModel"
import {
  ActionRow,
  ActionToneBadge,
  CardSectionHeading,
  DetailsPanel,
  DetailsSummary,
  FreshnessBadge,
  QuietButton,
  SectionHeading,
  SectionTitleBlock,
  SubtleMetaItem,
  WorkspaceSection,
} from "src/routes/Admin/AdminToolsWorkspace.styles"

const pretty = (value: unknown) => JSON.stringify(value, null, 2)

export type AdminToolsResultsPanelProps = {
  executions: ExecutionEntry[]
  filteredExecutions: ExecutionEntry[]
  freshnessClock: number | null
  onResultFilterChange: (filter: ExecutionResultFilter) => void
  onSelectedExecutionChange: (id: string) => void
  resultFilterCounts: Record<ExecutionResultFilter, number>
  resultsFilter: ExecutionResultFilter
  selectedExecution: ExecutionEntry | null
}

const RESULT_FILTERS: Array<{ key: ExecutionResultFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "success", label: "성공" },
  { key: "error", label: "실패" },
  { key: "stale", label: "오래됨" },
]

export default function AdminToolsResultsPanel({
  executions,
  filteredExecutions,
  freshnessClock,
  onResultFilterChange,
  onSelectedExecutionChange,
  resultFilterCounts,
  resultsFilter,
  selectedExecution,
}: AdminToolsResultsPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyPayload = async (entry: ExecutionEntry) => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(pretty(entry.payload))
      setCopiedId(entry.id)
    } catch {
      setCopiedId(null)
    }
  }

  return (
    <WorkspaceSection id={SECTION_IDS.results} data-ops-section="results" data-emphasis="secondary">
      <SectionHeading>
        <SectionTitleBlock>
          <h2>최근 진단 결과</h2>
        </SectionTitleBlock>
      </SectionHeading>

      <ResultFilterRow aria-label="실행 결과 필터">
        {RESULT_FILTERS.map((filter) => (
          <ResultFilterButton
            key={filter.key}
            type="button"
            data-active={resultsFilter === filter.key}
            onClick={() => onResultFilterChange(filter.key)}
          >
            {filter.label}
            <span>{resultFilterCounts[filter.key]}</span>
          </ResultFilterButton>
        ))}
      </ResultFilterRow>

      {selectedExecution ? (
        <ResultsLayout>
          <ResultPrimaryCard>
            <ResultTop>
              <div>
                <small>방금 실행한 작업</small>
                <strong>{selectedExecution.source}</strong>
              </div>
              <ResultBadgeRow>
                <ActionToneBadge
                  data-tone={
                    selectedExecution.status === "error"
                      ? "danger"
                      : selectedExecution.tone === "danger"
                        ? "danger"
                        : selectedExecution.tone === "write"
                          ? "write"
                          : "read"
                  }
                >
                  {selectedExecution.status === "error" ? "실패" : "성공"}
                </ActionToneBadge>
                <FreshnessBadge data-tone={getFreshnessMeta(selectedExecution.completedAt, freshnessClock).tone}>
                  {getFreshnessMeta(selectedExecution.completedAt, freshnessClock).label}
                </FreshnessBadge>
              </ResultBadgeRow>
            </ResultTop>
            <ResultMetaGrid>
              <SubtleMetaItem>
                <span>영역</span>
                <strong>{selectedExecution.domain}</strong>
              </SubtleMetaItem>
              <SubtleMetaItem>
                <span>실행 시각</span>
                <strong>{formatInstant(selectedExecution.completedAt)}</strong>
              </SubtleMetaItem>
            </ResultMetaGrid>
            <ResultSummary>{selectedExecution.summary}</ResultSummary>
            <DetailsPanel>
              <DetailsSummary>
                <span>원본 응답 보기</span>
                <small>JSON</small>
              </DetailsSummary>
              <ActionRow style={{ padding: "0 0 0.45rem" }}>
                <QuietButton
                  type="button"
                  onClick={() => void handleCopyPayload(selectedExecution)}
                >
                  {copiedId === selectedExecution.id ? "복사됨" : "JSON 복사"}
                </QuietButton>
              </ActionRow>
              <ResultPanel>{pretty(selectedExecution.payload)}</ResultPanel>
            </DetailsPanel>
          </ResultPrimaryCard>

          <ResultHistoryCard>
            <CardSectionHeading>
              <div>
                <h3>최근 기록</h3>
              </div>
            </CardSectionHeading>
            <HistoryList>
              {filteredExecutions.map((entry) => (
                <HistoryButton
                  key={entry.id}
                  type="button"
                  data-active={selectedExecution.id === entry.id}
                  onClick={() => onSelectedExecutionChange(entry.id)}
                >
                  <span>{entry.source}</span>
                  <small>
                    {entry.status === "error" ? "실패" : "성공"} · {formatInstant(entry.completedAt)} ·{" "}
                    {getFreshnessMeta(entry.completedAt, freshnessClock).label}
                  </small>
                </HistoryButton>
              ))}
            </HistoryList>
          </ResultHistoryCard>
        </ResultsLayout>
      ) : (
        <EmptyResultState>
          {executions.length === 0 ? "실행 기록 없음" : "현재 필터에 맞는 실행 결과가 없습니다."}
        </EmptyResultState>
      )}
    </WorkspaceSection>
  )
}

export const ResultFilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid ${adminBorderSubtle};
`

export const ResultFilterButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  min-height: 30px;
  padding: 0 0.68rem;
  border-radius: 6px;
  border: 1px solid ${adminBorderSubtle};
  background: ${adminSurfaceRaised};
  color: ${adminTextSecondary};
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  ${focusVisibleRing}

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
  }

  span {
    color: ${adminTextSecondary};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
  }

  &[data-active="true"] {
    border-color: ${adminTeal};
    background: ${adminTeal};
    color: ${adminControlText};

    span {
      color: ${adminControlText};
    }
  }
`

export const ResultsLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 280px;
  gap: 1.1rem;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`

export const ResultPrimaryCard = styled.div`
  display: grid;
  gap: 0.78rem;
  padding: 0.15rem 0;
  border-radius: 0;
  border: 0;
  background: transparent;
  min-width: 0;
`

export const ResultTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.8rem;

  small {
    display: block;
    color: ${adminTextSecondary};
    font-size: 0.73rem;
    font-weight: 650;
  }

  strong {
    display: block;
    margin-top: 0.16rem;
    color: ${adminTextPrimary};
    font-size: 1.02rem;
    letter-spacing: -0.015em;
  }
`

export const ResultBadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.42rem;
`

export const ResultMetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem 1.15rem;
  padding: 0.58rem 0;
  border-block: 1px solid ${adminBorderSubtle};

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`

export const ResultSummary = styled.p`
  margin: 0;
  color: ${adminTextPrimary};
  font-size: 0.86rem;
  line-height: 1.6;
`

export const ResultHistoryCard = styled.div`
  display: grid;
  align-content: start;
  gap: 0.55rem;
  padding: 0.15rem 0 0 1.1rem;
  border-radius: 0;
  border: 0;
  border-left: 1px solid ${adminBorderSubtle};
  background: transparent;
  min-width: 0;

  @media (max-width: 1024px) {
    padding: 0.85rem 0 0;
    border-left: 0;
    border-top: 1px solid ${adminBorderSubtle};
  }
`

export const HistoryList = styled.div`
  display: grid;
  gap: 0;
  border-top: 1px solid ${adminBorderSubtle};
`

export const HistoryButton = styled.button`
  text-align: left;
  display: grid;
  gap: 0.14rem;
  padding: 0.62rem 0.5rem;
  border-radius: 6px;
  border: 0;
  border-bottom: 1px solid ${adminBorderSubtle};
  background: transparent;
  color: ${adminTextPrimary};
  cursor: pointer;
  ${focusVisibleRing}

  &:last-of-type {
    border-bottom: 0;
  }

  &:hover {
    background: ${adminSurfaceRaised};
  }

  &[data-active="true"] {
    border-bottom-color: transparent;
    background: ${adminSurfaceMuted};
  }

  span {
    font-size: 0.82rem;
    font-weight: 700;
  }

  small {
    color: ${adminTextSecondary};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
  }
`

export const ResultPanel = styled.pre`
  margin: 0.15rem 0 0.35rem;
  min-height: 160px;
  padding: 0.9rem;
  border-radius: 8px;
  border: 1px solid ${adminBorderSubtle};
  background: ${adminTerminalBg};
  color: ${adminTerminalFg};
  overflow: auto;
  line-height: 1.55;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
`

export const EmptyResultState = styled.p`
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceRaised};
  color: ${adminTextSecondary};
  font-size: 0.84rem;
  line-height: 1.6;
`
