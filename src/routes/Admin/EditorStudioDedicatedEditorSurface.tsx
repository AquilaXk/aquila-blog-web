import type {
  ChangeEventHandler, KeyboardEvent as ReactKeyboardEvent, KeyboardEventHandler, ReactNode, Ref,
} from "react"
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { createMarkdownDocumentInsights } from "src/libs/markdown/markdownDocumentInsights"
import { splitCategoryDisplay } from "src/libs/utils"
import {
  EditorExitAction, EditorHeaderMetaPill, EditorHeaderMetaRow, MobilePropertiesToggle,
  EditorInspector, EditorInspectorTagInputRow, EditorOutline, EditorOutlineItem,
  EditorPanelHeader, EditorSidebarToggleButton, EditorStudioDedicatedCanvasSection,
  EditorStudioDedicatedMetaSection, EditorStudioDedicatedTopBar, EditorStudioFrame,
  EditorStudioGuideModal, EditorStudioLoadingState, EditorStudioPageHeading, EditorStudioRoot,
  EditorStudioSaveState, EditorStudioStatusBar, EditorStudioTopBarActions,
  EditorStudioWritingColumn, EditorTagRow, InlineMetaInput, LocalDraftRestoreCard,
  PrimaryButton, PublishNotice, SelectedTagChip, SecondaryButton, TitleInput,
} from "./EditorStudioDedicatedEditorSurfaceParts"
import type { PostVisibility } from "./editorStudioState"
import { PREVIEW_SUMMARY_MAX_LENGTH } from "./editorStudioMetaModel"
import { PUBLISH_VISIBILITY_OPTIONS } from "./EditorStudioWorkspaceControllerRootModel"

export const resolveActiveOutlineItemIndex = (
  items: ReadonlyArray<{ range: { start: number; end: number } | null }>,
  cursorOffset?: number | null
): number => {
  if (items.length === 0) return -1
  if (cursorOffset == null || cursorOffset < 0) return 0
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const range = items[index]?.range
    if (range && cursorOffset >= range.start) {
      return index
    }
  }
  return 0
}

const computeCursorLineAndColumn = (
  markdown: string,
  cursorOffset?: number | null
): { line: number; column: number } => {
  const clamped = Math.max(0, Math.min(cursorOffset ?? 0, markdown.length))
  let line = 1
  let lastNewlineIndex = -1
  for (let index = 0; index < clamped; index += 1) {
    if (markdown.codePointAt(index) === 10) {
      line += 1
      lastNewlineIndex = index
    }
  }
  return {
    line,
    column: clamped - lastNewlineIndex,
  }
}

export const countMarkdownTotalLinks = (markdown: string): number => {
  if (!markdown.includes("](") && !markdown.includes("[[")) return 0
  let count = 0
  if (markdown.includes("](")) {
    for (const _match of markdown.matchAll(/!?\[[^\][\r\n]*\]\([^()\s\r\n]*\)/g)) {
      count += 1
    }
  }
  if (markdown.includes("[[")) {
    for (const _match of markdown.matchAll(/\[\[[^\][\r\n]+\]\]/g)) {
      count += 1
    }
  }
  return count
}

type NoticeTone = "idle" | "loading" | "success" | "error"

type EditorStudioDedicatedEditorSurfaceProps = {
  thumbnailImageFileInputRef: Ref<HTMLInputElement>
  onThumbnailImageFileChange: ChangeEventHandler<HTMLInputElement>
  onExit: () => void
  saveStateText: string
  saveStateTone: string
  primaryActionDisabled: boolean
  primaryActionLabel: string
  onPrimaryAction: () => void
  isCompactSplitPreview: boolean
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
  postVisibility: PostVisibility
  onPostVisibilityChange: (value: PostVisibility) => void
  editorCanvas: ReactNode
  showPublishNotice: boolean
  publishNoticeTone: NoticeTone
  publishNoticeText: string
  isLocalDraftRestoreSuggestionVisible: boolean
  isLocalDraftRestoreSuggestionActionsDisabled: boolean
  onRestoreLocalDraft: () => void
  localDraftCandidates: Array<{ key: string; label: string }>
  selectedLocalDraftCandidateKey: string
  onSelectLocalDraftCandidate: (key: string) => void
  onDiscardLocalDraftCandidate: () => void
  onDismissLocalDraftRestoreSuggestion: () => void
  onClearLocalDraft: () => void
  resultPanel: ReactNode
  publishModal: ReactNode
}

