import type { KeyboardEventHandler } from "react"
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { createMarkdownDocumentInsights } from "src/libs/markdown/markdownDocumentInsights"
import { splitCategoryDisplay } from "src/libs/utils"
import {
  EditorExitAction,
  EditorHeaderMetaPill,
  EditorHeaderMetaRow,
  EditorHiddenFileInput,
  EditorInspector,
  EditorInspectorTagInputRow,
  EditorPanelHeader,
  EditorSidebarToggleButton,
  EditorStudioDedicatedCanvasSection,
  EditorStudioDedicatedMetaSection,
  EditorStudioDedicatedTopBar,
  EditorStudioFrame,
  EditorStudioGuideModal,
  EditorStudioPageHeading,
  EditorStudioRoot,
  EditorStudioSaveState,
  EditorStudioStatusBar,
  EditorStudioTopBarActions,
  EditorStudioTopBarLead,
  EditorStudioWritingColumn,
  EditorTagRow,
  InlineMetaInput,
  MobilePropertiesToggle,
  PrimaryButton,
  SecondaryButton,
  SelectedTagChip,
  TitleInput,
} from "./EditorStudioDedicatedEditorSurfaceParts"
import {
  EditorStudioDedicatedEditorLoadingState,
  LocalDraftRestoreSuggestion,
  renderEditorOutlinePanel,
  renderPublishNoticeBanner,
  type EditorStudioDedicatedEditorSurfaceProps,
} from "./EditorStudioDedicatedSurfaceComponents"
import type { PostVisibility } from "./editorStudioState"
import {
  EDITOR_SURFACE_GUIDE_OPEN,
  EDITOR_SURFACE_INSPECTOR_OPEN,
  EDITOR_SURFACE_MOBILE_PROPS_OPEN,
  EDITOR_SURFACE_OUTLINE_OPEN,
  EDITOR_SURFACE_ZEN_BITS,
  applyBitFlag,
  applyCommaSeparatedTagDraft,
  buildEditorOutlineItems,
  computeCursorLineAndColumn,
  computeSelectedCharCount,
  countMarkdownLinkWarnings,
  countMarkdownTotalLinks,
  formatCategoryDraftInputValue,
  handleTagInputKeyDown,
  isMobileEditorViewport,
  resolveActiveOutlineItemIndex,
  resolveViewportPanelUiMask,
  toCategorySuggestionLabels,
  toggleResponsiveSidebarBits,
  toggleZenBits,
} from "./editorStudioDedicatedSurfaceModel"
import { PREVIEW_SUMMARY_MAX_LENGTH } from "./editorStudioMetaModel"
import { PUBLISH_VISIBILITY_OPTIONS } from "./EditorStudioWorkspaceControllerRootModel"
import { EditorStudioCloudAssetPicker } from "./EditorStudioCloudAssetPicker"

export {
  analyzeMarkdownLinks,
  computeCursorLineAndColumn,
  countMarkdownLinkWarnings,
  countMarkdownTotalLinks,
  formatCategoryDraftInputValue,
  resolveActiveOutlineItemIndex,
  resolveViewportPanelUiMask,
  toCategorySuggestionLabels,
} from "./editorStudioDedicatedSurfaceModel"
export { EditorStudioDedicatedEditorLoadingState }

const dismissMobilePanelsOnCanvasTap = (
  isZenMode: boolean,
  setPanelUiMask: (updater: (m: number) => number) => void
) => {
  if (isMobileEditorViewport() && !isZenMode) {
    setPanelUiMask((m) => m & ~EDITOR_SURFACE_ZEN_BITS)
  }
}

const subscribeMediaQueryChange = (media: MediaQueryList, listener: () => void) => {
  if (typeof media.addEventListener !== "function") {
    return () => undefined
  }
  media.addEventListener("change", listener)
  return () => media.removeEventListener("change", listener)
}

