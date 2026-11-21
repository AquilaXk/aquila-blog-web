// 참조 구현: strapi/strapi (MIT), transloadit/uppy (MIT), TryGhost/Ghost (MIT), felixmosh/bull-board (MIT)
import { expect, test } from "@playwright/test"
import { validateCloudFileBeforeUpload } from "../../src/routes/Admin/cloudFileSignatureGuard"
import { MAX_SVG_MARKUP_BYTES, parseSvgDimensionsFromMarkup } from "../../src/routes/Admin/AdminCloudWorkspaceModel"
import { getStrapiAssetIcon, StrapiFileCodeIcon, StrapiFilePdfIcon, StrapiHeadphonesIcon, StrapiImageIcon, StrapiPlayIcon } from "../../src/routes/Admin/adminStrapiIcons"
import * as AdminProfilePersistenceModel from "../../src/routes/Admin/AdminProfilePersistenceModel"
import * as EditorStudioCloudAssetPickerModule from "../../src/routes/Admin/EditorStudioCloudAssetPicker"
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

  test("EditorStudioCloudAssetPicker 폴백 다운로드 바이트 예산 가드가 20MB 초과 응답을 Fail-Closed로 차단한다", async () => {
    const pickerMod = EditorStudioCloudAssetPickerModule as Record<string, unknown>
    const maxBytes = pickerMod.MAX_PICKER_FALLBACK_BYTES as number | undefined
    const assertBudget = pickerMod.assertCloudPickerFallbackByteBudget as
      | ((declaredBytes: number, contentLengthHeader?: string | null) => void)
      | undefined
    const readBoundedBlob = pickerMod.readBoundedResponseBlob as
      | ((response: Response, maxBudget?: number, declaredBytes?: number) => Promise<Blob>)
      | undefined

    expect(maxBytes).toBe(20 * 1024 * 1024)
    expect(typeof assertBudget).toBe("function")
    expect(typeof readBoundedBlob).toBe("function")

    // 1. 선언된 파일 크기가 20MB 초과일 때 즉시 거부
    expect(() => assertBudget!(20 * 1024 * 1024 + 1, null)).toThrow()

    // 2. Content-Length 헤더가 20MB 초과일 때 즉시 거부
    expect(() => assertBudget!(1024, String(20 * 1024 * 1024 + 512))).toThrow()

    // 3. Content-Length가 없더라도 스트림 누적 바이트가 상한을 넘는 순간 취소·거부하고 후속 청크를 읽지 않음
    let pulledChunks = 0
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulledChunks += 1
        controller.enqueue(new Uint8Array(1024))
      },
      cancel() {
        cancelled = true
      },
    })
    const oversizedStreamRes = new Response(stream, {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
    })
    await expect(readBoundedBlob!(oversizedStreamRes, 1500, 0)).rejects.toThrow()
    expect(cancelled).toBe(true)
    expect(pulledChunks).toBeLessThanOrEqual(3)

    // 4. 예산 이내의 정상 응답은 Blob으로 안전하게 읽음
    const validRes = new Response(new Uint8Array([1, 2, 3, 4, 5]), {
      status: 200,
      headers: { "content-type": "image/png", "content-length": "5" },
    })
    const blob = await readBoundedBlob!(validRes, maxBytes, 5)
    expect(blob.size).toBe(5)
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
})
