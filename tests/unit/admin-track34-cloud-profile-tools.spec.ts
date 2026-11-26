// 참조 구현: strapi/strapi (MIT), transloadit/uppy (MIT), TryGhost/Ghost (MIT), felixmosh/bull-board (MIT)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, test } from "@playwright/test"
import { act, createElement, type ComponentType } from "react"
import { createRoot } from "react-dom/client"
import { LanguageProvider as RawLanguageProvider } from "../../src/libs/language"
import { validateCloudFileBeforeUpload } from "../../src/routes/Admin/cloudFileSignatureGuard"
import { useAdminCloudUploadQueue } from "../../src/routes/Admin/useAdminCloudUploadQueue"
import { createMinimalRootContainer, withWindowStorage } from "./helpers/editorStudioTestHarness"
import { wrapPlaywrightJsxComponent } from "./helpers/materializePlaywrightJsx"
import { MAX_SVG_MARKUP_BYTES, parseSvgDimensionsFromMarkup } from "../../src/routes/Admin/AdminCloudWorkspaceModel"
import { getStrapiAssetIcon, StrapiFileCodeIcon, StrapiFilePdfIcon, StrapiHeadphonesIcon, StrapiImageIcon, StrapiPlayIcon } from "../../src/routes/Admin/adminStrapiIcons"
import * as AdminProfilePersistenceModel from "../../src/routes/Admin/AdminProfilePersistenceModel"
import * as EditorStudioCloudAssetPickerModule from "../../src/routes/Admin/EditorStudioCloudAssetPicker"
import { getCloudDictionary } from "../../src/routes/Admin/cloud/adminCloudI18n"
import { getCloudSignatureMessages } from "../../src/routes/Admin/cloud/cloudSignatureMessages"
import { buildToolsOpsBars } from "../../src/routes/Admin/AdminToolsOpsOverview"
import { formatRetryPolicy } from "../../src/routes/Admin/AdminToolsWorkspaceModel"
import { formatOperationPollingStatus } from "../../src/routes/Admin/useAdminOperationPolling"

