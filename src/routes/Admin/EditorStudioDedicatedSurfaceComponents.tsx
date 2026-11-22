/**
 * 참조 구현:
 * - TryGhost/Ghost apps/admin/src/editor/{post-settings-sidebar.tsx,editor-screen.tsx} (MIT License, Copyright (c) Ghost Foundation)
 */
import type { ChangeEventHandler, KeyboardEventHandler, ReactNode, Ref } from "react"
import { EditorIconClose, EditorIconPlus } from "src/components/markdown-editor/MarkdownEditorIcons"
import { useLanguage, type SiteLanguage } from "src/libs/language"
import { adminT } from "./adminI18n"
import {
  EditorInspector,
  EditorInspectorTagInputRow,
  EditorMobileSheetScrim,
  EditorOutline,
  EditorOutlineItem,
  EditorPanelHeader,
  EditorSectionEyebrow,
  EditorStudioLoadingState,
  EditorStudioRoot,
  EditorStudioStatusBar,
  EditorTagRow,
  LocalDraftRestoreCard,
  PublishNotice,
  SecondaryButton,
  SelectedTagChip,
} from "./EditorStudioDedicatedEditorSurfaceParts"
import { EditorStudioCloudAssetPicker } from "./EditorStudioCloudAssetPicker"
import {
  EditorFloatingMiniToc,
  EditorFloatingMiniTocTick,
  EditorOutlineSummaryBar,
  EditorOutlineTree,
} from "./EditorStudioEditorialStyles"
import { EditorStudioRevisionHistoryCard } from "./EditorStudioRevisionHistoryCard"
import {
  buildEditorOutlineItems,
  formatCategoryDraftInputValue,
  isMobileEditorViewport,
} from "./editorStudioDedicatedSurfaceModel"
import { PREVIEW_SUMMARY_MAX_LENGTH } from "./editorStudioMetaModel"
import { getPublishVisibilityOptions } from "./EditorStudioWorkspaceControllerRootModel"
import type { PostVisibility } from "./editorStudioState"
import type { WritingFocus } from "./editorStudioWritingFocus"

export type NoticeTone = "idle" | "loading" | "success" | "error"

export type EditorStudioDedicatedEditorSurfaceProps = {
  defaultPanelUiMask?: number
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
  postThumbnailUrl?: string
  safePreviewThumbnail?: string
  isThumbnailUploading?: boolean
  isThumbnailUploadDisabled?: boolean
  onOpenThumbnailFileInput?: () => void
  onResetThumbnailToAutoMode?: () => void
  managedPostId?: number | null
  onRevisionRestored?: () => Promise<void> | void
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
  const { language } = useLanguage()
  if (!visible) return null
  return (
    <LocalDraftRestoreCard role="status" aria-live="polite">
      <div className="card-header">
        <span>{adminT("editorDraftBannerTitle", language)}</span>
      </div>
      <select
        aria-label={adminT("editorDraftSelectAria", language)}
        disabled={disabled}
        value={selectedKey}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">{adminT("editorDraftSelectPlaceholder", language)}</option>
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
          {adminT("editorDraftRestore", language)}
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={disabled || !selectedKey}
          onClick={selectedKey ? onDiscard : onClear}
        >
          {adminT("editorDraftDelete", language)}
        </SecondaryButton>
        <SecondaryButton type="button" disabled={disabled} onClick={onDismiss}>
          {adminT("editorDraftDismiss", language)}
        </SecondaryButton>
      </div>
    </LocalDraftRestoreCard>
  )
}

export const EditorStudioDedicatedEditorLoadingState = () => {
  const { language } = useLanguage()
  return (
    <EditorStudioRoot>
      <EditorStudioLoadingState>
        <strong>{adminT("editorLoadingHeading", language)}</strong>
        <span>{adminT("editorLoadingSub", language)}</span>
      </EditorStudioLoadingState>
    </EditorStudioRoot>
  )
}

