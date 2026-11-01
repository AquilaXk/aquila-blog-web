import { expect, test } from "@playwright/test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import {
  formatCategoryDraftInputValue,
  toCategorySuggestionLabels,
} from "../../src/routes/Admin/EditorStudioDedicatedEditorSurface"
import {
  buildEditorStateFingerprint,
  composeEditorContent,
  type LocalDraftSource,
} from "../../src/routes/Admin/editorStudioMetaModel"
import {
  CATEGORY_CATALOG_STORAGE_KEY,
  TAG_CATALOG_STORAGE_KEY,
  persistLocalDraft,
  readLocalDraft,
} from "../../src/routes/Admin/editorStudioStorageModel"
import { isLocalDraftRestoreSuggestionEligible } from "../../src/routes/Admin/useEditorStudioDraftLifecycleModel"
import { useEditorStudioMetaCatalog } from "../../src/routes/Admin/useEditorStudioMetaCatalog"
import { useEditorStudioPublishModalFlow } from "../../src/routes/Admin/useEditorStudioPublishModalFlow"
import {
  createMinimalRootContainer,
  createSetter,
  createStatefulEditorHarness,
  withWindowStorage,
} from "./helpers/editorStudioTestHarness"

test.describe("Wave 6 Unit 3: EditorStudio conflict recovery & metadata catalog", () => {
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
        if (url.endsWith("/post/api/v1/posts/501") && init?.method === "PUT") {
          capturedBodies.push(JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>)
          return new Response(
            JSON.stringify({
              resultCode: "200-1",
              msg: "modified",
              data: {
                id: 501,
                version: 2,
                title: "새 포스트 2",
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

        await act(async () => {
          writeHarness.state.postTitle = "새 포스트 2"
          writeRoot.render(createElement(writeHarness.Probe))
        })
        await act(async () => {
          await writeHarness.persistence.handleModifyPost()
          writeRoot.render(createElement(writeHarness.Probe))
        })
        expect(writeHarness.state.postTags).toEqual(["react", "typescript", "nextjs"])
        expect(writeHarness.state.postCategory).toBe("rocket::Backend")
        expect(String(capturedBodies[1]?.content ?? "")).toContain('tags: ["react", "typescript", "nextjs"]')
        expect(String(capturedBodies[1]?.content ?? "")).toContain('category: ["rocket::Backend"]')
      } finally {
        await act(async () => {
          writeRoot.unmount()
        })
        globalThis.fetch = originalFetch
      }
    })
  })
})
