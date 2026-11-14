import type { ChangeEventHandler, KeyboardEventHandler, ReactNode, Ref } from "react"
import {
  EditorOutline,
  EditorOutlineItem,
  EditorPanelHeader,
  EditorStudioLoadingState,
  EditorStudioRoot,
  LocalDraftRestoreCard,
  PublishNotice,
  SecondaryButton,
} from "./EditorStudioDedicatedEditorSurfaceParts"
import { buildEditorOutlineItems, isMobileEditorViewport } from "./editorStudioDedicatedSurfaceModel"
import type { PostVisibility } from "./editorStudioState"

export type NoticeTone = "idle" | "loading" | "success" | "error"

export type EditorStudioDedicatedEditorSurfaceProps = {
  thumbnailImageFileInputRef: Ref<HTMLInputElement>
  onThumbnailImageFileChange: ChangeEventHandler<HTMLInputElement>
  onExit: () => void
  saveStateText: string
  saveStateTone: string
  primaryActionDisabled: boolean
  primaryActionLabel: string
  onPrimaryAction: () => void
  postTags: string[]
  tagDraft: string
  onTagDraftChange: (value: string) => void
  onAddTags: (values: string[]) => void
  onAddTag: (value: string) => void
  onRemoveTag: (value: string) => void
  titleInputRef: (node: HTMLTextAreaElement | null) => void
  onOutlineBodyHeadingActivate: (selection: { from: number; to: number }) => void
  activeCursorOffset?: number | null
  activeSelectionRange?: { from: number; to: number } | null
  postTitle: string
  onPostTitleChange: ChangeEventHandler<HTMLTextAreaElement>
  onPostTitleKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
  postContent: string
  postSummary: string
  onPostSummaryChange: (value: string) => void
  postCategory: string
  onPostCategoryChange: (value: string) => void
  onCommitPostCategory: () => void
  categorySuggestions: string[]
  tagSuggestions?: string[]
  postVisibility: PostVisibility
  onPostVisibilityChange: (value: PostVisibility) => void
  editorCanvas: ReactNode
  showPublishNotice: boolean
  publishNoticeTone: NoticeTone
  publishNoticeText: string
  onReloadLatestServerPost?: (() => void) | null
  isLocalDraftRestoreSuggestionVisible: boolean
  isLocalDraftRestoreSuggestionActionsDisabled: boolean
  onRestoreLocalDraft: () => void
  localDraftCandidates: Array<{ key: string; label: string }>
  selectedLocalDraftCandidateKey: string
  onSelectLocalDraftCandidate: (key: string) => void
  onDiscardLocalDraftCandidate: () => void
  onDismissLocalDraftRestoreSuggestion: () => void
  onClearLocalDraft: () => void
  publishModal: ReactNode
  onUploadPostImage?: (
    file: File
  ) => Promise<{ alt?: string; title?: string; url?: string; src?: string }>
  onUploadPostAttachment?: (file: File) => Promise<{ url?: string; name?: string }>
  onInsertMarkdownSnippet?: (snippet: string) => void
}

type LocalDraftRestoreSuggestionProps = {
  visible: boolean
  disabled: boolean
  onRestore: () => void
  candidates: Array<{ key: string; label: string }>
  selectedKey: string
  onSelect: (key: string) => void
  onDiscard: () => void
  onClear: () => void
  onDismiss: () => void
}

export const activateEditorOutlineItem = (
  range: { start: number; end: number } | null,
  setIsOutlineOpen: (next: boolean) => void,
  setLastActivatedOutlineOffset: (offset: number | null) => void,
  onOutlineBodyHeadingActivate: (selection: { from: number; to: number }) => void,
  focusTitle: () => void
) => {
  if (isMobileEditorViewport()) setIsOutlineOpen(false)
  if (range) {
    setLastActivatedOutlineOffset(range.start)
    onOutlineBodyHeadingActivate({ from: range.start, to: range.end })
    return
  }
  setLastActivatedOutlineOffset(null)
  focusTitle()
}

