import { expect, test } from "@playwright/test"
import { createElement, type Dispatch, type SetStateAction } from "react"
import { renderToString } from "react-dom/server"
import { registerServerApiFetchMetrics } from "../../src/libs/server/apiFetchMetrics"
import { useEditorStudioDraftLifecycle } from "../../src/routes/Admin/useEditorStudioDraftLifecycle"

type DraftLifecycleParams = Parameters<typeof useEditorStudioDraftLifecycle>[0]
type Setter<T> = Dispatch<SetStateAction<T>>
type EditorLoadState = {
  content: string
  editorMode: "create" | "edit"
  loadingKey: string
  postId: string
  postTitle: string
  result: string
}

const createDeferredResponse = () => {
  let reject!: (error: Error) => void
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "content-type": "application/json" },
})

const createSetter = <T>(read: () => T, write: (value: T) => void): Setter<T> => (next) => {
  write(typeof next === "function" ? (next as (previous: T) => T)(read()) : next)
}

const createPost = (id: string, title: string, content: string) => ({
  id,
  title,
  content,
  summary: "",
  summarySource: "NONE",
  published: true,
  listed: true,
  tempDraft: false,
})

const createHarness = () => {
  const state: EditorLoadState = {
    content: "",
    editorMode: "create",
    loadingKey: "",
    postId: "",
    postTitle: "",
    result: "",
  }
  const baselineRef = { current: "" }
  const lastLocalDraftFingerprintRef = { current: "" }
  const lastWriteFingerprintRef = { current: "" }
  const lastWriteIdempotencyKeyRef = { current: "" }
  const tempPostRequestRef = { current: null }
  const setPostId: Setter<string> = createSetter(() => state.postId, (value) => { state.postId = value })
  const setPostTitle: Setter<string> = createSetter(() => state.postTitle, (value) => { state.postTitle = value })
  const setPostContent: Setter<string> = createSetter(() => state.content, (value) => { state.content = value })
  const setLoadingKey: Setter<string> = createSetter(() => state.loadingKey, (value) => { state.loadingKey = value })
  const setResult: Setter<string> = createSetter(() => state.result, (value) => { state.result = value })
  const params: DraftLifecycleParams = {
    router: {} as DraftLifecycleParams["router"],
    toEditorPostRoute: (id) => `/admin/editor/${id}`,
    postId: "",
    postVersion: null,
    loadingKey: "",
    postTitle: "",
    postContent: "",
    getCurrentPostContent: () => state.content,
    postSummary: "",
    postSummarySource: "NONE",
    summaryIntent: { kind: "auto" },
    postThumbnailUrl: "",
    postThumbnailFocusX: 0.5,
    postThumbnailFocusY: 0.5,
    postThumbnailZoom: 1,
    postTags: [],
    postCategory: "",
    postVisibility: "PUBLIC_LISTED",
    editorMode: "create",
    isCompactMobileLayout: false,
    setEditorMode: createSetter(() => state.editorMode, (value) => { state.editorMode = value }),
    setIsTempDraftMode: createSetter(() => false, () => undefined),
    setPostId,
    setPostVersion: createSetter(() => null, () => undefined),
    setPreviewThumbnailSourceUrl: createSetter(() => "", () => undefined),
    setPostTitle,
    setPostContent,
    setPostSummary: createSetter(() => "", () => undefined),
    setPostSummarySource: createSetter(() => "NONE" as const, () => undefined),
    setSummaryIntent: createSetter(() => ({ kind: "auto" } as const), () => undefined),
    setPostThumbnailUrl: createSetter(() => "", () => undefined),
    setPostThumbnailFocusX: createSetter(() => 0.5, () => undefined),
    setPostThumbnailFocusY: createSetter(() => 0.5, () => undefined),
    setPostThumbnailZoom: createSetter(() => 1, () => undefined),
    setPostTags: createSetter(() => [], () => undefined),
    setPostCategory: createSetter(() => "", () => undefined),
    setPostVisibility: createSetter(() => "PUBLIC_LISTED" as const, () => undefined),
    setKnownTags: createSetter(() => [], () => undefined),
    setLocalDraftSavedAt: createSetter(() => "", () => undefined),
    setLocalDraftSlotLabel: createSetter(() => "", () => undefined),
    setLoadingKey,
    setResult,
    setIsNewEditorBootstrapPending: createSetter(() => false, () => undefined),
    setMobileComposeStep: createSetter(() => "edit" as const, () => undefined),
    activateComposeSurface: () => undefined,
    setPublishStatus: () => undefined,
    dedupeStrings: (items) => Array.from(new Set(items)),
    normalizeCategoryValue: (value) => value.trim(),
    buildLocalDraftFingerprint: (payload) => JSON.stringify(payload),
    persistLocalDraft: () => undefined,
    readLocalDraft: () => null,
    removeLocalDraft: () => undefined,
    buildEditorStateFingerprint: (payload) => `${payload.title}:${payload.content}`,
    pretty: (value) => JSON.stringify(value),
    resolveEditorMetaSnapshot: (content) => ({
      body: content,
      thumbnailUrl: "",
      thumbnailFocusX: 0.5,
      thumbnailFocusY: 0.5,
      thumbnailZoom: 1,
      tags: [],
      category: "",
    }),
    syncEditorMeta: (content) => {
      setPostContent(content)
      return {
        body: content,
        thumbnailUrl: "",
        thumbnailFocusX: 0.5,
        thumbnailFocusY: 0.5,
        thumbnailZoom: 1,
        tags: [],
        category: "",
      }
    },
    buildEmptyEditorMetaSnapshot: () => ({
      body: "",
      thumbnailUrl: "",
      thumbnailFocusX: 0.5,
      thumbnailFocusY: 0.5,
      thumbnailZoom: 1,
      tags: [],
      category: "",
    }),
    isBlankServerTempDraft: () => false,
    toVisibility: (published, listed) => published && listed ? "PUBLIC_LISTED" : "PRIVATE",
    requestTempPostWithConflictRetry: async () => ({ data: createPost("temp", "", ""), msg: "" }),
    defaultThumbnailFocusX: 0.5,
    defaultThumbnailFocusY: 0.5,
    defaultThumbnailZoom: 1,
    lastLocalDraftFingerprintRef,
    lastWriteFingerprintRef,
    lastWriteIdempotencyKeyRef,
    serverBaselineEditorFingerprintRef: baselineRef,
    tempPostRequestRef,
  }
  let lifecycle!: ReturnType<typeof useEditorStudioDraftLifecycle>
  const Probe = () => {
    lifecycle = useEditorStudioDraftLifecycle(params)
    return null
  }
  renderToString(createElement(Probe))
  return { baselineRef, lifecycle, state }
}

