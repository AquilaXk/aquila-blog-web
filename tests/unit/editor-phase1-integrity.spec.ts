import { act, createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import { createTheme } from "../../src/styles/theme"
import { LanguageProvider } from "../../src/libs/language"
import { adminT } from "../../src/routes/Admin/adminI18n"
import { LOCAL_DRAFT_BASELINE_SETTLE_LOADING_KEYS } from "../../src/routes/Admin/editorStudioDraftAutosaveDecisionModel"
import { composeEditorContent } from "../../src/routes/Admin/editorStudioMetaModel"
import { deriveEditorPersistenceState } from "../../src/routes/Admin/editorStudioState"
import { isEditorStudioBootstrapNavigation } from "../../src/routes/Admin/editorStudioUnsavedExitGuard"
import { EditorStudioDedicatedEditorSurface } from "../../src/routes/Admin/EditorStudioDedicatedEditorSurface"
import { EditorStudioPublishReadinessCard } from "../../src/routes/Admin/EditorStudioPublishReadinessCard"
import { EditorStudioThumbnailMetaPanel } from "../../src/routes/Admin/EditorStudioThumbnailPanels"
import { useEditorStudioKeyboardShortcuts } from "../../src/routes/Admin/useEditorStudioKeyboardShortcuts"
import {
  createMinimalRootContainer,
  createStatefulEditorHarness,
  withWindowStorage,
} from "./helpers/editorStudioTestHarness"
import { materializePlaywrightJsx, wrapPlaywrightJsxComponent } from "./helpers/materializePlaywrightJsx"

const withClientLanguageStorage = async (run: () => Promise<void>) =>
  withWindowStorage(async () => {
    const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
    const docStub = { activeElement: null, body: null, documentElement: { lang: "" } }
    Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: docStub })
    ;(globalThis.window as unknown as Record<string, unknown>).document = docStub
    try {
      await run()
    } finally {
      if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc)
      else delete (globalThis as Record<string, unknown>).document
    }
  })

const ClientLanguageProvider = wrapPlaywrightJsxComponent(LanguageProvider) as typeof LanguageProvider

const lightTheme = createTheme({ scheme: "light" })

const renderThemed = (node: unknown, initialLanguage: "ko" | "en" = "ko"): string =>
  renderToStaticMarkup(
    createElement(ThemeProvider, {
      theme: lightTheme,
      children: materializePlaywrightJsx(
        createElement(LanguageProvider, {
          initialLanguage,
          children: node as ReactElement,
        })
      ) as ReactElement,
    })
  )

const createKeydownEvent = (init: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  isComposing?: boolean
  keyCode?: number
}): Event =>
  Object.assign(new Event("keydown", { cancelable: true }), {
    key: init.key,
    metaKey: Boolean(init.metaKey),
    ctrlKey: Boolean(init.ctrlKey),
    shiftKey: Boolean(init.shiftKey),
    altKey: Boolean(init.altKey),
    isComposing: Boolean(init.isComposing),
    keyCode: init.keyCode ?? 0,
  })