const isComposingKeyboardEvent = (event: ReactKeyboardEvent<HTMLElement>) => {
  const nativeEvent = event.nativeEvent as globalThis.KeyboardEvent & {
    isComposing?: boolean
    keyCode?: number
  }
  return nativeEvent.isComposing === true || nativeEvent.keyCode === 229
}

export const countMarkdownLinkWarnings = (markdown: string) => {
  if (!markdown.includes("](")) return 0
  let count = 0
  for (const match of markdown.matchAll(/!?\[[^\][\r\n]*\]\(([^()\s\r\n]*)/g)) {
    const href = match[1]?.trim() ?? ""
    if (!href || /^https?:\/\/$/.test(href)) {
      count += 1
    }
  }
  return count
}

const getCategoryInputValue = (category: string) =>
  category.trim() ? splitCategoryDisplay(category).label : ""

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

const LocalDraftRestoreSuggestion = ({
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
      <select aria-label="복구할 브라우저 초안" disabled={disabled} value={selectedKey} onChange={(event) => onSelect(event.target.value)}>
        <option value="">초안을 선택하세요</option>
        {candidates.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.label}</option>)}
      </select>
      <div className="card-actions">
        <SecondaryButton type="button" disabled={disabled || !selectedKey} onClick={onRestore}>
          복구
        </SecondaryButton>
        <SecondaryButton type="button" disabled={disabled || !selectedKey} onClick={selectedKey ? onDiscard : onClear}>
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

export const EditorStudioDedicatedEditorSurface = ({
  thumbnailImageFileInputRef,
  onThumbnailImageFileChange,
  onExit,
  saveStateText,
  saveStateTone,
  primaryActionDisabled,
  primaryActionLabel,
  onPrimaryAction,
  isCompactSplitPreview,
  postTags,
  tagDraft,
  onTagDraftChange,
  onAddTags,
  onAddTag,
  onRemoveTag,
  titleInputRef,
  onOutlineBodyHeadingActivate,
  activeCursorOffset,
  activeSelectionRange,
  postTitle,
  onPostTitleChange,
  onPostTitleKeyDown,
  postContent,
  postSummary,
  onPostSummaryChange,
  postCategory,
  onPostCategoryChange,
  onCommitPostCategory,
  categorySuggestions,
  postVisibility,
  onPostVisibilityChange,
  editorCanvas,
  showPublishNotice,
  publishNoticeTone,
  publishNoticeText,
  isLocalDraftRestoreSuggestionVisible,
  isLocalDraftRestoreSuggestionActionsDisabled,
  onRestoreLocalDraft,
  localDraftCandidates,
  selectedLocalDraftCandidateKey,
  onSelectLocalDraftCandidate,
  onDiscardLocalDraftCandidate,
  onDismissLocalDraftRestoreSuggestion,
  onClearLocalDraft,
  resultPanel,
  publishModal,
}: EditorStudioDedicatedEditorSurfaceProps) => {
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isOutlineOpen, setIsOutlineOpen] = useState(true)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)
  const [isMobilePropertiesOpen, setIsMobilePropertiesOpen] = useState(false)
  const [lastActivatedOutlineOffset, setLastActivatedOutlineOffset] = useState<number | null>(null)
  const titleNodeRef = useRef<HTMLTextAreaElement | null>(null)
  const isZenMode = !isOutlineOpen && !isInspectorOpen

  const handleToggleZenMode = useCallback(() => {
    if (isZenMode) {
      setIsOutlineOpen(true)
      setIsInspectorOpen(true)
    } else {
      setIsOutlineOpen(false)
      setIsInspectorOpen(false)
    }
  }, [isZenMode])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault()
        handleToggleZenMode()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleToggleZenMode])

  const deferredPostContent = useDeferredValue(postContent)
  const outlineInsights = useMemo(() => createMarkdownDocumentInsights(deferredPostContent), [deferredPostContent])
  const outlineItems = useMemo(() => {
    const title = postTitle.trim()
    return [
      ...(title ? [{ id: "title", level: 1 as const, label: title, range: null }] : []),
      ...outlineInsights.headings.map((heading) => ({
        id: `${heading.slug}:${heading.offset}`,
        level: heading.level,
        label: heading.label,
        range: heading.range,
      })),
    ]
  }, [outlineInsights.headings, postTitle])
  const activeOutlineIndex = useMemo(
    () => resolveActiveOutlineItemIndex(outlineItems, activeCursorOffset ?? lastActivatedOutlineOffset),
    [activeCursorOffset, lastActivatedOutlineOffset, outlineItems]
  )
  const linkWarningCount = useMemo(() => countMarkdownLinkWarnings(deferredPostContent), [deferredPostContent])
  const totalLinkCount = useMemo(() => countMarkdownTotalLinks(deferredPostContent), [deferredPostContent])
  const cursorPosition = useMemo(
    () => computeCursorLineAndColumn(postContent, activeCursorOffset),
    [activeCursorOffset, postContent]
  )
  const selectedCharCount = activeSelectionRange ? Math.max(0, activeSelectionRange.to - activeSelectionRange.from) : 0
  const handleTagDraftChange = (nextValue: string) => {
    const commaSeparated = /[,，]/
    if (!commaSeparated.test(nextValue)) {
      onTagDraftChange(nextValue)
      return
    }

    const fragments = nextValue.split(commaSeparated)
    const tailDraft = fragments.pop() ?? ""
    const tagsToAdd = fragments.map((fragment) => fragment.trim()).filter(Boolean)
    if (tagsToAdd.length > 0) onAddTags(tagsToAdd)
    onTagDraftChange(tailDraft)
  }
  const handleTagDraftKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (isComposingKeyboardEvent(event)) return
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      onAddTag(event.currentTarget.value)
    }
  }
  const handleTitleInputRef = useCallback((node: HTMLTextAreaElement | null) => {
    titleNodeRef.current = node
    titleInputRef(node)
  }, [titleInputRef])

  return (
    <EditorStudioRoot>
      <EditorStudioPageHeading>글 편집</EditorStudioPageHeading>
      <input
        ref={thumbnailImageFileInputRef}
        type="file"
        accept="image/*"
        onChange={onThumbnailImageFileChange}
        style={{ display: "none" }}
      />

      <EditorStudioDedicatedTopBar>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <EditorExitAction type="button" onClick={onExit}>
            ← 글 관리
          </EditorExitAction>
          <EditorSidebarToggleButton
            type="button"
            $active={isOutlineOpen}
            onClick={() => setIsOutlineOpen((prev) => !prev)}
            aria-label="문서 목차 토글"
            title="문서 목차 토글"
          >
            목차
          </EditorSidebarToggleButton>
        </div>

        {saveStateText ? <EditorStudioSaveState data-tone={saveStateTone}>{saveStateText}</EditorStudioSaveState> : <span />}

        <EditorStudioTopBarActions>
          <EditorSidebarToggleButton
            type="button"
            $active={isZenMode}
            onClick={handleToggleZenMode}
            aria-label="집중 모드 토글"
            title="집중 모드 (사이드바 숨김 · Cmd/Ctrl+Shift+F)"
          >
            {isZenMode ? "집중 모드 켜짐" : "집중 모드"}
          </EditorSidebarToggleButton>
          <EditorSidebarToggleButton
            type="button"
            $active={isInspectorOpen}
            onClick={() => setIsInspectorOpen((prev) => !prev)}
            aria-label="메타 패널 토글"
            title="메타 패널 토글"
          >
            메타 패널
          </EditorSidebarToggleButton>
          <SecondaryButton type="button" onClick={() => setIsGuideOpen(true)}>
            Markdown 가이드
          </SecondaryButton>
          <PrimaryButton type="button" disabled={primaryActionDisabled} onClick={onPrimaryAction}>
            {primaryActionLabel}
          </PrimaryButton>
        </EditorStudioTopBarActions>
      </EditorStudioDedicatedTopBar>

      <EditorStudioFrame
        data-testid="editor-studio-frame"
        $showOutline={isOutlineOpen}
        $showInspector={isInspectorOpen}
      >
        {isOutlineOpen ? (
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
                  data-active={index === activeOutlineIndex ? "true" : "false"}
                  onClick={() => {
                    if (item.range) {
                      setLastActivatedOutlineOffset(item.range.start)
                      onOutlineBodyHeadingActivate({ from: item.range.start, to: item.range.end })
                      return
                    }
                    setLastActivatedOutlineOffset(null)
                    titleNodeRef.current?.focus()
                  }}
                >
                  <span>H{item.level}</span>
                  <strong>{item.label}</strong>
                </EditorOutlineItem>
              ))
            ) : (
              <p>제목과 본문 heading을 입력하면 목차가 표시됩니다.</p>
            )}
          </EditorOutline>
        ) : null}

        <EditorStudioWritingColumn
          data-testid="editor-writing-column"
          $compact={isCompactSplitPreview}
          $zenMode={isZenMode}
        >
          <EditorStudioDedicatedMetaSection $compact={isCompactSplitPreview}>
            <TitleInput
              $compact={isCompactSplitPreview}
              ref={handleTitleInputRef}
              id="post-title"
              placeholder="제목을 입력하세요"
              rows={1}
              value={postTitle}
              onChange={onPostTitleChange}
              onKeyDown={onPostTitleKeyDown}
            />
            <MobilePropertiesToggle
              type="button"
              $visibleOnDesktop={isZenMode}
              onClick={() => setIsMobilePropertiesOpen((prev) => !prev)}
              aria-label="속성 정보 토글"
            >
              속성 {isMobilePropertiesOpen ? "접기 ▲" : `펼치기 (${postTags.length}개 태그) ▼`}
            </MobilePropertiesToggle>
            <EditorHeaderMetaRow
              $collapsedOnMobile={!isMobilePropertiesOpen}
              $collapsedInZen={isZenMode && !isMobilePropertiesOpen}
            >
              <EditorTagRow aria-label="태그 입력" $compact={isCompactSplitPreview}>
                {postTags.map((tag) => (
                  <SelectedTagChip key={tag}>
                    <span className="label">{tag}</span>
                    <button type="button" onClick={() => onRemoveTag(tag)} aria-label={`${tag} 삭제`}>
                      ×
                    </button>
                  </SelectedTagChip>
                ))}
                <InlineMetaInput
                  placeholder="태그 입력 후 Enter"
                  value={tagDraft}
                  onChange={(event) => handleTagDraftChange(event.target.value)}
                  onKeyDown={handleTagDraftKeyDown}
                />
              </EditorTagRow>
              <EditorHeaderMetaPill $compact={isCompactSplitPreview}>본문 형식 · Markdown</EditorHeaderMetaPill>
            </EditorHeaderMetaRow>
          </EditorStudioDedicatedMetaSection>

          <EditorStudioDedicatedCanvasSection>{editorCanvas}</EditorStudioDedicatedCanvasSection>

          <EditorStudioStatusBar data-testid="editor-studio-status-bar" aria-label="편집기 상태 표시줄">
            <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
            {selectedCharCount > 0 ? <span>선택 {selectedCharCount}자</span> : null}
            <span>단어 {outlineInsights.wordCount} · 글자 {outlineInsights.characterCount}</span>
            <span>약 {outlineInsights.readingMinutes}분 읽기</span>
            <span>링크 {totalLinkCount}</span>
          </EditorStudioStatusBar>

          {showPublishNotice ? <PublishNotice data-tone={publishNoticeTone}>{publishNoticeText}</PublishNotice> : null}
        </EditorStudioWritingColumn>

        {isInspectorOpen ? (
          <EditorInspector aria-label="발행 설정">
            <EditorPanelHeader>
              <h3>발행 설정</h3>
              <button type="button" aria-label="발행 설정 닫기" onClick={() => setIsInspectorOpen(false)}>
                ×
              </button>
            </EditorPanelHeader>
            <label>
              <span>공개 범위</span>
              <select value={postVisibility} onChange={(event) => onPostVisibilityChange(event.target.value as PostVisibility)}>
                {PUBLISH_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>요약</span>
              <textarea
                value={postSummary}
                maxLength={PREVIEW_SUMMARY_MAX_LENGTH}
                onChange={(event) => onPostSummaryChange(event.target.value)}
              />
              <small>
                {postSummary.length}/{PREVIEW_SUMMARY_MAX_LENGTH}
              </small>
            </label>
            <label>
              <span>분류 (선택)</span>
              <EditorInspectorTagInputRow>
                <input
                  list="editor-category-suggestions"
                  value={getCategoryInputValue(postCategory)}
                  onChange={(event) => onPostCategoryChange(event.target.value)}
                  onBlur={onCommitPostCategory}
                />
                <SecondaryButton
                  type="button"
                  aria-label="카테고리 지우기"
                  onClick={() => onPostCategoryChange("")}
                  disabled={!postCategory}
                >
                  지우기
                </SecondaryButton>
              </EditorInspectorTagInputRow>
              <datalist id="editor-category-suggestions">
                {categorySuggestions.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
              <small>하나의 글에는 넓은 분류를 하나만 선택하세요. 세부 키워드는 태그로 추가할 수 있습니다.</small>
            </label>
            <LocalDraftRestoreSuggestion
              visible={isLocalDraftRestoreSuggestionVisible}
              disabled={isLocalDraftRestoreSuggestionActionsDisabled}
              onRestore={onRestoreLocalDraft}
              candidates={localDraftCandidates}
              selectedKey={selectedLocalDraftCandidateKey}
              onSelect={onSelectLocalDraftCandidate}
              onDiscard={onDiscardLocalDraftCandidate}
              onClear={onClearLocalDraft}
              onDismiss={onDismissLocalDraftRestoreSuggestion}
            />
            <section>
              <span>태그</span>
              <EditorTagRow aria-label="발행 태그" $compact>
                {postTags.map((tag) => (
                  <SelectedTagChip key={`inspector-${tag}`}>
                    <span className="label">{tag}</span>
                    <button type="button" onClick={() => onRemoveTag(tag)} aria-label={`${tag} 삭제`}>
                      ×
                    </button>
                  </SelectedTagChip>
                ))}
              </EditorTagRow>
              <EditorInspectorTagInputRow>
                <input
                  placeholder="태그 추가"
                  value={tagDraft}
                  onChange={(event) => handleTagDraftChange(event.target.value)}
                  onKeyDown={handleTagDraftKeyDown}
                />
                <button type="button" onClick={() => onAddTag(tagDraft)} aria-label="태그 추가">
                  +
                </button>
              </EditorInspectorTagInputRow>
            </section>
            {linkWarningCount > 0 ? (
              <p role="alert">링크 주소가 비어 있거나 http:// 또는 https://만 입력된 링크가 {linkWarningCount}개 있습니다. 주소를 완성해 주세요.</p>
            ) : null}
          </EditorInspector>
        ) : null}
      </EditorStudioFrame>

      {isGuideOpen ? <EditorStudioGuideModal onClose={() => setIsGuideOpen(false)} /> : null}

      {resultPanel}
      {publishModal}
    </EditorStudioRoot>
  )
}
