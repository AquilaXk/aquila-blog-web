/**
 * 참조 구현:
 * - TryGhost/Ghost apps/admin/src/editor/{editor-screen.tsx,post-editor.tsx,post-settings-sidebar.tsx} (MIT License, Copyright (c) Ghost Foundation)
 * - TryGhost/Koenig packages/koenig-lexical/ (MIT License, Copyright (c) Ghost Foundation)
 * - marktext/marktext src/muya/lib/contentState/focus.ts (MIT License, Copyright (c) 2018-present Jocs / MarkText)
 */
import type { KeyboardEventHandler } from "react"
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useLanguage } from "src/libs/language"
import {
  EditorIconArrowLeft,
  EditorIconBookOpen,
  EditorIconClose,
  EditorIconMaximize,
  EditorIconSidebarLeft,
  EditorIconSidebarRight,
} from "src/components/markdown-editor/MarkdownEditorIcons"
import { adminT } from "./adminI18n"
import { createMarkdownDocumentInsights } from "src/libs/markdown/markdownDocumentInsights"
import { splitCategoryDisplay } from "src/libs/utils"
import {
  EditorExitAction,
  EditorHeaderMetaPill,
  EditorHeaderMetaRow,
  EditorHiddenFileInput,
  EditorSidebarToggleButton,
  EditorStudioDedicatedCanvasSection,
  EditorStudioDedicatedMetaSection,
  EditorStudioDedicatedTopBar,
  EditorStudioFrame,
  EditorStudioGuideModal,
  EditorStudioPageHeading,
  EditorStudioPaperScrollSheet,
  EditorStudioRoot,
  EditorStudioSaveState,
  EditorStudioToolbarDock,
  EditorStudioTopBarActions,
  EditorStudioTopBarLead,
  EditorStudioWritingColumn,
  EditorTagRow,
  EditorVisibilityMonoPill,
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
  renderEditorFloatingStatusHud,
  renderEditorInspectorPanel,
  renderEditorOutlinePanel,
  renderFloatingMiniTocSpine,
  renderPublishNoticeBanner,
  type EditorStudioDedicatedEditorSurfaceProps,
} from "./EditorStudioDedicatedSurfaceComponents"
import {
  EDITOR_SURFACE_FOCUS_MODE,
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
  handleTagInputKeyDown,
  isComposingKeyboardEvent,
  isMobileEditorViewport,
  resolveActiveOutlineItemIndex,
  resolveViewportPanelUiMask,
  toCategorySuggestionLabels,
  toggleFocusModeBits,
  toggleResponsiveSidebarBits,
} from "./editorStudioDedicatedSurfaceModel"
import { PREVIEW_SUMMARY_MAX_LENGTH } from "./editorStudioMetaModel"
import {
  EditorialMetaInner,
  EditorEditorialDivider,
  EditorSaveStatusDot,
  EditorToggleIconWrap,
  EditorWritingChromeBlock,
  EditorWritingChromeDim,
  InlineExcerptInput,
} from "./EditorStudioEditorialStyles"
import { EditorStudioFeatureImageBar } from "./EditorStudioFeatureImageBar"
import {
  readStoredDesktopSidebarMask,
  useAutosizeTextarea,
  useEditorWritingFocus,
  writeStoredDesktopSidebarMask,
} from "./editorStudioWritingFocus"

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
  defaultPanelUiMask: number | undefined,
  setPanelUiMask: (updater: (m: number) => number) => void,
  handleToggleZenMode: () => void
) => {
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mobileMedia = window.matchMedia("(max-width: 820px)")
    const tabletMedia = window.matchMedia("(max-width: 1100px)")
    if (defaultPanelUiMask === undefined && !mobileMedia.matches) {
      const stored = readStoredDesktopSidebarMask()
      if (stored !== 0) {
        setPanelUiMask((m) =>
          resolveViewportPanelUiMask(m | stored, {
            isMobileViewport: false,
            isTabletViewport: tabletMedia.matches,
          })
        )
      }
    }
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
  }, [defaultPanelUiMask, setPanelUiMask])

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
}

