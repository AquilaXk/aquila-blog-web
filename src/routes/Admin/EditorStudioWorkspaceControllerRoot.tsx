import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/router"
import {
  type SetStateAction, useDeferredValue, useCallback, useEffect, useMemo, useRef, useState, useTransition,
} from "react"
import { layoutBreakpoint } from "src/design-system/tokens"
import useAuthSession from "src/hooks/useAuthSession"
import { normalizeCategoryValue } from "src/libs/utils"
import {
  toFlags, toVisibility, type EditorMode, type PostVisibility, type PublishActionType,
} from "./editorStudioState"
import { useEditorStudioDraftLifecycle } from "./useEditorStudioDraftLifecycle"
import { useEditorStudioPersistence } from "./useEditorStudioPersistence"
import { useEditorStudioRouting } from "./useEditorStudioRouting"
import { useEditorStudioThumbnailControls } from "./useEditorStudioThumbnailControls"
import { useEditorStudioThumbnailPreview } from "./useEditorStudioThumbnailPreview"
import { useEditorStudioMetaCatalog } from "./useEditorStudioMetaCatalog"
import { useEditorStudioPublishModalFlow } from "./useEditorStudioPublishModalFlow"
import { useEditorStudioWorkspaceControllerRuntime } from "./useEditorStudioWorkspaceControllerRuntime"
import { EditorStudioWorkspaceControllerRootView } from "./EditorStudioWorkspaceControllerRootView"
import {
  buildEditorStateFingerprint, buildLocalDraftFingerprint, composeEditorContent,
  computeContentFingerprint, dedupeStrings, detectPublishPlaceholderIssue,
  extractFirstMarkdownImage, normalizeSafeImageUrl, normalizeSafePreviewThumbnailUrl,
  resolveEditorMetaSnapshot, type ResolvedEditorMetaSnapshot,
} from "./editorStudioMetaModel"
import { replaceShallowRoutePreservingScroll } from "src/libs/router"
import type { AdminPageProps } from "src/libs/server/adminPage"
import {
  DEFAULT_THUMBNAIL_FOCUS_X, DEFAULT_THUMBNAIL_FOCUS_Y, DEFAULT_THUMBNAIL_ZOOM, stripThumbnailFocusFromUrl,
} from "src/libs/thumbnailFocus"
import { persistLocalDraft, readLocalDraft, removeLocalDraft } from "./editorStudioStorageModel"
import {
  ADMIN_POSTS_WORKSPACE_ROUTE, EDITOR_NEW_ROUTE_PATH, buildEffectiveThumbnailUrl,
  buildEmptyEditorMetaSnapshot, extractImageFileFromClipboard, generateIdempotencyKey,
  isBlankServerTempDraft, normalizeEditorReturnRoute, pretty, requestTempPostWithConflictRetry,
  toEditorPostRoute, uploadWithConflictRetry, type NoticeState, type PostForEditor,
  type CanonicalSummaryState, type SummaryIntent, type RsData,
} from "./EditorStudioWorkspaceControllerRootModel"

const MODAL_UI_PUBLISH_OPEN = 1
const MODAL_UI_MOBILE_THUMB_OPEN = 1 << 1
const MODAL_UI_MOBILE_META_OPEN = 1 << 2
const applyBitFlag = (mask: number, bit: number, action: SetStateAction<boolean>) => {
  const enabled = typeof action === "function" ? action((mask & bit) !== 0) : action
  return enabled ? mask | bit : mask & ~bit
}

type MarkdownEditorFlush = () => string
type MarkdownEditorChangeMeta = {
  editorFocused: boolean
}

type EditorStudioWorkspaceControllerProps = AdminPageProps

