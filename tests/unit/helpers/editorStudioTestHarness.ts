import type { Dispatch, SetStateAction } from "react"
import { normalizeCategoryValue } from "../../../src/libs/utils"
import {
  buildEditorStateFingerprint,
  buildLocalDraftFingerprint,
  composeEditorContent,
  dedupeStrings,
  resolveEditorMetaSnapshot,
} from "../../../src/routes/Admin/editorStudioMetaModel"
import {
  toFlags,
  toVisibility,
  type EditorMode,
  type PostVisibility,
} from "../../../src/routes/Admin/editorStudioState"
import {
  persistLocalDraft,
  readLocalDraft,
  removeLocalDraft,
} from "../../../src/routes/Admin/editorStudioStorageModel"
import { useEditorStudioDraftLifecycle } from "../../../src/routes/Admin/useEditorStudioDraftLifecycle"
import { useEditorStudioPersistence } from "../../../src/routes/Admin/useEditorStudioPersistence"

export type Setter<T> = Dispatch<SetStateAction<T>>

export const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

export const createMinimalRootContainer = () => {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  const ownerDocument = {
    nodeType: 9,
    activeElement: null,
    body: null,
    documentElement: {},
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  return {
    nodeType: 1,
    nodeName: "DIV",
    tagName: "DIV",
    namespaceURI: "http://www.w3.org/1999/xhtml",
    ownerDocument,
    childNodes: [] as unknown[],
    firstChild: null,
    appendChild() {},
    removeChild() {},
    insertBefore() {},
    addEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(handler)
    },
    removeEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      listeners.get(type)?.delete(handler)
    },
  }
}

export const withWindowStorage = async <T>(
  run: (storage: Storage) => Promise<T> | T
): Promise<T> => {
  const storage = createMemoryStorage()
  const prevWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const prevActEnv = (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT
  const eventTarget = new EventTarget()
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: storage,
      sessionStorage: createMemoryStorage(),
      location: { hostname: "localhost", origin: "http://localhost:3000" },
      document: { activeElement: null, body: null },
      HTMLIFrameElement: class HTMLIFrameElement {},
      navigator: { onLine: true },
      innerWidth: 1440,
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    },
  })
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  try {
    return await run(storage)
  } finally {
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = prevActEnv
    if (prevWindow) {
      Object.defineProperty(globalThis, "window", prevWindow)
    } else {
      delete (globalThis as Record<string, unknown>).window
    }
  }
}

export const createSetter =
  <T>(read: () => T, write: (value: T) => void): Setter<T> =>
  (next) => {
    write(typeof next === "function" ? (next as (prev: T) => T)(read()) : next)
  }

const noop = () => undefined
const noopAsync = async () => undefined
const toEditorPostRoute = (id: string | number) => `/admin/editor/${id}`
const prettyJson = (v: unknown) => JSON.stringify(v)
const identityString = (v: string) => v
const emptyPlaceholderIssue = () => ""
const fixedIdempotencyKey = () => "idem-key-1"
const extractNoClipboardImage = () => null
const isNotBlankTempDraft = () => false
const buildEmptySnapshot = () => ({
  body: "",
  tags: [] as string[],
  category: "",
  thumbnailUrl: "",
  thumbnailFocusX: 50,
  thumbnailFocusY: 50,
  thumbnailZoom: 1,
})
const requestTempPostStub = async () => ({
  resultCode: "200-1",
  msg: "ok",
  data: { id: 1 } as never,
})
const uploadWithRetryStub = async () =>
  new Response(JSON.stringify({ url: "" }), { status: 200 })

