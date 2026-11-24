/**
 * 참조 구현:
 * - TryGhost/Ghost apps/admin/src/editor/post-settings-sidebar.tsx (MIT License, Copyright (c) Ghost Foundation)
 * - payloadcms/payload (MIT License, Copyright (c) Payload CMS)
 */
import styled from "@emotion/styled"
import { EditorIconCheck } from "src/components/markdown-editor/MarkdownEditorIcons"
import { useLanguage } from "src/libs/language"
import { adminT } from "./adminI18n"
import {
  adminBorder,
  adminBorderSubtle,
  adminSurfaceMuted,
  adminTeal,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"

export type EditorStudioPublishReadinessProps = {
  hasTitle: boolean
  wordCount: number
  hasBody: boolean
  hasManualSummary: boolean
  tagCount: number
  linkWarningCount: number
  totalLinkCount: number
}

type ReadinessRowTone = "ready" | "neutral" | "warning"

const ReadinessCard = styled.div`
  display: grid;
  gap: 10px;
  padding: 0 0 16px;
  margin: 0;
  border: 0;
  border-bottom: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;
`

const ReadinessProgressTrack = styled.div`
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: ${adminSurfaceMuted};
  overflow: hidden;
`

const ReadinessProgressFill = styled.div<{ $percent: number; $hasWarning: boolean }>`
  width: ${({ $percent }) => `${$percent}%`};
  height: 100%;
  border-radius: 2px;
  background: ${({ theme, $hasWarning }) =>
    $hasWarning ? adminTeal : theme.colors.green9};
  transition: width 0.2s ease, background-color 0.2s ease;
`

const ReadinessHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const ReadinessTitle = styled.span`
  font: 600 12.5px/1.2 var(--aq-font-sans);
  color: ${adminTextPrimary};
`

const ReadinessScoreBadge = styled.span<{ $hasWarning: boolean }>`
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid
    ${({ theme, $hasWarning }) =>
      $hasWarning ? theme.colors.orange7 : adminBorder};
  background: ${adminSurfaceMuted};
  color: ${({ theme, $hasWarning }) =>
    $hasWarning ? theme.colors.orange11 : adminTextSecondary};
  font: 600 10.5px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
`

const ReadinessList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 5px;
`

const ReadinessRow = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font: 500 11.5px/1.3 var(--aq-font-sans);
  color: ${adminTextMuted};
`

const ReadinessRowLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`

const ReadinessRowDot = styled.span<{ $tone: ReadinessRowTone }>`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
  background: ${({ theme, $tone }) => {
    if ($tone === "warning") return theme.colors.orange9
    if ($tone === "ready") return theme.colors.green9
    return theme.colors.gray7
  }};
`

const ReadinessStatusValue = styled.span<{ $tone: ReadinessRowTone }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: 650 11px/1.2 var(--aq-font-sans);
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $tone }) => {
    if ($tone === "warning") return theme.colors.orange11
    if ($tone === "ready") return theme.colors.green11
    return theme.colors.gray10
  }};
`

export const EditorStudioPublishReadinessCard = ({
  hasTitle,
  wordCount,
  hasBody,
  hasManualSummary,
  tagCount,
  linkWarningCount,
  totalLinkCount,
}: EditorStudioPublishReadinessProps) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const hasWarning = linkWarningCount > 0 || !hasTitle || !hasBody
  const rows: Array<{ label: string; value: string; tone: ReadinessRowTone }> = [
    {
      label: adminT("editorReadinessTitleRow", language),
      value: hasTitle
        ? adminT("editorReadinessEntered", language)
        : adminT("editorReadinessRequired", language),
      tone: hasTitle ? "ready" : "warning",
    },
    {
      label: adminT("editorReadinessBodyRow", language),
      value: hasBody
        ? isEn
          ? `${wordCount} words`
          : `${wordCount}단어`
        : adminT("editorReadinessWriteNeeded", language),
      tone: hasBody ? "ready" : "warning",
    },
    {
      label: adminT("editorReadinessSummaryRow", language),
      value: hasManualSummary
        ? adminT("editorReadinessManual", language)
        : adminT("editorReadinessAuto", language),
      tone: hasManualSummary ? "ready" : "neutral",
    },
    {
      label: adminT("editorReadinessTagRow", language),
      value: isEn ? String(tagCount) : `${tagCount}개`,
      tone: tagCount > 0 ? "ready" : "neutral",
    },
    {
      label: adminT("editorReadinessLinkRow", language),
      value:
        linkWarningCount > 0
          ? isEn
            ? `${linkWarningCount} warning`
            : `주의 ${linkWarningCount}건`
          : isEn
            ? `OK (${totalLinkCount})`
            : `정상 (${totalLinkCount}개)`,
      tone: linkWarningCount > 0 ? "warning" : "ready",
    },
  ]

  const completedCount = rows.filter((row) => row.tone !== "warning").length
  const completionPercent = Math.round((completedCount / rows.length) * 100)

  return (
    <ReadinessCard data-testid="editor-publish-readiness" aria-label={adminT("editorReadinessTitle", language)}>
      <ReadinessHeader>
        <ReadinessTitle>{adminT("editorReadinessTitle", language)}</ReadinessTitle>
        <ReadinessScoreBadge $hasWarning={hasWarning}>
          {completedCount}/{rows.length} {adminT("editorReadinessItemsUnit", language)}
        </ReadinessScoreBadge>
      </ReadinessHeader>
      <ReadinessProgressTrack aria-hidden="true">
        <ReadinessProgressFill $percent={completionPercent} $hasWarning={hasWarning} />
      </ReadinessProgressTrack>
      <ReadinessList>
        {rows.map((row) => (
          <ReadinessRow key={row.label}>
            <ReadinessRowLabel>
              <ReadinessRowDot $tone={row.tone} aria-hidden="true" />
              <span>{row.label}</span>
            </ReadinessRowLabel>
            <ReadinessStatusValue $tone={row.tone}>
              {row.tone === "ready" ? <EditorIconCheck size={12} strokeWidth={2.2} /> : null}
              <span>{row.value}</span>
            </ReadinessStatusValue>
          </ReadinessRow>
        ))}
      </ReadinessList>
    </ReadinessCard>
  )
}
