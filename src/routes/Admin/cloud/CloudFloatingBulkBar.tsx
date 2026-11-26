// 참조 구현: 내부 AdminPostsWorkspacePageSections FloatingBulkBar 패턴 — 선택 항목 일괄 작업 플로팅 바
import styled from "@emotion/styled"
import { useLanguage } from "src/libs/language"
import {
  adminStatusDangerBorder,
  adminStatusDangerText,
} from "src/routes/Admin/adminColorTokens"
import { GhostButton, SecondaryButton } from "../AdminCloudWorkspaceControls.styles"
import { FloatingBulkBadge, FloatingBulkBar } from "./AdminCloudOverlay.styles"
import { getCloudDictionary } from "./adminCloudI18n"

const DangerBulkButton = styled(SecondaryButton)`
  color: ${adminStatusDangerText};
  border-color: ${adminStatusDangerBorder};
`

export type CloudFloatingBulkBarProps = {
  selectedCount: number
  isBusy: boolean
  onBulkMove: () => void
  onBulkDownload: () => void
  onBulkDelete: () => void
  onClearSelection: () => void
}

export const CloudFloatingBulkBar = ({
  selectedCount,
  isBusy,
  onBulkMove,
  onBulkDownload,
  onBulkDelete,
  onClearSelection,
}: CloudFloatingBulkBarProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)

  if (selectedCount <= 0) return null

  return (
    <FloatingBulkBar role="region" aria-label={t.bulkSelectedCount(selectedCount)}>
      <FloatingBulkBadge>{t.bulkSelectedCount(selectedCount)}</FloatingBulkBadge>
      <SecondaryButton type="button" disabled={isBusy} onClick={onBulkMove}>
        {t.bulkMove}
      </SecondaryButton>
      <SecondaryButton type="button" disabled={isBusy} onClick={onBulkDownload}>
        {t.bulkDownload}
      </SecondaryButton>
      <DangerBulkButton
        type="button"
        disabled={isBusy}
        onClick={onBulkDelete}
      >
        {t.bulkDelete}
      </DangerBulkButton>
      <GhostButton type="button" disabled={isBusy} onClick={onClearSelection}>
        {t.bulkClearSelection}
      </GhostButton>
    </FloatingBulkBar>
  )
}