export const renderFloatingMiniTocSpine = ({
  language = "ko",
  isOutlineOpen,
  outlineItems,
  activeOutlineIndex,
  writingFocus,
  onOpenOutline,
}: {
  language?: SiteLanguage
  isOutlineOpen: boolean
  outlineItems: ReturnType<typeof buildEditorOutlineItems>
  activeOutlineIndex: number
  writingFocus: WritingFocus
  onOpenOutline: () => void
}) => {
  if (isOutlineOpen || outlineItems.length === 0) return null
  const visibleItems = outlineItems.slice(0, 12)
  const headingSummary =
    language === "en"
      ? `${adminT("editorOutlineOpen", language)} (${outlineItems.length} ${adminT("editorOutlineHeadingUnit", language)})`
      : `${adminT("editorOutlineOpen", language)} (헤딩 ${outlineItems.length}개)`
  return (
    <EditorFloatingMiniToc
      type="button"
      data-testid="editor-floating-mini-toc"
      data-writing-focus={writingFocus}
      aria-label={adminT("editorOutlineOpen", language)}
      title={headingSummary}
      onClick={onOpenOutline}
    >
      {visibleItems.map((item, index) => (
        <EditorFloatingMiniTocTick
          key={item.id}
          $level={item.level}
          $active={index === activeOutlineIndex}
          aria-hidden="true"
        />
      ))}
    </EditorFloatingMiniToc>
  )
}

export const renderEditorOutlinePanel = ({
  language = "ko",
  isOutlineOpen,
  outlineItems,
  activeOutlineIndex,
  readingMinutes,
  setIsOutlineOpen,
  setLastActivatedOutlineOffset,
  onOutlineBodyHeadingActivate,
  focusTitle,
}: {
  language?: SiteLanguage
  isOutlineOpen: boolean
  outlineItems: ReturnType<typeof buildEditorOutlineItems>
  activeOutlineIndex: number
  readingMinutes?: number
  setIsOutlineOpen: (next: boolean) => void
  setLastActivatedOutlineOffset: (offset: number | null) => void
  onOutlineBodyHeadingActivate: (selection: { from: number; to: number }) => void
  focusTitle: () => void
}) => {
  if (!isOutlineOpen) return null
  const headingLabel =
    language === "en"
      ? `${outlineItems.length} ${adminT("editorOutlineHeadingUnit", language)}`
      : `헤딩 ${outlineItems.length}개`
  const readingLabel =
    readingMinutes !== undefined
      ? language === "en"
        ? `~${readingMinutes} min read`
        : `약 ${readingMinutes}분 읽기`
      : null
  return (
    <>
      <EditorMobileSheetScrim
        type="button"
        aria-label={adminT("editorOutlineClose", language)}
        onClick={() => setIsOutlineOpen(false)}
      />
      <EditorOutline aria-label={adminT("editorOutlineTitle", language)}>
      <EditorPanelHeader>
        <h3>{adminT("editorOutlineTitle", language)}</h3>
        <button type="button" aria-label={adminT("editorOutlineClose", language)} onClick={() => setIsOutlineOpen(false)}>
          <EditorIconClose size={14} />
        </button>
      </EditorPanelHeader>
      <EditorOutlineSummaryBar data-testid="editor-outline-summary">
        <span>{headingLabel}</span>
        {readingLabel ? <span>{readingLabel}</span> : null}
      </EditorOutlineSummaryBar>
      {outlineItems.length > 0 ? (
        <EditorOutlineTree>
          {outlineItems.map((item, index) => (
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
              <span aria-hidden="true">H{item.level}</span>
              <strong>{item.label}</strong>
            </EditorOutlineItem>
          ))}
        </EditorOutlineTree>
      ) : (
        <p>{adminT("editorOutlineEmpty", language)}</p>
      )}
      </EditorOutline>
    </>
  )
}

export const renderPublishNoticeBanner = ({
  language = "ko",
  showPublishNotice,
  publishNoticeTone,
  publishNoticeText,
  onReloadLatestServerPost,
  actionsDisabled,
}: {
  language?: SiteLanguage
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
          {adminT("editorReloadLatest", language)}
        </SecondaryButton>
      ) : null}
    </PublishNotice>
  )
}