test.describe("Track 3 & 4 보안 가드 · SSR 정규화 · 메모리 상한 단위 테스트", () => {
  test("cloudFileSignatureGuard가 유효한 PNG, PDF, MP4, WebM, 안전 SVG를 허용한다", async () => {
    const pngBuf = new Uint8Array(64)
    new DataView(pngBuf.buffer).setUint32(0, 0x89504e47, false)
    const pngFile = new File([pngBuf], "diagram.png", { type: "image/png" })
    expect((await validateCloudFileBeforeUpload(pngFile)).ok).toBe(true)

    const pdfBytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj<<>>endobj\n")
    const pdfFile = new File([pdfBytes], "report.pdf", { type: "application/pdf" })
    expect((await validateCloudFileBeforeUpload(pdfFile)).ok).toBe(true)

    const mp4Buf = new Uint8Array(32)
    new DataView(mp4Buf.buffer).setUint32(0, 24, false)
    new DataView(mp4Buf.buffer).setUint32(4, 0x66747970, false) // ftyp
    const mp4File = new File([mp4Buf], "walkthrough.mp4", { type: "video/mp4" })
    expect((await validateCloudFileBeforeUpload(mp4File)).ok).toBe(true)

    const webmBuf = new Uint8Array(32)
    new DataView(webmBuf.buffer).setUint32(0, 0x1a45dfa3, false) // EBML
    const webmFile = new File([webmBuf], "clip.webm", { type: "video/webm" })
    expect((await validateCloudFileBeforeUpload(webmFile)).ok).toBe(true)

    const cleanSvg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>'
    )
    const svgFile = new File([cleanSvg], "icon.svg", { type: "image/svg+xml" })
    expect((await validateCloudFileBeforeUpload(svgFile)).ok).toBe(true)
  })

  test("cloudFileSignatureGuard가 위조된 PDF/MP4 바이트와 SVG XSS 페이로드를 Fail-Closed로 거부한다", async () => {
    const fakePdf = new File([new TextEncoder().encode("NOT-A-PDF-HEADER")], "spoofed.pdf", {
      type: "application/pdf",
    })
    const fakePdfRes = await validateCloudFileBeforeUpload(fakePdf)
    expect(fakePdfRes.ok).toBe(false)

    const fakeMp4 = new File([new TextEncoder().encode("plain text pretending to be mp4")], "fake.mp4", {
      type: "video/mp4",
    })
    const fakeMp4Res = await validateCloudFileBeforeUpload(fakeMp4)
    expect(fakeMp4Res.ok).toBe(false)

    const scriptSvg = new File(
      [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><SCRIPT>alert(1)</SCRIPT></svg>')],
      "xss-script.svg",
      { type: "image/svg+xml" }
    )
    expect((await validateCloudFileBeforeUpload(scriptSvg)).ok).toBe(false)

    const onloadSvg = new File(
      [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" OnLoad="fetch(1)"></svg>')],
      "xss-onload.svg",
      { type: "image/svg+xml" }
    )
    expect((await validateCloudFileBeforeUpload(onloadSvg)).ok).toBe(false)

    const onerrorSvg = new File(
      [new TextEncoder().encode('<svg><image href="x" onerror="alert(1)"/></svg>')],
      "xss-onerror.svg",
      { type: "image/svg+xml" }
    )
    expect((await validateCloudFileBeforeUpload(onerrorSvg)).ok).toBe(false)

    const jsHrefSvg = new File(
      [new TextEncoder().encode('<svg><a href="JavaScript:alert(1)"><text>x</text></a></svg>')],
      "xss-javascript.svg",
      { type: "image/svg+xml" }
    )
    expect((await validateCloudFileBeforeUpload(jsHrefSvg)).ok).toBe(false)

    // 네임스페이스 접두 XSS 태그 및 data:image/svg+xml 차단 + .sh 텍스트 허용 / 실행 바이너리 위장 .sh 차단
    const nsScriptSvg = new File(
      [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" xmlns:h="http://www.w3.org/1999/xhtml"><h:script>alert(1)</h:script></svg>')],
      "xss-ns-script.svg",
      { type: "image/svg+xml" }
    )
    expect((await validateCloudFileBeforeUpload(nsScriptSvg)).ok).toBe(false)
    expect((await validateCloudFileBeforeUpload(nsScriptSvg, "en")).ok).toBe(false)

    const nsForeignSvg = new File(
      [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="http://www.w3.org/2000/svg"><x:foreignObject><body/></x:foreignObject></svg>')],
      "xss-ns-foreign.svg",
      { type: "image/svg+xml" }
    )
    expect((await validateCloudFileBeforeUpload(nsForeignSvg)).ok).toBe(false)

    const nsIframeSvg = new File(
      [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="http://www.w3.org/1999/xhtml"><x:iframe src="https://evil.example"/></svg>')],
      "xss-ns-iframe.svg",
      { type: "image/svg+xml" }
    )
    expect((await validateCloudFileBeforeUpload(nsIframeSvg)).ok).toBe(false)

    const nsDotScriptSvg = new File(
      [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" xmlns:a.b="http://www.w3.org/1999/xhtml"><a.b:script>alert(1)</a.b:script></svg>')],
      "xss-ns-dot-script.svg",
      { type: "image/svg+xml" }
    )
    expect((await validateCloudFileBeforeUpload(nsDotScriptSvg)).ok).toBe(false)

    const dataSvgUri = new File(
      [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;utf8,<svg/>"/></svg>')],
      "xss-data-svg.svg",
      { type: "image/svg+xml" }
    )
    expect((await validateCloudFileBeforeUpload(dataSvgUri)).ok).toBe(false)

    const validSh = new File(
      [new TextEncoder().encode("#!/usr/bin/env bash\necho ok\n")],
      "deploy.sh",
      { type: "application/x-sh" }
    )
    expect(await validateCloudFileBeforeUpload(validSh)).toEqual({ ok: true })
    const validShNoMime = new File([new TextEncoder().encode("echo hi\n")], "run.sh", { type: "" })
    expect(await validateCloudFileBeforeUpload(validShNoMime)).toEqual({ ok: true })

    const elfSpoofedSh = new File(
      [new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0])],
      "evil-elf.sh",
      { type: "text/plain" }
    )
    expect((await validateCloudFileBeforeUpload(elfSpoofedSh)).ok).toBe(false)
    const machoSpoofedSh = new File(
      [new Uint8Array([0xcf, 0xfa, 0xed, 0xfe, 0, 0, 0, 0])],
      "evil-macho.sh",
      { type: "text/plain" }
    )
    expect((await validateCloudFileBeforeUpload(machoSpoofedSh)).ok).toBe(false)
    const peSpoofedSh = new File(
      [new Uint8Array([0x4d, 0x5a, 0x90, 0x00])],
      "evil-pe.sh",
      { type: "text/plain" }
    )
    expect((await validateCloudFileBeforeUpload(peSpoofedSh)).ok).toBe(false)
    const nulSh = new File([new Uint8Array([0x61, 0x00, 0x62])], "nul.sh", { type: "text/plain" })
    expect((await validateCloudFileBeforeUpload(nulSh)).ok).toBe(false)

    // 영어 모드(language = "en") 시그니처·용량·텍스트 검사 오류 메시지 확인
    const enFakePdf = await validateCloudFileBeforeUpload(fakePdf, "en")
    expect(enFakePdf).toEqual({ ok: false, reason: "Invalid PDF file." })
    const enFakeMp4 = await validateCloudFileBeforeUpload(fakeMp4, "en")
    expect(enFakeMp4).toEqual({ ok: false, reason: "Invalid video file." })
    const enXssSvg = await validateCloudFileBeforeUpload(scriptSvg, "en")
    expect(enXssSvg).toEqual({
      ok: false,
      reason: "SVG files containing scripts cannot be uploaded.",
    })
    const enEmpty = await validateCloudFileBeforeUpload(new File([], "empty.txt", { type: "text/plain" }), "en")
    expect(enEmpty).toEqual({ ok: false, reason: "Empty files (0 bytes) cannot be uploaded." })
  })

  test("AdminProfilePersistenceModel이 부분 누락된 SSR workspace.draft를 null-safe하게 정규화하고 이미지 시그니처를 선검증한다", async () => {
    const normalizeWorkspace = (
      AdminProfilePersistenceModel as Record<string, unknown>
    ).normalizeProfileWorkspaceResponseSafe as
      | ((input: unknown) => ReturnType<typeof Object>)
      | undefined

    expect(typeof normalizeWorkspace).toBe("function")
    expect(normalizeWorkspace!(null)).toBeNull()
    expect(normalizeWorkspace!(undefined)).toBeNull()

    const normalized = normalizeWorkspace!({
      draft: {
        blogTitle: "Aquila Tech",
        // aboutSections, aboutProjects, serviceLinks, contactLinks 의도적 누락
      },
      // published 도 누락된 부분 응답 시나리오
      dirtyFromPublished: true,
    }) as {
      draft: {
        blogTitle: string
        aboutSections: unknown[]
        aboutProjects: unknown[]
        serviceLinks: unknown[]
        contactLinks: unknown[]
      }
      published: {
        aboutSections: unknown[]
        aboutProjects: unknown[]
        serviceLinks: unknown[]
        contactLinks: unknown[]
      }
      dirtyFromPublished: boolean
    }

    expect(normalized).not.toBeNull()
    expect(normalized.draft.blogTitle).toBe("Aquila Tech")
    expect(Array.isArray(normalized.draft.aboutSections)).toBe(true)
    expect(Array.isArray(normalized.draft.aboutProjects)).toBe(true)
    expect(Array.isArray(normalized.draft.serviceLinks)).toBe(true)
    expect(Array.isArray(normalized.draft.contactLinks)).toBe(true)
    expect(Array.isArray(normalized.published.aboutSections)).toBe(true)
    expect(normalized.dirtyFromPublished).toBe(true)

    const fakeAvatar = new File([new TextEncoder().encode("not-an-image")], "avatar.png", {
      type: "image/png",
    })
    await expect(AdminProfilePersistenceModel.readImageSourceSizeFromFile(fakeAvatar)).rejects.toThrow()
  })

  test("EditorStudioCloudAssetPicker는 8MB·래스터 이미지 승격만 허용하고 비래스터·초과 이미지·20MB 폴백을 제거한다", async () => {
    const pickerMod = EditorStudioCloudAssetPickerModule as Record<string, unknown>
    expect(pickerMod.MAX_PICKER_FALLBACK_BYTES).toBeUndefined()
    expect(pickerMod.readBoundedResponseBlob).toBeUndefined()
    expect(pickerMod.MAX_POST_PROMOTABLE_IMAGE_BYTES).toBe(8 * 1024 * 1024)

    const checkEligibility = pickerMod.getCloudFilePostPromotionEligibility as (
      file: { mediaKind: "PHOTO" | "VIDEO" | "DOCUMENT"; contentType: string; originalFilename: string; byteSize: number },
      language?: "ko" | "en"
    ) => { promotable: boolean; reason: string | null }

    expect(
      checkEligibility({ mediaKind: "PHOTO", contentType: "image/png", originalFilename: "ok.png", byteSize: 4 * 1024 * 1024 })
    ).toEqual({ promotable: true, reason: null })

    expect(
      checkEligibility({ mediaKind: "PHOTO", contentType: "image/jpeg", originalFilename: "big.jpg", byteSize: 8 * 1024 * 1024 + 1 }).promotable
    ).toBe(false)

    expect(
      checkEligibility({ mediaKind: "PHOTO", contentType: "image/svg+xml", originalFilename: "vec.svg", byteSize: 1024 }).promotable
    ).toBe(false)

    expect(
      checkEligibility({ mediaKind: "DOCUMENT", contentType: "application/pdf", originalFilename: "doc.pdf", byteSize: 1024 }).promotable
    ).toBe(false)

    expect(
      checkEligibility(
        { mediaKind: "PHOTO", contentType: "image/svg+xml", originalFilename: "vec.svg", byteSize: 1024 },
        "ko"
      )
    ).toEqual({ promotable: false, reason: "SVG는 본문에 삽입할 수 없습니다" })
    expect(
      checkEligibility(
        { mediaKind: "PHOTO", contentType: "image/svg+xml", originalFilename: "vec.svg", byteSize: 1024 },
        "en"
      )
    ).toEqual({ promotable: false, reason: "SVG cannot be inserted into posts" })
    expect(
      checkEligibility(
        { mediaKind: "PHOTO", contentType: "image/jpeg", originalFilename: "big.jpg", byteSize: 8 * 1024 * 1024 + 1 },
        "ko"
      )
    ).toEqual({ promotable: false, reason: "8MB 초과 (삽입 불가)" })

    const koDict = getCloudDictionary("ko")
    const enDict = getCloudDictionary("en")
    const koText = Object.values(koDict)
      .filter((v): v is string => typeof v === "string")
      .join("\n")
    const enText = Object.values(enDict)
      .filter((v): v is string => typeof v === "string")
      .join("\n")
    expect(koText).not.toMatch(/승격|피커|래스터|서명|토큰|회수|인스펙터|MIME|에셋/)
    expect(enText).not.toMatch(/promot|raster|signed|token|inspector|mime/i)
    expect(koDict.pickerHeading).toBe("클라우드 사진 삽입")
    expect(koDict.pickerPromotableOnly).toBe("삽입 가능한 사진만")
    expect(koDict.pickerAllFolders).toBe("전체 폴더")
    expect(enDict.pickerHeading).toBe("Insert Cloud Photo")
    expect(enDict.pickerPromotableOnly).toBe("Insertable only")

    const koSigText = Object.values(getCloudSignatureMessages("ko"))
      .filter((v): v is string => typeof v === "string")
      .join("\n")
    expect(koSigText).not.toMatch(/시그니처|바이너리|NUL|루트 태그/)

    const buildSnippet = pickerMod.buildCloudAssetMarkdownSnippet as (
      file: { mediaKind: "PHOTO" | "VIDEO" | "DOCUMENT"; contentType: string; originalFilename: string },
      url?: string
    ) => string
    expect(
      buildSnippet(
        { mediaKind: "PHOTO", contentType: "image/png", originalFilename: "a[1]\\b.png" },
        "https://cdn.example.com/a.png"
      )
    ).toBe("![a\\[1\\]\\\\b.png](https://cdn.example.com/a.png)")
  })

  test("AdminToolsOpsOverview 바 차트 빌더가 부분 누락된 스냅샷을 안전하게 처리하고 0건 막대를 0%·기준선으로 계산한다", () => {
    const partialSnapshot = {
      taskQueue: {
        readyPendingCount: 5,
        processingCount: 0,
        failedCount: 2,
        staleProcessingCount: 0,
      },
      // storageCleanup, authSecurity 의도적 누락
    } as unknown as Parameters<typeof buildToolsOpsBars>[0]["dashboardSnapshot"]

    const bars = buildToolsOpsBars({
      dashboardSnapshot: partialSnapshot,
      taskQueueDiagnostics: null,
      cleanupDiagnostics: null,
      authSecurityEvents: [],
    })

    expect(bars.length).toBe(7)
    const processingBar = bars.find((b) => b.key === "processing")
    const failedBar = bars.find((b) => b.key === "failed")
    const purgeBar = bars.find((b) => b.key === "purge")

    expect(processingBar).toMatchObject({ value: 0, height: 0, isZero: true })
    expect(failedBar).toMatchObject({ value: 2, isZero: false, tone: "danger" })
    expect(purgeBar).toMatchObject({ value: 0, height: 0, isZero: true, tone: "good" })

    expect(formatOperationPollingStatus(true, 1, 8)).toContain("1/8")
    expect(formatOperationPollingStatus(false, 3, 8)).toContain("3/8")
    expect(formatOperationPollingStatus(false, 8, 8)).toContain("8/8")
  })

  test("AdminToolsDiagnosticsSection과 AdminToolsExecutionSection이 배열 필드가 누락된 부분 진단 응답에서도 크래시 없이 방어한다", async () => {
    const fs = await import("node:fs")
    const path = await import("node:path")
    const diagSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/routes/Admin/AdminToolsDiagnosticsSection.tsx"),
      "utf8"
    )
    const execSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/routes/Admin/AdminToolsExecutionSection.tsx"),
      "utf8"
    )
    expect(diagSource).toContain("Array.isArray(taskQueueDiagnostics?.taskTypes)")
    expect(diagSource).toContain("Array.isArray(taskQueueDiagnostics?.recentFailures)")
    expect(execSource).toContain("Array.isArray(cleanupDiagnostics?.sampleEligibleObjectKeys)")
    expect(execSource).toContain("Array.isArray(authSecurityEvents)")
    expect(formatRetryPolicy(undefined)).toBe("-")
    expect(formatRetryPolicy({ maxRetries: 5, baseDelaySeconds: 10, maxDelaySeconds: 300 })).toBe(
      "5회 / 10초 시작 / x2.0 / 최대 300초"
    )
  })

  test("parseSvgDimensionsFromMarkup과 getStrapiAssetIcon이 SVG 치수(viewBox·px·상한 차단) 및 포맷별 원본 아이콘을 정확히 판별한다", () => {
    expect(
      parseSvgDimensionsFromMarkup('<?xml version="1.0"?><!-- hdr --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect/></svg>')
    ).toEqual({ width: 640, height: 400 })
    expect(
      parseSvgDimensionsFromMarkup('<svg width="100%" height="100%" viewBox="0, 0, 1280, 720"></svg>')
    ).toEqual({ width: 1280, height: 720 })
    expect(
      parseSvgDimensionsFromMarkup('<svg width="320px" height="180px" viewBox="0 0 16 9"></svg>')
    ).toEqual({ width: 320, height: 180 })

    // 악의적 입력 Fail-Closed: 256KB 초과, NUL 바이트 포함, 비정상 음수/초과 치수 거부
    expect(parseSvgDimensionsFromMarkup(`<svg viewBox="0 0 100 100">${"a".repeat(MAX_SVG_MARKUP_BYTES)}</svg>`)).toBeNull()
    expect(parseSvgDimensionsFromMarkup('<svg viewBox="0 0 100 100">\0</svg>')).toBeNull()
    expect(parseSvgDimensionsFromMarkup('<svg viewBox="0 0 -100 200"></svg>')).toBeNull()

    // Strapi getAssetIcon 포맷별 매핑 검증
    expect(getStrapiAssetIcon("image/svg+xml", "arch.svg")).toBe(StrapiImageIcon)
    expect(getStrapiAssetIcon("video/mp4", "demo.mp4")).toBe(StrapiPlayIcon)
    expect(getStrapiAssetIcon("audio/mpeg", "voice.mp3")).toBe(StrapiHeadphonesIcon)
    expect(getStrapiAssetIcon("application/pdf", "spec.pdf")).toBe(StrapiFilePdfIcon)
    expect(getStrapiAssetIcon("text/markdown", "readme.md")).toBe(StrapiFileCodeIcon)
  })

  test("useAdminCloudUploadQueue는 비사용자 abort와 명시적 취소, 언마운트 완료 알림을 구분해 처리한다", async () => {
    const LanguageProvider = wrapPlaywrightJsxComponent(RawLanguageProvider) as ComponentType<{
      initialLanguage?: "ko" | "en"
      children?: unknown
    }>
    const prevXhr = (globalThis as Record<string, unknown>).XMLHttpRequest
    const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")

    type MockXhrInstance = {
      upload: { onprogress: ((ev: { loaded: number; total: number; lengthComputable: boolean }) => void) | null }
      onload: (() => void) | null
      onerror: (() => void) | null
      ontimeout: (() => void) | null
      onabort: (() => void) | null
      status: number
      responseText: string
      timeout: number
      withCredentials: boolean
      open: (method: string, url: string, asyncFlag: boolean) => void
      setRequestHeader: (k: string, v: string) => void
      getResponseHeader: (k: string) => string | null
      send: (body: unknown) => void
      abort: () => void
    }
    const xhrInstances: MockXhrInstance[] = []
    class MockXMLHttpRequest implements MockXhrInstance {
      upload = { onprogress: null }
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      ontimeout: (() => void) | null = null
      onabort: (() => void) | null = null
      status = 201
      responseText = ""
      timeout = 0
      withCredentials = false
      open() {}
      setRequestHeader() {}
      getResponseHeader() {
        return null
      }
      send() {
        xhrInstances.push(this)
      }
      abort() {
        this.onabort?.()
      }
    }

    ;(globalThis as Record<string, unknown>).XMLHttpRequest = MockXMLHttpRequest
    try {
      await withWindowStorage(async () => {
        Object.defineProperty(globalThis, "document", {
          configurable: true,
          writable: true,
          value: (globalThis as unknown as { window: { document: unknown } }).window.document,
        })
        Object.assign((globalThis as unknown as { document: Record<string, unknown> }).document, {
          documentElement: { lang: "ko-KR" },
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        })
        const runScenario = async (language: "ko" | "en") => {
          xhrInstances.length = 0
          const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
          const notices: string[] = []
          const successes: number[] = []
          let queueApi!: ReturnType<typeof useAdminCloudUploadQueue>

          const Probe = () => {
            queueApi = useAdminCloudUploadQueue({
              activeFolderPath: "",
              onUploadSuccess: (file) => successes.push(file.id),
              onNotice: (msg) => notices.push(msg),
              onToast: () => {},
            })
            return null
          }

          const root = createRoot(createMinimalRootContainer() as unknown as Element)
          await act(async () => {
            root.render(
              createElement(
                QueryClientProvider,
                { client: queryClient },
                createElement(
                  LanguageProvider,
                  { initialLanguage: language },
                  createElement(Probe)
                )
              )
            )
          })

          const scriptFile = new File([new TextEncoder().encode("#!/bin/sh\necho hi\n")], "deploy.sh", {
            type: "text/plain",
          })

          // 1) 비사용자 abort (!isExplicitUserCancel && aborted) -> 일시 중단 notice
          await act(async () => {
            await queueApi.queueUploadFiles([scriptFile])
          })
          await act(async () => {
            await Promise.resolve()
          })
          expect(xhrInstances.length).toBe(1)
          await act(async () => {
            xhrInstances[0]!.onabort?.()
            await Promise.resolve()
          })
          if (language === "ko") {
            expect(notices.at(-1)).toBe("deploy.sh 업로드 일시 중단")
            expect(queueApi.uploadQueue[0]?.message).toBe("전송 일시 중단됨")
          } else {
            expect(notices.at(-1)).toBe("deploy.sh upload paused")
            expect(queueApi.uploadQueue[0]?.message).toBe("Paused on navigation")
          }
          expect(queueApi.uploadQueue[0]?.status).toBe("cancelled")

          // 2) 명시적 사용자 취소 (handleCancelUpload) -> 취소 notice
          await act(async () => {
            await queueApi.queueUploadFiles([scriptFile])
          })
          await act(async () => {
            await Promise.resolve()
          })
          expect(xhrInstances.length).toBe(2)
          await act(async () => {
            queueApi.handleCancelUpload(queueApi.uploadQueue[1]!)
            await Promise.resolve()
          })
          if (language === "ko") {
            expect(notices.at(-1)).toBe("deploy.sh 업로드 취소")
            expect(queueApi.uploadQueue[1]?.message).toBe("사용자가 취소함")
          } else {
            expect(notices.at(-1)).toBe("deploy.sh upload cancelled")
            expect(queueApi.uploadQueue[1]?.message).toBe("Cancelled by user")
          }

          // 3) 대기(queued) 중 취소 -> 재시도 후 비사용자 abort 시 취소 오분류 방지
          const queuedFiles = [1, 2, 3, 4].map(
            (idx) =>
              new File([new TextEncoder().encode(`echo ${idx}\n`)], `batch-${idx}.sh`, {
                type: "text/plain",
              })
          )
          await act(async () => {
            await queueApi.queueUploadFiles(queuedFiles)
          })
          await act(async () => {
            await Promise.resolve()
          })
          // 동시성 3이므로 4번째 항목은 queued 상태
          const fourthItem = queueApi.uploadQueue.find((item) => item.name === "batch-4.sh")!
          expect(fourthItem.status).toBe("queued")
          await act(async () => {
            queueApi.handleCancelUpload(fourthItem)
            await Promise.resolve()
          })
          // 1..3 완료/abort 시켜 슬롯 비우기
          for (const xhr of xhrInstances.slice(2, 5)) {
            await act(async () => {
              xhr.onabort?.()
              await Promise.resolve()
            })
          }
          const cancelledFourth = queueApi.uploadQueue.find((item) => item.name === "batch-4.sh")!
          await act(async () => {
            queueApi.handleRetryUpload(cancelledFourth)
            await Promise.resolve()
          })
          await act(async () => {
            await Promise.resolve()
          })
          const retriedXhr = xhrInstances.at(-1)!
          await act(async () => {
            retriedXhr.onabort?.()
            await Promise.resolve()
          })
          const retriedFourth = queueApi.uploadQueue.find((item) => item.name === "batch-4.sh")!
          if (language === "ko") {
            expect(notices.at(-1)).toBe("batch-4.sh 업로드 일시 중단")
            expect(retriedFourth.message).toBe("전송 일시 중단됨")
          } else {
            expect(notices.at(-1)).toBe("batch-4.sh upload paused")
            expect(retriedFourth.message).toBe("Paused on navigation")
          }

          // 4) 언마운트 시 완료·중단 콜백 미호출
          await act(async () => {
            await queueApi.queueUploadFiles([scriptFile])
          })
          await act(async () => {
            await Promise.resolve()
          })
          const noticeCountBeforeUnmount = notices.length
          await act(async () => {
            root.unmount()
            await Promise.resolve()
          })
          expect(notices.length).toBe(noticeCountBeforeUnmount)
          expect(successes).toEqual([])
        }

        await runScenario("ko")
        await runScenario("en")
      })
    } finally {
      ;(globalThis as Record<string, unknown>).XMLHttpRequest = prevXhr
      if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc)
      else delete (globalThis as Record<string, unknown>).document
    }
  })
})