export const LocalDraftRestoreSuggestion = ({
  visible,
  disabled,
  onRestore,
  candidates,
  selectedKey,
  onSelect,
  onDiscard,
  onClear,
  onDismiss,
}: LocalDraftRestoreSuggestionProps) => {
  if (!visible) return null
  return (
    <LocalDraftRestoreCard role="status" aria-live="polite">
      <div className="card-header">
        <span>브라우저 임시글이 있습니다.</span>
      </div>
      <select
        aria-label="복구할 브라우저 초안"
        disabled={disabled}
        value={selectedKey}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">초안을 선택하세요</option>
        {candidates.map((candidate) => (
          <option key={candidate.key} value={candidate.key}>
            {candidate.label}
          </option>
        ))}
      </select>
      <div className="card-actions">
        <SecondaryButton
          type="button"
          disabled={disabled || !selectedKey}
          onClick={onRestore}
        >
          복구
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={disabled || !selectedKey}
          onClick={selectedKey ? onDiscard : onClear}
        >
          삭제
        </SecondaryButton>
        <SecondaryButton type="button" disabled={disabled} onClick={onDismiss}>
          이번 세션에 표시 안 함
        </SecondaryButton>
      </div>
    </LocalDraftRestoreCard>
  )
}

export const EditorStudioDedicatedEditorLoadingState = () => (
  <EditorStudioRoot>
    <EditorStudioLoadingState>
      <strong>편집 화면을 준비하고 있습니다.</strong>
      <span>잠시만 기다려 주세요.</span>
    </EditorStudioLoadingState>
  </EditorStudioRoot>
)

export const renderEditorOutlinePanel = ({
  isOutlineOpen,
  outlineItems,
  activeOutlineIndex,
  setIsOutlineOpen,
  setLastActivatedOutlineOffset,
  onOutlineBodyHeadingActivate,
  focusTitle,
}: {
  isOutlineOpen: boolean
  outlineItems: ReturnType<typeof buildEditorOutlineItems>
  activeOutlineIndex: number
  setIsOutlineOpen: (next: boolean) => void
  setLastActivatedOutlineOffset: (offset: number | null) => void
  onOutlineBodyHeadingActivate: (selection: { from: number; to: number }) => void
  focusTitle: () => void
}) => {
  if (!isOutlineOpen) return null
  return (
    <EditorOutline aria-label="문서 목차">
      <EditorPanelHeader>
        <h3>문서 목차</h3>
        <button type="button" aria-label="목차 닫기" onClick={() => setIsOutlineOpen(false)}>
          ×
        </button>
      </EditorPanelHeader>
      {outlineItems.length > 0 ? (
        outlineItems.map((item, index) => (
          <EditorOutlineItem
            key={item.id}
            type="button"
            data-level={item.level}
            data-active={String(index === activeOutlineIndex)}
            onClick={() =>
              activateEditorOutlineItem(
                item.range,
                setIsOutlineOpen,
                setLastActivatedOutlineOffset,
                onOutlineBodyHeadingActivate,
                focusTitle
              )
            }
          >
            <span>H{item.level}</span>
            <strong>{item.label}</strong>
          </EditorOutlineItem>
        ))
      ) : (
        <p>제목과 본문 heading을 입력하면 목차가 표시됩니다.</p>
      )}
    </EditorOutline>
  )
}

export const renderPublishNoticeBanner = ({
  showPublishNotice,
  publishNoticeTone,
  publishNoticeText,
  onReloadLatestServerPost,
  actionsDisabled,
}: {
  showPublishNotice: boolean
  publishNoticeTone: NoticeTone
  publishNoticeText: string
  onReloadLatestServerPost: (() => void) | null
  actionsDisabled: boolean
}) => {
  if (!showPublishNotice) return null
  return (
    <PublishNotice data-tone={publishNoticeTone}>
      <span>{publishNoticeText}</span>
      {onReloadLatestServerPost ? (
        <SecondaryButton
          type="button"
          disabled={actionsDisabled}
          onClick={onReloadLatestServerPost}
        >
          서버 최신본 다시 불러오기
        </SecondaryButton>
      ) : null}
    </PublishNotice>
  )
}