export const createStatefulEditorHarness = (options?: { failPersist?: () => boolean }) => {
  const state = {
    editorMode: "edit" as EditorMode,
    isTempDraftMode: false,
    postId: "101",
    postVersion: 3 as number | null,
    postTitle: "내 로컬 수정 제목",
    postContent: "충돌 직전 로컬 본문",
    postSummary: "",
    postSummarySource: "NONE" as "MANUAL" | "LEADING_BLOCK" | "EXTRACTED" | "MIGRATED" | "NONE",
    summaryIntent: { kind: "auto" } as
      | { kind: "auto" }
      | { kind: "manual"; summary: string }
      | { kind: "unchanged" },
    postThumbnailUrl: "",
    postThumbnailFocusX: 50,
    postThumbnailFocusY: 50,
    postThumbnailZoom: 1,
    postTags: ["react"] as string[],
    tagDraft: "",
    postCategory: "",
    customCategoryCatalog: ["rocket::Backend"] as string[],
    postVisibility: "PUBLIC_LISTED" as PostVisibility,
    localDraftSavedAt: "",
    loadingKey: "",
    result: "",
    pageNotice: { tone: "idle" as "idle" | "loading" | "success" | "error", text: "" },
    modalNotice: { tone: "idle" as "idle" | "loading" | "success" | "error", text: "" },
  }
  const refs = {
    lastLocalDraftFingerprintRef: { current: "" },
    lastWriteFingerprintRef: { current: "" },
    lastWriteIdempotencyKeyRef: { current: "" },
    serverBaselineEditorFingerprintRef: { current: "" },
    tempPostRequestRef: { current: null },
  }
  const routerStub = { pathname: "/admin/editor/[id]", isReady: true, query: { id: "101" } } as never
  const getCurrentPostContent = () => state.postContent
  const setEditorMode = createSetter(() => state.editorMode, (v) => { state.editorMode = v })
  const setIsTempDraftMode = createSetter(() => state.isTempDraftMode, (v) => { state.isTempDraftMode = v })
  const setPostId = createSetter(() => state.postId, (v) => { state.postId = v })
  const setPostVersion = createSetter(() => state.postVersion, (v) => { state.postVersion = v })
  const setPostTitle = createSetter(() => state.postTitle, (v) => { state.postTitle = v })
  const setPostContent = createSetter(() => state.postContent, (v) => { state.postContent = v })
  const setPostSummary = createSetter(() => state.postSummary, (v) => { state.postSummary = v })
  const setPostSummarySource = createSetter(() => state.postSummarySource, (v) => { state.postSummarySource = v })
  const setSummaryIntent = createSetter(() => state.summaryIntent, (v) => { state.summaryIntent = v })
  const setPostThumbnailUrl = createSetter(() => state.postThumbnailUrl, (v) => { state.postThumbnailUrl = v })
  const setPostThumbnailFocusX = createSetter(() => state.postThumbnailFocusX, (v) => { state.postThumbnailFocusX = v })
  const setPostThumbnailFocusY = createSetter(() => state.postThumbnailFocusY, (v) => { state.postThumbnailFocusY = v })
  const setPostThumbnailZoom = createSetter(() => state.postThumbnailZoom, (v) => { state.postThumbnailZoom = v })
  const setPostTags = createSetter(() => state.postTags, (v) => { state.postTags = v })
  const setPostCategory = createSetter(() => state.postCategory, (v) => { state.postCategory = v })
  const setPostVisibility = createSetter(() => state.postVisibility, (v) => { state.postVisibility = v })
  const setLocalDraftSavedAt = createSetter(() => state.localDraftSavedAt, (v) => { state.localDraftSavedAt = v })
  const setLoadingKey = createSetter(() => state.loadingKey, (v) => { state.loadingKey = v })
  const setResult = createSetter(() => state.result, (v) => { state.result = v })
  const setTagDraft = createSetter(() => state.tagDraft, (v) => { state.tagDraft = v })
  const setPublishStatus = (
    notice: { tone: "idle" | "loading" | "success" | "error"; text: string },
    target?: "modal" | "page"
  ) => {
    if (target === "page") state.pageNotice = notice
    else state.modalNotice = notice
  }
  const persistDraftGuarded: typeof persistLocalDraft = (payload) => {
    if (options?.failPersist?.()) {
      throw new DOMException("Quota exceeded", "QuotaExceededError")
    }
    persistLocalDraft(payload)
  }
  const syncEditorMeta = (
    content: string,
    canonicalSummary: {
      summary: string
      summarySource: typeof state.postSummarySource
      intent: typeof state.summaryIntent
    }
  ) => {
    const snap = resolveEditorMetaSnapshot(content)
    state.postContent = snap.body
    state.postSummary = canonicalSummary.summary
    state.postSummarySource = canonicalSummary.summarySource
    state.summaryIntent = canonicalSummary.intent
    state.postTags = snap.tags
    state.postCategory = snap.category
    return snap
  }
  const addTagsToPost = (values: string[]) => {
    const added = dedupeStrings(values.map((v) => v.trim()).filter(Boolean))
    state.postTags = dedupeStrings([...state.postTags, ...added])
    return added
  }

  let lifecycleApi!: ReturnType<typeof useEditorStudioDraftLifecycle>
  let persistenceApi!: ReturnType<typeof useEditorStudioPersistence>

  const Probe = () => {
    lifecycleApi = useEditorStudioDraftLifecycle({
      router: routerStub,
      toEditorPostRoute,
      postId: state.postId,
      postVersion: state.postVersion,
      loadingKey: state.loadingKey,
      postTitle: state.postTitle,
      postContent: state.postContent,
      getCurrentPostContent,
      postSummary: state.postSummary,
      postSummarySource: state.postSummarySource,
      summaryIntent: state.summaryIntent,
      postThumbnailUrl: state.postThumbnailUrl,
      postThumbnailFocusX: state.postThumbnailFocusX,
      postThumbnailFocusY: state.postThumbnailFocusY,
      postThumbnailZoom: state.postThumbnailZoom,
      postTags: state.postTags,
      postCategory: state.postCategory,
      postVisibility: state.postVisibility,
      editorMode: state.editorMode,
      setEditorMode,
      setIsTempDraftMode,
      setPostId,
      setPostVersion,
      setPreviewThumbnailSourceUrl: noop,
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
      setIsNewEditorBootstrapPending: noop,
      activateComposeSurface: noop,
      setPublishStatus,
      dedupeStrings,
      normalizeCategoryValue,
      buildLocalDraftFingerprint,
      persistLocalDraft: persistDraftGuarded,
      readLocalDraft,
      removeLocalDraft,
      buildEditorStateFingerprint,
      pretty: prettyJson,
      resolveEditorMetaSnapshot,
      syncEditorMeta,
      buildEmptyEditorMetaSnapshot: buildEmptySnapshot,
      isBlankServerTempDraft: isNotBlankTempDraft,
      toVisibility,
      requestTempPostWithConflictRetry: requestTempPostStub,
      defaultThumbnailFocusX: 50,
      defaultThumbnailFocusY: 50,
      defaultThumbnailZoom: 1,
      ...refs,
    })

    persistenceApi = useEditorStudioPersistence({
      editorMode: state.editorMode,
      postId: state.postId,
      postVersion: state.postVersion,
      postTitle: state.postTitle,
      postTags: state.postTags,
      tagDraft: state.tagDraft,
      postCategory: state.postCategory,
      customCategoryCatalog: state.customCategoryCatalog,
      postSummary: state.postSummary,
      postSummarySource: state.postSummarySource,
      summaryIntent: state.summaryIntent,
      postThumbnailUrl: state.postThumbnailUrl,
      postThumbnailFocusX: state.postThumbnailFocusX,
      postThumbnailFocusY: state.postThumbnailFocusY,
      postThumbnailZoom: state.postThumbnailZoom,
      postVisibility: state.postVisibility,
      effectiveThumbnailUrl: "",
      loadingKey: state.loadingKey,
      getCurrentPostContent,
      ...refs,
      defaultThumbnailFocusX: 50,
      defaultThumbnailFocusY: 50,
      defaultThumbnailZoom: 1,
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
      setPreviewThumbnailSourceUrl: noop,
      setIsPreviewThumbnailError: noop,
      setThumbnailImageFileName: noop,
      addTagsToPost,
      setTagDraft,
      setPostCategory,
      composeEditorContent,
      toFlags,
      buildEditorStateFingerprint,
      dedupeStrings,
      detectPublishPlaceholderIssue: emptyPlaceholderIssue,
      refreshPublicPostReadViews: noopAsync,
      pretty: prettyJson,
      generateIdempotencyKey: fixedIdempotencyKey,
      signalLocalDraftBaselineReady: lifecycleApi.signalLocalDraftBaselineReady,
      uploadWithConflictRetry: uploadWithRetryStub,
      normalizeSafeImageUrl: identityString,
      extractImageFileFromClipboard: extractNoClipboardImage,
    })
    return null
  }

  return {
    state,
    refs,
    get lifecycle() {
      return lifecycleApi
    },
    get persistence() {
      return persistenceApi
    },
    Probe,
  }
}