test.describe("Phase 1 editor workflow & integrity invariants", () => {
  test("autosave persistence state shows local autosave label without false green dot", () => {
    expect(adminT("editorStatusLocalAutoSaved", "ko")).toBe("로컬 임시 저장됨")
    expect(adminT("editorStatusLocalAutoSaved", "en")).toBe("Saved locally")
    expect(LOCAL_DRAFT_BASELINE_SETTLE_LOADING_KEYS.has("serverTempDraftSave")).toBe(true)

    const dirtyLocalAutosaved = deriveEditorPersistenceState({
      editorMode: "edit",
      hasSelectedManagedPost: true,
      hasEditorDraftContent: true,
      editorStateFingerprint: "fp-local-1",
      serverBaselineFingerprint: "fp-server-0",
      localDraftFingerprint: "fp-local-1",
      localDraftSavedAt: "2026-11-26T10:00:00.000Z",
      loadingKey: "",
      publishNoticeTone: "success",
      language: "ko",
    })
    expect(dirtyLocalAutosaved.tone).toBe("idle")
    expect(dirtyLocalAutosaved.text).toBe("로컬 임시 저장됨")
    expect(dirtyLocalAutosaved.isLocalAutoSavedEditDraft).toBe(true)

    const savingTempDraft = deriveEditorPersistenceState({
      editorMode: "edit",
      hasSelectedManagedPost: true,
      hasEditorDraftContent: true,
      editorStateFingerprint: "fp-local-1",
      serverBaselineFingerprint: "fp-server-0",
      localDraftFingerprint: "fp-local-1",
      localDraftSavedAt: "2026-11-26T10:00:00.000Z",
      loadingKey: "serverTempDraftSave",
      publishNoticeTone: "idle",
      language: "ko",
    })
    expect(savingTempDraft.tone).toBe("loading")
    expect(savingTempDraft.text).toBe("저장 중")
  })

  test("bootstrap navigation allows /admin/editor root transition to temp draft route", () => {
    expect(isEditorStudioBootstrapNavigation("/admin/editor", "/admin/editor/42")).toBe(true)
    expect(isEditorStudioBootstrapNavigation("/admin/editor/new", "/admin/editor/42")).toBe(true)
    expect(isEditorStudioBootstrapNavigation("/admin/editor/42", "/admin/posts")).toBe(false)
    expect(isEditorStudioBootstrapNavigation("/admin/editor/42", "/admin/editor/new")).toBe(false)
  })

  test("publish readiness card excludes neutral summary and empty tags from completed count", () => {
    const html = renderThemed(
      createElement(EditorStudioPublishReadinessCard, {
        hasTitle: true,
        wordCount: 42,
        hasBody: true,
        hasManualSummary: false,
        tagCount: 0,
        linkWarningCount: 0,
        totalLinkCount: 1,
      })
    )
    expect(html).not.toContain("5/5")
    expect(html).toContain("3/5")
  })

  test("manual thumbnail URL panel shows fail-closed error alert for unsupported external URL", () => {
    const html = renderThemed(
      createElement(EditorStudioThumbnailMetaPanel, {
        firstBodyImageUrl: "",
        isThumbnailUploadDisabled: false,
        isThumbnailUploading: false,
        postThumbnailUrl: "https://external.example.com/bad-cover.png",
        thumbnailImageFileName: "",
        thumbnailUploadRuleLabel: "PNG/JPG/WebP, max 10MB",
        onApplyFirstBodyImage: () => undefined,
        onOpenThumbnailFileInput: () => undefined,
        onResetThumbnailToAutoMode: () => undefined,
        onThumbnailPaste: () => undefined,
        onThumbnailUrlChange: () => undefined,
      })
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain("/post/api/v1/images/")
  })

  test("temp draft load preserves PUBLIC_LISTED visibility and revision restore clears conflict", async () => {
    await withWindowStorage(async () => {
      const harness = createStatefulEditorHarness()
      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      const originalFetch = globalThis.fetch

      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith("/post/api/v1/adm/posts/777")) {
          return new Response(
            JSON.stringify({
              id: 777,
              version: 1,
              title: "",
              content: "",
              summary: "",
              summarySource: "NONE",
              thumbnailUrl: "",
              published: false,
              listed: false,
              tempDraft: true,
              tags: [],
              category: [],
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
          await harness.lifecycle.loadPostForEditor("777")
          root.render(createElement(harness.Probe))
        })
        expect(harness.state.isTempDraftMode).toBe(true)
        expect(harness.state.postVisibility).toBe("PUBLIC_LISTED")

        await act(async () => {
          harness.lifecycle.applyRestoredRevisionPost({
            id: 777,
            version: 4,
            title: "복원된 제목",
            content: composeEditorContent("복원된 본문", ["typescript"], {
              category: "rocket::Backend",
              thumbnail: "",
            }),
            summary: "복원된 요약",
            summarySource: "MANUAL",
            thumbnailUrl: "",
            published: false,
            listed: false,
            tempDraft: true,
            tags: ["typescript"],
            category: ["rocket::Backend"],
          } as never)
          root.render(createElement(harness.Probe))
        })
        expect(harness.state.postTitle).toBe("복원된 제목")
        expect(harness.state.postVersion).toBe(4)
        expect(harness.state.postTags).toEqual(["typescript"])

        await act(async () => {
          harness.lifecycle.applyRestoredRevisionPost({
            id: 777,
            version: 5,
            title: "비공개 발행본",
            content: "비공개 본문",
            summary: "",
            summarySource: "NONE",
            thumbnailUrl: "",
            published: false,
            listed: false,
            tempDraft: false,
            tags: [],
            category: [],
          } as never)
          root.render(createElement(harness.Probe))
        })
        expect(harness.state.isTempDraftMode).toBe(false)
        expect(harness.state.postVisibility).toBe("PRIVATE")
      } finally {
        await act(async () => {
          root.unmount()
        })
        globalThis.fetch = originalFetch
      }
    })
  })

  test("Mod+S in temp draft commits tagDraft, syncs server baseline, and falls back locally with force=true", async () => {
    await withWindowStorage(async () => {
      const harness = createStatefulEditorHarness()
      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      const originalFetch = globalThis.fetch
      let methodCalled = ""
      let failSave = false

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith("/post/api/v1/posts/temp/777")) {
          methodCalled = init?.method ?? "GET"
          if (failSave) {
            return new Response(JSON.stringify({ msg: "server down" }), { status: 500 })
          }
          return new Response(
            JSON.stringify({
              resultCode: "200-1",
              msg: "saved",
              data: { id: 777, version: 5, summary: "", summarySource: "NONE" },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }) as typeof fetch

      try {
        await act(async () => {
          harness.state.isTempDraftMode = true
          harness.state.postId = "777"
          harness.state.postTitle = "임시초안 제목"
          harness.state.postContent = "임시초안 본문"
          harness.state.tagDraft = "pending-tag"
          root.render(createElement(harness.Probe))
        })
        let ok = false
        await act(async () => {
          ok = await harness.persistence.handleSaveServerTempDraft({ silent: false })
          root.render(createElement(harness.Probe))
        })
        expect(ok).toBe(true)
        expect(methodCalled).toBe("PUT")
        expect(harness.state.postTags).toContain("pending-tag")
        expect(harness.state.tagDraft).toBe("")
        expect(harness.state.postVersion).toBe(5)
        expect(harness.refs.serverBaselineEditorFingerprintRef.current.length).toBeGreaterThan(0)

        failSave = true
        await act(async () => {
          harness.state.postTitle = "오프라인 백업 제목"
          root.render(createElement(harness.Probe))
        })
        let fallbackOk = true
        await act(async () => {
          fallbackOk = await harness.persistence.handleSaveServerTempDraft({ silent: false })
          root.render(createElement(harness.Probe))
        })
        expect(fallbackOk).toBe(false)
        expect(harness.state.localDraftSavedAt.length).toBeGreaterThan(0)
      } finally {
        await act(async () => {
          root.unmount()
        })
        globalThis.fetch = originalFetch
      }
    })
  })

  test("keyboard shortcuts leave Mod+Enter unintercepted and handle Mod+Shift+P and Mod+Shift+E", async () => {
    await withWindowStorage(async () => {
      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      const calls: string[] = []

      const Probe = () => {
        useEditorStudioKeyboardShortcuts({
          isTempDraftMode: true,
          editorMode: "edit",
          postId: "777",
          postVersion: 1,
          postTitle: "제목",
          postSummary: "",
          postSummarySource: "NONE",
          effectiveThumbnailUrl: "",
          getCurrentPostContent: () => "본문",
          composeEditorContent: (c) => c,
          postTags: [],
          tagDraft: "draft-tag",
          postCategory: "",
          saveLocalDraft: () => {
            calls.push("localSave")
          },
          setPostVersion: () => undefined,
          setPublishStatus: () => undefined,
          loadingKey: "",
          setLoadingKey: () => undefined,
          isPublishModalOpen: false,
          onOpenPublishModal: () => {
            calls.push("openPublish")
          },
          onTogglePreviewMode: () => {
            calls.push("togglePreview")
          },
        })
        return null
      }

      try {
        await act(async () => {
          root.render(createElement(Probe))
        })

        let modEnterDefaultPrevented = false
        await act(async () => {
          const ev = createKeydownEvent({ key: "Enter", metaKey: true })
          window.dispatchEvent(ev)
          modEnterDefaultPrevented = ev.defaultPrevented
        })
        expect(modEnterDefaultPrevented).toBe(false)
        expect(calls).not.toContain("openPublish")

        await act(async () => {
          window.dispatchEvent(createKeydownEvent({ key: "p", metaKey: true, shiftKey: true }))
          window.dispatchEvent(createKeydownEvent({ key: "e", metaKey: true, shiftKey: true }))
        })
        expect(calls).toEqual(["openPublish", "togglePreview"])
      } finally {
        await act(async () => {
          root.unmount()
        })
      }
    })
  })

  test("Mod+S while non-publish loading commits pending tagDraft, forces local backup, and reports KO/EN notice", async () => {
    for (const { loadingKey, language, expectedNotice } of [
      {
        loadingKey: "uploadThumbnail",
        language: "ko" as const,
        expectedNotice: "다른 작업이 진행 중이어서 브라우저 로컬 초안에 안전 저장했습니다.",
      },
      {
        loadingKey: "serverTempDraftSave",
        language: "en" as const,
        expectedNotice: "Another task is running; backed up safely as a browser draft.",
      },
    ]) {
      await withClientLanguageStorage(async () => {
        const container = createMinimalRootContainer()
        const root = createRoot(container as unknown as Element)
        const originalFetch = globalThis.fetch
        let fetchCalls = 0
        globalThis.fetch = (async () => {
          fetchCalls += 1
          return new Response(null, { status: 204 })
        }) as typeof fetch

        const addedTagBatches: string[][] = []
        const tagDraftUpdates: string[] = []
        const localSaveOptions: Array<{ silent?: boolean; force?: boolean } | undefined> = []
        const statusCalls: Array<{ notice: { tone: string; text: string }; target?: string }> = []

        const Probe = () => {
          useEditorStudioKeyboardShortcuts({
            isTempDraftMode: true,
            editorMode: "edit",
            postId: "778",
            postVersion: 2,
            postTitle: "제목",
            postSummary: "",
            postSummarySource: "NONE",
            effectiveThumbnailUrl: "",
            getCurrentPostContent: () => "본문",
            composeEditorContent: (c) => c,
            postTags: ["existing"],
            tagDraft: "pending-tag, second-tag",
            postCategory: "",
            addTagsToPost: (tags) => {
              addedTagBatches.push(tags)
              return ["existing", ...tags]
            },
            setTagDraft: (value) => {
              tagDraftUpdates.push(value)
            },
            saveLocalDraft: (options) => {
              localSaveOptions.push(options)
            },
            setPostVersion: () => undefined,
            setPublishStatus: (notice, target) => {
              statusCalls.push({ notice, target })
            },
            loadingKey,
            setLoadingKey: () => undefined,
          })
          return null
        }

        try {
          await act(async () => {
            root.render(
              createElement(ClientLanguageProvider, {
                initialLanguage: language,
                children: createElement(Probe),
              })
            )
          })

          let prevented = false
          await act(async () => {
            const ev = createKeydownEvent({ key: "s", metaKey: true })
            window.dispatchEvent(ev)
            prevented = ev.defaultPrevented
          })

          expect(prevented).toBe(true)
          expect(fetchCalls).toBe(0)
          expect(addedTagBatches).toEqual([["pending-tag", "second-tag"]])
          expect(tagDraftUpdates).toEqual([""])
          expect(localSaveOptions).toEqual([{ silent: false, force: true }])
          expect(statusCalls).toEqual([
            {
              notice: { tone: "success", text: expectedNotice },
              target: "page",
            },
          ])
        } finally {
          globalThis.fetch = originalFetch
          await act(async () => {
            root.unmount()
          })
        }
      })
    }
  })

  test("Mod+S while publishing saves local backup without mutating tagDraft or overwriting publish status", async () => {
    for (const publishLoadingKey of ["writePost", "modifyPost", "publishTempPost"] as const) {
      await withClientLanguageStorage(async () => {
        const container = createMinimalRootContainer()
        const root = createRoot(container as unknown as Element)
        const originalFetch = globalThis.fetch
        let fetchCalls = 0
        globalThis.fetch = (async () => {
          fetchCalls += 1
          return new Response(null, { status: 204 })
        }) as typeof fetch

        const addedTagBatches: string[][] = []
        const tagDraftUpdates: string[] = []
        const localSaveOptions: Array<{ silent?: boolean; force?: boolean } | undefined> = []
        const statusCalls: Array<{ notice: { tone: string; text: string }; target?: string }> = []

        const Probe = () => {
          useEditorStudioKeyboardShortcuts({
            isTempDraftMode: false,
            editorMode: "edit",
            postId: "779",
            postVersion: 3,
            postTitle: "발행 중 제목",
            postSummary: "",
            postSummarySource: "NONE",
            effectiveThumbnailUrl: "",
            getCurrentPostContent: () => "발행 중 본문",
            composeEditorContent: (c) => c,
            postTags: ["existing"],
            tagDraft: "uncommitted-draft-tag",
            postCategory: "",
            addTagsToPost: (tags) => {
              addedTagBatches.push(tags)
              return tags
            },
            setTagDraft: (value) => {
              tagDraftUpdates.push(value)
            },
            saveLocalDraft: (options) => {
              localSaveOptions.push(options)
            },
            setPostVersion: () => undefined,
            setPublishStatus: (notice, target) => {
              statusCalls.push({ notice, target })
            },
            loadingKey: publishLoadingKey,
            setLoadingKey: () => undefined,
          })
          return null
        }

        try {
          await act(async () => {
            root.render(
              createElement(ClientLanguageProvider, {
                initialLanguage: "ko",
                children: createElement(Probe),
              })
            )
          })

          let prevented = false
          await act(async () => {
            const ev = createKeydownEvent({ key: "s", metaKey: true })
            window.dispatchEvent(ev)
            prevented = ev.defaultPrevented
          })

          expect(prevented).toBe(true)
          expect(fetchCalls).toBe(0)
          expect(addedTagBatches).toEqual([])
          expect(tagDraftUpdates).toEqual([])
          expect(localSaveOptions).toEqual([{ silent: false, force: true }])
          expect(statusCalls).toEqual([])
        } finally {
          globalThis.fetch = originalFetch
          await act(async () => {
            root.unmount()
          })
        }
      })
    }
  })

  test("dedicated editor surface topbar shows DRAFT badge when isTempDraftMode is true", () => {
    const surfaceProps = {
      isTempDraftMode: true,
      thumbnailImageFileInputRef: () => undefined,
      onThumbnailImageFileChange: () => undefined,
      onExit: () => undefined,
      saveStateText: "임시초안",
      saveStateTone: "idle" as const,
      primaryActionDisabled: false,
      primaryActionLabel: "새 글 발행",
      onPrimaryAction: () => undefined,
      postTags: [],
      tagDraft: "",
      onTagDraftChange: () => undefined,
      onAddTags: () => undefined,
      onAddTag: () => undefined,
      onRemoveTag: () => undefined,
      titleInputRef: () => undefined,
      onOutlineBodyHeadingActivate: () => undefined,
      postTitle: "제목",
      onPostTitleChange: () => undefined,
      onPostTitleKeyDown: () => undefined,
      postContent: "본문",
      postSummary: "",
      onPostSummaryChange: () => undefined,
      postCategory: "",
      onPostCategoryChange: () => undefined,
      onCommitPostCategory: () => undefined,
      categorySuggestions: [],
      tagSuggestions: [],
      postVisibility: "PUBLIC_LISTED" as const,
      onPostVisibilityChange: () => undefined,
      editorCanvas: createElement("div", null, "canvas"),
      showPublishNotice: false,
      publishNoticeTone: "idle" as const,
      publishNoticeText: "",
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
    }
    const koHtml = renderThemed(createElement(EditorStudioDedicatedEditorSurface, surfaceProps), "ko")
    const enHtml = renderThemed(createElement(EditorStudioDedicatedEditorSurface, surfaceProps), "en")
    expect(koHtml).toContain("임시초안")
    expect(enHtml).toContain("DRAFT")
  })
})
