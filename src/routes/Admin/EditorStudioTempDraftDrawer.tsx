import styled from "@emotion/styled"
import { useRef, useState } from "react"
import type { ApiPostDto } from "src/apis/backend/posts/PostApiDtos"
import { ConfirmDialog } from "src/design-system/ConfirmDialog"
import { focusVisibleRing } from "src/design-system/focusRing"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import { useLanguage } from "src/libs/language"
import { formatDate } from "src/libs/utils"
import { EditorIconClose } from "src/components/markdown-editor/MarkdownEditorIcons"
import {
  adminBorder,
  adminBorderSubtle,
  adminStatusDangerText,
  adminSurface,
  adminSurfaceMuted,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"
import { adminT } from "./adminI18n"
import { PrimaryButton, SecondaryButton } from "./EditorStudioSurfaceButtons"
import { zIndexes } from "src/styles/zIndexes"

const DrawerBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.publishModal + 10};
  display: grid;
  place-items: center;
  padding: 1rem;
  background: color-mix(in srgb, ${adminTextPrimary}, transparent 62%);
  overscroll-behavior: contain;
`

const DrawerDialog = styled.div`
  width: min(560px, 100%);
  max-height: min(82dvh, 620px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 12px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  box-shadow: 0 20px 44px color-mix(in srgb, ${adminTextPrimary}, transparent 80%);
  overflow: hidden;
  overscroll-behavior: contain;
`

const DrawerHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid ${adminBorderSubtle};

  h3 {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 700;
    color: ${adminTextPrimary};
  }
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
`

const CloseIconButton = styled.button`
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: ${adminTextSecondary};
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    border-color: ${adminBorder};
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }

  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
  }
`

const DraftList = styled.div`
  padding: 0.85rem 1.1rem 1.1rem;
  overflow-y: auto;
  display: grid;
  gap: 0.55rem;
  align-content: start;
`

const DraftRow = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.8rem;
  border-radius: 9px;
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.accentBorder : adminBorder)};
  background: ${({ $active }) => ($active ? adminSurfaceMuted : adminSurface)};

  .meta {
    min-width: 0;
    display: grid;
    gap: 0.18rem;
  }

  .titleLine {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  strong {
    font-size: 0.88rem;
    font-weight: 650;
    color: ${adminTextPrimary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .currentBadge {
    flex-shrink: 0;
    padding: 0.12rem 0.45rem;
    border-radius: 999px;
    background: ${adminSurface};
    border: 1px solid ${adminBorder};
    font-size: 0.7rem;
    font-weight: 650;
    color: ${adminTextSecondary};
  }

  .time {
    font-size: 0.76rem;
    color: ${adminTextMuted};
  }

  .actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
`

const DeleteButton = styled(SecondaryButton)`
  color: ${adminStatusDangerText};
`

const EmptyText = styled.p`
  margin: 1rem 0;
  text-align: center;
  font-size: 0.86rem;
  color: ${adminTextMuted};
`

type Props = {
  open: boolean
  loading: boolean
  currentPostId: string
  drafts: ApiPostDto[]
  onClose: () => void
  onCreateNew: () => Promise<void>
  onSelectDraft: (id: string | number) => Promise<void>
  onDeleteDraft: (id: string | number) => Promise<void>
}

export const EditorStudioTempDraftDrawer = ({
  open,
  loading,
  currentPostId,
  drafts,
  onClose,
  onCreateNew,
  onSelectDraft,
  onDeleteDraft,
}: Props) => {
  const { language } = useLanguage()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null)

  const { handleKeyDown } = useModalFocusTrap({
    open,
    onClose,
    containerRef: dialogRef,
    lockScroll: true,
  })

  if (!open) return null
  const untitledLabel = language === "en" ? "Untitled draft" : "제목 없는 임시글"

  return (
    <>
      <DrawerBackdrop onClick={onClose}>
        <DrawerDialog
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={adminT("editorTempDraftsTitle", language)}
          data-testid="editor-temp-drafts-dialog"
          onKeyDown={handleKeyDown}
          onClick={(event) => event.stopPropagation()}
        >
          <DrawerHeader>
            <h3>{adminT("editorTempDraftsTitle", language)}</h3>
            <HeaderActions>
              <PrimaryButton
                type="button"
                disabled={loading}
                data-testid="editor-temp-drafts-create-new"
                onClick={() => void onCreateNew()}
              >
                {adminT("editorTempDraftsCreateNew", language)}
              </PrimaryButton>
              <CloseIconButton
                type="button"
                aria-label={adminT("editorTempDraftsCloseAria", language)}
                onClick={onClose}
              >
                <EditorIconClose size={15} />
              </CloseIconButton>
            </HeaderActions>
          </DrawerHeader>
          <DraftList>
            {loading && drafts.length === 0 ? (
              <EmptyText>{adminT("editorTempDraftsLoading", language)}</EmptyText>
            ) : drafts.length === 0 ? (
              <EmptyText>{adminT("editorTempDraftsEmpty", language)}</EmptyText>
            ) : (
              drafts.map((draft) => {
                const draftId = draft.id ?? 0
                const isCurrent = String(draftId) === currentPostId.trim()
                const rawTitle = (draft.title ?? "").trim()
                const displayTitle = !rawTitle || rawTitle === "임시글" ? untitledLabel : rawTitle
                const timestamp = draft.modifiedAt || draft.createdAt || ""
                return (
                  <DraftRow key={draftId} $active={isCurrent} data-testid={`temp-draft-row-${draftId}`}>
                    <div className="meta">
                      <div className="titleLine">
                        <strong>{displayTitle}</strong>
                        {isCurrent ? (
                          <span className="currentBadge">{adminT("editorTempDraftsCurrent", language)}</span>
                        ) : null}
                      </div>
                      <span className="time">
                        #{draftId} {timestamp ? `· ${formatDate(timestamp, language === "en" ? "en-US" : "ko-KR")}` : ""}
                      </span>
                    </div>
                    <div className="actions">
                      {!isCurrent ? (
                        <SecondaryButton
                          type="button"
                          disabled={loading}
                          onClick={() => void onSelectDraft(draftId)}
                        >
                          {adminT("editorTempDraftsOpen", language)}
                        </SecondaryButton>
                      ) : null}
                      <DeleteButton
                        type="button"
                        disabled={loading}
                        data-testid={`temp-draft-delete-${draftId}`}
                        onClick={() => setConfirmDeleteId(draftId)}
                      >
                        {adminT("editorTempDraftsDelete", language)}
                      </DeleteButton>
                    </div>
                  </DraftRow>
                )
              })
            )}
          </DraftList>
        </DrawerDialog>
      </DrawerBackdrop>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        titleId="temp-draft-delete-title"
        descriptionId="temp-draft-delete-description"
        title={adminT("editorTempDraftsDelete", language)}
        description={adminT("editorTempDraftsDeleteConfirm", language)}
        confirmLabel={adminT("editorTempDraftsDelete", language)}
        cancelLabel={adminT("editorCloseLabel", language)}
        confirmTone="danger"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          const targetId = confirmDeleteId
          setConfirmDeleteId(null)
          if (targetId !== null) {
            void onDeleteDraft(targetId)
          }
        }}
      />
    </>
  )
}