export const renderEditorInspectorPanel = ({
  language = "ko",
  isInspectorOpen,
  onCloseInspector,
  postSummary,
  onPostSummaryChange,
  postTags,
  onRemoveTag,
  tagDraft,
  onTagDraftChange,
  onTagDraftKeyDown,
  onAddTag,
  linkWarningCount,
  postVisibility,
  onPostVisibilityChange,
  postCategory,
  onPostCategoryChange,
  onCommitPostCategory,
  decodedCategorySuggestions,
  onUploadPostImage,
  onUploadPostAttachment,
  onInsertMarkdownSnippet,
  managedPostId,
  actionsDisabled,
  onRevisionRestored,
  currentTitle = "",
  currentTags = [],
  currentContent = "",
}: {
  language?: SiteLanguage
  isInspectorOpen: boolean
  onCloseInspector: () => void
  postSummary: string
  onPostSummaryChange: (value: string) => void
  postTags: string[]
  onRemoveTag: (value: string) => void
  tagDraft: string
  onTagDraftChange: (value: string) => void
  onTagDraftKeyDown: KeyboardEventHandler<HTMLInputElement>
  onAddTag: (value: string) => void
  linkWarningCount: number
  postVisibility: PostVisibility
  onPostVisibilityChange: (value: PostVisibility) => void
  postCategory: string
  onPostCategoryChange: (value: string) => void
  onCommitPostCategory: () => void
  decodedCategorySuggestions: string[]
  onUploadPostImage?: EditorStudioDedicatedEditorSurfaceProps["onUploadPostImage"]
  onUploadPostAttachment?: EditorStudioDedicatedEditorSurfaceProps["onUploadPostAttachment"]
  onInsertMarkdownSnippet?: EditorStudioDedicatedEditorSurfaceProps["onInsertMarkdownSnippet"]
  managedPostId: number | null
  actionsDisabled: boolean
  onRevisionRestored?: () => Promise<void> | void
  currentTitle?: string
  currentTags?: string[]
  currentContent?: string
}) => {
  if (!isInspectorOpen) return null
  const visibilityOptions = getPublishVisibilityOptions(language)
  const linkWarningMessage =
    language === "en"
      ? `${linkWarningCount} incomplete link(s) detected. Please complete the URL.`
      : `링크 주소가 비어 있거나 http:// 또는 https://만 입력된 링크가 ${linkWarningCount}개 있습니다. 주소를 완성해 주세요.`
  return (
    <>
      <EditorMobileSheetScrim
        type="button"
        aria-label={adminT("editorSettingsCloseAria", language)}
        onClick={onCloseInspector}
      />
      <EditorInspector data-testid="editor-inspector-aside" aria-label={adminT("editorPublishSettingsAria", language)}>
        <EditorPanelHeader>
          <h3>{adminT("editorSettingsHeading", language)}</h3>
          <button type="button" aria-label={adminT("editorSettingsCloseAria", language)} onClick={onCloseInspector}>
            <EditorIconClose size={14} />
          </button>
        </EditorPanelHeader>
        <label>
          <EditorSectionEyebrow aria-hidden="true">
            {adminT("editorSectionVisibilityEyebrow", language)}
          </EditorSectionEyebrow>
          <span>{adminT("editorVisibilityLabel", language)}</span>
          <select
            value={postVisibility}
            onChange={(event) => onPostVisibilityChange(event.target.value as PostVisibility)}
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <section>
          <EditorSectionEyebrow aria-hidden="true">
            {adminT("editorSectionTaxonomyEyebrow", language)}
          </EditorSectionEyebrow>
          <span>{adminT("editorTagsHeading", language)}</span>
          <EditorTagRow aria-label={adminT("editorPublishTagsAria", language)}>
            {postTags.map((tag) => (
              <SelectedTagChip key={`inspector-${tag}`}>
                <span className="label">{tag}</span>
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  aria-label={`${tag} ${adminT("editorTagDeleteSuffix", language)}`}
                >
                  <EditorIconClose size={11} />
                </button>
              </SelectedTagChip>
            ))}
          </EditorTagRow>
          <EditorInspectorTagInputRow>
            <input
              list="editor-tag-suggestions"
              placeholder={adminT("editorTagAddPlaceholder", language)}
              value={tagDraft}
              onChange={(event) => onTagDraftChange(event.target.value)}
              onKeyDown={onTagDraftKeyDown}
            />
            <button type="button" onClick={() => onAddTag(tagDraft)} aria-label={adminT("editorTagAddAria", language)}>
              <EditorIconPlus size={14} />
            </button>
          </EditorInspectorTagInputRow>
        </section>
        <label>
          <span>{adminT("editorCategoryOptional", language)}</span>
          <EditorInspectorTagInputRow>
            <input
              list="editor-category-suggestions"
              placeholder={adminT("editorCategoryPlaceholder", language)}
              value={formatCategoryDraftInputValue(postCategory)}
              onChange={(event) => onPostCategoryChange(event.target.value)}
              onBlur={onCommitPostCategory}
            />
            <SecondaryButton
              type="button"
              aria-label={adminT("editorCategoryClearAria", language)}
              onClick={() => onPostCategoryChange("")}
              disabled={!postCategory}
            >
              {adminT("editorCategoryClear", language)}
            </SecondaryButton>
          </EditorInspectorTagInputRow>
          <datalist id="editor-category-suggestions">
            {decodedCategorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <small>{adminT("editorCategoryHint", language)}</small>
        </label>
        <label>
          <EditorSectionEyebrow aria-hidden="true">
            {adminT("editorSectionExcerptEyebrow", language)}
          </EditorSectionEyebrow>
          <span>{adminT("editorSummaryLabel", language)}</span>
          <textarea
            value={postSummary}
            maxLength={PREVIEW_SUMMARY_MAX_LENGTH}
            onChange={(event) => onPostSummaryChange(event.target.value)}
          />
          <small>
            {postSummary.length}/{PREVIEW_SUMMARY_MAX_LENGTH}
          </small>
        </label>
        <EditorStudioCloudAssetPicker
          onUploadPostImage={onUploadPostImage}
          onUploadPostAttachment={onUploadPostAttachment}
          onInsertMarkdownSnippet={onInsertMarkdownSnippet}
        />
        <EditorStudioRevisionHistoryCard
          postId={managedPostId}
          disabled={actionsDisabled}
          onRevisionRestored={onRevisionRestored}
          currentTitle={currentTitle}
          currentTags={currentTags}
          currentContent={currentContent}
        />
        {linkWarningCount > 0 ? <p role="alert">{linkWarningMessage}</p> : null}
      </EditorInspector>
    </>
  )
}

export const renderEditorFloatingStatusHud = ({
  language,
  sidebarsOpen,
  writingFocus,
  cursorLine,
  cursorColumn,
  selectedCharCount,
  wordCount,
  readingMinutes,
  totalLinkCount,
  linkWarningCount,
}: {
  language: SiteLanguage
  sidebarsOpen: boolean
  writingFocus: WritingFocus
  cursorLine: number
  cursorColumn: number
  selectedCharCount: number
  wordCount: number
  readingMinutes: number
  totalLinkCount: number
  linkWarningCount: number
}) => {
  const isEn = language === "en"
  const lineColLabel = adminT("editorStatusLineCol", language)
    .replace("{line}", String(cursorLine))
    .replace("{col}", String(cursorColumn))
  return (
    <EditorStudioStatusBar
      $sidebarsOpen={sidebarsOpen}
      data-testid="editor-status-hud"
      data-writing-focus={writingFocus}
      aria-label={adminT("editorSaveStatusAria", language)}
    >
      <span>{lineColLabel}</span>
      {selectedCharCount > 0 ? (
        <span>{isEn ? `${selectedCharCount} sel` : `선택 ${selectedCharCount}자`}</span>
      ) : null}
      <span>
        {wordCount} {adminT("editorWordUnit", language)}
      </span>
      <span>{isEn ? `~${readingMinutes} min` : `약 ${readingMinutes}분`}</span>
      {linkWarningCount > 0 ? (
        <span>
          {isEn
            ? `Links ${totalLinkCount} (${linkWarningCount} warn)`
            : `링크 ${totalLinkCount} (주의 ${linkWarningCount})`}
        </span>
      ) : null}
    </EditorStudioStatusBar>
  )
}
