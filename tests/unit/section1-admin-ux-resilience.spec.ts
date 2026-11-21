import { act, createElement, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import { createTheme } from "../../src/styles/theme"
import {
  clearStoredVideoUploadSessionId,
  readStoredVideoUploadSessionId,
  storeVideoUploadSessionId,
} from "../../src/apis/backend/cloud"
import { performAdminShellLogout } from "../../src/routes/Admin/AdminShell"
import { AdminHubSurfaceSections } from "../../src/routes/Admin/AdminHubSurface.sections"
import {
  buildListEndpoint,
  canOpenCanonicalPost,
  visibilityLabel,
  visibilityLabelFromValue,
  workspaceStatusLabel,
  type AdminPostListItem,
} from "../../src/routes/Admin/AdminPostsWorkspaceModel"
import { AdminPostsWorkspaceList } from "../../src/routes/Admin/AdminPostsWorkspaceList"
import {
  LOCAL_DRAFT_POST_SLOT_LIMIT,
  LOCAL_DRAFT_POST_STORAGE_KEY_PREFIX,
  listLocalDraftCandidates,
  persistCatalog,
  persistLocalDraft,
  readLocalDraft,
  removeLocalDraft,
  removeLocalDraftCandidate,
} from "../../src/routes/Admin/editorStudioStorageModel"
import type { LocalDraftPayload } from "../../src/routes/Admin/editorStudioMetaModel"
import { getFreshnessMeta } from "../../src/routes/Admin/AdminToolsWorkspaceModel"
import { AdminToolsOpsOverview } from "../../src/routes/Admin/AdminToolsOpsOverview"
import {
  createMinimalRootContainer,
  createStatefulEditorHarness,
  withWindowStorage,
} from "./helpers/editorStudioTestHarness"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"

const lightTheme = createTheme({ scheme: "light" })

const makeDraftPayload = (postId: string, savedAt = new Date().toISOString()): LocalDraftPayload => ({
  title: `Draft ${postId}`,
  content: `Body ${postId}`,
  summary: "",
  summarySource: "NONE",
  summaryIntent: { kind: "auto" },
  thumbnailUrl: "",
  thumbnailFocusX: 50,
  thumbnailFocusY: 50,
  thumbnailZoom: 1,
  tags: [],
  category: "",
  visibility: "PRIVATE",
  savedAt,
  source: { kind: "post", postId },
})

test.describe("Section 1: Storage Resilience, Admin UX, & Draft Lifecycle", () => {
  test("storage helpers fail safely on SecurityError while preserving QuotaExceededError on 20 full draft slots", async () => {
    const securityErrorStorage = {
      get length() {
        throw new DOMException("Access denied", "SecurityError")
      },
      key() {
        throw new DOMException("Access denied", "SecurityError")
      },
      getItem() {
        throw new DOMException("Access denied", "SecurityError")
      },
      setItem() {
        throw new DOMException("Access denied", "SecurityError")
      },
      removeItem() {
        throw new DOMException("Access denied", "SecurityError")
      },
      clear() {
        throw new DOMException("Access denied", "SecurityError")
      },
    } as unknown as Storage

    const prevWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        localStorage: securityErrorStorage,
        sessionStorage: securityErrorStorage,
      },
    })
    try {
      expect(() => storeVideoUploadSessionId("cloud:vid:1", 42)).not.toThrow()
      expect(readStoredVideoUploadSessionId("cloud:vid:1")).toBeNull()
      expect(() => clearStoredVideoUploadSessionId("cloud:vid:1")).not.toThrow()
      expect(() => persistCatalog("admin.editor.customTags", ["ts"])).not.toThrow()
      expect(readLocalDraft({ kind: "post", postId: "1" })).toBeNull()
      expect(() => persistLocalDraft(makeDraftPayload("99"))).toThrow(/SecurityError|Access denied/i)
      expect(() => listLocalDraftCandidates({ kind: "create" })).toThrow(/SecurityError|Access denied/i)
      expect(() => removeLocalDraft({ kind: "post", postId: "1" })).toThrow(/SecurityError|Access denied/i)
      expect(() => removeLocalDraftCandidate({ kind: "create" }, "k")).toThrow(/SecurityError|Access denied/i)
    } finally {
      if (prevWindow) Object.defineProperty(globalThis, "window", prevWindow)
      else delete (globalThis as Record<string, unknown>).window
    }

    await withWindowStorage((storage) => {
      for (let i = 1; i <= LOCAL_DRAFT_POST_SLOT_LIMIT; i += 1) {
        storage.setItem(
          `${LOCAL_DRAFT_POST_STORAGE_KEY_PREFIX}${i}.v3`,
          JSON.stringify(makeDraftPayload(String(i)))
        )
      }
      expect(() => persistLocalDraft(makeDraftPayload("999"))).toThrow(/QuotaExceededError|draft/i)
    })
  })

  test("AdminPostsWorkspaceModel distinguishes all 4 visibility states and supports CREATED_AT & HIT_COUNT sorts", () => {
    expect(visibilityLabel(true, true)).toBe("전체 공개")
    expect(visibilityLabel(true, false)).toBe("링크 공개")
    expect(visibilityLabel(false, false)).toBe("비공개")
    expect(visibilityLabelFromValue("PUBLIC_UNLISTED")).toBe("링크 공개")
    expect(
      workspaceStatusLabel({ title: "임시글", published: false, listed: false, tempDraft: true })
    ).toBe("임시 초안")
    expect(canOpenCanonicalPost({ published: true, tempDraft: false })).toBe(true)
    expect(canOpenCanonicalPost({ published: true, tempDraft: true })).toBe(false)
    expect(canOpenCanonicalPost({ published: false, tempDraft: false })).toBe(false)

    expect(
      buildListEndpoint("active", {
        page: "1",
        pageSize: "20",
        kw: "",
        status: "all",
        sort: "CREATED_AT",
      })
    ).toContain("sort=CREATED_AT")
    expect(
      buildListEndpoint("active", {
        page: "1",
        pageSize: "20",
        kw: "",
        status: "all",
        sort: "HIT_COUNT",
      })
    ).toContain("sort=HIT_COUNT")
  })

  test("AdminPostsWorkspaceList renders Link titles, canonical open action, Korean headers, and status loading skeleton", () => {
    const unlistedRow: AdminPostListItem = {
      id: 501,
      title: "Unlisted Note",
      authorName: "Aquila",
      published: true,
      listed: false,
      tempDraft: false,
      hitCount: 12,
      createdAt: "2026-10-01T00:00:00Z",
      modifiedAt: "2026-10-02T00:00:00Z",
      category: ["Backend"],
      tags: ["Spring"],
    }

    const loadedHtml = renderToStaticMarkup(
      materializePlaywrightJsx(
        createElement(ThemeProvider, {
          theme: lightTheme,
          children: createElement(AdminPostsWorkspaceList, {
            listScope: "active",
            listKw: "",
            listPage: "1",
            listPageSize: "20",
            listState: {
              rows: [unlistedRow],
              total: 1,
              loadedAt: "2026-10-02T00:00:00Z",
            },
            isListLoading: false,
            listError: "",
            shouldRenderMobileList: false,
            onLoadList: () => {},
            onOpenWriteRoute: () => {},
            onPageChange: () => {},
            pendingPostId: null,
            mutationPending: null,
            onDeletePost: () => {},
            onHardDeletePost: () => {},
            onRestorePost: () => {},
            onResetSearch: () => {},
          }),
        }) as ReactElement
      ) as ReactElement
    )
    expect(loadedHtml).toContain('href="/admin/editor/501"')
    expect(loadedHtml).toContain("링크 공개")
    expect(loadedHtml).toContain('href="/posts/501"')
    expect(loadedHtml).toContain("글 보기")
    expect(loadedHtml).not.toContain("글 보기 ↗")
    expect(loadedHtml).toContain("제목")

    const loadingHtml = renderToStaticMarkup(
      materializePlaywrightJsx(
        createElement(ThemeProvider, {
          theme: lightTheme,
          children: createElement(AdminPostsWorkspaceList, {
            listScope: "active",
            listKw: "",
            listPage: "1",
            listPageSize: "20",
            listState: {
              rows: [],
              total: 0,
              loadedAt: "",
            },
            isListLoading: true,
            listError: "",
            shouldRenderMobileList: false,
            onLoadList: () => {},
            onOpenWriteRoute: () => {},
            onPageChange: () => {},
            pendingPostId: null,
            mutationPending: null,
            onDeletePost: () => {},
            onHardDeletePost: () => {},
            onRestorePost: () => {},
            onResetSearch: () => {},
          }),
        }) as ReactElement
      ) as ReactElement
    )
    expect(loadingHtml).toContain('role="status"')
    expect(loadingHtml).toContain('aria-busy="true"')
    expect(loadingHtml).toContain('aria-label="글 목록을 불러오는 중입니다."')
  })

  test("AdminHubSurfaceSections renders primaryAction CTA and AdminToolsOpsOverview labels queue metrics accurately", () => {
    const hubHtml = renderToStaticMarkup(
      materializePlaywrightJsx(
        createElement(ThemeProvider, {
          theme: lightTheme,
          children: createElement(AdminHubSurfaceSections, {
            displayName: "Aquila",
            greeting: "운영 요약",
            recentWorkSummary: "최근 업데이트",
            primaryAction: {
              href: "/admin/editor/new",
              cta: "새 글 작성",
              secondaryHref: "/admin/posts",
            },
            metrics: [{ label: "PUBLISHED", value: "3", detail: "전체 3건", tone: "good" }],
            contentItems: [],
            serviceStatusItems: [],
            activityItems: [],
          }),
        }) as ReactElement
      ) as ReactElement
    )
    expect(hubHtml).toContain('href="/admin/editor/new"')
    expect(hubHtml).toContain("새 글 작성")

    const toolsHtml = renderToStaticMarkup(
      materializePlaywrightJsx(
        createElement(ThemeProvider, {
          theme: lightTheme,
          children: createElement(AdminToolsOpsOverview, {
            authSecurityEvents: [],
            cleanupDiagnostics: {
              tempCount: 1,
              activeCount: 1,
              pendingDeleteCount: 1,
              deletedCount: 0,
              eligibleForPurgeCount: 1,
              cleanupSafetyThreshold: 10,
              blockedBySafetyThreshold: false,
              oldestEligiblePurgeAfter: null,
              sampleEligibleObjectKeys: [],
            },
            dashboardSnapshot: {
              generatedAt: "2026-10-01T00:00:00Z",
              taskQueue: {
                pendingCount: 3,
                readyPendingCount: 2,
                processingCount: 1,
                failedCount: 0,
                staleProcessingCount: 0,
                oldestReadyPendingAgeSeconds: 12,
                latestFailureAt: null,
                latestFailureMessage: null,
              },
              storageCleanup: {
                eligibleForPurgeCount: 1,
                blockedBySafetyThreshold: false,
                oldestEligiblePurgeAfter: "2026-10-01T00:00:00Z",
              },
              authSecurity: {
                recentEventCount: 0,
                blockedEventCount: 0,
                latestEventAt: null,
                latestBlockedAt: null,
              },
            },
            executeAction: async () => null,
            fetchSystemHealthCached: async () => ({ status: "UP", checks: { db: "UP", redis: "UP" } }),
            focusSection: () => {},
            loadingKey: "",
            overviewStatusLabel: "UP",
            queueStatusLabel: "NORMAL",
            recentCheckedLabel: "방금",
            setSystemHealthCheckedAt: () => {},
            systemHealthFreshness: getFreshnessMeta(
              "2026-10-01T00:00:00Z",
              Date.parse("2026-10-01T00:00:10Z")
            ),
            systemHealthQuery: { data: { status: "UP" } },
            systemHealthStatus: "UP",
            taskQueueDiagnostics: null,
          }),
        }) as ReactElement
      ) as ReactElement
    )
    expect(toolsHtml).toContain('data-ui="bullboard-queue-grid"')
    expect(toolsHtml).toContain("TOTAL")
    expect(toolsHtml).toContain("READY")
  })

  test("performAdminShellLogout confirms unsaved changes BEFORE calling logout or clearing local drafts", async () => {
    const events: string[] = []
    const aborted = await performAdminShellLogout({
      hasUnsavedChanges: true,
      hasLocalDrafts: true,
      confirmFn: () => {
        events.push("confirm:false")
        return false
      },
      callLogout: async () => {
        events.push("logout")
      },
      clearDrafts: () => {
        events.push("clear")
      },
    })
    expect(aborted).toBe(false)
    expect(events).toEqual(["confirm:false"])

    const confirmedEvents: string[] = []
    const completed = await performAdminShellLogout({
      hasUnsavedChanges: true,
      hasLocalDrafts: false,
      confirmFn: () => {
        confirmedEvents.push("confirm:true")
        return true
      },
      callLogout: async () => {
        confirmedEvents.push("logout")
      },
      clearDrafts: () => {
        confirmedEvents.push("clear")
      },
    })
    expect(completed).toBe(true)
    expect(confirmedEvents).toEqual(["confirm:true", "logout", "clear"])
  })

  test("useEditorStudioDraftLifecycle preserves non-default tempDraft title on load", async () => {
    await withWindowStorage(async () => {
      const harness = createStatefulEditorHarness()
      harness.state.postId = "91"
      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            id: 91,
            title: "사용자가 정한 임시글 제목",
            content: "본문",
            summary: "",
            summarySource: "NONE",
            published: false,
            listed: false,
            tempDraft: true,
            version: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )) as typeof fetch

      try {
        await act(async () => {
          root.render(createElement(harness.Probe))
        })
        await act(async () => {
          await harness.lifecycle.loadPostForEditor("91")
          root.render(createElement(harness.Probe))
        })
        expect(harness.state.postTitle).toBe("사용자가 정한 임시글 제목")
      } finally {
        await act(async () => {
          root.unmount()
        })
        globalThis.fetch = originalFetch
      }
    })
  })
})