export const EditorStudioDedicatedEditorSurface = ({
  defaultPanelUiMask,
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
  postThumbnailUrl, safePreviewThumbnail, isThumbnailUploading, isThumbnailUploadDisabled, onOpenThumbnailFileInput, onResetThumbnailToAutoMode,
  managedPostId = null, postVersion = null, isTempDraftMode = false, onRevisionRestored,
}: EditorStudioDedicatedEditorSurfaceProps) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const [panelUiMask, setPanelUiMask] = useState(defaultPanelUiMask ?? 0)
  const isGuideOpen = (panelUiMask & EDITOR_SURFACE_GUIDE_OPEN) !== 0
  const isOutlineOpen = (panelUiMask & EDITOR_SURFACE_OUTLINE_OPEN) !== 0
  const isInspectorOpen = (panelUiMask & EDITOR_SURFACE_INSPECTOR_OPEN) !== 0
  const isMobilePropertiesOpen = (panelUiMask & EDITOR_SURFACE_MOBILE_PROPS_OPEN) !== 0
  const setIsGuideOpen = useCallback((v: boolean) => setPanelUiMask((m) => applyBitFlag(m, EDITOR_SURFACE_GUIDE_OPEN, v)), [])
  const setIsOutlineOpen = useCallback((fn: boolean | ((p: boolean) => boolean)) => {
    setPanelUiMask((m) => {
      const next = applyBitFlag(m, EDITOR_SURFACE_OUTLINE_OPEN, fn)
      if (!isMobileEditorViewport()) writeStoredDesktopSidebarMask(next)
      return next
    })
  }, [])
  const setIsInspectorOpen = useCallback((fn: boolean | ((p: boolean) => boolean)) => {
    setPanelUiMask((m) => {
      const next = applyBitFlag(m, EDITOR_SURFACE_INSPECTOR_OPEN, fn)
      if (!isMobileEditorViewport()) writeStoredDesktopSidebarMask(next)
      return next
    })
  }, [])
  const setIsMobilePropertiesOpen = useCallback((fn: (p: boolean) => boolean) => setPanelUiMask((m) => applyBitFlag(m, EDITOR_SURFACE_MOBILE_PROPS_OPEN, fn)), [])
  const [lastActivatedOutlineOffset, setLastActivatedOutlineOffset] = useState<number | null>(null)
  const titleNodeRef = useRef<HTMLTextAreaElement | null>(null)
  const excerptNodeRef = useRef<HTMLTextAreaElement | null>(null)
  const writingAreaRef = useRef<HTMLElement | null>(null)
  const isZenMode = (panelUiMask & EDITOR_SURFACE_FOCUS_MODE) !== 0
  const isPublishModalVisible = Boolean(publishModal)
  const writingFocus = useEditorWritingFocus({
    blocked: isOutlineOpen || isInspectorOpen || isGuideOpen || isPublishModalVisible,
    writingAreaRef,
  })

  useAutosizeTextarea(titleNodeRef, postTitle)
  useAutosizeTextarea(excerptNodeRef, postSummary)

  const handleToggleZenMode = useCallback(() => {
    setPanelUiMask((m) => {
      const next = toggleFocusModeBits(m)
      if (!isMobileEditorViewport()) writeStoredDesktopSidebarMask(next)
      return next
    })
  }, [])
  const toggleResponsiveSidebar = useCallback((targetBit: number) => {
    setPanelUiMask((m) => {
      const next = toggleResponsiveSidebarBits(m, targetBit)
      if (!isMobileEditorViewport()) writeStoredDesktopSidebarMask(next)
      return next
    })
  }, [])

  useResponsiveEditorPanelEffects(defaultPanelUiMask, setPanelUiMask, handleToggleZenMode)

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
  const selectedCharCount = computeSelectedCharCount(activeSelectionRange)
  const cursorPosition = useMemo(
    () => computeCursorLineAndColumn(deferredPostContent, activeCursorOffset),
    [activeCursorOffset, deferredPostContent]
  )
  const visibilityShortLabel = useMemo(() => {
    if (isTempDraftMode) return adminT("editorVisibilityShortDraft", language)
    if (postVisibility === "PUBLIC_LISTED") return adminT("editorVisibilityShortPublic", language)
    if (postVisibility === "PUBLIC_UNLISTED") return adminT("editorVisibilityShortUnlisted", language)
    return adminT("editorVisibilityShortPrivate", language)
  }, [isTempDraftMode, language, postVisibility])
  const handleTagDraftChange = (nextValue: string) =>
    applyCommaSeparatedTagDraft(nextValue, onTagDraftChange, onAddTags)
  const handleTagDraftKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) =>
    handleTagInputKeyDown(event, onAddTag)
  const handleTitleInputRef = useCallback((node: HTMLTextAreaElement | null) => {
    titleNodeRef.current = node
    titleInputRef(node)
  }, [titleInputRef])
  const handleInlineExcerptKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      if (isComposingKeyboardEvent(event)) return
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        onOutlineBodyHeadingActivate({ from: 0, to: 0 })
        return
      }
      const target = event.currentTarget
      if (
        event.key === "ArrowDown" &&
        target.selectionStart === target.selectionEnd &&
        target.selectionEnd === target.value.length
      ) {
        event.preventDefault()
        onOutlineBodyHeadingActivate({ from: 0, to: 0 })
      } else if (
        event.key === "ArrowUp" &&
        target.selectionStart === target.selectionEnd &&
        target.selectionStart === 0
      ) {
        event.preventDefault()
        titleNodeRef.current?.focus()
      }
    },
    [onOutlineBodyHeadingActivate]
  )
  const availableTagSuggestions = useMemo(() => {
    const selected = new Set(postTags)
    return tagSuggestions.filter((tag) => !selected.has(tag))
  }, [postTags, tagSuggestions])
  const decodedCategorySuggestions = useMemo(
    () => toCategorySuggestionLabels(categorySuggestions),
    [categorySuggestions]
  )
  const hasFeatureImage = Boolean(postThumbnailUrl?.trim() || safePreviewThumbnail?.trim())

  return (
    <EditorStudioRoot data-writing-focus={writingFocus} data-focus-mode={isZenMode ? "true" : "false"}>
      <EditorStudioPageHeading>{adminT("editorPageHeading", language)}</EditorStudioPageHeading>
      <EditorHiddenFileInput ref={thumbnailImageFileInputRef} type="file" accept="image/*" onChange={onThumbnailImageFileChange} />
      <datalist id="editor-tag-suggestions">
        {availableTagSuggestions.map((tag) => <option key={tag} value={tag} />)}
      </datalist>

      <EditorStudioDedicatedTopBar>
        <EditorStudioTopBarLead>
          <EditorExitAction type="button" onClick={onExit} aria-label={`← ${adminT("editorBackToPosts", language)}`}>
            <EditorIconArrowLeft size={14} />
            <span>{adminT("editorBackToPosts", language)}</span>
          </EditorExitAction>
          <EditorWritingChromeDim data-writing-focus={writingFocus}>
            <EditorSidebarToggleButton
              type="button"
              $active={isOutlineOpen}
              aria-pressed={isOutlineOpen}
              onClick={() => toggleResponsiveSidebar(EDITOR_SURFACE_OUTLINE_OPEN)}
              aria-label={adminT("editorOutlineToggle", language)}
              title={adminT("editorOutlineToggle", language)}
            >
              <EditorToggleIconWrap aria-hidden="true">
                <EditorIconSidebarLeft size={14} />
              </EditorToggleIconWrap>
              <span>{adminT("editorOutlineTitle", language)}</span>
            </EditorSidebarToggleButton>
          </EditorWritingChromeDim>
        </EditorStudioTopBarLead>

        <EditorWritingChromeDim data-writing-focus={writingFocus}>
          {saveStateText ? (
            <EditorStudioSaveState data-tone={saveStateTone}>
              <EditorSaveStatusDot aria-hidden="true" />
              <span>{saveStateText}</span>
            </EditorStudioSaveState>
          ) : null}
          <EditorVisibilityMonoPill>{visibilityShortLabel}</EditorVisibilityMonoPill>
        </EditorWritingChromeDim>

        <EditorWritingChromeDim data-writing-focus={writingFocus}>
          <EditorStudioTopBarActions>
            <EditorSidebarToggleButton
              type="button"
              data-mobile-hidden="true"
              $active={isZenMode}
              aria-pressed={isZenMode}
              onMouseDown={(event) => event.preventDefault()} onClick={handleToggleZenMode}
              aria-label={adminT("editorZenToggle", language)}
              title={adminT("editorZenTitle", language)}
            >
              <EditorToggleIconWrap aria-hidden="true">
                <EditorIconMaximize size={14} />
              </EditorToggleIconWrap>
              <span>{isZenMode ? adminT("editorZenActiveLabel", language) : isEn ? adminT("editorZenLabel", language) : "집중 모드"}</span>
            </EditorSidebarToggleButton>
            <EditorSidebarToggleButton
              type="button"
              $active={isInspectorOpen}
              aria-pressed={isInspectorOpen}
              onClick={() => toggleResponsiveSidebar(EDITOR_SURFACE_INSPECTOR_OPEN)}
              aria-label={adminT("editorSettingsToggle", language)}
              title={adminT("editorSettingsToggle", language)}
            >
              <EditorToggleIconWrap aria-hidden="true">
                <EditorIconSidebarRight size={14} />
              </EditorToggleIconWrap>
              <span>{adminT("editorSettingsLabel", language)}</span>
            </EditorSidebarToggleButton>
            <SecondaryButton type="button" onClick={() => setIsGuideOpen(true)}>
              <EditorIconBookOpen size={14} />
              <span>{adminT("editorGuideButton", language)}</span>
            </SecondaryButton>
            <PrimaryButton
              type="button"
              data-testid="editor-publish-open-button"
              disabled={primaryActionDisabled}
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </PrimaryButton>
          </EditorStudioTopBarActions>
        </EditorWritingChromeDim>
      </EditorStudioDedicatedTopBar>

      <EditorStudioFrame data-testid="editor-studio-frame" $showOutline={isOutlineOpen} $showInspector={isInspectorOpen}>
        {renderEditorOutlinePanel({
          language,
          isOutlineOpen,
          outlineItems,
          activeOutlineIndex,
          readingMinutes: outlineInsights.readingMinutes,
          setIsOutlineOpen,
          setLastActivatedOutlineOffset,
          onOutlineBodyHeadingActivate,
          focusTitle: () => titleNodeRef.current?.focus(),
        })}

        <EditorStudioWritingColumn
          ref={writingAreaRef}
          data-testid="editor-writing-column"
          $zenMode={isZenMode}
          onPointerDown={() => dismissMobilePanelsOnCanvasTap(isZenMode, setPanelUiMask)}
        >
          <EditorStudioToolbarDock id="editor-studio-toolbar-slot" />
          <EditorStudioPaperScrollSheet data-testid="editor-paper-scroll-sheet">
            {renderFloatingMiniTocSpine({
              language,
              isOutlineOpen,
              outlineItems,
              activeOutlineIndex,
              writingFocus,
              onOpenOutline: () => setIsOutlineOpen(true),
            })}

            <EditorStudioDedicatedMetaSection>
              <EditorialMetaInner>
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
                <EditorWritingChromeBlock data-writing-focus={hasFeatureImage ? undefined : writingFocus}>
                  <EditorStudioFeatureImageBar
                    postThumbnailUrl={postThumbnailUrl}
                    safePreviewThumbnail={safePreviewThumbnail}
                    isThumbnailUploading={isThumbnailUploading}
                    isThumbnailUploadDisabled={isThumbnailUploadDisabled}
                    onOpenThumbnailFileInput={onOpenThumbnailFileInput}
                    onResetThumbnailToAutoMode={onResetThumbnailToAutoMode}
                  />
                </EditorWritingChromeBlock>
                <TitleInput
                  ref={handleTitleInputRef}
                  id="post-title"
                  placeholder={adminT("editorTitlePlaceholder", language)}
                  rows={1}
                  value={postTitle}
                  onChange={onPostTitleChange}
                  onKeyDown={onPostTitleKeyDown}
                />
                <InlineExcerptInput
                  ref={excerptNodeRef}
                  data-testid="editor-inline-excerpt"
                  aria-label={isInspectorOpen ? adminT("editorSubtitleLabel", language) : adminT("editorSummaryLabel", language)}
                  placeholder={adminT("editorSummaryPlaceholder", language)}
                  rows={1}
                  maxLength={PREVIEW_SUMMARY_MAX_LENGTH}
                  value={postSummary}
                  onChange={(event) => onPostSummaryChange(event.target.value.replace(/\r\n?/g, " "))}
                  onKeyDown={handleInlineExcerptKeyDown}
                />
                <MobilePropertiesToggle
                  type="button"
                  onClick={() => setIsMobilePropertiesOpen((prev) => !prev)}
                  aria-label={adminT("editorPropsToggleAria", language)}
                >
                  {adminT("editorPropsLabel", language)}{" "}
                  {isMobilePropertiesOpen
                    ? adminT("editorPropsCollapse", language)
                    : isEn
                      ? `${adminT("editorPropsExpand", language)} (${postTags.length} ${adminT("editorTagsUnitSuffix", language)}) ▼`
                      : `${adminT("editorPropsExpand", language)} (${postTags.length}개 태그) ▼`}
                </MobilePropertiesToggle>
                <EditorHeaderMetaRow
                  $collapsedOnMobile={!isMobilePropertiesOpen}
                  $collapsedWhenInspectorOpen={isInspectorOpen && !isZenMode}
                >
                  <EditorTagRow aria-label={adminT("editorTagInputAria", language)}>
                    {postTags.map((tag) => (
                      <SelectedTagChip key={tag}>
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
                    <InlineMetaInput
                      list="editor-tag-suggestions"
                      placeholder={adminT("editorTagPlaceholder", language)}
                      value={tagDraft}
                      onChange={(event) => handleTagDraftChange(event.target.value)}
                      onKeyDown={handleTagDraftKeyDown}
                    />
                  </EditorTagRow>
                  {postCategory.trim() ? (
                    <EditorHeaderMetaPill data-testid="editor-category-meta-pill">
                      {adminT("editorCategoryBadgePrefix", language)} · {splitCategoryDisplay(postCategory).label}
                    </EditorHeaderMetaPill>
                  ) : null}
                </EditorHeaderMetaRow>
                <EditorEditorialDivider aria-hidden="true" />
              </EditorialMetaInner>
            </EditorStudioDedicatedMetaSection>

            <EditorStudioDedicatedCanvasSection>{editorCanvas}</EditorStudioDedicatedCanvasSection>
          </EditorStudioPaperScrollSheet>

          {renderEditorFloatingStatusHud({
            language,
            sidebarsOpen: isOutlineOpen || isInspectorOpen,
            writingFocus,
            cursorLine: cursorPosition.line,
            cursorColumn: cursorPosition.column,
            selectedCharCount,
            wordCount: outlineInsights.wordCount,
            readingMinutes: outlineInsights.readingMinutes,
            totalLinkCount,
            linkWarningCount,
          })}

          {renderPublishNoticeBanner({
            language,
            showPublishNotice,
            publishNoticeTone,
            publishNoticeText,
            onReloadLatestServerPost,
            actionsDisabled: isLocalDraftRestoreSuggestionActionsDisabled,
          })}
        </EditorStudioWritingColumn>

        {renderEditorInspectorPanel({
          language,
          isInspectorOpen,
          onCloseInspector: () => setIsInspectorOpen(false),
          postSummary,
          onPostSummaryChange,
          postTags,
          onRemoveTag,
          tagDraft,
          onTagDraftChange: handleTagDraftChange,
          onTagDraftKeyDown: handleTagDraftKeyDown,
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
          postVersion,
          actionsDisabled: isLocalDraftRestoreSuggestionActionsDisabled,
          onRevisionRestored,
          currentTitle: postTitle,
          currentTags: postTags,
          currentContent: postContent,
        })}
      </EditorStudioFrame>

      {isGuideOpen ? <EditorStudioGuideModal onClose={() => setIsGuideOpen(false)} /> : null}

      {publishModal}
    </EditorStudioRoot>
  )
}
