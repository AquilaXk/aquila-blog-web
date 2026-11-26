import { act, createElement, useRef, type ReactElement } from "react"
import fs from "node:fs"
import path from "node:path"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import { EditorState } from "@codemirror/state"
import { EditorView, type DecorationSet } from "@codemirror/view"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { GFM } from "@lezer/markdown"
import { expect, test } from "@playwright/test"
import { ApiError, ApiNetworkError, ApiTimeoutError } from "../../src/apis/backend/client"
import { LanguageProvider } from "../../src/libs/language"
import { createTheme } from "../../src/styles/theme"
import {
  clearCreatedEditorPostHandoff,
  consumeCreatedEditorPostHandoff,
  hydrateCreatedEditorPostHandoff,
  resolveCreatedPostDestination,
  saveCreatedEditorPostHandoff,
  syncCreatedPostBrowserRoute,
} from "../../src/routes/Admin/editorCreatedPostHandoff"
import {
  resolveEditorFailureRecovery,
  resolveEditorUploadFailureRecovery,
} from "../../src/routes/Admin/editorFailureRecoveryModel"
import { resolveCreateWritePostId } from "../../src/routes/Admin/editorStudioDraftAutosaveDecisionModel"
import { describeLocalDraftSlot } from "../../src/routes/Admin/editorStudioStorageModel"
import {
  isEditorStudioBootstrapNavigation,
  isEditorUnsavedDirtyByFingerprint,
} from "../../src/routes/Admin/editorStudioUnsavedExitGuard"
import { useEditorStudioDraftLifecycle } from "../../src/routes/Admin/useEditorStudioDraftLifecycle"
import { useEditorStudioLocalDraftLifecycle } from "../../src/routes/Admin/useEditorStudioDraftLifecycleModel"
import { useEditorStudioRouting } from "../../src/routes/Admin/useEditorStudioRouting"
import {
  blockContainerBlockField,
  MarkdownBookmarkBlockWidget,
  MarkdownCalloutBlockWidget,
  MarkdownEmbedBlockWidget,
  MarkdownFileBlockWidget,
  MarkdownToggleBlockWidget,
} from "../../src/components/markdown-editor/markdownEditorBlockWidgets"
import { computeColorSwatchMutationPlan } from "../../src/components/markdown-editor/markdownEditorBlockChromeModel"
import { parseBlockContainerBlocks } from "../../src/components/markdown-editor/markdownEditorBlockContainerModel"
import { blockDecorationField, buildInlineViewportDecorations } from "../../src/components/markdown-editor/markdownEditorLiveViewportDecorations"
import { MarkdownCodeBlockHeaderWidget } from "../../src/components/markdown-editor/markdownEditorCodeBlockChrome"
import { attachLiveImageControls } from "../../src/components/markdown-editor/markdownEditorImageControls"
import {
  editorLanguageField,
  setEditorLanguage,
} from "../../src/components/markdown-editor/markdownEditorLanguageState"
import { liveTableAndCardThemeSpec } from "../../src/components/markdown-editor/markdownEditorLiveTableAndCardTheme"
import {
  applyHtmlPasteIfEligible,
  resolveMarkdownEditorUploadErrorMessage,
} from "../../src/components/markdown-editor/markdownEditorMediaTransferModel"
import {
  buildUploadingAttachmentPlaceholder,
  buildUploadingImagePlaceholder,
  planTransferFileReservations,
} from "../../src/components/markdown-editor/markdownEditorPasteDropModel"
import {
  resolveMarkdownScrollHost,
  type MarkdownScrollSnapshot,
} from "../../src/components/markdown-editor/markdownEditorScrollSync"
import {
  createTableImeProxyElement,
  openTableCellEditorSession,
} from "../../src/components/markdown-editor/markdownEditorTableSessionDom"
import { MarkdownTableWidget } from "../../src/components/markdown-editor/markdownEditorTableWidget"
import {
  attachColumnResizeHandle,
  createInteractiveTableSurface,
  createTableToolbarElement,
} from "../../src/components/markdown-editor/markdownEditorTableWidgetDom"
import {
  MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
  MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE,
  resolveMarkdownAttachmentLink,
  resolveMarkdownImageEmbed,
  validateMarkdownAttachmentSize,
} from "../../src/components/markdown-editor/markdownEditorUploadModel"
import {
  MarkdownEditorReadingPreview,
  ReadingPreviewLoadingPlaceholder,
} from "../../src/components/markdown-editor/MarkdownEditorReadingPreview"
import {
  shouldIgnoreBlockChromeHoverTarget,
  useBlockChromeViewportListeners,
} from "../../src/components/markdown-editor/markdownEditorBlockDragHelper"
import {
  createMinimalRootContainer,
  createStatefulEditorHarness,
  withWindowStorage,
} from "./helpers/editorStudioTestHarness"
import { wrapPlaywrightJsxComponent } from "./helpers/materializePlaywrightJsx"

const ClientLanguageProvider = wrapPlaywrightJsxComponent(LanguageProvider) as typeof LanguageProvider
const ClientThemeProvider = wrapPlaywrightJsxComponent(ThemeProvider) as typeof ThemeProvider
const ClientReadingPreview = wrapPlaywrightJsxComponent(
  MarkdownEditorReadingPreview
) as typeof MarkdownEditorReadingPreview
const ClientLoadingPlaceholder = wrapPlaywrightJsxComponent(
  ReadingPreviewLoadingPlaceholder
) as typeof ReadingPreviewLoadingPlaceholder

type MutationObserverCallbackFn = (mutations: unknown[]) => void

