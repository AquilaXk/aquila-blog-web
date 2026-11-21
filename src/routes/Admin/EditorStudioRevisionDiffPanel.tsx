/**
 * 참조 구현:
 * - payloadcms/payload packages/ui/src/elements/DocumentDiff/ (MIT License, Copyright (c) Payload CMS)
 */
import styled from "@emotion/styled"
import type { SiteLanguage } from "src/libs/language"
import {
  adminBorder,
  adminBorderSubtle,
  adminStatusDangerBg,
  adminStatusDangerBorder,
  adminStatusDangerText,
  adminStatusSuccessBg,
  adminStatusSuccessBorder,
  adminStatusSuccessText,
  adminSurface,
  adminSurfaceMuted,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"
import { adminT } from "./adminI18n"
import type { PostRevisionDiffResult } from "./postRevisionDiffModel"

export type EditorStudioRevisionDiffPanelProps = {
  language: SiteLanguage
  revisionTitle: string
  currentTitle: string
  isLoading: boolean
  errorText: string
  diff: PostRevisionDiffResult | null
}

export const EditorStudioRevisionDiffPanel = ({
  language,
  revisionTitle,
  currentTitle,
  isLoading,
  errorText,
  diff,
}: EditorStudioRevisionDiffPanelProps) => {
  if (isLoading) {
    return (
      <DiffContainer data-testid="editor-revision-diff-panel">
        <DiffStatusText>{adminT("editorRevisionLoadingDiff", language)}</DiffStatusText>
      </DiffContainer>
    )
  }

  if (errorText) {
    return (
      <DiffContainer data-testid="editor-revision-diff-panel">
        <DiffErrorText role="alert">{errorText}</DiffErrorText>
      </DiffContainer>
    )
  }

  if (!diff) return null

  return (
    <DiffContainer data-testid="editor-revision-diff-panel">
      <DiffSummaryBar>
        <span>
          {adminT("editorRevisionLinesAdded", language)} +{diff.addedLines}
        </span>
        <span>
          {adminT("editorRevisionLinesRemoved", language)} -{diff.removedLines}
        </span>
      </DiffSummaryBar>

      {diff.changedTitle ? (
        <DiffMetaBlock>
          <strong>{adminT("editorRevisionTitleChanged", language)}</strong>
          <DiffLineRow data-diff-kind="removed">
            <span className="marker">-</span>
            <span className="lineText">
              {adminT("editorRevisionSnapshotTitle", language)}: {revisionTitle}
            </span>
          </DiffLineRow>
          <DiffLineRow data-diff-kind="added">
            <span className="marker">+</span>
            <span className="lineText">
              {adminT("editorRevisionCurrentTitle", language)}: {currentTitle}
            </span>
          </DiffLineRow>
        </DiffMetaBlock>
      ) : null}

      {diff.addedTags.length > 0 || diff.removedTags.length > 0 ? (
        <DiffMetaBlock>
          <strong>{adminT("editorRevisionTagsChanged", language)}</strong>
          <DiffTagPills>
            {diff.removedTags.map((tag) => (
              <DiffTagPill key={`rm-${tag}`} data-diff-kind="removed">
                - {tag}
              </DiffTagPill>
            ))}
            {diff.addedTags.map((tag) => (
              <DiffTagPill key={`add-${tag}`} data-diff-kind="added">
                + {tag}
              </DiffTagPill>
            ))}
          </DiffTagPills>
        </DiffMetaBlock>
      ) : null}

      {diff.truncated ? (
        <DiffWarningText role="status">
          {adminT("editorRevisionTruncated", language)} ({diff.revisionLineCount} → {diff.currentLineCount})
        </DiffWarningText>
      ) : !diff.hasChanges ? (
        <DiffStatusText>{adminT("editorRevisionNoChanges", language)}</DiffStatusText>
      ) : (
        <DiffLinesList>
          {diff.lines.map((line, index) => (
            <DiffLineRow key={`${line.kind}-${index}`} data-diff-kind={line.kind}>
              <span className="marker">
                {line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}
              </span>
              <span className="lineText">{line.text || " "}</span>
            </DiffLineRow>
          ))}
        </DiffLinesList>
      )}
    </DiffContainer>
  )
}

const DiffContainer = styled.div`
  display: grid;
  gap: 6px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceMuted};
`

const DiffSummaryBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font: 600 0.7rem/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: ${adminTextSecondary};
  font-variant-numeric: tabular-nums;
`

const DiffMetaBlock = styled.div`
  display: grid;
  gap: 3px;

  strong {
    font-size: 0.7rem;
    font-weight: 600;
    color: ${adminTextPrimary};
  }
`

const DiffTagPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`

const DiffTagPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;

  &[data-diff-kind="added"] {
    background: ${adminStatusSuccessBg};
    border: 1px solid ${adminStatusSuccessBorder};
    color: ${adminStatusSuccessText};
  }

  &[data-diff-kind="removed"] {
    background: ${adminStatusDangerBg};
    border: 1px solid ${adminStatusDangerBorder};
    color: ${adminStatusDangerText};
  }
`

const DiffLinesList = styled.div`
  display: grid;
  max-height: 12rem;
  overflow: auto;
  border-radius: 4px;
  border: 1px solid ${adminBorderSubtle};
  background: ${adminSurface};
`

const DiffLineRow = styled.div`
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 6px;
  padding: 1px 6px;
  font: 500 0.69rem/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: ${adminTextSecondary};
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  .marker {
    user-select: none;
    text-align: center;
    font-weight: 700;
  }

  &[data-diff-kind="added"] {
    background: ${adminStatusSuccessBg};
    color: ${adminStatusSuccessText};
  }

  &[data-diff-kind="removed"] {
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
  }
`

const DiffStatusText = styled.p`
  margin: 0;
  font-size: 0.72rem;
  color: ${adminTextMuted};
`

const DiffWarningText = styled.p`
  margin: 0;
  font-size: 0.72rem;
  color: ${adminTextPrimary};
`

const DiffErrorText = styled.p`
  margin: 0;
  font-size: 0.72rem;
  color: ${({ theme }) => theme.colors.red11};
`