export const EditorStudioWorkspaceController = ({
  initialMember,
}: EditorStudioWorkspaceControllerProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { me, authStatus } = useAuthSession()
  const sessionMember = me || initialMember
  const [result, setResult] = useState<string>("")
  const [loadingKey, setLoadingKey] = useState<string>("")
  const [postId, setPostId] = useState("")
  const [postVersion, setPostVersion] = useState<number | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>("create")
  const [isTempDraftMode, setIsTempDraftMode] = useState(false)
  const [postTitle, setPostTitle] = useState("")
  const [postContent, setPostContent] = useState("")
  const deferredPostContent = useDeferredValue(postContent)
  const [, startPostContentTransition] = useTransition()
  const [postSummary, setPostSummary] = useState("")
  const [postSummarySource, setPostSummarySource] = useState<CanonicalSummaryState["summarySource"]>("NONE")
  const [summaryIntent, setSummaryIntent] = useState<SummaryIntent>({ kind: "auto" })
  const [postThumbnailUrl, setPostThumbnailUrl] = useState("")
  const [postThumbnailFocusX, setPostThumbnailFocusX] = useState(DEFAULT_THUMBNAIL_FOCUS_X)
  const [postThumbnailFocusY, setPostThumbnailFocusY] = useState(DEFAULT_THUMBNAIL_FOCUS_Y)
  const [postThumbnailZoom, setPostThumbnailZoom] = useState(DEFAULT_THUMBNAIL_ZOOM)
  const [postTags, setPostTags] = useState<string[]>([])
  const [postCategory, setPostCategory] = useState("")
  const [tagDraft, setTagDraft] = useState("")
  const [postVisibility, setPostVisibility] = useState<PostVisibility>("PUBLIC_LISTED")
  const [publishNotice, setPublishNotice] = useState<NoticeState>({
    tone: "idle",
    text: "",
  })
  const [publishModalNotice, setPublishModalNotice] = useState<NoticeState>({
    tone: "idle",
    text: "",
  })
  const postContentLiveRef = useRef(postContent)
  const flushEditorMarkdownRef = useRef<MarkdownEditorFlush | null>(null)
  const deferredContentDerivedCacheRef = useRef<{
    fingerprint: string
    firstImage: string
  }>({
    fingerprint: "",
    firstImage: "",
  })
  const [modalUiMask, setModalUiMask] = useState(0)
  const isPublishModalOpen = (modalUiMask & MODAL_UI_PUBLISH_OPEN) !== 0
  const isMobileThumbnailEditorOpen = (modalUiMask & MODAL_UI_MOBILE_THUMB_OPEN) !== 0
  const isMobileMetaEditorOpen = (modalUiMask & MODAL_UI_MOBILE_META_OPEN) !== 0
  const setIsPublishModalOpen = useCallback((v: SetStateAction<boolean>) => setModalUiMask((m) => applyBitFlag(m, MODAL_UI_PUBLISH_OPEN, v)), [])
  const setIsMobileThumbnailEditorOpen = useCallback((v: SetStateAction<boolean>) => setModalUiMask((m) => applyBitFlag(m, MODAL_UI_MOBILE_THUMB_OPEN, v)), [])
  const setIsMobileMetaEditorOpen = useCallback((v: SetStateAction<boolean>) => setModalUiMask((m) => applyBitFlag(m, MODAL_UI_MOBILE_META_OPEN, v)), [])
  const [publishActionType, setPublishActionType] = useState<PublishActionType>("create")
  const [previewThumbnailSourceUrl, setPreviewThumbnailSourceUrl] = useState("")
  const [localDraftSavedAt, setLocalDraftSavedAt] = useState("")
  const [isCompactMobileLayout, setIsCompactMobileLayout] = useState(false)

  useEffect(() => {
    postContentLiveRef.current = postContent
  }, [postContent])

  const handleMarkdownEditorChange = useCallback((nextMarkdown: string, meta?: MarkdownEditorChangeMeta) => {
    const previousMarkdown = postContentLiveRef.current
    if (nextMarkdown === previousMarkdown) {
      return
    }

    if (meta?.editorFocused) {
      postContentLiveRef.current = nextMarkdown
      startPostContentTransition(() => {
        setPostContent(nextMarkdown)
      })
      return
    }

    postContentLiveRef.current = nextMarkdown
    setPostContent(nextMarkdown)
  }, [startPostContentTransition])

  const handleFlushMarkdownReady = useCallback((flush: MarkdownEditorFlush | null) => {
    flushEditorMarkdownRef.current = flush
  }, [])

  const getCurrentPostContent = useCallback(() => {
    const flushedMarkdown = flushEditorMarkdownRef.current?.()
    if (typeof flushedMarkdown === "string") {
      postContentLiveRef.current = flushedMarkdown
      return flushedMarkdown
    }
    return postContentLiveRef.current
  }, [])

  const isDedicatedEditorRoute = router.pathname.startsWith("/admin/editor")
  const isDedicatedNewEditorRoute = isDedicatedEditorRoute && router.pathname === EDITOR_NEW_ROUTE_PATH
  const [isNewEditorBootstrapPending, setIsNewEditorBootstrapPending] = useState(isDedicatedNewEditorRoute)
  const redirectingRef = useRef(false)
  const autoLoadedPostIdRef = useRef<string | null>(null)
  const autoCreatedTempDraftRef = useRef(false)
  const tempPostRequestRef = useRef<Promise<RsData<PostForEditor>> | null>(null)
  const lastWriteFingerprintRef = useRef<string>("")
  const lastWriteIdempotencyKeyRef = useRef<string>("")
  const lastLocalDraftFingerprintRef = useRef("")
  const serverBaselineEditorFingerprintRef = useRef("")
  const {
    disabled,
    handleFocusTitle,
    handleTitleChange,
    handleTitleFieldRef,
    handleTitleKeyDown,
    publishModalHintByAction,
    refreshPublicPostReadViews,
    setPublishStatus,
  } = useEditorStudioWorkspaceControllerRuntime({
    isPublishModalOpen,
    loadingKey,
    postId,
    postTitle,
    queryClient,
    setEditorMode,
    setIsTempDraftMode,
    setLoadingKey,
    setPostId,
    setPostTitle,
    setPostVersion,
    setPublishModalNotice,
    setPublishNotice,
    setResult,
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    const media = window.matchMedia(`(max-width: ${layoutBreakpoint.editorCompact}px)`)
    const sync = () => {
      setIsCompactMobileLayout(media.matches)
    }

    sync()

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync)
      return () => media.removeEventListener("change", sync)
    }

    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  const activateComposeSurface = useCallback(() => {
    if (!router.isReady) return
    const nextQuery = { ...router.query }
    delete nextQuery.surface
    void replaceShallowRoutePreservingScroll(router, { query: nextQuery })
  }, [router])

  const syncEditorMeta = useCallback((content: string, canonicalSummary: CanonicalSummaryState) => {
    const snapshot = resolveEditorMetaSnapshot(content)
    postContentLiveRef.current = snapshot.body
    setPostContent(snapshot.body)
    setPostSummary(canonicalSummary.summary)
    setPostSummarySource(canonicalSummary.summarySource)
    setSummaryIntent(canonicalSummary.intent)
    setPostThumbnailUrl(snapshot.thumbnailUrl)
    setPostThumbnailFocusX(snapshot.thumbnailFocusX)
    setPostThumbnailFocusY(snapshot.thumbnailFocusY)
    setPostThumbnailZoom(snapshot.thumbnailZoom)
    setPreviewThumbnailSourceUrl(snapshot.thumbnailUrl)
    setPostTags(snapshot.tags)
    setPostCategory(snapshot.category)
    return snapshot
  }, [])

  const {
    clearLocalDraft,
    dismissedLocalDraft,
    dismissLocalDraftRestoreSuggestion,
    handleLoadOrCreateTempPost,
    localDraftCandidate,
    localDraftCandidates,
    localDraftSource,
    loadPostForEditor,
    reloadLatestServerPost,
    restoredLocalDraft,
    restoreLocalDraft,
    selectLocalDraftCandidate,
    discardLocalDraftCandidate,
    signalLocalDraftBaselineReady,
  } = useEditorStudioDraftLifecycle({
    router,
    toEditorPostRoute,
    postId,
    postVersion,
    loadingKey,
    postTitle,
    postContent,
    getCurrentPostContent,
    postSummary,
    postSummarySource,
    summaryIntent,
    postThumbnailUrl,
    postThumbnailFocusX,
    postThumbnailFocusY,
    postThumbnailZoom,
    postTags,
    postCategory,
    postVisibility,
    editorMode,
    setEditorMode,
    setIsTempDraftMode,
    setPostId,
    setPostVersion,
    setPreviewThumbnailSourceUrl,
    setPostTitle,
    setPostContent,
    setPostSummary,
    setPostSummarySource,
    setSummaryIntent,
    setPostThumbnailUrl,
    setPostThumbnailFocusX,
    setPostThumbnailFocusY,
    setPostThumbnailZoom,
    setPostTags,
    setPostCategory,
    setPostVisibility,
    setLocalDraftSavedAt,
    setLoadingKey,
    setResult,
    setIsNewEditorBootstrapPending,
    activateComposeSurface,
    setPublishStatus,
    dedupeStrings,
    normalizeCategoryValue,
    buildLocalDraftFingerprint,
    persistLocalDraft,
    readLocalDraft,
    removeLocalDraft,
    buildEditorStateFingerprint,
    pretty,
    resolveEditorMetaSnapshot,
    syncEditorMeta,
    buildEmptyEditorMetaSnapshot,
    isBlankServerTempDraft: (post, snapshot) =>
      isBlankServerTempDraft(
        post as Pick<PostForEditor, "title" | "published" | "listed" | "tempDraft">,
        snapshot as ResolvedEditorMetaSnapshot
      ),
    toVisibility,
    requestTempPostWithConflictRetry: async (resolveExistingTempPost) =>
      (await requestTempPostWithConflictRetry(
        async () => (await resolveExistingTempPost()) as PostForEditor | null
      )) as RsData<PostForEditor>,
    defaultThumbnailFocusX: DEFAULT_THUMBNAIL_FOCUS_X,
    defaultThumbnailFocusY: DEFAULT_THUMBNAIL_FOCUS_Y,
    defaultThumbnailZoom: DEFAULT_THUMBNAIL_ZOOM,
    lastLocalDraftFingerprintRef,
    lastWriteFingerprintRef,
    lastWriteIdempotencyKeyRef,
    serverBaselineEditorFingerprintRef,
    tempPostRequestRef,
  })

  const deferredContentDerived = useMemo(() => {
    const fingerprint = computeContentFingerprint(deferredPostContent)
    const cached = deferredContentDerivedCacheRef.current
    if (cached.fingerprint === fingerprint) {
      return cached
    }

    const next = {
      fingerprint,
      firstImage: extractFirstMarkdownImage(deferredPostContent),
    }
    deferredContentDerivedCacheRef.current = next
    return next
  }, [deferredPostContent])

  const handlePostSummaryChange = useCallback((summary: string) => {
    if (summary.trim()) {
      setPostSummary(summary)
      setPostSummarySource("MANUAL")
      setSummaryIntent({ kind: "manual", summary })
    } else {
      setPostSummary("")
      setPostSummarySource("NONE")
      setSummaryIntent({ kind: "auto" })
    }
  }, [])

  const resolvedPreviewThumbnail = useMemo(() => {
    const manual = stripThumbnailFocusFromUrl(normalizeSafeImageUrl(postThumbnailUrl))
    if (manual) return manual
    return stripThumbnailFocusFromUrl(normalizeSafeImageUrl(deferredContentDerived.firstImage))
  }, [deferredContentDerived.firstImage, postThumbnailUrl])
  const effectiveThumbnailUrl = useMemo(() => {
    return buildEffectiveThumbnailUrl({
      postThumbnailFocusX,
      postThumbnailFocusY,
      postThumbnailZoom,
      resolvedPreviewThumbnail,
    })
  }, [postThumbnailFocusX, postThumbnailFocusY, postThumbnailZoom, resolvedPreviewThumbnail])
  const safePreviewThumbnail = useMemo(() => {
    const preferredSource = previewThumbnailSourceUrl || resolvedPreviewThumbnail
    return normalizeSafePreviewThumbnailUrl(preferredSource)
  }, [previewThumbnailSourceUrl, resolvedPreviewThumbnail])

  const {
    commitPreviewThumbTransform,
    finalizePreviewThumbPointer,
    handlePreviewThumbPointerDown,
    handlePreviewThumbPointerMove,
    isPreviewThumbDragging,
    isPreviewThumbnailError,
    previewThumbFrameRef,
    previewThumbTransformRef,
    setIsPreviewThumbnailError,
  } = useEditorStudioThumbnailPreview({
    safePreviewThumbnail,
    isPublishModalOpen,
    isComposeAssistOpen: false,
    postThumbnailFocusX,
    postThumbnailFocusY,
    postThumbnailZoom,
    setPostThumbnailFocusX,
    setPostThumbnailFocusY,
    setPostThumbnailZoom,
  })

  const {
    applyFirstBodyImageToThumbnail,
    handleThumbnailUrlModalChange,
    openThumbnailFileInput,
    resetThumbnailToAutoMode,
    setThumbnailImageFileName,
    thumbnailImageFileInputRef,
    thumbnailImageFileName,
  } = useEditorStudioThumbnailControls({
    postContent,
    setPostThumbnailUrl,
    setPostThumbnailFocusX,
    setPostThumbnailFocusY,
    setPostThumbnailZoom,
    setPreviewThumbnailSourceUrl,
    extractFirstMarkdownImage,
    normalizeSafeImageUrl,
  })

  const {
    addTagsToPost,
    addTagToPost,
    commitPostCategory,
    customCategoryCatalog,
    customTagCatalog,
    handlePostCategoryChange,
    removeTagFromPost,
  } = useEditorStudioMetaCatalog({
    postCategory,
    setPostCategory,
    setPostTags,
    setTagDraft,
  })

  const {
    clearLastSaveError,
    handleMarkdownEditorFileUpload,
    handleMarkdownEditorImageUpload,
    handleModifyPost,
    handlePublishTempDraft,
    handleThumbnailImageFileChange,
    handleThumbnailPaste,
    handleWritePost,
    lastSaveError,
  } = useEditorStudioPersistence({
    editorMode,
    postId,
    postVersion,
    postTitle,
    postTags,
    tagDraft,
    postCategory,
    customCategoryCatalog,
    postSummary,
    postSummarySource,
    summaryIntent,
    postThumbnailUrl,
    postThumbnailFocusX,
    postThumbnailFocusY,
    postThumbnailZoom,
    postVisibility,
    effectiveThumbnailUrl,
    loadingKey,
    getCurrentPostContent,
    lastWriteFingerprintRef,
    lastWriteIdempotencyKeyRef,
    lastLocalDraftFingerprintRef,
    serverBaselineEditorFingerprintRef,
    defaultThumbnailFocusX: DEFAULT_THUMBNAIL_FOCUS_X,
    defaultThumbnailFocusY: DEFAULT_THUMBNAIL_FOCUS_Y,
    defaultThumbnailZoom: DEFAULT_THUMBNAIL_ZOOM,
    setEditorMode,
    setIsTempDraftMode,
    setPostId,
    setPostVersion,
    setPostSummary,
    setPostSummarySource,
    setSummaryIntent,
    setLocalDraftSavedAt,
    setPublishStatus,
    setLoadingKey,
    setResult,
    setPostThumbnailUrl,
    setPostThumbnailFocusX,
    setPostThumbnailFocusY,
    setPostThumbnailZoom,
    setPreviewThumbnailSourceUrl,
    setIsPreviewThumbnailError,
    setThumbnailImageFileName,
    addTagsToPost,
    setTagDraft,
    setPostCategory,
    composeEditorContent,
    toFlags,
    buildEditorStateFingerprint,
    dedupeStrings,
    detectPublishPlaceholderIssue: (content) => detectPublishPlaceholderIssue(content) || "",
    refreshPublicPostReadViews,
    pretty,
    generateIdempotencyKey,
    signalLocalDraftBaselineReady,
    uploadWithConflictRetry,
    normalizeSafeImageUrl,
    extractImageFileFromClipboard,
  })

  useEffect(() => {
    clearLastSaveError()
  }, [clearLastSaveError, postId])

  const handleReloadLatestServerPost = useCallback(async () => {
    const reloaded = await reloadLatestServerPost()
    if (reloaded) {
      clearLastSaveError()
      setIsPublishModalOpen(false)
    }
  }, [clearLastSaveError, reloadLatestServerPost, setIsPublishModalOpen])

  const { handleExitDedicatedEditor } = useEditorStudioRouting({
    router,
    authStatus,
    sessionMember,
    postId,
    isDedicatedEditorRoute,
    isDedicatedNewEditorRoute,
    adminPostsWorkspaceRoute: ADMIN_POSTS_WORKSPACE_ROUTE,
    editorNewRoutePath: EDITOR_NEW_ROUTE_PATH,
    toEditorPostRoute,
    normalizeEditorReturnRoute,
    pretty,
    setResult,
    setPostId,
    setIsNewEditorBootstrapPending,
    redirectingRef,
    autoLoadedPostIdRef,
    autoCreatedTempDraftRef,
    restoreLocalDraft,
    loadPostForEditor,
    handleLoadOrCreateTempPost,
  })

  const {
    closePublishModal,
    handleConfirmPublish,
    openPublishModal,
  } = useEditorStudioPublishModalFlow({
    activateComposeSurface,
    addTagsToPost,
    commitPostCategory,
    handleModifyPost,
    handlePublishTempDraft,
    handleWritePost,
    isPreviewThumbnailError,
    loadingKey,
    publishActionType,
    publishModalHintByAction,
    safePreviewThumbnail,
    setIsMobileMetaEditorOpen,
    setIsMobileThumbnailEditorOpen,
    setIsPublishModalOpen,
    setPublishActionType,
    setPublishModalNotice,
    setTagDraft,
    tagDraft,
  })

  return (
    <EditorStudioWorkspaceControllerRootView
      props={{
        addTagsToPost, addTagToPost, applyFirstBodyImageToThumbnail, clearLocalDraft, discardLocalDraftCandidate,
        closePublishModal, commitPreviewThumbTransform, customCategoryCatalog, customTagCatalog, deferredContentDerived,
        dismissedLocalDraft, dismissLocalDraftRestoreSuggestion, disabled, editorMode, finalizePreviewThumbPointer,
        getCurrentPostContent, handleMarkdownEditorChange, handleMarkdownEditorFileUpload,
        handleMarkdownEditorImageUpload, handleConfirmPublish, handleExitDedicatedEditor, handleFlushMarkdownReady,
        commitPostCategory, handlePostCategoryChange, handlePostSummaryChange, handlePreviewThumbPointerDown,
        handlePreviewThumbPointerMove, handleReloadLatestServerPost, handleThumbnailImageFileChange, handleThumbnailPaste,
        handleThumbnailUrlModalChange, handleTitleChange, handleTitleFieldRef, handleTitleKeyDown, handleFocusTitle,
        isCompactMobileLayout, isDedicatedEditorRoute, isDedicatedNewEditorRoute, isMobileMetaEditorOpen,
        isMobileThumbnailEditorOpen, isNewEditorBootstrapPending, isPreviewThumbDragging, isPreviewThumbnailError,
        isPublishModalOpen, isTempDraftMode, lastLocalDraftFingerprintRef, lastSaveError, loadingKey, localDraftCandidate,
        localDraftCandidates, localDraftSavedAt, localDraftSource, openPublishModal, openThumbnailFileInput,
        postCategory, postContent, postId, postSummary, postSummarySource, summaryIntent, postTags,
        postThumbnailFocusX, postThumbnailFocusY, postThumbnailUrl, postThumbnailZoom, postTitle, postVisibility,
        publishActionType, publishModalNotice, publishNotice, previewThumbFrameRef, previewThumbTransformRef,
        resetThumbnailToAutoMode, removeTagFromPost, restoreLocalDraft, selectLocalDraftCandidate,
        restoredLocalDraft, result, safePreviewThumbnail, serverBaselineEditorFingerprintRef, sessionMember,
        setIsMobileMetaEditorOpen, setIsMobileThumbnailEditorOpen, setIsPreviewThumbnailError, setPostVisibility,
        setTagDraft, tagDraft, thumbnailImageFileInputRef, thumbnailImageFileName,
      }}
    />
  )
}

export default EditorStudioWorkspaceController