const useResponsiveEditorPanelEffects = (
  setPanelUiMask: (updater: (m: number) => number) => void,
  handleToggleZenMode: () => void
) => {
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mobileMedia = window.matchMedia("(max-width: 820px)")
    const tabletMedia = window.matchMedia("(max-width: 1100px)")
    const syncViewportPanels = () => {
      setPanelUiMask((m) =>
        resolveViewportPanelUiMask(m, {
          isMobileViewport: mobileMedia.matches,
          isTabletViewport: !mobileMedia.matches && tabletMedia.matches,
        })
      )
    }
    syncViewportPanels()
    const unsubscribeMobile = subscribeMediaQueryChange(mobileMedia, syncViewportPanels)
    const unsubscribeTablet = subscribeMediaQueryChange(tabletMedia, syncViewportPanels)
    return () => {
      unsubscribeMobile()
      unsubscribeTablet()
    }
  }, [setPanelUiMask])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault()
        handleToggleZenMode()
        return
      }
      if (event.key === "Escape" && isMobileEditorViewport()) {
        setPanelUiMask((m) => m & ~EDITOR_SURFACE_ZEN_BITS)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleToggleZenMode, setPanelUiMask])
}

export const EditorStudioDedicatedEditorSurface = ({
  thumbnailImageFileInputRef, onThumbnailImageFileChange, onExit, saveStateText, saveStateTone,
  primaryActionDisabled, primaryActionLabel, onPrimaryAction, postTags, tagDraft, onTagDraftChange,
  onAddTags, onAddTag, onRemoveTag, titleInputRef, onOutlineBodyHeadingActivate, activeCursorOffset,
  activeSelectionRange, postTitle, onPostTitleChange, onPostTitleKeyDown, postContent, postSummary,
  onPostSummaryChange, postCategory, onPostCategoryChange, onCommitPostCategory, categorySuggestions,
  tagSuggestions = [], postVisibility, onPostVisibilityChange, editorCanvas, showPublishNotice,
  publishNoticeTone, publishNoticeText, onReloadLatestServerPost = null, isLocalDraftRestoreSuggestionVisible,
  isLocalDraftRestoreSuggestionActionsDisabled, onRestoreLocalDraft, localDraftCandidates,
  selectedLocalDraftCandidateKey, onSelectLocalDraftCandidate, onDiscardLocalDraftCandidate,
  onDismissLocalDraftRestoreSuggestion, onClearLocalDraft, publishModal, onUploadPostImage, onUploadPostAttachment, onInsertMarkdownSnippet,
}: EditorStudioDedicatedEditorSurfaceProps) => {
  const [panelUiMask, setPanelUiMask] = useState(EDITOR_SURFACE_ZEN_BITS)
  const isGuideOpen = (panelUiMask & EDITOR_SURFACE_GUIDE_OPEN) !== 0
  const isOutlineOpen = (panelUiMask & EDITOR_SURFACE_OUTLINE_OPEN) !== 0
  const isInspectorOpen = (panelUiMask & EDITOR_SURFACE_INSPECTOR_OPEN) !== 0
  const isMobilePropertiesOpen = (panelUiMask & EDITOR_SURFACE_MOBILE_PROPS_OPEN) !== 0
  const setIsGuideOpen = useCallback((v: boolean) => setPanelUiMask((m) => applyBitFlag(m, EDITOR_SURFACE_GUIDE_OPEN, v)), [])
  const setIsOutlineOpen = useCallback((fn: boolean | ((p: boolean) => boolean)) => setPanelUiMask((m) => applyBitFlag(m, EDITOR_SURFACE_OUTLINE_OPEN, fn)), [])
  const setIsInspectorOpen = useCallback((fn: boolean | ((p: boolean) => boolean)) => setPanelUiMask((m) => applyBitFlag(m, EDITOR_SURFACE_INSPECTOR_OPEN, fn)), [])
  const setIsMobilePropertiesOpen = useCallback((fn: (p: boolean) => boolean) => setPanelUiMask((m) => applyBitFlag(m, EDITOR_SURFACE_MOBILE_PROPS_OPEN, fn)), [])
  const [lastActivatedOutlineOffset, setLastActivatedOutlineOffset] = useState<number | null>(null)
  const titleNodeRef = useRef<HTMLTextAreaElement | null>(null)
  const isZenMode = !isOutlineOpen && !isInspectorOpen
  const isPublishModalVisible = Boolean(publishModal)

  const handleToggleZenMode = useCallback(() => setPanelUiMask(toggleZenBits), [])
  const toggleResponsiveSidebar = useCallback(
    (targetBit: number) => setPanelUiMask((m) => toggleResponsiveSidebarBits(m, targetBit)),
    []
  )

  useResponsiveEditorPanelEffects(setPanelUiMask, handleToggleZenMode)

  useEffect(() => {
    if (!isPublishModalVisible) return
    setPanelUiMask((m) =>
      isMobileEditorViewport()
        ? m & ~(EDITOR_SURFACE_ZEN_BITS | EDITOR_SURFACE_GUIDE_OPEN)
        : m & ~EDITOR_SURFACE_GUIDE_OPEN
    )
  }, [isPublishModalVisible])

  const deferredPostContent = useDeferredValue(postContent)
  const outlineInsights = useMemo(() => createMarkdownDocumentInsights(deferredPostContent), [deferredPostContent])
  const outlineItems = useMemo(
    () => buildEditorOutlineItems(postTitle, outlineInsights.headings),
    [outlineInsights.headings, postTitle]
  )
  const activeOutlineIndex = useMemo(
    () => resolveActiveOutlineItemIndex(outlineItems, activeCursorOffset ?? lastActivatedOutlineOffset),
    [activeCursorOffset, lastActivatedOutlineOffset, outlineItems]
  )
  const linkWarningCount = useMemo(() => countMarkdownLinkWarnings(deferredPostContent), [deferredPostContent])
  const totalLinkCount = useMemo(() => countMarkdownTotalLinks(deferredPostContent), [deferredPostContent])
  const cursorPosition = useMemo(
    () => computeCursorLineAndColumn(deferredPostContent, activeCursorOffset),
    [activeCursorOffset, deferredPostContent]
  )
  const selectedCharCount = computeSelectedCharCount(activeSelectionRange)
  const handleTagDraftChange = (nextValue: string) =>
    applyCommaSeparatedTagDraft(nextValue, onTagDraftChange, onAddTags)
  const handleTagDraftKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) =>
    handleTagInputKeyDown(event, onAddTag)
  const handleTitleInputRef = useCallback((node: HTMLTextAreaElement | null) => {
    titleNodeRef.current = node
    titleInputRef(node)
  }, [titleInputRef])
  const availableTagSuggestions = useMemo(() => {
    const selected = new Set(postTags)
    return tagSuggestions.filter((tag) => !selected.has(tag))
  }, [postTags, tagSuggestions])
  const decodedCategorySuggestions = useMemo(
    () => toCategorySuggestionLabels(categorySuggestions),
    [categorySuggestions]
  )
  const localDraftRestoreCardNode = (
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
  )

  return (
    <EditorStudioRoot>
      <EditorStudioPageHeading>글 편집</EditorStudioPageHeading>
      <EditorHiddenFileInput ref={thumbnailImageFileInputRef} type="file" accept="image/*" onChange={onThumbnailImageFileChange} />
      <datalist id="editor-tag-suggestions">
        {availableTagSuggestions.map((tag) => <option key={tag} value={tag} />)}
      </datalist>

      <EditorStudioDedicatedTopBar>
        <EditorStudioTopBarLead>
          <EditorExitAction type="button" onClick={onExit}>← 글 관리</EditorExitAction>
          <EditorSidebarToggleButton
            type="button"
            $active={isOutlineOpen}
            onClick={() => toggleResponsiveSidebar(EDITOR_SURFACE_OUTLINE_OPEN)}
            aria-label="문서 목차 토글"
            title="문서 목차 토글"
          >
            목차
          </EditorSidebarToggleButton>
        </EditorStudioTopBarLead>

        {saveStateText ? <EditorStudioSaveState data-tone={saveStateTone}>{saveStateText}</EditorStudioSaveState> : <span />}

        <EditorStudioTopBarActions>
          <EditorSidebarToggleButton
            type="button"
            data-mobile-hidden="true"
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
            onClick={() => toggleResponsiveSidebar(EDITOR_SURFACE_INSPECTOR_OPEN)}
            aria-label="메타 패널 토글"
            title="메타 패널 토글"
          >
            메타 패널
          </EditorSidebarToggleButton>
          <SecondaryButton type="button" onClick={() => setIsGuideOpen(true)}>Markdown 가이드</SecondaryButton>
          <PrimaryButton type="button" disabled={primaryActionDisabled} onClick={onPrimaryAction}>
            {primaryActionLabel}
          </PrimaryButton>
        </EditorStudioTopBarActions>
      </EditorStudioDedicatedTopBar>

      <EditorStudioFrame data-testid="editor-studio-frame" $showOutline={isOutlineOpen} $showInspector={isInspectorOpen}>
        {renderEditorOutlinePanel({
          isOutlineOpen,
          outlineItems,
          activeOutlineIndex,
          setIsOutlineOpen,
          setLastActivatedOutlineOffset,
          onOutlineBodyHeadingActivate,
          focusTitle: () => titleNodeRef.current?.focus(),
        })}

        <EditorStudioWritingColumn
          data-testid="editor-writing-column"
          $zenMode={isZenMode}
          onPointerDown={() => dismissMobilePanelsOnCanvasTap(isZenMode, setPanelUiMask)}
        >
          <EditorStudioDedicatedMetaSection>
            {localDraftRestoreCardNode}
            <TitleInput
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
              $collapsedWhenInspectorOpen={isInspectorOpen && !isZenMode}
            >
              <EditorTagRow aria-label="태그 입력">
                {postTags.map((tag) => (
                  <SelectedTagChip key={tag}>
                    <span className="label">{tag}</span>
                    <button type="button" onClick={() => onRemoveTag(tag)} aria-label={`${tag} 삭제`}>
                      ×
                    </button>
                  </SelectedTagChip>
                ))}
                <InlineMetaInput
                  list="editor-tag-suggestions"
                  placeholder="태그 입력 후 Enter"
                  value={tagDraft}
                  onChange={(event) => handleTagDraftChange(event.target.value)}
                  onKeyDown={handleTagDraftKeyDown}
                />
              </EditorTagRow>
              {postCategory.trim() ? <EditorHeaderMetaPill data-testid="editor-category-meta-pill">분류 · {splitCategoryDisplay(postCategory).label}</EditorHeaderMetaPill> : null}
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

          {renderPublishNoticeBanner({
            showPublishNotice,
            publishNoticeTone,
            publishNoticeText,
            onReloadLatestServerPost,
            actionsDisabled: isLocalDraftRestoreSuggestionActionsDisabled,
          })}
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
                  placeholder="분류 입력 또는 선택"
                  value={formatCategoryDraftInputValue(postCategory)}
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
                {decodedCategorySuggestions.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
              <small>하나의 글에는 넓은 분류를 하나만 선택하세요. 세부 키워드는 태그로 추가할 수 있습니다.</small>
            </label>
            <section>
              <span>태그</span>
              <EditorTagRow aria-label="발행 태그">
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
                  list="editor-tag-suggestions"
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
            <EditorStudioCloudAssetPicker onUploadPostImage={onUploadPostImage} onUploadPostAttachment={onUploadPostAttachment} onInsertMarkdownSnippet={onInsertMarkdownSnippet} />
            {linkWarningCount > 0 ? (
              <p role="alert">링크 주소가 비어 있거나 http:// 또는 https://만 입력된 링크가 {linkWarningCount}개 있습니다. 주소를 완성해 주세요.</p>
            ) : null}
          </EditorInspector>
        ) : null}
      </EditorStudioFrame>

      {isGuideOpen ? <EditorStudioGuideModal onClose={() => setIsGuideOpen(false)} /> : null}

      {publishModal}
    </EditorStudioRoot>
  )
}