const createInteractiveFakeDom = () => {
  const observerEntries = new Set<{
    target: Record<string, unknown>
    callback: MutationObserverCallbackFn
  }>()

  const notifyObservers = (node: Record<string, unknown> | null) => {
    let cur = node
    while (cur) {
      for (const entry of Array.from(observerEntries)) {
        if (entry.target === cur) entry.callback([])
      }
      cur = (cur.parentElement as Record<string, unknown> | null) ?? null
    }
  }

  const createEl = (tag: string): Record<string, any> => {
    const attrs = new Map<string, string>()
    const listeners = new Map<string, Set<(ev?: unknown) => void>>()
    const classes = new Set<string>()
    const childNodes: any[] = []
    let text = ""
    let val = ""

    const matches = (candidate: Record<string, any>, selector: string): boolean => {
      if (selector.includes(",")) {
        return selector
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .some((part) => matches(candidate, part))
      }
      if (selector.startsWith(".")) return candidate.classList.contains(selector.slice(1))
      const attrMatch = /^\[([^=\]]+)="([^"]*)"\]$/.exec(selector)
      if (attrMatch) return candidate.getAttribute(attrMatch[1]!) === attrMatch[2]!
      return String(candidate.tagName).toUpperCase() === selector.toUpperCase()
    }

    const findDescendant = (root: Record<string, any>, selector: string): Record<string, any> | null => {
      for (const child of root.children as Record<string, any>[]) {
        if (matches(child, selector)) return child
        const nested = findDescendant(child, selector)
        if (nested) return nested
      }
      return null
    }

    const el: Record<string, any> = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      nodeName: tag.toUpperCase(),
      namespaceURI: "http://www.w3.org/1999/xhtml",
      parentElement: null as Record<string, any> | null,
      parentNode: null as Record<string, any> | null,
      childNodes,
      children: childNodes,
      get firstChild() {
        return childNodes[0] ?? null
      },
      scrollTop: 0,
      scrollHeight: 0,
      clientHeight: 0,
      style: { setProperty: () => undefined, removeProperty: () => undefined },
      dataset: new Proxy({} as Record<string, string | undefined>, {
        get: (_t, key) =>
          typeof key === "string"
            ? attrs.get(`data-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`)
            : undefined,
        set: (_t, key, nextVal) => {
          if (typeof key !== "string") return true
          const attrKey = `data-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`
          if (nextVal === undefined) attrs.delete(attrKey)
          else attrs.set(attrKey, String(nextVal))
          return true
        },
      }),
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        contains: (c: string) => classes.has(c),
        toggle: (c: string) => {
          if (classes.has(c)) {
            classes.delete(c)
            return false
          }
          classes.add(c)
          return true
        },
      },
      get className() {
        return Array.from(classes).join(" ")
      },
      set className(next: string) {
        classes.clear()
        for (const token of String(next || "").split(/\s+/).filter(Boolean)) classes.add(token)
      },
      get textContent() {
        return text
      },
      set textContent(next: string) {
        text = String(next ?? "")
        if (text === "") childNodes.length = 0
      },
      get value() {
        return val
      },
      set value(next: string) {
        val = String(next ?? "")
      },
      setAttribute: (name: string, nextVal: string) => attrs.set(name, String(nextVal)),
      getAttribute: (name: string) => attrs.get(name) ?? null,
      hasAttribute: (name: string) => attrs.has(name),
      appendChild: (child: Record<string, any>) => {
        if (child.parentNode) child.parentNode.removeChild(child)
        child.parentElement = el
        child.parentNode = el
        childNodes.push(child)
        notifyObservers(el)
        return child
      },
      append: (...nodes: Array<Record<string, any> | string>) => {
        for (const node of nodes) {
          if (typeof node !== "string") el.appendChild(node)
        }
      },
      insertBefore: (newNode: Record<string, any>, refNode: Record<string, any> | null) => {
        if (newNode.parentNode) newNode.parentNode.removeChild(newNode)
        const idx = refNode ? childNodes.indexOf(refNode) : -1
        newNode.parentElement = el
        newNode.parentNode = el
        if (idx >= 0) childNodes.splice(idx, 0, newNode)
        else childNodes.push(newNode)
        notifyObservers(el)
        return newNode
      },
      remove: () => {
        el.parentNode?.removeChild(el)
      },
      removeChild: (child: Record<string, any>) => {
        const idx = childNodes.indexOf(child)
        if (idx >= 0) {
          childNodes.splice(idx, 1)
          child.parentElement = null
          child.parentNode = null
          notifyObservers(el)
        }
        return child
      },
      replaceChildren: (...nodes: Array<Record<string, any>>) => {
        childNodes.length = 0
        for (const node of nodes) el.appendChild(node)
      },
      querySelector: (selector: string) => findDescendant(el, selector),
      querySelectorAll: (selector: string) => {
        const out: Record<string, any>[] = []
        const walk = (root: Record<string, any>) => {
          for (const child of root.children as Record<string, any>[]) {
            if (matches(child, selector)) out.push(child)
            walk(child)
          }
        }
        walk(el)
        return out
      },
      matches: (selector: string) => matches(el, selector),
      closest: (selector: string) => {
        for (let cur: Record<string, any> | null = el; cur; cur = cur.parentElement) {
          if (matches(cur, selector)) return cur
        }
        return null
      },
      addEventListener: (type: string, fn: (ev?: unknown) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)?.add(fn)
      },
      removeEventListener: (type: string, fn: (ev?: unknown) => void) => {
        listeners.get(type)?.delete(fn)
      },
      dispatchEvent: (ev: Record<string, any>) => {
        for (const fn of listeners.get(String(ev.type)) ?? []) fn(ev)
        return true
      },
    }
    return el
  }

  const head = createEl("head")
  const body = createEl("body")
  const doc = {
    nodeType: 9,
    head,
    body,
    documentElement: { lang: "" },
    activeElement: null as Record<string, any> | null,
    querySelectorAll: (selector: string) => body.querySelectorAll(selector),
    querySelector: (selector: string) => body.querySelector(selector),
    createElement: (tag: string) => {
      const node = createEl(tag)
      node.ownerDocument = doc
      return node
    },
    createTextNode: (data: string) => ({
      nodeType: 3,
      nodeValue: String(data),
      textContent: String(data),
      parentNode: null,
      parentElement: null,
      children: [],
      childNodes: [],
      ownerDocument: doc,
    }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  head.ownerDocument = doc
  body.ownerDocument = doc

  class FakeMutationObserver {
    private readonly entry: { target: Record<string, unknown>; callback: MutationObserverCallbackFn }
    constructor(callback: MutationObserverCallbackFn) {
      this.entry = { target: {}, callback }
    }
    observe(target: Record<string, unknown>) {
      this.entry.target = target
      observerEntries.add(this.entry)
    }
    disconnect() {
      observerEntries.delete(this.entry)
    }
  }

  return { doc, MutationObserver: FakeMutationObserver }
}

const withFakeDomEnvironment = async <T>(
  run: (ctx: { doc: ReturnType<typeof createInteractiveFakeDom>["doc"] }) => Promise<T> | T
): Promise<T> => {
  const { doc, MutationObserver: FakeMutationObserver } = createInteractiveFakeDom()
  const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
  const prevMutationObserver = Object.getOwnPropertyDescriptor(globalThis, "MutationObserver")
  return withWindowStorage(async () => {
    Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: doc })
    Object.defineProperty(globalThis, "MutationObserver", {
      configurable: true,
      writable: true,
      value: FakeMutationObserver,
    })
    ;(globalThis.window as unknown as Record<string, unknown>).document = doc
    ;(globalThis.window as unknown as Record<string, unknown>).requestAnimationFrame = (cb: () => void) =>
      setTimeout(cb, 0) as unknown as number
    ;(globalThis.window as unknown as Record<string, unknown>).cancelAnimationFrame = (id: number) =>
      clearTimeout(id)
    try {
      return await run({ doc })
    } finally {
      if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc)
      else delete (globalThis as Record<string, unknown>).document
      if (prevMutationObserver) Object.defineProperty(globalThis, "MutationObserver", prevMutationObserver)
      else delete (globalThis as Record<string, unknown>).MutationObserver
    }
  })
}

const createEditorStateWithLanguage = (doc: string, language: "ko" | "en"): EditorState =>
  EditorState.create({
    doc,
    extensions: [editorLanguageField.init(() => language)],
  })

