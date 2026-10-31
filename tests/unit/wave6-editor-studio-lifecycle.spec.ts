import createCache from "@emotion/cache"
import { CacheProvider, ThemeProvider } from "@emotion/react"
import createEmotionServer from "@emotion/server/create-instance"
import { expect, test } from "@playwright/test"
import { Fragment, act, createElement, type ComponentType, type Dispatch, type SetStateAction } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { ConfirmDialog } from "../../src/design-system/ConfirmDialog"
import { normalizeCategoryValue } from "../../src/libs/utils"
import {
  EditorStudioDedicatedEditorSurface,
  formatCategoryDraftInputValue,
  resolveViewportPanelUiMask,
  toCategorySuggestionLabels,
} from "../../src/routes/Admin/EditorStudioDedicatedEditorSurface"
import {
  EDITOR_SURFACE_INSPECTOR_OPEN,
  EDITOR_SURFACE_OUTLINE_OPEN,
  EDITOR_SURFACE_ZEN_BITS,
} from "../../src/routes/Admin/editorStudioDedicatedSurfaceModel"
import { EditorStudioPublishModal } from "../../src/routes/Admin/EditorStudioPublishModal"
import { PUBLISH_VISIBILITY_OPTIONS } from "../../src/routes/Admin/EditorStudioWorkspaceControllerRootModel"
import {
  buildEditorStateFingerprint,
  buildLocalDraftFingerprint,
  composeEditorContent,
  dedupeStrings,
  resolveEditorMetaSnapshot,
  type LocalDraftSource,
} from "../../src/routes/Admin/editorStudioMetaModel"
import { revalidateSavedPost } from "../../src/routes/Admin/editorPostSaveRefresh"
import { toFlags, toVisibility, type EditorMode, type PostVisibility } from "../../src/routes/Admin/editorStudioState"
import {
  CATEGORY_CATALOG_STORAGE_KEY,
  TAG_CATALOG_STORAGE_KEY,
  persistLocalDraft,
  readLocalDraft,
  removeLocalDraft,
} from "../../src/routes/Admin/editorStudioStorageModel"
import { isServerTempDraftPost, isTempDraftCandidate } from "../../src/routes/Admin/editorTempDraft"
import { useEditorStudioDraftLifecycle } from "../../src/routes/Admin/useEditorStudioDraftLifecycle"
import {
  decideLocalDraftAutosave,
  isLocalDraftRestoreSuggestionEligible,
  resolveEffectivePendingRestorableDraftFingerprint,
  resolveRestoredPostVersion,
} from "../../src/routes/Admin/useEditorStudioDraftLifecycleModel"
import { useEditorStudioMetaCatalog } from "../../src/routes/Admin/useEditorStudioMetaCatalog"
import { useEditorStudioPersistence } from "../../src/routes/Admin/useEditorStudioPersistence"
import { useEditorStudioPublishModalFlow } from "../../src/routes/Admin/useEditorStudioPublishModalFlow"
import { createTheme } from "../../src/styles/theme"

type Setter<T> = Dispatch<SetStateAction<T>>

const lightTheme = createTheme({ scheme: "light" })

const wrappedComponentCache = new WeakMap<(props: unknown) => unknown, (props: unknown) => unknown>()

const wrapPlaywrightComponent = (fn: (props: unknown) => unknown) => {
  const existing = wrappedComponentCache.get(fn)
  if (existing) return existing
  const wrapped = (props: unknown) => materializePlaywrightJsx(fn(props))
  Object.defineProperty(wrapped, "name", { value: fn.name || "WrappedComponent" })
  wrappedComponentCache.set(fn, wrapped)
  return wrapped
}

