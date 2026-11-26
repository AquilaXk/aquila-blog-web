import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError, ApiNetworkError, ApiTimeoutError } from "../../src/apis/backend/client"
import {
  CloudApiError,
  createUploadSpeedEstimator,
  isRetryableCloudUploadError,
  parseRetryAfterMs,
  resolveCloudRetryDelayMs,
} from "../../src/apis/backend/cloudXhrTransport"
import {
  buildCloudFolderBreadcrumbs,
  buildCloudWorkspaceUrlQuery,
  extractDirectChildFolders,
  normalizeCloudFolderPath,
  parseCloudWorkspaceUrlQuery,
  validateCloudFolderPath,
} from "../../src/routes/Admin/cloud/cloudFolderHelpers"
import { validateCloudFileBeforeUpload } from "../../src/routes/Admin/cloudFileSignatureGuard"
import {
  computeAggregateQueueProgress,
  formatCloudEta,
  formatCloudTransferRate,
} from "../../src/routes/Admin/cloudUploadQueueModel"
import { queryKey } from "../../src/constants/queryKey"
import {
  CLOUD_SYNC_UPLOAD_MAX_BYTES,
  type CloudFile,
  getCloudFileDownloadUrl,
  isDefinitiveStaleVideoUploadSessionError,
  isExplicitUploadAbort,
  isResumableVideoUploadFile,
} from "../../src/apis/backend/cloud"
import { resolveVideoUploadSession } from "../../src/apis/backend/cloudVideoUpload"
import { readBoundedCloudSvgPreview, readBoundedCloudTextPreview } from "../../src/routes/Admin/cloud/cloudPreviewHelpers"
import {
  buildExploreCursorPath,
  buildFeedCursorPath,
  toValidPage,
  toValidPageSize,
} from "../../src/apis/backend/posts/PostApiRequestModel"
import useAuthSession, { shouldFetchAuthSession } from "../../src/hooks/useAuthSession"
import { registeredBrowserStorageKeys } from "../../src/libs/privacy/browserStorageRegistry"
import { getSearchDebounceMs } from "../../src/hooks/useDebouncedValue"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"
import {
  DASHBOARD_COLLECTION_FAILED_LABEL,
  DASHBOARD_DATA_MISSING_LABEL,
  formatDashboardFreshnessLabel,
  isDashboardQueryCollectionFailed,
  resolveDashboardCollectionLabel,
  resolveDashboardDataUpdatedAt,
} from "../../src/routes/Admin/AdminDashboardWorkspaceModel"
import { normalizeApiRequestPath } from "../../src/libs/backend/requestPath"
import { renderMarkdownSegment } from "../../src/libs/markdown/MarkdownRendererSegments"
import { normalizeInlineColorToken, resolveInlineColorValue } from "../../src/libs/markdown/inlineColor"
import { parseMarkdownSegments } from "../../src/libs/markdown/renderingSegmentModel"
import { normalizeSafeMarkdownUrl } from "../../src/libs/markdown/safeMarkdownUrl"
import { normalizeAdminNextPath, normalizeNextPath, toAdminLoginPath } from "../../src/libs/router"
import { isSafeInlineHref } from "../../src/components/markdown-editor/markdownEditorWidgets"
import { normalizeEditorReturnRoute } from "../../src/routes/Admin/EditorStudioWorkspaceControllerRootModel"
import {
  doesCloudFileMatchFilters,
  extractCloudFolders,
  isCloudSearchPending,
  resolveCloudEmptyTitle,
  shouldShowCloudEmptyLoading,
  sortCloudFiles,
  updateCachedCloudFilesForMutation,
} from "../../src/routes/Admin/AdminCloudWorkspaceModel"