const originalFetch = globalThis.fetch
test.beforeEach(() => { registerServerApiFetchMetrics() })
test.afterEach(() => { globalThis.fetch = originalFetch })

test("later editor load keeps title, content, id, and baseline when an earlier load resolves last", async () => {
  const first = createDeferredResponse()
  const second = createDeferredResponse()
  globalThis.fetch = ((url) => {
    const targetId = String(url).split("/").pop()
    return targetId === "A" ? first.promise : second.promise
  }) as typeof fetch
  const { baselineRef, lifecycle, state } = createHarness()

  const firstLoad = lifecycle.loadPostForEditor("A")
  const secondLoad = lifecycle.loadPostForEditor("B")
  second.resolve(jsonResponse(createPost("B", "B title", "B content")))
  await secondLoad
  first.resolve(jsonResponse(createPost("A", "A title", "A content")))
  await firstLoad

  expect(state).toMatchObject({ postId: "B", postTitle: "B title", content: "B content" })
  expect(baselineRef.current).toBe("B title:B content")
})

test("stale load failure cannot replace the latest result or loading state", async () => {
  const first = createDeferredResponse()
  const second = createDeferredResponse()
  globalThis.fetch = ((url) => {
    const targetId = String(url).split("/").pop()
    return targetId === "A" ? first.promise : second.promise
  }) as typeof fetch
  const { lifecycle, state } = createHarness()

  const firstLoad = lifecycle.loadPostForEditor("A")
  const secondLoad = lifecycle.loadPostForEditor("B")
  second.resolve(jsonResponse(createPost("B", "B title", "B content")))
  await secondLoad
  first.reject(new Error("stale A failure"))
  await firstLoad

  expect(state.result).toContain('"id":"B"')
  expect(state.loadingKey).toBe("")
})

test("switching to create mode invalidates an in-flight editor load", async () => {
  const first = createDeferredResponse()
  globalThis.fetch = (() => first.promise) as typeof fetch
  const { baselineRef, lifecycle, state } = createHarness()

  const firstLoad = lifecycle.loadPostForEditor("A")
  lifecycle.switchToCreateMode({ keepContent: false })
  first.resolve(jsonResponse(createPost("A", "A title", "A content")))
  await firstLoad

  expect(state).toMatchObject({ editorMode: "create", postId: "", postTitle: "", content: "" })
  expect(baselineRef.current).toBe("")
})

test("settling an older load leaves the current request loading until it completes", async () => {
  const first = createDeferredResponse()
  const second = createDeferredResponse()
  globalThis.fetch = ((url) => String(url).endsWith("/A") ? first.promise : second.promise) as typeof fetch
  const { lifecycle, state } = createHarness()
  const firstLoad = lifecycle.loadPostForEditor("A")
  const secondLoad = lifecycle.loadPostForEditor("B")
  first.resolve(jsonResponse(createPost("A", "A title", "A content")))
  await firstLoad
  expect(state.loadingKey).toBe("postOne")
  expect(state.postId).toBe("")
  second.resolve(jsonResponse(createPost("B", "B title", "B content")))
  await secondLoad
  expect(state.loadingKey).toBe("")
  expect(state.postId).toBe("B")
})

test("temporary draft loading cannot overwrite a newer existing-post request", async () => {
  const second = createDeferredResponse()
  globalThis.fetch = (() => second.promise) as typeof fetch
  const { lifecycle, state } = createHarness()
  const tempLoad = lifecycle.handleLoadOrCreateTempPost()
  const secondLoad = lifecycle.loadPostForEditor("B")
  await tempLoad
  expect(state.postId).toBe("")
  expect(state.loadingKey).toBe("postOne")
  second.resolve(jsonResponse(createPost("B", "B title", "B content")))
  await secondLoad
  expect(state).toMatchObject({ postId: "B", content: "B content", loadingKey: "" })
})