const materializePlaywrightJsx = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(materializePlaywrightJsx)
  if (
    value &&
    typeof value === "object" &&
    "__pw_type" in value &&
    (value as { __pw_type?: unknown }).__pw_type === "jsx"
  ) {
    const pw = value as { type?: unknown; props?: Record<string, unknown>; key?: string | null }
    const resolvedType =
      typeof pw.type === "function"
        ? wrapPlaywrightComponent(pw.type as (props: unknown) => unknown)
        : (pw.type ?? Fragment)
    const { children: rawChildren, ...restProps } = pw.props ?? {}
    const nextProps: Record<string, unknown> = {
      ...restProps,
      ...(pw.key != null ? { key: pw.key } : {}),
    }
    if (Array.isArray(rawChildren)) {
      return createElement(resolvedType as never, nextProps, ...(rawChildren.map(materializePlaywrightJsx) as never[]))
    }
    if (rawChildren !== undefined) {
      return createElement(resolvedType as never, nextProps, materializePlaywrightJsx(rawChildren) as never)
    }
    return createElement(resolvedType as never, nextProps)
  }
  return value
}

const renderWithEmotionCss = <P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  props: P
) => {
  const cache = createCache({ key: "css" })
  const { extractCriticalToChunks } = createEmotionServer(cache)
  const Wrapped = wrapPlaywrightComponent(Component as unknown as (p: unknown) => unknown) as ComponentType<P>
  const node = createElement(Wrapped, props)
  const html = renderToString(
    createElement(
      CacheProvider,
      { value: cache, children: createElement(ThemeProvider, { theme: lightTheme, children: node }) }
    )
  )
  const chunks = extractCriticalToChunks(html)
  const css = chunks.styles.map((style) => style.css).join("\n")
  return { html, css }
}