test.describe("Editor Phase 3 remaining sync, KO/EN i18n, and scroll restoration", () => {
  test("failure recovery, local draft slot, and missing create post id localize cleanly while keeping KO defaults intact", () => {
    const koDefault = resolveEditorFailureRecovery(
      new ApiError(409, "/post/api/v1/posts/1", "", "req-ko-1"),
      { action: "modify", isOnline: true }
    )
    expect(koDefault.statusText).toContain("수정 실패: 서버 최신본과 충돌했습니다.")
    expect(koDefault.statusText).toContain("(요청 ID: req-ko-1)")
    expect(koDefault.result.nextActions[0]).toBe("현재 내용을 로컬 임시저장으로 보존")

    const enConflict = resolveEditorFailureRecovery(
      new ApiError(409, "/post/api/v1/posts/1", "", "req-en-1"),
      { action: "write", isOnline: true, language: "en" }
    )
    expect(enConflict.statusText).toContain("Create failed: Conflicts with the latest server version.")
    expect(enConflict.statusText).toContain("(Request ID: req-en-1)")
    expect(enConflict.result.nextActions[0]).toBe("Keep current content in a local draft")

    const enOffline = resolveEditorFailureRecovery(new ApiNetworkError("/post/api/v1/posts"), {
      action: "publish-temp",
      isOnline: false,
      language: "en",
    })
    expect(enOffline.statusText).toContain("Publish post failed: Cannot reach the server while offline.")

    const enUpload = resolveEditorUploadFailureRecovery(new ApiTimeoutError("/post/api/v1/posts/files", 5000), {
      kind: "thumbnail",
      fileName: "cover.webp",
      isOnline: true,
      language: "en",
    })
    expect(enUpload.statusText).toContain('Cover upload failed for "cover.webp". The server response timed out.')
    expect(enUpload.statusText).toContain("You can try again.")

    expect(
      describeLocalDraftSlot({
        source: { kind: "create" },
        title: "",
        savedAt: "2026-11-27T01:23:00.000Z",
      })
    ).toBe("새 글 · 01:23")
    expect(
      describeLocalDraftSlot(
        {
          source: { kind: "create" },
          title: "",
          savedAt: "2026-11-27T01:23:00.000Z",
        },
        "en"
      )
    ).toBe("New post · 01:23")
    expect(
      describeLocalDraftSlot(
        {
          source: { kind: "post", postId: "88" },
          title: "",
          savedAt: "",
        },
        "en"
      )
    ).toBe("Post #88 · Untitled")

    expect(resolveCreateWritePostId(null)).toEqual({
      ok: false,
      statusText: "글 작성 응답에 글 ID가 없습니다. 로컬 임시저장은 유지됩니다. 다시 시도해주세요.",
    })
    expect(resolveCreateWritePostId(null, "en")).toEqual({
      ok: false,
      statusText: "Post ID is missing from the create response. Your local draft is preserved. Please try again.",
    })
  })

  test("draft lifecycle hooks emit EN status notices when LanguageProvider is English", async () => {
    await withFakeDomEnvironment(async () => {
      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      const originalFetch = globalThis.fetch
      const notices: Array<{ tone: string; text: string }> = []
      let lifecycleRef: ReturnType<typeof useEditorStudioDraftLifecycle> | null = null
      let shouldThrowStorage = false

      const emptyTags: string[] = []
      const stableNoop = () => undefined
      const stableToEditorPostRoute = (id: string | number) => `/admin/editor/${id}`
      const stableGetCurrentPostContent = () => "EN Draft Body"
      const stableGetEmptyContent = () => ""
      const stableSetPublishStatus = (notice: { tone: string; text: string }) => {
        notices.push(notice)
      }
      const stableDedupeStrings = (items: string[]) => items
      const stableNormalizeCategory = (val: string) => val
      const stableBuildFingerprint = (payload: unknown) => JSON.stringify(payload)
      const stablePersistLocalDraft = () => {
        if (shouldThrowStorage) throw new Error("quota exceeded")
      }
      const stablePersistNoop = () => undefined
      const stableReadNull = () => null
      const stablePretty = (val: unknown) => JSON.stringify(val)
      const stableSnapshot = (c: string) => ({
        body: c,
        thumbnailUrl: "",
        thumbnailFocusX: 50,
        thumbnailFocusY: 50,
        thumbnailZoom: 1,
        tags: emptyTags,
        category: "",
      })
      const stableEmptySnapshot = () => ({
        body: "",
        thumbnailUrl: "",
        thumbnailFocusX: 50,
        thumbnailFocusY: 50,
        thumbnailZoom: 1,
        tags: emptyTags,
        category: "",
      })
      const stableIsBlankTemp = () => true
      const stableToVisibility = () => "PUBLIC_LISTED" as const
      let failTempPostFetch = false
      const stableRequestTempPost = async () => {
        if (failTempPostFetch) throw new Error("network error")
        return {
          resultCode: "200-1",
          msg: "ok",
          data: {
            id: 10,
            title: "임시글",
            content: "",
            summary: "",
            summarySource: "NONE" as const,
            published: false,
            listed: false,
            tempDraft: true,
          },
        }
      }
      const stableSummaryIntent = { kind: "auto" as const }
      const stableRouter = { pathname: "/admin/editor/10", query: {}, isReady: true } as any

      const Probe = () => {
        const fpRef = useRef("")
        const writeFpRef = useRef("")
        const idemRef = useRef("")
        const baselineRef = useRef("")
        const tempReqRef = useRef(null)
        const lifecycle = useEditorStudioDraftLifecycle({
          router: stableRouter,
          toEditorPostRoute: stableToEditorPostRoute,
          postId: "10",
          postVersion: 1,
          loadingKey: "",
          postTitle: "EN Draft Title",
          postContent: "EN Draft Body",
          getCurrentPostContent: stableGetCurrentPostContent,
          postSummary: "",
          postSummarySource: "NONE",
          summaryIntent: stableSummaryIntent,
          postThumbnailUrl: "",
          postThumbnailFocusX: 50,
          postThumbnailFocusY: 50,
          postThumbnailZoom: 1,
          postTags: emptyTags,
          postCategory: "",
          postVisibility: "PUBLIC_LISTED",
          editorMode: "edit",
          setEditorMode: stableNoop,
          setIsTempDraftMode: stableNoop,
          setPostId: stableNoop,
          setPostVersion: stableNoop,
          setPreviewThumbnailSourceUrl: stableNoop,
          setPostTitle: stableNoop,
          setPostContent: stableNoop,
          setPostSummary: stableNoop,
          setPostSummarySource: stableNoop,
          setSummaryIntent: stableNoop,
          setPostThumbnailUrl: stableNoop,
          setPostThumbnailFocusX: stableNoop,
          setPostThumbnailFocusY: stableNoop,
          setPostThumbnailZoom: stableNoop,
          setPostTags: stableNoop,
          setPostCategory: stableNoop,
          setPostVisibility: stableNoop,
          setLocalDraftSavedAt: stableNoop,
          setLoadingKey: stableNoop,
          setResult: stableNoop,
          setIsNewEditorBootstrapPending: stableNoop,
          activateComposeSurface: stableNoop,
          setPublishStatus: stableSetPublishStatus,
          dedupeStrings: stableDedupeStrings,
          normalizeCategoryValue: stableNormalizeCategory,
          buildLocalDraftFingerprint: stableBuildFingerprint,
          persistLocalDraft: stablePersistLocalDraft,
          readLocalDraft: stableReadNull,
          removeLocalDraft: stableNoop,
          buildEditorStateFingerprint: stableBuildFingerprint,
          pretty: stablePretty,
          resolveEditorMetaSnapshot: stableSnapshot,
          syncEditorMeta: stableSnapshot,
          buildEmptyEditorMetaSnapshot: stableEmptySnapshot,
          isBlankServerTempDraft: stableIsBlankTemp,
          toVisibility: stableToVisibility,
          requestTempPostWithConflictRetry: stableRequestTempPost,
          defaultThumbnailFocusX: 50,
          defaultThumbnailFocusY: 50,
          defaultThumbnailZoom: 1,
          lastLocalDraftFingerprintRef: fpRef,
          lastWriteFingerprintRef: writeFpRef,
          lastWriteIdempotencyKeyRef: idemRef,
          serverBaselineEditorFingerprintRef: baselineRef,
          tempPostRequestRef: tempReqRef,
        })
        lifecycleRef = lifecycle
        return null
      }

      try {
        await act(async () => {
          root.render(
            createElement(ClientLanguageProvider, {
              initialLanguage: "en",
              children: createElement(Probe),
            })
          )
        })

        await act(async () => {
          lifecycleRef!.saveLocalDraft({ silent: false, force: true })
        })
        expect(notices.at(-1)?.text).toContain("Saved browser draft (Post #10 · EN Draft Title")

        shouldThrowStorage = true
        await act(async () => {
          lifecycleRef!.saveLocalDraft({ silent: false, force: true })
        })
        expect(notices.at(-1)?.text).toContain("Failed to save browser draft.")
        expect(lifecycleRef!.preserveLocalDraftForConflictReload("10")).toBe(false)
        expect(notices.at(-1)?.text).toContain("Could not back up locally")
        shouldThrowStorage = false

        await act(async () => {
          lifecycleRef!.clearLocalDraft()
        })
        expect(notices.at(-1)?.text).toBe("Cleared browser draft.")

        await act(async () => {
          await lifecycleRef!.applyRestoredRevisionPost({
            id: 10,
            version: 4,
            title: "Rev Title",
            content: "Rev Body",
            summary: "",
            summarySource: "NONE",
            published: true,
            listed: true,
          })
        })
        expect(notices.at(-1)?.text).toBe("Restored manuscript from the selected revision.")

        globalThis.fetch = (async () =>
          new Response(
            JSON.stringify({
              id: 10,
              version: 5,
              title: "Latest",
              content: "Latest body",
              summary: "",
              summarySource: "NONE",
              published: true,
              listed: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )) as typeof fetch
        await act(async () => {
          await lifecycleRef!.reloadLatestServerPost("10")
        })
        expect(notices.some((n) => n.text.includes("Keeping current edits in a local draft"))).toBe(true)
        expect(notices.at(-1)?.text).toContain("Saved current edits to a browser draft and loaded the latest server version.")

        await act(async () => {
          await lifecycleRef!.handleLoadOrCreateTempPost()
        })
        expect(notices.some((n) => n.text === "Preparing a new post...")).toBe(true)
        expect(notices.at(-1)?.text).toBe("Ready to start a new post.")

        failTempPostFetch = true
        await act(async () => {
          await lifecycleRef!.handleLoadOrCreateTempPost()
        })
        expect(notices.at(-1)?.text).toBe("Failed to prepare new post: network error")
        failTempPostFetch = false

        // useEditorStudioLocalDraftLifecycle missing draft case in EN
        let modelRef: ReturnType<typeof useEditorStudioLocalDraftLifecycle> | null = null
        const ModelProbe = () => {
          const a = useRef("")
          const b = useRef("")
          const c = useRef("")
          modelRef = useEditorStudioLocalDraftLifecycle({
            buildLocalDraftFingerprint: stableBuildFingerprint,
            dedupeStrings: stableDedupeStrings,
            editorMode: "create",
            lastLocalDraftFingerprintRef: a,
            lastWriteFingerprintRef: b,
            lastWriteIdempotencyKeyRef: c,
            loadingKey: "",
            normalizeCategoryValue: stableNormalizeCategory,
            persistLocalDraft: stablePersistNoop,
            postCategory: "",
            postContent: "",
            getCurrentPostContent: stableGetEmptyContent,
            postId: "",
            postSummary: "",
            postSummarySource: "NONE",
            summaryIntent: stableSummaryIntent,
            postTags: emptyTags,
            postThumbnailFocusX: 50,
            postThumbnailFocusY: 50,
            postThumbnailUrl: "",
            postThumbnailZoom: 1,
            postTitle: "",
            postVersion: null,
            postVisibility: "PUBLIC_LISTED",
            readLocalDraft: stableReadNull,
            removeLocalDraft: stableNoop,
            setEditorMode: stableNoop,
            setIsTempDraftMode: stableNoop,
            setLocalDraftSavedAt: stableNoop,
            setPostCategory: stableNoop,
            setPostContent: stableNoop,
            setPostId: stableNoop,
            setPostSummary: stableNoop,
            setPostSummarySource: stableNoop,
            setSummaryIntent: stableNoop,
            setPostTags: stableNoop,
            setPostThumbnailFocusX: stableNoop,
            setPostThumbnailFocusY: stableNoop,
            setPostThumbnailUrl: stableNoop,
            setPostThumbnailZoom: stableNoop,
            setPostTitle: stableNoop,
            setPostVersion: stableNoop,
            setPostVisibility: stableNoop,
            setPreviewThumbnailSourceUrl: stableNoop,
            setPublishStatus: stableSetPublishStatus,
          })
          return null
        }
        await act(async () => {
          root.render(
            createElement(ClientLanguageProvider, {
              initialLanguage: "en",
              children: createElement(ModelProbe),
            })
          )
        })
        modelRef!.restoreLocalDraft("non-existent-key")
        expect(notices.at(-1)?.text).toBe("No saved browser draft found.")
      } finally {
        globalThis.fetch = originalFetch
        await act(async () => {
          root.unmount()
        })
      }
    })
  })

  test("markdown editor media transfer and upload helpers localize KO/EN error messages and placeholders", () => {
    expect(
      resolveMarkdownEditorUploadErrorMessage(new ApiTimeoutError("/upload", 5000), {
        kind: "image",
        fileName: "a.png",
        fallbackMessage: MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE,
        language: "en",
      })
    ).toBe("Upload timed out. Wait a moment and try again.")
    expect(
      resolveMarkdownEditorUploadErrorMessage(new ApiNetworkError("/upload"), {
        kind: "file",
        fileName: "a.pdf",
        fallbackMessage: MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
        language: "en",
      })
    ).toBe("Network connection failed. Wait a moment and try again.")
    expect(
      resolveMarkdownEditorUploadErrorMessage(
        new ApiError(413, "/upload", "Too large", "파일 용량 초과"),
        {
          kind: "image",
          fileName: "huge.png",
          fallbackMessage: MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE,
          language: "en",
        }
      )
    ).toBe("The uploaded file is too large. Reduce the file size and try again.")

    expect(validateMarkdownAttachmentSize({ size: 20 * 1024 * 1024, name: "a.zip", type: "" }, "en")).toBe(
      "Attachments must be 10MB or smaller."
    )
    expect(resolveMarkdownAttachmentLink({ url: "" }, "a.pdf", "en")).toEqual({
      error: "Attachment upload did not return a valid URL.",
    })
    expect(resolveMarkdownImageEmbed({ url: "" }, "a.png", { language: "en" })).toEqual({
      error: "Image upload did not return a valid URL.",
    })
    expect(buildUploadingImagePlaceholder("shot.png", "u1", "en")).toBe("![Uploading: shot.png · u1…]()" )
    expect(buildUploadingAttachmentPlaceholder("doc.pdf", "u2", "en")).toBe("[Uploading: doc.pdf · u2…]()")

    const reserved = planTransferFileReservations(
      [
        { name: "evil.html", size: 120, type: "text/html" } as File,
        { name: "ok.png", size: 120, type: "image/png" } as File,
      ],
      { canUploadImage: true, canUploadFile: true, createId: () => "id1", language: "en" }
    )
    expect(reserved.errors).toEqual(["Executable files such as HTML, SVG, or JavaScript cannot be attached."])
    expect(reserved.jobs[0]?.placeholder).toBe("![Uploading: ok.png · id1…]()")

    const htmlErrors: string[] = []
    applyHtmlPasteIfEligible({
      event: {
        preventDefault: () => undefined,
        clipboardData: { types: ["text/html"] },
      } as unknown as React.ClipboardEvent<HTMLElement>,
      html: "<script>alert(1)</script>",
      plainText: "",
      viewMode: "live",
      currentValue: "",
      selection: { from: 0, to: 0 },
      language: "en",
      applyRecordedMarkdownMutation: () => true,
      setEditorError: (msg) => htmlErrors.push(msg),
    })
    expect(htmlErrors).toEqual(["No safe HTML content could be pasted."])
  })

  test("CM6 block cards, callout/toggle, image controls, code chrome, Mermaid theme, and table DOM support KO/EN", async () => {
    await withFakeDomEnvironment(({ doc }) => {
      const enState = createEditorStateWithLanguage("```ts\nconst x = 1\n```\n| A | B |\n| --- | --- |\n| 1 | 2 |", "en")
      const koState = createEditorStateWithLanguage("```ts\nconst x = 1\n```\n| A | B |\n| --- | --- |\n| 1 | 2 |", "ko")
      const makeMockView = (state: EditorState, editable = true) => {
        const wrappedState = Object.create(state) as EditorState
        ;(wrappedState as { facet: EditorState["facet"] }).facet = (() => editable) as unknown as EditorState["facet"]
        return {
          state: wrappedState,
          dispatch: () => undefined,
          posAtDOM: () => 0,
          focus: () => undefined,
        } as unknown as EditorView
      }

      const koView = makeMockView(koState)
      const enView = makeMockView(enState)

      // Bookmark / Embed / File widgets
      const koBookmark = new MarkdownBookmarkBlockWidget("https://example.com", "T", "D", 0, 20).toDOM(koView)
      const enBookmark = new MarkdownBookmarkBlockWidget("https://example.com", "T", "D", 0, 20, "", "", "", "en").toDOM(enView)
      expect(koBookmark.querySelector("a")?.getAttribute("aria-label")).toBe("북마크 링크 열기")
      expect(enBookmark.querySelector("a")?.getAttribute("aria-label")).toBe("Open bookmark link")

      const enEmbed = new MarkdownEmbedBlockWidget(
        "",
        "",
        "",
        0,
        20,
        "",
        "",
        "",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "en"
      ).toDOM(enView)
      expect(enEmbed.querySelector("iframe")?.getAttribute("title") ?? enEmbed.querySelector("iframe")?.title).toBe(
        "Embed preview"
      )
      const enEmbedOpen = new MarkdownEmbedBlockWidget(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "",
        "",
        0,
        20,
        "",
        "",
        "",
        "",
        "en"
      ).toDOM(enView)
      expect(enEmbedOpen.querySelector("a")?.getAttribute("aria-label")).toBe("Open embed link")

      const enFile = new MarkdownFileBlockWidget("https://example.com/a.pdf", "a.pdf", "", 0, 20, "application/pdf", 1024, "en").toDOM(enView)
      expect(enFile.querySelector("a")?.getAttribute("aria-label")).toBe("Open attached file")

      // Callout & Toggle widgets (legacy fakeDom without dataset.lang keeps updateDOM compatibility)
      const koCalloutWidget = new MarkdownCalloutBlockWidget("info", "", "", "body", 0, 10)
      const koCalloutDom = koCalloutWidget.toDOM(koView)
      expect(koCalloutDom.querySelector(".cm-live-callout-title")?.textContent).toBe("콜아웃")
      expect(koCalloutWidget.updateDOM({ dataset: { sig: koCalloutDom.dataset.sig } } as unknown as HTMLElement)).toBe(true)
      const enCalloutDom = new MarkdownCalloutBlockWidget("info", "", "", "body", 0, 10, 11, false, false, "en").toDOM(enView)
      expect(enCalloutDom.querySelector(".cm-live-callout-title")?.textContent).toBe("Callout")

      const enToggleDom = new MarkdownToggleBlockWidget("", "", 0, 10, 11, "en").toDOM(enView)
      expect(enToggleDom.querySelector(".cm-live-toggle-caret")?.getAttribute("aria-label")).toBe(
        "Toggle expand/collapse"
      )
      expect(enToggleDom.querySelector(".cm-live-toggle-title")?.textContent).toBe("Toggle block")
      expect(enToggleDom.querySelector(".cm-live-toggle-body")?.textContent).toBe("Click to enter content...")

      // Image controls localize BOTH KO (no leftover English labels!) and EN
      const koImgWrap = doc.createElement("span")
      const koImgEl = doc.createElement("img")
      attachLiveImageControls({ view: koView, wrap: koImgWrap as any, img: koImgEl as any, src: "/a.png", alt: "alt" })
      expect(koImgWrap.querySelector(".cm-live-image-resize-handle")?.getAttribute("aria-label")).toBe("이미지 너비 조절")
      expect(koImgWrap.querySelector(".cm-live-image-resize-handle")?.title).toBe("드래그해 너비 조절")
      expect(koImgWrap.querySelector(".cm-live-image-caption-input")?.placeholder).toBe("캡션 / 대체 텍스트")
      expect(koImgWrap.querySelector(".cm-live-image-caption-input")?.getAttribute("aria-label")).toBe("이미지 캡션")

      const enImgWrap = doc.createElement("span")
      const enImgEl = doc.createElement("img")
      attachLiveImageControls({ view: enView, wrap: enImgWrap as any, img: enImgEl as any, src: "/a.png", alt: "alt" })
      expect(enImgWrap.querySelector(".cm-live-image-resize-handle")?.getAttribute("aria-label")).toBe("Resize image width")
      expect(enImgWrap.querySelector(".cm-live-image-caption-input")?.placeholder).toBe("Caption / alt")

      // Code block header chrome
      const koCodeDom = new MarkdownCodeBlockHeaderWidget("ts", 0, "ko").toDOM(koView)
      expect(koCodeDom.querySelector(".cm-live-code-lang-select")?.getAttribute("aria-label")).toBe("코드 언어")
      expect(koCodeDom.querySelector(".cm-live-code-copy-btn")?.textContent).toBe("복사")
      expect(koCodeDom.querySelector(".cm-live-code-copy-btn")?.getAttribute("aria-label")).toBe("코드 복사")

      const enCodeDom = new MarkdownCodeBlockHeaderWidget("ts", 0, "en").toDOM(enView)
      expect(enCodeDom.querySelector(".cm-live-code-lang-select")?.getAttribute("aria-label")).toBe("Code language")
      expect(enCodeDom.querySelector(".cm-live-code-copy-btn")?.textContent).toBe("Copy")
      expect(enCodeDom.querySelector(".cm-live-code-copy-btn")?.getAttribute("aria-label")).toBe("Copy code")

      // Mermaid CSS theme EN override
      expect(liveTableAndCardThemeSpec['.cm-live-mermaid[data-mermaid-state="rendered"]::before']?.content).toBe(
        '"MERMAID DIAGRAM · 클릭하여 원본 편집"'
      )
      expect(
        liveTableAndCardThemeSpec['&[data-editor-lang="en"] .cm-live-mermaid[data-mermaid-state="rendered"]::before']
          ?.content
      ).toBe('"MERMAID DIAGRAM · Click to edit source"')

      // Table DOM + widget EN labels & language transition effect
      expect(createTableImeProxyElement("en").getAttribute("aria-label")).toBe("Table cell input proxy")
      const thEn = doc.createElement("th")
      const colEn = doc.createElement("col")
      const resizerEn = attachColumnResizeHandle(
        thEn as any,
        0,
        colEn as any,
        { headerRow: true, headerColumn: false, fitPageWidth: false, columnWidths: [0] },
        undefined,
        () => true,
        "en"
      )
      expect(resizerEn.getAttribute("aria-label")).toBe("Resize column 1 width")

      const tableWidgetEn = new MarkdownTableWidget("| A | B |\n| --- | --- |\n| 1 | 2 |", 18, 42, "en")
      const tableDomEn = tableWidgetEn.toDOM(enView)
      expect(tableDomEn.querySelector('[data-testid="cm-live-table-toolbar"]')?.getAttribute("aria-label")).toBe(
        "Table quick edit toolbar"
      )
      expect(tableDomEn.querySelector('[data-testid="cm-live-table-add-row"]')?.getAttribute("aria-label")).toBe(
        "Add new row below"
      )
      expect(tableWidgetEn.updateDOM(tableDomEn as any, koView)).toBe(false)

      const cellEl = doc.createElement("td")
      const session = openTableCellEditorSession({
        cellEl: cellEl as any,
        preservedControls: [],
        grid: { headers: ["A"], rows: [["1"]], alignments: ["left"] },
        visualOptions: { headerRow: true, headerColumn: false, fitPageWidth: false, columnWidths: [0] },
        row: 0,
        col: 0,
        language: "en",
        getCurrentMarkdown: () => "| A |\n| --- |\n| 1 |",
        clearActiveSessionIfMatch: () => undefined,
        setActiveCoordinates: () => undefined,
        flushActiveCellMarkdown: () => "| A |\n| --- |\n| 1 |",
        dispatchTableMarkdown: () => undefined,
        executeGridAction: () => undefined,
        focusSelectedTableTarget: () => undefined,
      })
      expect(session.input.getAttribute("aria-label")).toBe("Edit table cell")

      // Verify state field update helper toggles language cleanly
      const updatedState = enState.update({ effects: setEditorLanguage.of("ko") }).state
      expect(updatedState.field(editorLanguageField)).toBe("ko")

      // Verify direct toolbar/surface helpers accept language
      const toolbarEn = createTableToolbarElement({
        grid: { headers: ["A"], rows: [["1"]], alignments: ["left"] },
        wrap: doc.createElement("div") as any,
        visualOptions: { headerRow: true, headerColumn: false, fitPageWidth: false, columnWidths: [0] },
        executeGridAction: () => undefined,
        onEditSource: () => undefined,
        language: "en",
      })
      expect(toolbarEn.toolbar.getAttribute("aria-label")).toBe("Table quick edit toolbar")
      const surfaceEn = createInteractiveTableSurface({
        grid: { headers: ["A"], rows: [["1"]], alignments: ["left"] },
        visualOptions: { headerRow: true, headerColumn: false, fitPageWidth: false, columnWidths: [0] },
        canAddCol: () => true,
        canAddRow: () => true,
        onActivateCell: () => undefined,
        onAddColumn: () => undefined,
        onAddRow: () => undefined,
        language: "en",
      })
      expect(surfaceEn.gridRow.querySelector('[data-testid="cm-live-table-add-col"]')?.getAttribute("aria-label")).toBe(
        "Add new column on the right"
      )
    })
  })

  test("handleWritePost in create mode syncs /admin/editor/new & /admin/editor URL and hydrates without duplicate GET", async () => {
    clearCreatedEditorPostHandoff()
    expect(isEditorStudioBootstrapNavigation("/admin/editor/new/", "/admin/editor/404")).toBe(true)
    expect(isEditorStudioBootstrapNavigation("/admin/editor/", "/admin/editor/404?returnTo=%2Fadmin%2Fposts")).toBe(true)

    expect(
      resolveCreatedPostDestination(
        "404",
        { pathname: "/admin/editor/new", query: { returnTo: "/admin/posts?page=2", source: "local-draft" } } as any,
        "/admin/editor/new",
        (id) => `/admin/editor/${id}`,
        (val) => (val.startsWith("/admin/") ? val : "")
      )
    ).toBe("/admin/editor/404?returnTo=%2Fadmin%2Fposts%3Fpage%3D2")
    expect(
      resolveCreatedPostDestination(
        "404",
        { pathname: "/admin/editor", query: { returnTo: "https://evil.test" } } as any,
        "/admin/editor/new",
        (id) => `/admin/editor/${id}`,
        (val) => (val.startsWith("/admin/") ? val : "")
      )
    ).toBe("/admin/editor/404")
    expect(
      resolveCreatedPostDestination(
        "404",
        { pathname: "/admin/editor/[id]", query: { id: "404" } } as any,
        "/admin/editor/new",
        (id) => `/admin/editor/${id}`,
        () => ""
      )
    ).toBeNull()

    await withWindowStorage(async () => {
      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      const originalFetch = globalThis.fetch
      const replacedUrls: string[] = []
      const adminGetUrls: string[] = []

      const autoLoadedRef = { current: null as string | null }
      const createRouter = {
        pathname: "/admin/editor/new",
        asPath: "/admin/editor/new?source=local-draft&returnTo=%2Fadmin%2Fposts",
        query: { returnTo: "/admin/posts", source: "local-draft" },
        isReady: true,
        replace: async (url: string) => {
          replacedUrls.push(url)
          return true
        },
        events: { emit: () => undefined },
      } as any

      const writeHarness = createStatefulEditorHarness({
        mode: "create",
        title: "Created via local draft",
        content: "Body created cleanly",
        tags: ["typescript"],
        category: "Engineering",
        visibility: "PUBLIC_LISTED",
        onPostCreatedRouteSync: (createdPostId, handoffInput) =>
          syncCreatedPostBrowserRoute({
            router: createRouter,
            createdPostId,
            handoffInput,
            editorNewRoutePath: "/admin/editor/new",
            toEditorPostRoute: (id) => `/admin/editor/${id}`,
            normalizeEditorReturnRoute: (val) => (val.startsWith("/admin/") ? val : ""),
            autoLoadedPostIdRef: autoLoadedRef,
          }),
      })

      const WriteProbe = () => createElement(writeHarness.Probe)

      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes("/post/api/v1/adm/posts/")) adminGetUrls.push(url)
        if (url.includes("/post/api/v1/posts")) {
          return new Response(
            JSON.stringify({
              resultCode: "201-1",
              msg: "created",
              data: { id: 404, version: 1, summary: "Auto summary", summarySource: "EXTRACTED" },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }) as typeof fetch

      try {
        await act(async () => {
          root.render(createElement(WriteProbe))
        })

        let saved = false
        await act(async () => {
          saved = await writeHarness.persistence.handleWritePost()
        })
        expect(saved).toBe(true)
        expect(replacedUrls).toEqual(["/admin/editor/404?returnTo=%2Fadmin%2Fposts"])

        // Simulate destination /admin/editor/[id] fresh mount consuming single-use handoff without GET refetch
        let hydratedState = {
          postId: "",
          postVersion: null as number | null,
          editorMode: "create" as "create" | "edit",
          isTempDraftMode: false,
          postTitle: "",
          postContent: "",
          postSummary: "",
          postSummarySource: "NONE" as const,
          summaryIntent: { kind: "auto" as const },
          postThumbnailUrl: "",
          postThumbnailFocusX: 50,
          postThumbnailFocusY: 50,
          postThumbnailZoom: 1,
          postTags: [] as string[],
          postCategory: "",
          postVisibility: "PUBLIC_LISTED" as const,
          postScheduledAt: "",
          postSeriesName: "",
          postSeriesOrder: null as number | null,
          postCanonicalUrl: "",
          localDraftSavedAt: "",
          result: "",
        }
        const serverBaselineRef = { current: "" }
        const localBaselineRef = { current: "" }
        const writeFpRef = { current: "" }
        const idemRef = { current: "" }
        const contentLiveRef = { current: "" }
        let loadPostCallCount = 0
        let baselineSignalArg: unknown = null
        let lastNotice = { tone: "idle", text: "" }

        const DestProbe = () => {
          const destAutoLoadedRef = useRef<string | null>(null)
          const destAutoTempRef = useRef(false)
          const redirectingRef = useRef(false)
          useEditorStudioRouting({
            router: {
              pathname: "/admin/editor/[id]",
              asPath: "/admin/editor/404?returnTo=%2Fadmin%2Fposts",
              query: { id: "404", returnTo: "/admin/posts" },
              isReady: true,
              replace: async () => true,
            } as any,
            authStatus: "authenticated",
            sessionMember: { isAdmin: true },
            postId: hydratedState.postId,
            isDedicatedEditorRoute: true,
            isDedicatedNewEditorRoute: false,
            adminPostsWorkspaceRoute: "/admin/posts",
            editorNewRoutePath: "/admin/editor/new",
            toEditorPostRoute: (id) => `/admin/editor/${id}`,
            normalizeEditorReturnRoute: (v) => v,
            pretty: (v) => JSON.stringify(v),
            setResult: (next) => {
              hydratedState = { ...hydratedState, result: typeof next === "function" ? next(hydratedState.result) : next }
            },
            setPostId: (next) => {
              hydratedState = { ...hydratedState, postId: typeof next === "function" ? next(hydratedState.postId) : next }
            },
            setIsNewEditorBootstrapPending: () => undefined,
            redirectingRef,
            autoLoadedPostIdRef: destAutoLoadedRef,
            autoCreatedTempDraftRef: destAutoTempRef,
            restoreLocalDraft: () => undefined,
            applyCreatedPostHandoff: (handoff) =>
              hydrateCreatedEditorPostHandoff(handoff, {
                beginLocalDraftPostLoad: () => undefined,
                endLocalDraftPostLoad: () => undefined,
                cancelPendingAutosave: () => undefined,
                signalLocalDraftBaselineReady: (signal) => {
                  baselineSignalArg = signal
                },
                serverBaselineEditorFingerprintRef: serverBaselineRef,
                lastLocalDraftFingerprintRef: localBaselineRef,
                lastWriteFingerprintRef: writeFpRef,
                lastWriteIdempotencyKeyRef: idemRef,
                postContentLiveRef: contentLiveRef,
                setPostId: (v) => {
                  hydratedState = { ...hydratedState, postId: typeof v === "function" ? v(hydratedState.postId) : v }
                },
                setPostVersion: (v) => {
                  hydratedState = { ...hydratedState, postVersion: typeof v === "function" ? v(hydratedState.postVersion) : v }
                },
                setEditorMode: (v) => {
                  hydratedState = { ...hydratedState, editorMode: typeof v === "function" ? v(hydratedState.editorMode) : v }
                },
                setIsTempDraftMode: (v) => {
                  hydratedState = { ...hydratedState, isTempDraftMode: typeof v === "function" ? v(hydratedState.isTempDraftMode) : v }
                },
                setPostTitle: (v) => {
                  hydratedState = { ...hydratedState, postTitle: typeof v === "function" ? v(hydratedState.postTitle) : v }
                },
                setPostContent: (v) => {
                  hydratedState = { ...hydratedState, postContent: typeof v === "function" ? v(hydratedState.postContent) : v }
                },
                setPostSummary: (v) => {
                  hydratedState = { ...hydratedState, postSummary: typeof v === "function" ? v(hydratedState.postSummary) : v }
                },
                setPostSummarySource: () => undefined,
                setSummaryIntent: () => undefined,
                setPostThumbnailUrl: () => undefined,
                setPostThumbnailFocusX: () => undefined,
                setPostThumbnailFocusY: () => undefined,
                setPostThumbnailZoom: () => undefined,
                setPreviewThumbnailSourceUrl: () => undefined,
                setPostTags: (v) => {
                  hydratedState = { ...hydratedState, postTags: typeof v === "function" ? v(hydratedState.postTags) : v }
                },
                setPostCategory: (v) => {
                  hydratedState = { ...hydratedState, postCategory: typeof v === "function" ? v(hydratedState.postCategory) : v }
                },
                setPostVisibility: () => undefined,
                setPostScheduledAt: () => undefined,
                setPostSeriesName: () => undefined,
                setPostSeriesOrder: () => undefined,
                setPostCanonicalUrl: () => undefined,
                setLocalDraftSavedAt: () => undefined,
                setPublishStatus: (n) => {
                  lastNotice = n
                },
                setResult: () => undefined,
              }),
            loadPostForEditor: async () => {
              loadPostCallCount += 1
            },
            handleLoadOrCreateTempPost: async () => undefined,
          })
          return null
        }

        await act(async () => {
          root.render(createElement(DestProbe))
        })

        expect(loadPostCallCount).toBe(0)
        expect(adminGetUrls).toEqual([])
        expect(hydratedState.postId).toBe("404")
        expect(hydratedState.postVersion).toBe(1)
        expect(hydratedState.editorMode).toBe("edit")
        expect(hydratedState.postTitle).toBe("Created via local draft")
        expect(hydratedState.postContent).toBe("Body created cleanly")
        expect(hydratedState.postTags).toEqual(["typescript"])
        expect(hydratedState.postCategory).toBe("folder::Engineering")
        expect(lastNotice.tone).toBe("success")
        expect(baselineSignalArg).toEqual({ baselineFingerprint: localBaselineRef.current })
        expect(
          isEditorUnsavedDirtyByFingerprint({
            isSaving: false,
            editorMode: hydratedState.editorMode,
            hasSelectedManagedPost: true,
            editorStateFingerprint: serverBaselineRef.current,
            serverBaselineFingerprint: serverBaselineRef.current,
            localDraftFingerprint: localBaselineRef.current,
            localDraftSavedAt: "",
            pristineCreateFingerprint: "pristine",
          })
        ).toBe(false)

        // Single-use guarantee: second consume returns null
        expect(consumeCreatedEditorPostHandoff("404")).toBeNull()
        saveCreatedEditorPostHandoff("405", {
          postId: "405",
          postVersion: 1,
          title: "t",
          content: "c",
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
          scheduledAt: "",
          seriesName: "",
          seriesOrder: null,
          canonicalUrl: "",
          serverBaselineFingerprint: "fp",
          localDraftBaselineFingerprint: "lfp",
          publishNotice: { tone: "success", text: "ok" },
          resultText: "{}",
        })
        clearCreatedEditorPostHandoff("405")
        expect(consumeCreatedEditorPostHandoff("405")).toBeNull()
      } finally {
        clearCreatedEditorPostHandoff()
        globalThis.fetch = originalFetch
        await act(async () => {
          root.unmount()
        })
      }
    })
  })

  test("reading mode preview preserves scroll ratio until async DynamicMarkdownRenderer mounts", async () => {
    await withFakeDomEnvironment(async ({ doc }) => {
      const paperSheet = doc.createElement("div")
      paperSheet.setAttribute("data-testid", "editor-paper-scroll-sheet")
      paperSheet.clientHeight = 800
      paperSheet.scrollHeight = 800
      paperSheet.scrollTop = 600

      const hiddenCmScroller = doc.createElement("div")
      hiddenCmScroller.className = "cm-scroller"
      hiddenCmScroller.clientHeight = 0
      hiddenCmScroller.scrollHeight = 0

      const editorBody = doc.createElement("div")
      editorBody.appendChild(hiddenCmScroller)
      const mountHost = doc.createElement("div")
      editorBody.appendChild(mountHost)
      paperSheet.appendChild(editorBody)

      // resolveMarkdownScrollHost ignores hidden .cm-scroller (clientHeight=0) and selects scrollable paperSheet
      paperSheet.scrollHeight = 2400
      expect(resolveMarkdownScrollHost(editorBody as unknown as HTMLElement)).toBe(paperSheet)
      paperSheet.scrollHeight = 800

      const snapshotRef: { current: MarkdownScrollSnapshot | null } = {
        current: {
          scrollTop: 600,
          scrollHeight: 2000,
          clientHeight: 800,
          fallbackHost: paperSheet as unknown as HTMLElement,
        },
      }

      const root = createRoot(mountHost as unknown as Element)
      const lightTheme = createTheme({ scheme: "light" })

      const AsyncStubRenderer = ({ ready }: { ready?: boolean }) =>
        ready
          ? createElement("div", { className: "aq-markdown" }, "Rendered Long Article")
          : createElement(ClientLoadingPlaceholder)
      let isChunkReady = false
      const StableRendererShell = () => createElement(AsyncStubRenderer, { ready: isChunkReady })

      try {
        await act(async () => {
          root.render(
            createElement(ClientThemeProvider, {
              theme: lightTheme,
              children: createElement(ClientLanguageProvider, {
                initialLanguage: "ko",
                children: createElement(ClientReadingPreview, {
                  value: "# Long Article\n\nParagraph",
                  viewMode: "reading",
                  pendingScrollSnapshotRef: snapshotRef,
                  getScrollBodyNode: () => editorBody as unknown as HTMLElement,
                  rendererComponent: StableRendererShell as any,
                }),
              }),
            })
          )
        })

        // While placeholder is mounted, scrollTop must NOT be clobbered to 0 and snapshot must remain pending
        expect(paperSheet.scrollTop).toBe(600)
        expect(snapshotRef.current).not.toBeNull()

        // Dynamic chunk resolves -> renderer expands paperSheet and replaces placeholder
        paperSheet.scrollHeight = 2400
        isChunkReady = true
        await act(async () => {
          root.render(
            createElement(ClientThemeProvider, {
              theme: lightTheme,
              children: createElement(ClientLanguageProvider, {
                initialLanguage: "ko",
                children: createElement(ClientReadingPreview, {
                  value: "# Long Article\n\nParagraph",
                  viewMode: "reading",
                  pendingScrollSnapshotRef: snapshotRef,
                  getScrollBodyNode: () => editorBody as unknown as HTMLElement,
                  rendererComponent: StableRendererShell as any,
                }),
              }),
            })
          )
        })

        await new Promise((resolve) => setTimeout(resolve, 60))

        // 50% ratio (600 / 1200) * new maxScroll (2400 - 800 = 1600) = 800
        expect(snapshotRef.current).toBeNull()
        expect(paperSheet.scrollTop).toBe(800)
      } finally {
        await act(async () => {
          root.unmount()
        })
      }
    })
  })

  test("block chrome hover listeners ignore floating chrome targets, active drag sessions, and stale pre-edit rAFs while LiveSurface keeps imperative ref stable", async () => {
    await withFakeDomEnvironment(async ({ doc }) => {
      const container = doc.createElement("div")
      const lineNode = doc.createElement("div")
      lineNode.className = "cm-line"
      const linkDialog = doc.createElement("div")
      linkDialog.setAttribute("data-testid", "markdown-bubble-link-popover")
      const removeButton = doc.createElement("button")
      const removeText = doc.createTextNode("Remove link")
      removeButton.appendChild(removeText)
      linkDialog.appendChild(removeButton)
      const gutterHandle = doc.createElement("button")
      gutterHandle.setAttribute("data-testid", "markdown-block-gutter-handle")
      container.appendChild(lineNode)
      container.appendChild(linkDialog)
      container.appendChild(gutterHandle)

      expect(shouldIgnoreBlockChromeHoverTarget(null)).toBe(false)
      expect(shouldIgnoreBlockChromeHoverTarget(lineNode as unknown as EventTarget)).toBe(false)
      expect(shouldIgnoreBlockChromeHoverTarget(removeButton as unknown as EventTarget)).toBe(true)
      expect(shouldIgnoreBlockChromeHoverTarget(removeText as unknown as EventTarget)).toBe(true)
      expect(shouldIgnoreBlockChromeHoverTarget(gutterHandle as unknown as EventTarget)).toBe(true)

      const liveRefs = {
        current: {
          value: "First block [Docs](https://example.com)\nSecond block",
          selection: { from: 0, to: 0 },
          isBlockMenuOpen: false,
          resolvePosAtCoords: (coords: { x: number; y: number }) => (coords.y >= 100 ? 41 : 0),
        },
      }
      const isDragActiveRef: { current: { active: boolean } | null } = { current: null }
      const hoveredUpdates: Array<number | null> = []
      const containerRef = { current: container as unknown as HTMLElement }

      const Probe = () => {
        useBlockChromeViewportListeners({
          containerRef,
          disabled: false,
          mode: "live",
          liveRefs,
          isDragActiveRef,
          setLayoutTick: () => undefined,
          setHoveredLineStart: (updater) => {
            const next = typeof updater === "function" ? updater(hoveredUpdates.at(-1) ?? null) : updater
            hoveredUpdates.push(next)
          },
          setIsTypingDimmed: () => undefined,
        })
        return null
      }

      const mount = doc.createElement("div")
      const root = createRoot(mount as unknown as Element)
      try {
        await act(async () => {
          root.render(createElement(Probe))
        })

        // 1. Hovering floating link popover must not schedule hover line change
        container.dispatchEvent({ type: "mousemove", target: removeButton, clientX: 20, clientY: 120 })
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(hoveredUpdates).toEqual([])

        // 2. Queued hover before document edit must be ignored once doc changes
        container.dispatchEvent({ type: "mousemove", target: lineNode, clientX: 20, clientY: 120 })
        liveRefs.current.value = "First block Docs\nSecond block"
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(hoveredUpdates).toEqual([])

        // 3. Pre-threshold drag session (active=false) blocks hover tracking
        isDragActiveRef.current = { active: false }
        container.dispatchEvent({ type: "mousemove", target: lineNode, clientX: 20, clientY: 120 })
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(hoveredUpdates).toEqual([])

        // 4. Normal hover when drag is idle resolves Second block lineStart cleanly
        isDragActiveRef.current = null
        container.dispatchEvent({ type: "mousemove", target: lineNode, clientX: 20, clientY: 120 })
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(hoveredUpdates.at(-1)).toBe(17)
      } finally {
        await act(async () => {
          root.unmount()
        })
      }
    })

    // Ensure MarkdownEditorLiveSurface keeps its imperative handle ref attached across value/disabled updates
    const liveSurfaceSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/components/markdown-editor/MarkdownEditorLiveSurface.tsx"),
      "utf8"
    )
    expect(liveSurfaceSource).toMatch(/useImperativeHandle\(\s*ref,\s*\(\)\s*=>\s*\(\{[\s\S]*?\}\),\s*\[\]\s*\)/)
  })

  test("parseBlockContainerBlocks, color swatch fallback, and live CM6 KO->EN widget transitions localize defaults cleanly", async () => {
    const containerDoc = [
      ":::callout",
      "Body",
      ":::",
      "",
      ":::callout note+",
      "Note body",
      ":::",
      "",
      ":::summary",
      "Summary body",
      ":::",
      "",
      ":::toggle",
      "Toggle body",
      ":::",
    ].join("\n")

    const koBlocks = parseBlockContainerBlocks(containerDoc)
    expect(koBlocks.map((b) => ("title" in b ? b.title : ""))).toEqual(["콜아웃", "배경 메모", "핵심 요약", "토글 블록"])

    const enBlocks = parseBlockContainerBlocks(containerDoc, "en")
    expect(enBlocks.map((b) => ("title" in b ? b.title : ""))).toEqual(["Callout", "Note", "Summary", "Toggle block"])

    expect(computeColorSwatchMutationPlan("", { from: 0, to: 0 }, "", "sky")).toEqual({
      kind: "replace",
      plan: {
        rangeStart: 0,
        rangeEnd: 0,
        replacement: "{{color:sky|강조 텍스트}}",
        selectionStart: "{{color:sky|강조 텍스트}}".length,
        selectionEnd: "{{color:sky|강조 텍스트}}".length,
      },
    })
    expect(computeColorSwatchMutationPlan("", { from: 0, to: 0 }, "", "sky", "en")).toEqual({
      kind: "replace",
      plan: {
        rangeStart: 0,
        rangeEnd: 0,
        replacement: "{{color:sky|Highlighted text}}",
        selectionStart: "{{color:sky|Highlighted text}}".length,
        selectionEnd: "{{color:sky|Highlighted text}}".length,
      },
    })

    await withFakeDomEnvironment(async () => {
      const mixedDoc = [
        "Intro",
        "",
        "- [x] Task item",
        "[[WikiTarget|WikiAlias]]",
        "",
        "![alt](https://example.com/a.png)",
        "",
        ":::callout",
        "Body",
        ":::",
        "",
        ":::toggle",
        "Toggle body",
        ":::",
      ].join("\n")

      const makeView = (state: EditorState) => {
        const wrappedState = Object.create(state) as EditorState
        ;(wrappedState as { facet: EditorState["facet"] }).facet = (() => true) as unknown as EditorState["facet"]
        return {
          state: wrappedState,
          dispatch: () => undefined,
          posAtDOM: () => 0,
          focus: () => undefined,
        } as unknown as EditorView
      }

      const collectWidgets = (set: DecorationSet) => {
        const widgets: Array<{ eq: (other: unknown) => boolean; toDOM: (view?: EditorView) => any }> = []
        set.between(0, mixedDoc.length, (_from, _to, value) => {
          const widget = (value as { spec?: { widget?: unknown } })?.spec?.widget as
            | { eq: (other: unknown) => boolean; toDOM: (view?: EditorView) => any }
            | undefined
          if (widget) widgets.push(widget)
        })
        return widgets
      }

      const koState = EditorState.create({
        doc: mixedDoc,
        selection: { anchor: 0 },
        extensions: [
          markdown({ base: markdownLanguage, extensions: GFM }),
          editorLanguageField.init(() => "ko"),
          blockContainerBlockField,
          blockDecorationField,
        ],
      })
      const koView = makeView(koState)
      const koInlineWidgets = collectWidgets(buildInlineViewportDecorations(koState, [{ from: 0, to: mixedDoc.length }]))
      const koBlockWidgets = collectWidgets(koState.field(blockDecorationField))
      const koContainerWidgets = collectWidgets(koState.field(blockContainerBlockField))

      expect(koInlineWidgets[0]?.toDOM(koView).getAttribute("aria-label")).toBe("할 일 체크 전환")
      expect(koInlineWidgets[1]?.toDOM(koView).getAttribute("aria-label")).toBe("위키링크: WikiAlias")
      const koImgDom = koBlockWidgets[0]?.toDOM(koView)
      expect(koImgDom?.querySelector(".cm-live-image-caption-input")?.placeholder).toBe("캡션 / 대체 텍스트")
      expect(koImgDom?.querySelector(".cm-live-image-resize-handle")?.getAttribute("aria-label")).toBe("이미지 너비 조절")
      expect(koContainerWidgets[0]?.toDOM(koView).querySelector(".cm-live-callout-title")?.textContent).toBe("콜아웃")
      expect(koContainerWidgets[1]?.toDOM(koView).querySelector(".cm-live-toggle-title")?.textContent).toBe("토글 블록")

      // Switch language via live CM6 transaction without document edit
      const enState = koState.update({ effects: setEditorLanguage.of("en") }).state
      const enView = makeView(enState)
      const enInlineWidgets = collectWidgets(buildInlineViewportDecorations(enState, [{ from: 0, to: mixedDoc.length }]))
      const enBlockWidgets = collectWidgets(enState.field(blockDecorationField))
      const enContainerWidgets = collectWidgets(enState.field(blockContainerBlockField))

      expect(koInlineWidgets[0]?.eq(enInlineWidgets[0])).toBe(false)
      expect(koInlineWidgets[1]?.eq(enInlineWidgets[1])).toBe(false)
      expect(koBlockWidgets[0]?.eq(enBlockWidgets[0])).toBe(false)
      expect(koContainerWidgets[0]?.eq(enContainerWidgets[0])).toBe(false)
      expect(koContainerWidgets[1]?.eq(enContainerWidgets[1])).toBe(false)

      expect(enInlineWidgets[0]?.toDOM(enView).getAttribute("aria-label")).toBe("Toggle task item")
      expect(enInlineWidgets[1]?.toDOM(enView).getAttribute("aria-label")).toBe("Wikilink: WikiAlias")
      const enImgDom = enBlockWidgets[0]?.toDOM(enView)
      expect(enImgDom?.querySelector(".cm-live-image-caption-input")?.placeholder).toBe("Caption / alt")
      expect(enImgDom?.querySelector(".cm-live-image-resize-handle")?.getAttribute("aria-label")).toBe("Resize image width")
      expect(enContainerWidgets[0]?.toDOM(enView).querySelector(".cm-live-callout-title")?.textContent).toBe("Callout")
      expect(enContainerWidgets[1]?.toDOM(enView).querySelector(".cm-live-toggle-title")?.textContent).toBe("Toggle block")
    })
  })
})