test.describe("frontend pure logic contracts", () => {
  test("safe redirect paths reject external and data-route inputs", () => {
    expect(normalizeNextPath("/admin/posts?tag=release")).toBe("/admin/posts?tag=release")
    expect(normalizeNextPath("//evil.example/path", "/")).toBe("/")
    expect(normalizeNextPath("/\\evil.example/path", "/")).toBe("/")
    expect(normalizeNextPath("https://evil.example/path", "/")).toBe("/")
    expect(normalizeNextPath("/_next/data/build-id/posts/42.json?next=https%3A%2F%2Fevil.example&tag=qa")).toBe(
      "/posts/42?tag=qa"
    )
    expect(normalizeNextPath("/_next/data/build-id//evil.example/index.json", "/")).toBe("/")
    expect(normalizeNextPath("/_next/data/build-id/\\evil.example/index.json", "/")).toBe("/")
    expect(normalizeSafeMarkdownUrl("/\\evil.example/path")).toBe("")
    expect(normalizeEditorReturnRoute("/\\evil.example/path")).toBe("")
    expect(normalizeEditorReturnRoute("/_next/data/build-id//evil.example/index.json")).toBe("")
    expect(isSafeInlineHref("/\\evil.example/path")).toBe(false)
    expect(isSafeInlineHref("//evil.example/path")).toBe(false)
    expect(resolveInlineColorValue("constructor")).toBeNull()
    expect(normalizeInlineColorToken("__proto__")).toBeNull()
  })

  test("admin login next paths remain within the admin surface", () => {
    expect(normalizeAdminNextPath("/admin/editor/42?surface=compose")).toBe(
      "/admin/editor/42?surface=compose"
    )
    expect(normalizeAdminNextPath("/posts/42", "/admin")).toBe("/admin")
    expect(normalizeAdminNextPath("https://evil.example/admin", "/admin")).toBe("/admin")
    expect(toAdminLoginPath("/admin/editor/new")).toBe(
      "/admin/login?next=%2Fadmin%2Feditor%2Fnew"
    )
    expect(toAdminLoginPath("/posts/42", "/admin")).toBe("/admin/login?next=%2Fadmin")
    expect(normalizeAdminNextPath("/admin/./login")).toBe("/admin")
    expect(normalizeAdminNextPath("/admin/../posts/42")).toBe("/admin")
    expect(normalizeAdminNextPath("/admin/posts/../editor/new?draft=1#title")).toBe(
      "/admin/editor/new?draft=1#title"
    )
  })

  test("backend request paths stay allow-listed and relative", () => {
    expect(normalizeApiRequestPath("/post/api/v1/posts/feed/cursor?cursor=abc")).toBe(
      "/post/api/v1/posts/feed/cursor?cursor=abc"
    )
    expect(normalizeApiRequestPath("/member/api/v1/auth/me")).toBe("/member/api/v1/auth/me")
    expect(() => normalizeApiRequestPath("https://api.example.com/member/api/v1/auth/me")).toThrow(
      /Absolute URL/
    )
    expect(() => normalizeApiRequestPath("/post/api/v1/%E0%A4%A/admin")).toThrow(/Path traversal/)
    expect(() => normalizeApiRequestPath("/internal/health")).toThrow(/allow-listed/)
  })

  test("markdown card URLs keep safe values, validate embedUrl, and sandbox embed iframes", () => {
    const segments = parseMarkdownSegments(`<!-- aq-bookmark {"thumbnailUrl":"javascript:alert(1)"} -->
:::bookmark javascript:alert(1)
Unsafe
description
:::

<!-- aq-embed {"embedUrl":"https://www.youtube.com/embed/abc123def45"} -->
:::embed https://www.youtube.com/watch?v=abc123def45
Safe
caption
:::`)

    const bookmark = segments.find((segment) => segment.type === "bookmark")
    const embed = segments.find((segment) => segment.type === "embed")

    expect(bookmark).toMatchObject({ type: "bookmark", url: "" })
    expect(bookmark).not.toHaveProperty("thumbnailUrl")
    expect(embed).toMatchObject({
      type: "embed",
      embedUrl: "https://www.youtube.com/embed/abc123def45",
      url: "https://www.youtube.com/watch?v=abc123def45",
    })

    const renderedSafeEmbed = JSON.stringify(
      renderMarkdownSegment({
        segment: embed!,
        index: 0,
        imageIndex: 0,
        editableImages: false,
        renderMarkdown: (md) => md,
      })
    )
    expect(renderedSafeEmbed).toContain("https://www.youtube.com/embed/abc123def45")
    expect(renderedSafeEmbed).toContain("allow-scripts allow-same-origin allow-popups allow-presentation")

    const renderedCraftedEmbed = JSON.stringify(
      renderMarkdownSegment({
        segment: {
          type: "embed",
          url: "https://example.com/article",
          embedUrl: "https://evil.example/phish",
          title: "Crafted",
          caption: "",
        },
        index: 1,
        imageIndex: 0,
        editableImages: false,
        renderMarkdown: (md) => md,
      })
    )
    expect(renderedCraftedEmbed).not.toContain("https://evil.example/phish")

    const renderedCraftedFigmaEmbed = JSON.stringify(
      renderMarkdownSegment({
        segment: {
          type: "embed",
          url: "https://example.com/article",
          embedUrl: "https://www.figma.com/embed?url=https%3A%2F%2Fevil.example%2Fphish",
          title: "Crafted Figma",
          caption: "",
        },
        index: 2,
        imageIndex: 0,
        editableImages: false,
        renderMarkdown: (md) => md,
      })
    )
    expect(renderedCraftedFigmaEmbed).not.toContain("evil.example")
  })

  test("upload recovery predicates separate stale sessions from transient failures", () => {
    expect(isDefinitiveStaleVideoUploadSessionError(new ApiError(404, "/upload-session", ""))).toBe(true)
    expect(isDefinitiveStaleVideoUploadSessionError(new ApiError(410, "/upload-session", ""))).toBe(true)
    expect(isDefinitiveStaleVideoUploadSessionError(new ApiError(503, "/upload-session", ""))).toBe(false)

    const abortController = new AbortController()
    abortController.abort()
    expect(isExplicitUploadAbort(new Error("network closed"), abortController.signal)).toBe(true)
    expect(isExplicitUploadAbort(new DOMException("Upload aborted", "AbortError"))).toBe(true)
    expect(isExplicitUploadAbort(new Error("network closed"))).toBe(false)
  })

  test("auth session fetch decision preserves cached anonymous and member states", () => {
    expect(
      shouldFetchAuthSession({
        anonymousProbeSuppressed: false,
        hasCachedAnonymousSnapshot: false,
        hasCachedMemberSnapshot: true,
        hasCachedSnapshot: true,
        serverProbeSnapshot: false,
      })
    ).toBe(true)
    expect(
      shouldFetchAuthSession({
        anonymousProbeSuppressed: false,
        hasCachedAnonymousSnapshot: true,
        hasCachedMemberSnapshot: false,
        hasCachedSnapshot: true,
        serverProbeSnapshot: false,
      })
    ).toBe(false)
    expect(
      shouldFetchAuthSession({
        anonymousProbeSuppressed: true,
        hasCachedAnonymousSnapshot: false,
        hasCachedMemberSnapshot: false,
        hasCachedSnapshot: false,
        serverProbeSnapshot: undefined,
      })
    ).toBe(false)
    expect(
      shouldFetchAuthSession({
        anonymousProbeSuppressed: false,
        hasCachedAnonymousSnapshot: false,
        hasCachedMemberSnapshot: false,
        hasCachedSnapshot: false,
        serverProbeSnapshot: true,
      })
    ).toBe(true)
  })

  test("post pagination builders clamp page size and trim cursors", () => {
    expect(toValidPage(Number.NaN)).toBe(1)
    expect(toValidPage(-5)).toBe(1)
    expect(toValidPageSize(99)).toBe(30)
    expect(toValidPageSize(-5)).toBe(1)
    expect(buildFeedCursorPath({ cursor: "  abc  ", order: "asc", pageSize: 99 })).toBe(
      "/post/api/v1/posts/feed/cursor?sort=CREATED_AT_ASC&pageSize=30&cursor=abc"
    )
    expect(buildExploreCursorPath({ cursor: "", tag: "  TypeScript  ", pageSize: 2 })).toBe(
      "/post/api/v1/posts/explore/cursor?tag=TypeScript&sort=CREATED_AT&pageSize=2"
    )
    expect(buildFeedCursorPath({ sortMode: "views", pageSize: 24 })).toBe(
      "/post/api/v1/posts/feed/cursor?sort=HIT_COUNT&pageSize=24"
    )
  })

  test("search debounce delay adapts by keyword length", () => {
    expect(getSearchDebounceMs("")).toBe(0)
    expect(getSearchDebounceMs("  ")).toBe(0)
    expect(getSearchDebounceMs("한")).toBe(120)
    expect(getSearchDebounceMs("검색어")).toBe(180)
    expect(getSearchDebounceMs("프로젝트스크린샷")).toBe(240)
  })

  test("cloud empty state follows debounced search and fetch status", () => {
    const baseInput = {
      activeUploadCount: 0,
      debouncedKeyword: "",
      filter: "ALL" as const,
      isError: false,
      isFetching: false,
      isLoading: false,
      keyword: "",
    }

    expect(isCloudSearchPending("deploy", "depl")).toBe(true)
    expect(isCloudSearchPending("deploy", "deploy")).toBe(false)

    expect(
      resolveCloudEmptyTitle({
        ...baseInput,
        keyword: "deploy",
      })
    ).toBe("검색 중입니다.")

    expect(
      resolveCloudEmptyTitle({
        ...baseInput,
        debouncedKeyword: "deploy",
        keyword: "deploy",
      })
    ).toBe("선택한 조건에 맞는 파일이 없습니다.")

    expect(
      resolveCloudEmptyTitle({
        ...baseInput,
        debouncedKeyword: "deploy",
        isFetching: true,
        keyword: "deploy",
      })
    ).toBe("검색 중입니다.")

    expect(
      resolveCloudEmptyTitle({
        ...baseInput,
        debouncedKeyword: "deploy",
        keyword: "",
      })
    ).toBe("검색 중입니다.")

    expect(shouldShowCloudEmptyLoading({ filesCount: 0, isLoading: false, isSearchPending: true })).toBe(true)
    expect(shouldShowCloudEmptyLoading({ filesCount: 2, isLoading: false, isSearchPending: true })).toBe(false)
  })

  test("dashboard freshness uses latest dataUpdatedAt as HH:mm 기준", () => {
    const older = Date.UTC(2026, 6, 22, 2, 5, 0)
    const newer = Date.UTC(2026, 6, 22, 2, 17, 0)
    expect(resolveDashboardDataUpdatedAt(0, newer, older)).toBe(newer)
    expect(formatDashboardFreshnessLabel(older)).toMatch(/^\d{2}:\d{2} 기준$/)
    expect(resolveDashboardCollectionLabel({ isError: true, hasData: true })).toBe(
      DASHBOARD_COLLECTION_FAILED_LABEL
    )
    expect(resolveDashboardCollectionLabel({ isError: false, isRefetchError: true, hasData: true })).toBe(
      DASHBOARD_COLLECTION_FAILED_LABEL
    )
    expect(resolveDashboardCollectionLabel({ isError: false, hasData: false })).toBe(
      DASHBOARD_DATA_MISSING_LABEL
    )
    expect(resolveDashboardCollectionLabel({ isError: false, hasData: true })).toBeNull()
    expect(isDashboardQueryCollectionFailed({ isError: false, isRefetchError: true })).toBe(true)
    expect(isDashboardQueryCollectionFailed({ isError: true, isRefetchError: false })).toBe(true)
    expect(isDashboardQueryCollectionFailed({ isError: false, isRefetchError: false })).toBe(false)
  })

  test("dashboard collection failure flags stay scoped per query", () => {
    const pageSource = readFileSync(
      path.resolve(__dirname, "../../src/routes/Admin/AdminDashboardWorkspacePage.tsx"),
      "utf8"
    )
    const viewSource = readFileSync(
      path.resolve(__dirname, "../../src/routes/Admin/AdminDashboardWorkspaceView.tsx"),
      "utf8"
    )

    expect(pageSource).toContain("healthCollectionFailed = isDashboardQueryCollectionFailed(systemHealthQuery)")
    expect(pageSource).toContain("snapshotCollectionFailed = isDashboardQueryCollectionFailed(dashboardSnapshotQuery)")
    expect(pageSource).toContain("collectionFailed = healthCollectionFailed || snapshotCollectionFailed")
    expect(pageSource).toContain("isManualRefreshing")
    expect(pageSource).toContain("isRefreshing = isManualRefreshing")
    expect(pageSource).not.toContain("isRefreshing = systemHealthQuery.isFetching")
    expect(viewSource).toContain("snapshotCollectionFailed")
    expect(viewSource).not.toMatch(/운영 지표 요약[\s\S]*collectionFailed \?/)
    expect(viewSource).not.toMatch(/Live logs[\s\S]*collectionFailed \?/)
  })

  test("cloud upload limit, folder+keyword search parsing, and file sorting stay deterministic", () => {
    expect(CLOUD_SYNC_UPLOAD_MAX_BYTES).toBe(95 * 1024 * 1024)
    expect(getCloudFileDownloadUrl(42)).toMatch(/\/system\/api\/v1\/adm\/cloud\/files\/42\/content\?download=true$/)

    const makeSizedFile = (name: string, type: string, size: number) => {
      const file = new File(["x"], name, { type })
      Object.defineProperty(file, "size", { value: size })
      return file
    }

    expect(isResumableVideoUploadFile(makeSizedFile("clip.mp4", "video/mp4", 95 * 1024 * 1024))).toBe(false)
    expect(isResumableVideoUploadFile(makeSizedFile("clip.mp4", "video/mp4", 95 * 1024 * 1024 + 1))).toBe(true)
    expect(isResumableVideoUploadFile(makeSizedFile("archive.pdf", "application/pdf", 95 * 1024 * 1024 + 1))).toBe(
      false
    )

    expect(normalizeCloudFolderPath(" /ops\\2026 세미나/ ")).toBe("ops/2026 세미나")
    expect(validateCloudFolderPath("ops/2026 세미나")).toEqual({ ok: true, path: "ops/2026 세미나" })
    expect(validateCloudFolderPath("ops/../secret").ok).toBe(false)
    expect(buildCloudFolderBreadcrumbs("ops/2026 세미나/발표자료", "전체")).toEqual([
      { label: "전체", path: "" },
      { label: "ops", path: "ops" },
      { label: "ops/2026 세미나".split("/")[1], path: "ops/2026 세미나" },
      { label: "발표자료", path: "ops/2026 세미나/발표자료" },
    ])
    expect(
      parseCloudWorkspaceUrlQuery({
        folder: "/ops/2026 세미나/",
        kw: "발표 자료",
        kind: "PHOTO",
        sort: "NAME",
        dir: "desc",
      })
    ).toEqual({
      folderPath: "ops/2026 세미나",
      keyword: "발표 자료",
      mediaFilter: "PHOTO",
      sortMode: "NAME",
      sortDirection: "desc",
    })
    expect(
      buildCloudWorkspaceUrlQuery({
        folderPath: "/ops/2026 세미나/",
        keyword: "발표",
        mediaFilter: "PHOTO",
        sortMode: "NAME",
        sortDirection: "desc",
      })
    ).toEqual({
      folder: "ops/2026 세미나",
      kw: "발표",
      kind: "PHOTO",
      sort: "NAME",
      dir: "desc",
    })
    expect(
      buildCloudWorkspaceUrlQuery({
        folderPath: "",
        keyword: "",
        mediaFilter: "ALL",
        sortMode: "OLDEST",
        sortDirection: "asc",
      })
    ).toEqual({ sort: "OLDEST" })
    expect(
      buildCloudWorkspaceUrlQuery({
        folderPath: "",
        keyword: "",
        mediaFilter: "ALL",
        sortMode: "OLDEST",
        sortDirection: "desc",
      })
    ).toEqual({ sort: "OLDEST", dir: "desc" })
    expect(
      buildCloudWorkspaceUrlQuery({
        folderPath: "",
        keyword: "",
        mediaFilter: "ALL",
        sortMode: "LATEST",
        sortDirection: "desc",
      })
    ).toEqual({})
    expect(
      buildCloudWorkspaceUrlQuery({
        folderPath: "",
        keyword: "",
        mediaFilter: "ALL",
        sortMode: "LATEST",
        sortDirection: "asc",
      })
    ).toEqual({ dir: "asc" })
    expect(
      buildCloudWorkspaceUrlQuery({
        folderPath: "",
        keyword: "",
        mediaFilter: "ALL",
        sortMode: "NAME",
        sortDirection: "asc",
      })
    ).toEqual({ sort: "NAME" })
    expect(
      buildCloudWorkspaceUrlQuery({
        folderPath: "",
        keyword: "",
        mediaFilter: "ALL",
        sortMode: "SIZE",
        sortDirection: "desc",
      })
    ).toEqual({ sort: "SIZE" })
    expect(
      buildCloudWorkspaceUrlQuery({
        folderPath: "",
        keyword: "",
        mediaFilter: "ALL",
        sortMode: "SIZE",
        sortDirection: "asc",
      })
    ).toEqual({ sort: "SIZE", dir: "asc" })

    const sampleFiles: CloudFile[] = [
      {
        id: 1,
        ownerMemberId: 1,
        originalFilename: "alpha-report.pdf",
        contentType: "application/pdf",
        mediaKind: "DOCUMENT",
        byteSize: 512,
        folderPath: "ops",
        createdAt: "2026-03-10T10:00:00Z",
        modifiedAt: "2026-03-11T10:00:00Z",
      },
      {
        id: 2,
        ownerMemberId: 1,
        originalFilename: "gamma-photo.png",
        contentType: "image/png",
        mediaKind: "PHOTO",
        byteSize: 2048,
        folderPath: "photos",
        createdAt: "2026-03-12T10:00:00Z",
        modifiedAt: "2026-03-15T10:00:00Z",
      },
      {
        id: 3,
        ownerMemberId: 1,
        originalFilename: "beta-clip.mp4",
        contentType: "video/mp4",
        mediaKind: "VIDEO",
        byteSize: 8192,
        folderPath: "videos",
        createdAt: "2026-03-08T10:00:00Z",
        modifiedAt: "2026-03-09T10:00:00Z",
      },
    ]

    expect(sortCloudFiles(sampleFiles, "LATEST").map((f) => f.id)).toEqual([2, 1, 3])
    expect(sortCloudFiles(sampleFiles, "OLDEST").map((f) => f.id)).toEqual([3, 1, 2])
    expect(sortCloudFiles(sampleFiles, "NAME").map((f) => f.id)).toEqual([1, 3, 2])
    expect(sortCloudFiles(sampleFiles, "SIZE").map((f) => f.id)).toEqual([3, 2, 1])

    expect(extractCloudFolders(sampleFiles)).toEqual(["ops", "photos", "videos"])
    expect(extractCloudFolders(sampleFiles, "/archive/2026/")).toEqual([
      "archive/2026",
      "ops",
      "photos",
      "videos",
    ])
    expect(
      extractDirectChildFolders(["ops", "ops/2026 세미나", "ops/2026 세미나/사진", "photos"], "ops")
    ).toEqual(["ops/2026 세미나"])
    expect(
      doesCloudFileMatchFilters(
        { ...sampleFiles[0]!, folderPath: "ops/2026 세미나" },
        "DOCUMENT",
        "alpha",
        "ops/2026 세미나"
      )
    ).toBe(true)
    expect(
      doesCloudFileMatchFilters(
        { ...sampleFiles[0]!, folderPath: "ops/2026 세미나" },
        "DOCUMENT",
        "alpha",
        "ops"
      )
    ).toBe(false)

    const movedFile: CloudFile = { ...sampleFiles[0]!, folderPath: "ops/2026" }
    expect(
      updateCachedCloudFilesForMutation(sampleFiles, movedFile, "ALL", "", "").map((f) => f.folderPath),
    ).toEqual(["ops/2026", "photos", "videos"])
    expect(
      updateCachedCloudFilesForMutation([sampleFiles[0]!], movedFile, "ALL", "", "ops").map((f) => f.id),
    ).toEqual([])
    expect(
      updateCachedCloudFilesForMutation([], movedFile, "ALL", "", "ops/2026").map((f) => f.id),
    ).toEqual([1])
  })

  test("cloud signature guard enforces high-res PNG, SVG XSS, UTF-8 text, archive/video/audio headers and rejects executables", async () => {
    const makePngFile = (name: string, width: number, height: number) => {
      const buf = new Uint8Array(24)
      const view = new DataView(buf.buffer)
      view.setUint32(0, 0x89504e47, false)
      view.setUint32(4, 0x0d0a1a0a, false)
      view.setUint32(8, 13, false)
      view.setUint32(12, 0x49484452, false)
      view.setUint32(16, width, false)
      view.setUint32(20, height, false)
      return new File([buf], name, { type: "image/png" })
    }

    expect((await validateCloudFileBeforeUpload(makePngFile("hi-res.png", 8000, 6000))).ok).toBe(true)
    expect((await validateCloudFileBeforeUpload(makePngFile("too-wide.png", 16385, 100))).ok).toBe(false)
    expect((await validateCloudFileBeforeUpload(makePngFile("too-many-mp.png", 12000, 10000))).ok).toBe(false)

    const safeSvg = new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect/></svg>'], "icon.svg", {
      type: "image/svg+xml",
    })
    const xssSvg = new File(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'], "xss.svg", {
      type: "image/svg+xml",
    })
    expect((await validateCloudFileBeforeUpload(safeSvg)).ok).toBe(true)
    expect((await validateCloudFileBeforeUpload(xssSvg)).ok).toBe(false)

    const validUtf8 = new File(["안녕하세요\nconsole.log('ok')\n"], "notes.md", { type: "text/markdown" })
    const binaryText = new File([new Uint8Array([0x41, 0x00, 0x42])], "fake.txt", { type: "text/plain" })
    const ansiLog = new File([new Uint8Array([0x1b, 0x5b, 0x33, 0x32, 0x6d, 0x4f, 0x4b])], "build.log", {
      type: "text/plain",
    })
    expect((await validateCloudFileBeforeUpload(validUtf8)).ok).toBe(true)
    expect((await validateCloudFileBeforeUpload(binaryText)).ok).toBe(false)
    expect((await validateCloudFileBeforeUpload(ansiLog)).ok).toBe(true)

    const moovMov = new Uint8Array(12)
    new DataView(moovMov.buffer).setUint32(4, 0x6d6f6f76, false)
    expect((await validateCloudFileBeforeUpload(new File([moovMov], "clip.mov", { type: "video/quicktime" }))).ok).toBe(
      true
    )

    const hwpxZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
    expect((await validateCloudFileBeforeUpload(new File([hwpxZip], "spec.hwpx", { type: "application/hwp+zip" }))).ok).toBe(
      true
    )

    const mzExe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00])
    expect((await validateCloudFileBeforeUpload(new File([mzExe], "payload.exe", { type: "application/octet-stream" }))).ok).toBe(
      false
    )
    expect((await validateCloudFileBeforeUpload(new File([mzExe], "disguised.png", { type: "image/png" }))).ok).toBe(
      false
    )

    // 백엔드와 포맷·UTF-8/NUL 검증 정합성 검증
    const aviBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20])
    expect((await validateCloudFileBeforeUpload(new File([aviBytes], "clip.avi", { type: "video/x-msvideo" }))).ok).toBe(
      false
    )
    expect((await validateCloudFileBeforeUpload(new File(["a=1\n"], "app.properties", { type: "" }))).ok).toBe(false)
    expect((await validateCloudFileBeforeUpload(new File(["KEY=1\n"], ".env", { type: "" }))).ok).toBe(true)
    expect((await validateCloudFileBeforeUpload(new File(["PORT=3000\n"], "site.env", { type: "" }))).ok).toBe(true)
    expect((await validateCloudFileBeforeUpload(new File(["# hi\n<Box/>\n"], "guide.mdx", { type: "" }))).ok).toBe(true)
    expect((await validateCloudFileBeforeUpload(new File(["page1\f\npage2"], "report.txt", { type: "text/plain" }))).ok).toBe(
      true
    )
    expect(
      (await validateCloudFileBeforeUpload(new File(['{"ok":true}\n'], "payload", { type: "application/json" }))).ok
    ).toBe(true)
    const nulSvg = new File([new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x00, 0x3e])], "nul.svg", {
      type: "image/svg+xml",
    })
    const badUtf8Svg = new File([new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x3e, 0xff, 0xfe])], "bad.svg", {
      type: "image/svg+xml",
    })
    expect((await validateCloudFileBeforeUpload(nulSvg)).ok).toBe(false)
    expect((await validateCloudFileBeforeUpload(badUtf8Svg)).ok).toBe(false)
  })

  test("cloud XHR retry classification, EMA speed estimator, and aggregate queue ETA behave deterministically", () => {
    expect(isRetryableCloudUploadError(new ApiNetworkError("/upload"))).toBe(true)
    expect(isRetryableCloudUploadError(new ApiTimeoutError("/upload", 10_000))).toBe(true)
    expect(isRetryableCloudUploadError(new CloudApiError(429, "/upload", "", null, 4_000))).toBe(true)
    expect(isRetryableCloudUploadError(new CloudApiError(408, "/upload", ""))).toBe(true)
    expect(isRetryableCloudUploadError(new CloudApiError(503, "/upload", ""))).toBe(true)
    expect(isRetryableCloudUploadError(new CloudApiError(400, "/upload", ""))).toBe(false)

    expect(parseRetryAfterMs("3")).toBe(3_000)
    expect(parseRetryAfterMs("0")).toBe(250)
    expect(parseRetryAfterMs("120")).toBe(30_000)
    expect(resolveCloudRetryDelayMs(new CloudApiError(429, "/upload", "", null, 4_500), 600)).toBe(4_500)

    const estimate = createUploadSpeedEstimator(10_000, 1_000)
    const sample1 = estimate(2_000, 2_000)
    expect(sample1.loadedBytes).toBe(2_000)
    expect(sample1.speedBps).toBe(2_000)
    expect(sample1.etaSeconds).toBe(4)

    const dummyFile = new File(["abc"], "a.bin")
    const aggregate = computeAggregateQueueProgress([
      { id: "1", file: dummyFile, name: "a.bin", byteSize: 1000, folderPath: "", status: "done", progress: 100, message: "ok" },
      {
        id: "2",
        file: dummyFile,
        name: "b.bin",
        byteSize: 2000,
        folderPath: "",
        status: "uploading",
        progress: 50,
        loadedBytes: 1000,
        speedBps: 500,
        etaSeconds: 2,
        message: "uploading",
      },
      { id: "3", file: dummyFile, name: "c.bin", byteSize: 1000, folderPath: "", status: "queued", progress: 0, message: "queued" },
      { id: "4", file: dummyFile, name: "d.bin", byteSize: 1000, folderPath: "", status: "queued", progress: 0, message: "queued" },
    ])
    expect(aggregate.percent).toBe(40)
    expect(aggregate.queuedCount).toBe(2)
    expect(aggregate.etaSeconds).toBe(6)
    expect(formatCloudTransferRate(aggregate.speedBps)).toBe("500 B/s")
    expect(formatCloudEta(65, "ko")).toBe("약 1분 5초 남음")
    expect(formatCloudEta(65, "en")).toBe("~1m 5s left")
  })

  test("useAuthSession logout clears admin editor local drafts even when backend logout fails, and browserStorageRegistry documents logout and post-like keys", async () => {
    const store = new Map<string, string>([
      ["admin.editor.localDraft.create.v3", '{"title":"create"}'],
      ["admin.editor.localDraft.create.doc-1.v3", '{"title":"doc-create"}'],
      ["admin.editor.localDraft.post.42.doc-1.v3", '{"title":"post-42"}'],
      ["admin.editor.customCategories", '["Tech"]'],
    ])
    const mockLocalStorage: Storage = {
      get length() {
        return store.size
      },
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => {
        store.delete(key)
      },
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }
    const mockSessionStorage: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {},
    }

    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
    const previousFetch = globalThis.fetch
    let capturedLogout: (() => Promise<void>) | null = null
    const dispatchedEvents: string[] = []

    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: {
          localStorage: mockLocalStorage,
          sessionStorage: mockSessionStorage,
          location: { origin: "http://localhost:3000" },
          dispatchEvent: (event: Event) => {
            dispatchedEvents.push(event.type)
            return true
          },
        },
      })
      globalThis.fetch = (async () => new Response("server error", { status: 500 })) as typeof fetch

      const queryClient = new QueryClient()
      queryClient.setQueryData(queryKey.authMe(), {
        id: 1,
        username: "admin",
        nickname: "Admin",
        isAdmin: true,
      })

      const Probe = () => {
        const session = useAuthSession()
        capturedLogout = session.logout
        return null
      }

      renderToString(
        materializePlaywrightJsx(
          createElement(QueryClientProvider, { client: queryClient }, createElement(Probe))
        ) as never
      )
      expect(typeof capturedLogout).toBe("function")
      await capturedLogout!()

      expect(store.has("admin.editor.localDraft.create.v3")).toBe(false)
      expect(store.has("admin.editor.localDraft.create.doc-1.v3")).toBe(false)
      expect(store.has("admin.editor.localDraft.post.42.doc-1.v3")).toBe(false)
      expect(store.get("admin.editor.customCategories")).toBe('["Tech"]')
      expect(dispatchedEvents).toEqual(["aquila-local-drafts-changed"])
      expect(queryClient.getQueryData(queryKey.authMe())).toBeNull()
      expect(queryClient.getQueryData(queryKey.authMeProbe())).toBe(false)
    } finally {
      globalThis.fetch = previousFetch
      if (previousWindow) {
        Object.defineProperty(globalThis, "window", previousWindow)
      } else {
        delete (globalThis as Record<string, unknown>).window
      }
    }

    const draftKeys = [
      "admin.editor.localDraft.create.",
      "admin.editor.localDraft.create.v3",
      "admin.editor.localDraft.post.",
    ]
    for (const key of draftKeys) {
      const entry = registeredBrowserStorageKeys.find((item) => item.key === key)
      expect(entry?.deletion).toContain("logout")
    }
    const likedPostsEntry = registeredBrowserStorageKeys.find(
      (item) => item.key === "aquila_blog_liked_posts_v1"
    )
    expect(likedPostsEntry).toEqual({
      area: "localStorage",
      key: "aquila_blog_liked_posts_v1",
      purpose: "post-liked-state",
      required: false,
      retention: "until unliked or browser storage is cleared, capped to 200 post IDs",
      deletion: "unlike toggle or browser storage deletion",
      stores: "JSON array of liked post ID strings for client UI state",
    })
  })

  test("resolveVideoUploadSession waits for UPLOADING_PART convergence with AbortSignal and preserves storage key on 409", async () => {
    const store = new Map<string, string>()
    const mockLocalStorage: Storage = {
      get length() {
        return store.size
      },
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => {
        store.delete(key)
      },
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
    const previousFetch = globalThis.fetch

    const videoFile = new File(["video-bytes"], "demo.mp4", { type: "video/mp4" })
    const storageKey = "aquila-cloud-video-upload-session::demo.mp4:11:0"

    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: {
          localStorage: mockLocalStorage,
          location: { hostname: "localhost", origin: "http://localhost:3000" },
        },
      })

      // 1) Converges UPLOADING_PART -> UPLOADING_PART -> IN_PROGRESS
      store.set(storageKey, "701")
      let sessionPollCalls = 0
      globalThis.fetch = (async () => {
        sessionPollCalls += 1
        const status = sessionPollCalls < 3 ? "UPLOADING_PART" : "IN_PROGRESS"
        return new Response(
          JSON.stringify({
            id: 701,
            byteSize: videoFile.size,
            status,
            uploadedParts: [1],
            totalParts: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }) as typeof fetch

      const convergedInProgress = await resolveVideoUploadSession(videoFile, "", storageKey, undefined, [1, 1, 1, 1])
      expect(sessionPollCalls).toBe(3)
      expect(convergedInProgress.kind).toBe("inProgress")
      expect(store.get(storageKey)).toBe("701")

      // 2) Converges UPLOADING_PART -> COMPLETING
      let completingCalls = 0
      globalThis.fetch = (async () => {
        completingCalls += 1
        const status = completingCalls === 1 ? "UPLOADING_PART" : "COMPLETING"
        return new Response(
          JSON.stringify({ id: 701, byteSize: videoFile.size, status }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }) as typeof fetch
      const convergedCompleting = await resolveVideoUploadSession(videoFile, "", storageKey, undefined, [1, 1, 1, 1])
      expect(convergedCompleting.kind).toBe("completing")

      // 3) Converges UPLOADING_PART -> COMPLETED with completedFileId
      let completedCalls = 0
      globalThis.fetch = (async (input) => {
        const url = String(input)
        completedCalls += 1
        if (url.endsWith("/files/99")) {
          return new Response(
            JSON.stringify({
              id: 99,
              ownerMemberId: 1,
              originalFilename: "demo.mp4",
              contentType: "video/mp4",
              byteSize: videoFile.size,
              mediaKind: "VIDEO",
              folderPath: "",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        const status = completedCalls === 1 ? "UPLOADING_PART" : "COMPLETED"
        return new Response(
          JSON.stringify({ id: 701, byteSize: videoFile.size, status, completedFileId: 99 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }) as typeof fetch
      const convergedCompleted = await resolveVideoUploadSession(videoFile, "", storageKey, undefined, [1, 1, 1, 1])
      expect(convergedCompleted).toMatchObject({ kind: "completed", file: { id: 99 } })

      // 4) Remains UPLOADING_PART after 4 retries -> throws 409 ApiError and preserves storageKey
      let stuckCalls = 0
      globalThis.fetch = (async () => {
        stuckCalls += 1
        return new Response(
          JSON.stringify({ id: 701, byteSize: videoFile.size, status: "UPLOADING_PART" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }) as typeof fetch
      await expect(
        resolveVideoUploadSession(videoFile, "", storageKey, undefined, [1, 1, 1, 1])
      ).rejects.toMatchObject({ status: 409 })
      expect(stuckCalls).toBe(5)
      expect(store.get(storageKey)).toBe("701")

      // 5) AbortSignal cancels backoff immediately and preserves storageKey
      const controller = new AbortController()
      let abortTestCalls = 0
      globalThis.fetch = (async () => {
        abortTestCalls += 1
        setTimeout(() => controller.abort(), 5)
        return new Response(
          JSON.stringify({ id: 701, byteSize: videoFile.size, status: "UPLOADING_PART" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }) as typeof fetch
      await expect(
        resolveVideoUploadSession(videoFile, "", storageKey, controller.signal, [200, 200, 200, 200])
      ).rejects.toMatchObject({ name: "AbortError" })
      expect(abortTestCalls).toBe(1)
      expect(store.get(storageKey)).toBe("701")
    } finally {
      globalThis.fetch = previousFetch
      if (previousWindow) {
        Object.defineProperty(globalThis, "window", previousWindow)
      } else {
        delete (globalThis as Record<string, unknown>).window
      }
    }
  })

  test("readBoundedCloudTextPreview and readBoundedCloudSvgPreview localize error messages for ko and en", async () => {
    const previousFetch = globalThis.fetch
    try {
      globalThis.fetch = (async () => new Response("server error", { status: 500 })) as typeof fetch

      expect(await readBoundedCloudTextPreview("/test.txt", 10, 1024, undefined, 10, "ko")).toEqual({
        status: "error",
        message: "미리보기를 불러오지 못했습니다. (HTTP 500)",
      })
      expect(await readBoundedCloudTextPreview("/test.txt", 10, 1024, undefined, 10, "en")).toEqual({
        status: "error",
        message: "Failed to load preview. (HTTP 500)",
      })

      expect(await readBoundedCloudSvgPreview("/test.svg", 100, undefined, "ko")).toEqual({
        status: "error",
        message: "SVG 원문을 불러오지 못했습니다. (HTTP 500)",
      })
      expect(await readBoundedCloudSvgPreview("/test.svg", 100, undefined, "en")).toEqual({
        status: "error",
        message: "Failed to load SVG source. (HTTP 500)",
      })

      expect(await readBoundedCloudSvgPreview("/big.svg", 300 * 1024, undefined, "ko")).toEqual({
        status: "too_large",
        message: "SVG 원문 미리보기 상한(256KB)을 초과했습니다.",
      })
      expect(await readBoundedCloudSvgPreview("/big.svg", 300 * 1024, undefined, "en")).toEqual({
        status: "too_large",
        message: "SVG source preview exceeds the 256KB limit.",
      })
    } finally {
      globalThis.fetch = previousFetch
    }
  })
})