const createMemoryStorage = (): Storage => {
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

const createMinimalRootContainer = () => {
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

const withWindowStorage = async <T>(run: (storage: Storage) => Promise<T> | T): Promise<T> => {
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

const createSetter = <T>(read: () => T, write: (value: T) => void): Setter<T> => (next) => {
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
const uploadWithRetryStub = async () => new Response(JSON.stringify({ url: "" }), { status: 200 })

const createStatefulEditorHarness = (options?: { failPersist?: () => boolean }) => {
  const state = {
    editorMode: "edit" as EditorMode,
    isTempDraftMode: false,
    postId: "101",
    postVersion: 3 as number | null,
    postTitle: "내 로컬 수정 제목",
    postContent: "충돌 직전 로컬 본문",
    postSummary: "",
    postSummarySource: "NONE" as "MANUAL" | "LEADING_BLOCK" | "EXTRACTED" | "MIGRATED" | "NONE",
    summaryIntent: { kind: "auto" } as { kind: "auto" } | { kind: "manual"; summary: string } | { kind: "unchanged" },
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

test.describe("Wave 6 Unit 3: EditorStudio lifecycle, revalidation, metadata & responsive stacking", () => {
  test("resolveRestoredPostVersion keeps monotonic max version and never regresses to stale draft version", () => {
    expect(resolveRestoredPostVersion(7, 3)).toBe(7)
    expect(resolveRestoredPostVersion(3, 9)).toBe(9)
    expect(resolveRestoredPostVersion(7, null)).toBe(7)
    expect(resolveRestoredPostVersion(null, 4)).toBe(4)
    expect(resolveRestoredPostVersion(null, null)).toBeNull()
  })

  test("409 version-conflict backs up live manuscript fail-closed, reloads server post, and restores without regressing postVersion", async () => {
    await withWindowStorage(async () => {
      let shouldFailPersist = false
      const harness = createStatefulEditorHarness({ failPersist: () => shouldFailPersist })
      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      const fetchCalls: string[] = []
      const originalFetch = globalThis.fetch

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString()
        const pathname = new URL(url, "http://localhost:8080").pathname
        fetchCalls.push(`${init?.method ?? "GET"} ${pathname}`)
        if (url.endsWith("/post/api/v1/posts/101") && init?.method === "PUT") {
          return new Response(JSON.stringify({ msg: "version conflict" }), {
            status: 409,
            headers: { "content-type": "application/json" },
          })
        }
        if (url.endsWith("/post/api/v1/adm/posts/101")) {
          return new Response(
            JSON.stringify({
              id: 101,
              version: 5,
              title: "서버 최신 제목",
              content: "서버 최신 본문",
              summary: "",
              summarySource: "NONE",
              published: true,
              listed: true,
              tempDraft: false,
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }) as typeof fetch

      try {
        await act(async () => {
          root.render(createElement(harness.Probe))
        })

        await act(async () => {
          await harness.persistence.handleModifyPost()
          root.render(createElement(harness.Probe))
        })

        expect(harness.persistence.lastSaveError?.errorType).toBe("version-conflict")
        expect(harness.state.pageNotice.tone).toBe("error")
        expect(harness.state.postTitle).toBe("내 로컬 수정 제목")
        expect(harness.state.postContent).toBe("충돌 직전 로컬 본문")

        await act(async () => {
          harness.lifecycle.dismissLocalDraftRestoreSuggestion()
          root.render(createElement(harness.Probe))
        })

        shouldFailPersist = true
        let failedReload = true
        await act(async () => {
          failedReload = await harness.lifecycle.reloadLatestServerPost("101")
          root.render(createElement(harness.Probe))
        })
        expect(failedReload).toBe(false)
        expect(fetchCalls).toEqual(["PUT /post/api/v1/posts/101"])
        expect(harness.state.postTitle).toBe("내 로컬 수정 제목")
        expect(harness.state.postContent).toBe("충돌 직전 로컬 본문")

        shouldFailPersist = false
        let reloaded = false
        await act(async () => {
          reloaded = await harness.lifecycle.reloadLatestServerPost("101")
          root.render(createElement(harness.Probe))
        })
        expect(reloaded).toBe(true)
        expect(fetchCalls).toContain("GET /post/api/v1/adm/posts/101")
        expect(harness.state.postVersion).toBe(5)
        expect(harness.state.postTitle).toBe("서버 최신 제목")
        expect(harness.state.postContent).toBe("서버 최신 본문")

        const storedBackup = readLocalDraft({ kind: "post", postId: "101" })
        expect(storedBackup?.title).toBe("내 로컬 수정 제목")
        expect(storedBackup?.content).toBe("충돌 직전 로컬 본문")
        expect(storedBackup?.postVersion).toBe(3)

        const candidate = harness.lifecycle.localDraftCandidates[0]
        expect(candidate).toBeDefined()
        const serverFingerprint = harness.refs.serverBaselineEditorFingerprintRef.current
        expect(
          isLocalDraftRestoreSuggestionEligible({
            candidate: candidate!,
            currentSource: { kind: "post", postId: "101" } satisfies LocalDraftSource,
            editorFingerprint: serverFingerprint,
            serverBaselineFingerprint: serverFingerprint,
            restored: harness.lifecycle.restoredLocalDraft,
            dismissed: harness.lifecycle.dismissedLocalDraft,
          })
        ).toBe(true)

        await act(async () => {
          harness.lifecycle.restoreLocalDraft()
          root.render(createElement(harness.Probe))
        })

        expect(harness.state.postTitle).toBe("내 로컬 수정 제목")
        expect(harness.state.postContent).toBe("충돌 직전 로컬 본문")
        expect(harness.state.postVersion).toBe(5)
      } finally {
        await act(async () => {
          root.unmount()
        })
        globalThis.fetch = originalFetch
      }
    })
  })

  test("isTempDraftCandidate gives explicit boolean tempDraft precedence so private post titled 임시글 keeps its title", async () => {
    expect(
      isTempDraftCandidate({ tempDraft: false, title: "임시글", published: false, listed: false })
    ).toBe(false)
    expect(
      isServerTempDraftPost({ tempDraft: false, title: "임시글", published: false, listed: false })
    ).toBe(false)
    expect(
      isTempDraftCandidate({ tempDraft: true, title: "일반 제목", published: false, listed: false })
    ).toBe(true)
    expect(
      isTempDraftCandidate({ tempDraft: undefined, title: "임시글", published: false, listed: false })
    ).toBe(true)

    await withWindowStorage(async () => {
      const harness = createStatefulEditorHarness()
      harness.state.postId = "88"
      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      const originalFetch = globalThis.fetch

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.endsWith("/post/api/v1/adm/posts/88")) {
          return new Response(
            JSON.stringify({
              id: 88,
              version: 2,
              title: "임시글",
              content: "정상 비공개 포스트 본문",
              summary: "",
              summarySource: "NONE",
              published: false,
              listed: false,
              tempDraft: false,
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        if (url.endsWith("/post/api/v1/posts/88") && init?.method === "PUT") {
          return new Response(
            JSON.stringify({
              resultCode: "200-1",
              msg: "ok",
              data: {
                id: 88,
                version: 3,
                title: "임시글",
                summary: "",
                summarySource: "NONE",
                published: false,
                listed: false,
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        if (url === "/api/revalidate") {
          return new Response(JSON.stringify({ revalidated: true }), { status: 200 })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }) as typeof fetch

      try {
        await act(async () => {
          root.render(createElement(harness.Probe))
        })
        await act(async () => {
          await harness.lifecycle.loadPostForEditor("88")
          root.render(createElement(harness.Probe))
        })

        expect(harness.state.postTitle).toBe("임시글")
        expect(harness.state.isTempDraftMode).toBe(false)

        await act(async () => {
          await harness.persistence.handleModifyPost()
          root.render(createElement(harness.Probe))
        })

        expect(harness.state.isTempDraftMode).toBe(false)
        expect(harness.state.postVersion).toBe(3)
      } finally {
        await act(async () => {
          root.unmount()
        })
        globalThis.fetch = originalFetch
      }
    })
  })

  test("revalidateSavedPost sends both home feed and canonical post path", async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body ?? "{}")),
      })
      return new Response(JSON.stringify({ revalidated: true }), { status: 200 })
    }) as typeof fetch

    try {
      await revalidateSavedPost(" 771 ")
    } finally {
      globalThis.fetch = originalFetch
    }

    expect(calls).toEqual([
      {
        url: "/api/revalidate",
        body: { paths: ["/", "/posts/771"] },
      },
    ])
  })

  test("category draft preserves spaces, blank category never turns into All, datalist decodes labels, tagDraft flushes on save/modal, and meta catalog mount preserves localStorage", async () => {
    expect(formatCategoryDraftInputValue("")).toBe("")
    expect(formatCategoryDraftInputValue("Spring ")).toBe("Spring ")
    expect(formatCategoryDraftInputValue("Spring  Boot ")).toBe("Spring  Boot ")
    expect(formatCategoryDraftInputValue("folder::Spring Boot")).toBe("Spring Boot")
    expect(formatCategoryDraftInputValue("rocket::Backend Systems")).toBe("Backend Systems")

    expect(toCategorySuggestionLabels(["folder::Spring Boot", "rocket::Backend", "📂 All", ""])).toEqual([
      "Spring Boot",
      "Backend",
    ])

    expect(composeEditorContent("본문", [], { category: "" })).toBe("본문")
    expect(composeEditorContent("본문", [], { category: "   " })).toBe("본문")

    const blankCategoryFp = buildEditorStateFingerprint({
      title: "T",
      content: "B",
      summary: "",
      summarySource: "NONE",
      summaryIntent: { kind: "auto" },
      thumbnailUrl: "",
      thumbnailFocusX: 50,
      thumbnailFocusY: 50,
      thumbnailZoom: 1,
      tags: [],
      category: "   ",
      visibility: "PUBLIC_LISTED",
    })
    expect(JSON.parse(blankCategoryFp).category).toBe("")

    await withWindowStorage(async (storage) => {
      persistLocalDraft({
        title: "초안",
        content: "본문",
        summary: "",
        summarySource: "NONE",
        summaryIntent: { kind: "auto" },
        thumbnailUrl: "",
        thumbnailFocusX: 50,
        thumbnailFocusY: 50,
        thumbnailZoom: 1,
        tags: [],
        category: "",
        visibility: "PUBLIC_LISTED",
        savedAt: new Date().toISOString(),
        source: { kind: "create" },
        postVersion: null,
      })
      expect(readLocalDraft({ kind: "create" })?.category).toBe("")

      storage.setItem(TAG_CATALOG_STORAGE_KEY, JSON.stringify(["kotlin", "spring"]))
      storage.setItem(CATEGORY_CATALOG_STORAGE_KEY, JSON.stringify(["rocket::Backend"]))

      const catalogState = {
        postCategory: "Spring Boot",
        postTags: [] as string[],
        tagDraft: "vitest",
      }
      const setCatalogCategory = createSetter(
        () => catalogState.postCategory,
        (v) => {
          catalogState.postCategory = v
        }
      )
      const setCatalogTags = createSetter(
        () => catalogState.postTags,
        (v) => {
          catalogState.postTags = v
        }
      )
      const setCatalogTagDraft = createSetter(
        () => catalogState.tagDraft,
        (v) => {
          catalogState.tagDraft = v
        }
      )
      const noopCatalog = () => undefined
      const returnTrueAsync = async () => true
      const emptyHint = () => ""
      let catalogApi!: ReturnType<typeof useEditorStudioMetaCatalog>
      let modalFlowApi!: ReturnType<typeof useEditorStudioPublishModalFlow>

      const CatalogProbe = () => {
        catalogApi = useEditorStudioMetaCatalog({
          postCategory: catalogState.postCategory,
          setPostCategory: setCatalogCategory,
          setPostTags: setCatalogTags,
          setTagDraft: setCatalogTagDraft,
        })
        modalFlowApi = useEditorStudioPublishModalFlow({
          activateComposeSurface: noopCatalog,
          addTagsToPost: catalogApi.addTagsToPost,
          commitPostCategory: catalogApi.commitPostCategory,
          handleModifyPost: returnTrueAsync,
          handlePublishTempDraft: returnTrueAsync,
          handleWritePost: returnTrueAsync,
          isPreviewThumbnailError: false,
          loadingKey: "",
          publishActionType: "create",
          publishModalHintByAction: emptyHint,
          safePreviewThumbnail: "",
          setIsMobileMetaEditorOpen: noopCatalog,
          setIsMobileThumbnailEditorOpen: noopCatalog,
          setIsPublishModalOpen: noopCatalog,
          setPublishActionType: noopCatalog,
          setPublishModalNotice: noopCatalog,
          setTagDraft: setCatalogTagDraft,
          tagDraft: catalogState.tagDraft,
        })
        return null
      }

      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      try {
        await act(async () => {
          root.render(createElement(CatalogProbe))
        })

        expect(JSON.parse(storage.getItem(TAG_CATALOG_STORAGE_KEY) ?? "[]")).toEqual(["kotlin", "spring"])
        expect(JSON.parse(storage.getItem(CATEGORY_CATALOG_STORAGE_KEY) ?? "[]")).toEqual(["rocket::Backend"])
        expect(catalogApi.customTagCatalog).toEqual(["kotlin", "spring"])
        expect(catalogApi.customCategoryCatalog).toEqual(["rocket::Backend"])

        await act(async () => {
          modalFlowApi.openPublishModal("create")
          root.render(createElement(CatalogProbe))
        })

        expect(catalogState.postTags).toEqual(["vitest"])
        expect(catalogState.tagDraft).toBe("")
        expect(catalogState.postCategory).toBe("folder::Spring Boot")
        expect(JSON.parse(storage.getItem(TAG_CATALOG_STORAGE_KEY) ?? "[]")).toEqual(["kotlin", "spring", "vitest"])
        expect(JSON.parse(storage.getItem(CATEGORY_CATALOG_STORAGE_KEY) ?? "[]")).toEqual([
          "rocket::Backend",
          "folder::Spring Boot",
        ])
      } finally {
        await act(async () => {
          root.unmount()
        })
      }

      const writeHarness = createStatefulEditorHarness()
      writeHarness.state.editorMode = "create"
      writeHarness.state.postId = ""
      writeHarness.state.postTitle = "새 포스트"
      writeHarness.state.postContent = "본문 내용"
      writeHarness.state.postTags = ["react"]
      writeHarness.state.tagDraft = "typescript, nextjs"
      writeHarness.state.postCategory = "Backend"
      const writeRoot = createRoot(createMinimalRootContainer() as unknown as Element)
      const originalFetch = globalThis.fetch
      const capturedBodies: Array<Record<string, unknown>> = []

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.endsWith("/post/api/v1/posts") && init?.method === "POST") {
          capturedBodies.push(JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>)
          return new Response(
            JSON.stringify({
              resultCode: "201-1",
              msg: "created",
              data: {
                id: 501,
                version: 1,
                title: "새 포스트",
                summary: "",
                summarySource: "NONE",
                published: true,
                listed: true,
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        if (url === "/api/revalidate") {
          return new Response(JSON.stringify({ revalidated: true }), { status: 200 })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }) as typeof fetch

      try {
        await act(async () => {
          writeRoot.render(createElement(writeHarness.Probe))
        })
        await act(async () => {
          await writeHarness.persistence.handleWritePost()
          writeRoot.render(createElement(writeHarness.Probe))
        })

        expect(writeHarness.state.postTags).toEqual(["react", "typescript", "nextjs"])
        expect(writeHarness.state.tagDraft).toBe("")
        expect(writeHarness.state.postCategory).toBe("rocket::Backend")
        expect(String(capturedBodies[0]?.content ?? "")).toContain('tags: ["react", "typescript", "nextjs"]')
        expect(String(capturedBodies[0]?.content ?? "")).toContain('category: ["rocket::Backend"]')
      } finally {
        await act(async () => {
          writeRoot.unmount()
        })
        globalThis.fetch = originalFetch
      }
    })
  })

  test("responsive z-index hierarchy, tablet inspector default, 100dvh drawer + safe-area footer, conflict CTA, and card meta copy match contract", () => {
    const mobileMask = resolveViewportPanelUiMask(EDITOR_SURFACE_ZEN_BITS, {
      isMobileViewport: true,
      isTabletViewport: false,
    })
    expect(mobileMask & EDITOR_SURFACE_OUTLINE_OPEN).toBe(0)
    expect(mobileMask & EDITOR_SURFACE_INSPECTOR_OPEN).toBe(0)

    const tabletMask = resolveViewportPanelUiMask(EDITOR_SURFACE_ZEN_BITS, {
      isMobileViewport: false,
      isTabletViewport: true,
    })
    expect(tabletMask & EDITOR_SURFACE_OUTLINE_OPEN).toBe(EDITOR_SURFACE_OUTLINE_OPEN)
    expect(tabletMask & EDITOR_SURFACE_INSPECTOR_OPEN).toBe(0)

    const desktopMask = resolveViewportPanelUiMask(0, {
      isMobileViewport: false,
      isTabletViewport: false,
    })
    expect(desktopMask & EDITOR_SURFACE_ZEN_BITS).toBe(EDITOR_SURFACE_ZEN_BITS)

    const modalRendered = renderWithEmotionCss(EditorStudioPublishModal, {
      closeToggleLabel: "닫기",
      isCompactMobileLayout: true,
      isMobileMetaEditorOpen: false,
      isMobileThumbnailEditorOpen: false,
      loadingKey: "",
      modalNotice: { tone: "error", text: "버전 충돌 발생" },
      postVisibility: "PUBLIC_LISTED",
      previewMetaEditorPanel: createElement("div", null, "meta"),
      publishActionButtonDisabled: false,
      publishActionButtonText: "수정사항 반영",
      publishActionTitle: "글 수정 확인",
      shouldShowNotice: true,
      thumbnailEditorPanel: createElement("div", null, "thumb"),
      variant: "drawer",
      visibilityOptions: PUBLISH_VISIBILITY_OPTIONS,
      onClose: () => undefined,
      onConfirmPublish: () => undefined,
      onReloadLatestServerPost: () => undefined,
      onPostVisibilityChange: () => undefined,
      onToggleMobileMetaEditor: () => undefined,
      onToggleMobileThumbnailEditor: () => undefined,
    })
    expect(modalRendered.html).toContain("썸네일 URL과 업로드 방식을 설정합니다.")
    expect(modalRendered.html).not.toContain("썸네일 URL과 요약만")
    expect(modalRendered.html).toContain("서버 최신본 다시 불러오기")
    expect(modalRendered.css).toContain("z-index:190;")
    expect(modalRendered.css).toContain("max-height:100dvh;height:100dvh;")
    expect(modalRendered.css).toContain("padding:0.78rem 0 max(0.78rem, env(safe-area-inset-bottom, 0px));")

    const confirmRendered = renderWithEmotionCss(ConfirmDialog, {
      open: true,
      titleId: "confirm-t",
      descriptionId: "confirm-d",
      title: "나가시겠습니까?",
      description: "저장되지 않은 변경사항이 있습니다.",
      confirmLabel: "나가기",
      onConfirm: () => undefined,
      onCancel: () => undefined,
    })
    expect(confirmRendered.css).toContain("z-index:220;")

    const surfaceRendered = renderWithEmotionCss(EditorStudioDedicatedEditorSurface, {
      thumbnailImageFileInputRef: () => undefined,
      onThumbnailImageFileChange: () => undefined,
      onExit: () => undefined,
      saveStateText: "수정됨",
      saveStateTone: "dirty",
      primaryActionDisabled: false,
      primaryActionLabel: "발행하기",
      onPrimaryAction: () => undefined,
      postTags: ["kotlin"],
      tagDraft: "",
      onTagDraftChange: () => undefined,
      onAddTags: () => undefined,
      onAddTag: () => undefined,
      onRemoveTag: () => undefined,
      titleInputRef: () => undefined,
      onOutlineBodyHeadingActivate: () => undefined,
      postTitle: "테스트 제목",
      onPostTitleChange: () => undefined,
      onPostTitleKeyDown: () => undefined,
      postContent: "## 섹션 제목\n본문",
      postSummary: "",
      onPostSummaryChange: () => undefined,
      postCategory: "Spring ",
      onPostCategoryChange: () => undefined,
      onCommitPostCategory: () => undefined,
      categorySuggestions: ["folder::Spring Boot", "rocket::Backend"],
      tagSuggestions: ["kotlin", "spring"],
      postVisibility: "PUBLIC_LISTED",
      onPostVisibilityChange: () => undefined,
      editorCanvas: createElement("div", null, "canvas"),
      showPublishNotice: true,
      publishNoticeTone: "error",
      publishNoticeText: "버전 충돌이 발생했습니다.",
      onReloadLatestServerPost: () => undefined,
      isLocalDraftRestoreSuggestionVisible: false,
      isLocalDraftRestoreSuggestionActionsDisabled: false,
      onRestoreLocalDraft: () => undefined,
      localDraftCandidates: [],
      selectedLocalDraftCandidateKey: "",
      onSelectLocalDraftCandidate: () => undefined,
      onDiscardLocalDraftCandidate: () => undefined,
      onDismissLocalDraftRestoreSuggestion: () => undefined,
      onClearLocalDraft: () => undefined,
      publishModal: null,
    })
    expect(surfaceRendered.html).toContain("서버 최신본 다시 불러오기")
    expect(surfaceRendered.html).toContain('value="Spring "')
    expect(surfaceRendered.html).toContain('<option value="Spring Boot"></option>')
    expect(surfaceRendered.html).toContain('<option value="Backend"></option>')
    expect(surfaceRendered.html).not.toContain("folder::Spring Boot")
    expect(surfaceRendered.html).not.toContain("rocket::Backend")
    expect(surfaceRendered.css).toContain("z-index:160;")
  })

  test("consecutive session autosaves reschedule when own checkpoint updates and suppress self-restore thrashing", () => {
    const firstCheckpoint = '{"title":"draft","summary":"수동 요약"}'
    const clearedSummaryCheckpoint = '{"title":"draft","summary":""}'

    expect(
      resolveEffectivePendingRestorableDraftFingerprint(firstCheckpoint, firstCheckpoint)
    ).toBeNull()
    expect(
      resolveEffectivePendingRestorableDraftFingerprint(firstCheckpoint, null)
    ).toBe(firstCheckpoint)

    expect(
      decideLocalDraftAutosave({
        loadingKey: "",
        shouldAdoptBaseline: false,
        isPostIdTransitionGated: false,
        hasDraftContent: true,
        editorFingerprint: clearedSummaryCheckpoint,
        lastArmedFingerprint: firstCheckpoint,
        pendingRestorableDraftFingerprint: resolveEffectivePendingRestorableDraftFingerprint(
          firstCheckpoint,
          firstCheckpoint
        ),
      })
    ).toEqual({ action: "schedule" })

    expect(
      isLocalDraftRestoreSuggestionEligible({
        candidate: {
          key: "admin.editor.localDraft.create.self.v3",
          source: { kind: "create" },
          fingerprint: firstCheckpoint,
          isActiveSessionAutosave: true,
        },
        currentSource: { kind: "create" },
        editorFingerprint: clearedSummaryCheckpoint,
        serverBaselineFingerprint: "",
        restored: [],
        dismissed: [],
      })
    ).toBe(false)
  })
})
