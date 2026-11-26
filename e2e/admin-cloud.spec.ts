import { expect, test, type Page, type Route } from "@playwright/test"
import { writeFileSync } from "node:fs"
import {
  MAX_SVG_MARKUP_BYTES,
  parseSvgDimensionsFromMarkup,
} from "../src/routes/Admin/AdminCloudWorkspaceModel"

const ADMIN_MEMBER = {
  id: 1,
  username: "qa-admin",
  nickname: "QA Admin",
  isAdmin: true,
  blogTitle: "AquilaLog",
}

type CloudFileFixture = {
  id: number
  ownerMemberId: number
  originalFilename: string
  contentType: string
  byteSize: number
  mediaKind: "DOCUMENT" | "PHOTO" | "VIDEO"
  folderPath: string
  createdAt: string
  modifiedAt: string
}

const CLOUD_FILES: CloudFileFixture[] = [
  {
    id: 101,
    ownerMemberId: 1,
    originalFilename: "운영 점검 리포트.pdf",
    contentType: "application/pdf",
    byteSize: 245_760,
    mediaKind: "DOCUMENT",
    folderPath: "/ops",
    createdAt: "2026-06-12T09:00:00Z",
    modifiedAt: "2026-06-12T09:00:00Z",
  },
  {
    id: 102,
    ownerMemberId: 1,
    originalFilename: "home-server-rack.png",
    contentType: "image/png",
    byteSize: 142_336,
    mediaKind: "PHOTO",
    folderPath: "/photos",
    createdAt: "2026-06-12T10:00:00Z",
    modifiedAt: "2026-06-12T10:00:00Z",
  },
  {
    id: 103,
    ownerMemberId: 1,
    originalFilename: "deploy-walkthrough.mp4",
    contentType: "video/mp4",
    byteSize: 8_388_608,
    mediaKind: "VIDEO",
    folderPath: "/video",
    createdAt: "2026-06-12T11:00:00Z",
    modifiedAt: "2026-06-12T11:00:00Z",
  },
  {
    id: 104,
    ownerMemberId: 1,
    originalFilename: "[첨부1] NCS기반 채용 직무설명자료_2026년 제3회 식약처 공무원(일반직) 경력경쟁채용시험 공고문_게시.pdf",
    contentType: "application/pdf",
    byteSize: 1_004_544,
    mediaKind: "DOCUMENT",
    folderPath: "/",
    createdAt: "2026-06-13T02:20:00Z",
    modifiedAt: "2026-06-13T02:20:00Z",
  },
]

const pixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBAp6pW2kAAAAASUVORK5CYII=",
  "base64"
)

const buildMinimalTwoPagePdf = () => {
  const objects = [
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Count 2/Kids[3 0 R 6 0 R]>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 220 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    "4 0 obj<</Length 48>>stream\nBT /F1 18 Tf 24 68 Td (Aquila PDF Preview) Tj ET\nendstream endobj",
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "6 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 220 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
  ]
  let body = "%PDF-1.4\n"
  const offsets: number[] = []
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, "utf8"))
    body += `${obj}\n`
  }
  const xrefOffset = Buffer.byteLength(body, "utf8")
  const xrefLines = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    `trailer<</Root 1 0 R/Size ${objects.length + 1}>>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ]
  return Buffer.from(`${body}${xrefLines.join("\n")}`, "utf8")
}

const minimalPdf = buildMinimalTwoPagePdf()

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

const getUploadName = (route: Route) => {
  const body = route.request().postDataBuffer()
  const bodyText = body?.toString("utf8") ?? ""
  return bodyText.match(/filename="([^"]+)"/)?.[1] ?? "uploaded.pdf"
}

const getUploadTextField = (route: Route, fieldName: string) => {
  const body = route.request().postDataBuffer()
  const bodyText = body?.toString("utf8") ?? ""
  const match = bodyText.match(new RegExp(`name="${fieldName}"\\r?\\n\\r?\\n([^\\r\\n]*)`))
  return match?.[1] ?? ""
}

const getUploadFileMetadata = (name: string) => {
  const lowerName = name.toLowerCase()
  if (lowerName.endsWith(".svg")) {
    return { contentType: "image/svg+xml", mediaKind: "PHOTO" as const }
  }
  if (lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return { contentType: "image/png", mediaKind: "PHOTO" as const }
  }
  if (lowerName.endsWith(".mp4") || lowerName.endsWith(".mov")) {
    return { contentType: "video/mp4", mediaKind: "VIDEO" as const }
  }
  return { contentType: "application/pdf", mediaKind: "DOCUMENT" as const }
}

const normalizeFolderPathParam = (value: string) => value.trim().replace(/^\/+|\/+$/g, "")

const expectPdfPreviewFitsDetailPanel = async (page: Page, previewName: string | RegExp) => {
  await expect
    .poll(async () => {
      const detailPanelBox = await page.getByLabel("클라우드 상세정보").boundingBox()
      const pdfCanvasBox = await page.getByLabel(previewName).boundingBox()
      if (!detailPanelBox || !pdfCanvasBox) return false
      return pdfCanvasBox.width <= detailPanelBox.width
    })
    .toBe(true)
}

const setupAdminCloudMocks = async (
  page: Page,
  options: {
    contentDelayMs?: number
    failDeleteIds?: string[]
    failList?: boolean
    failUploadStatusByName?: Record<string, number>
    failUploadOnceNames?: string[]
    failUploadNames?: string[]
    failVideoPartOnceNumber?: number
    failVideoPartFailureCounts?: Record<number, number>
    failVideoSessionGetOnceStatus?: number
    externalPlaybackTokenDelayMs?: number
    externalPlaybackTokensListDelayMsByFileId?: Record<string, number>
    initialFiles?: CloudFileFixture[]
    initialPlaybackTokensByFileId?: Record<
      string,
      Array<{ id: number; fileId: number; purpose: "EXTERNAL_PLAYBACK"; createdAt: string; expiresAt: string }>
    >
    initialShareTokensByFileId?: Record<
      string,
      Array<{ id: number; fileId: number; purpose: "SHARE_LINK"; createdAt: string; expiresAt: string }>
    >
    invalidPdfIds?: string[]
    listDelayMs?: number
    lookupOnlyFiles?: CloudFileFixture[]
    normalizeVideoSessionFilename?: boolean
    shareIssueDelayMsByFileId?: Record<string, number>
    shareLinksDelayMsByFileId?: Record<string, number>
    svgBodiesById?: Record<string, string>
    uploadResponseFilenames?: Record<string, string>
    videoCompletedFileId?: number
    videoSessionStatus?: "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "EXPIRED"
  } = {}
) => {
  const requestedKinds: string[] = []
  const requestedFolderPaths: string[] = []
  const uploadedNames: string[] = []
  const uploadedFolderPaths: string[] = []
  const uploadedClientFilenames: string[] = []
  const videoSessionCreates: string[] = []
  const videoSessionGets: string[] = []
  const videoPartNumbers: number[] = []
  const videoCompletes: string[] = []
  const videoCancels: string[] = []
  const deletedIds: string[] = []
  const requestedContentIds: string[] = []
  const requestedThumbnailIds: string[] = []
  const externalPlaybackTokenRequests: string[] = []
  const shareLinkRequests: Array<{ fileId: string; ttlSeconds: number }> = []
  const revokedShareLinkIds: number[] = []
  const bulkDeletedBatches: number[][] = []
  const shareTokensByFileId = new Map<
    string,
    Array<{ id: number; fileId: number; purpose: "SHARE_LINK"; createdAt: string; expiresAt: string }>
  >(Object.entries(options.initialShareTokensByFileId ?? {}).map(([k, v]) => [k, v.map((item) => ({ ...item }))]))
  const playbackTokensByFileId = new Map<
    string,
    Array<{ id: number; fileId: number; purpose: "EXTERNAL_PLAYBACK"; createdAt: string; expiresAt: string }>
  >(Object.entries(options.initialPlaybackTokensByFileId ?? {}).map(([k, v]) => [k, v.map((item) => ({ ...item }))]))
  const uploadedFiles: CloudFileFixture[] = []
  const failedDeleteIds = new Set(options.failDeleteIds ?? [])
  const failedUploadNames = new Set(options.failUploadNames ?? [])
  const failUploadOnceNames = new Set(options.failUploadOnceNames ?? [])
  const invalidPdfIds = new Set(options.invalidPdfIds ?? [])
  const failedVideoPartOnceNumbers = new Set<number>()
  const remainingVideoPartFailures = new Map<number, number>(
    Object.entries(options.failVideoPartFailureCounts ?? {}).map(([k, v]) => [Number(k), v])
  )
  let didFailVideoSessionGet = false
  let nextTokenId = 9001
  const initialFiles = (options.initialFiles ?? CLOUD_FILES).map((item) => ({ ...item }))
  const lookupOnlyFiles = (options.lookupOnlyFiles ?? []).map((item) => ({ ...item }))
  let videoSessionFilename = "대용량 교육 영상.mp4"
  let videoSessionByteSize = 101 * 1024 * 1024
  let nextUploadId = 204

  await page.route("**/_next/image**", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: pixelPng })
  })

  await page.route("**/member/api/v1/auth/me", (route) => fulfillJson(route, ADMIN_MEMBER))

  await page.route("**/system/api/v1/adm/cloud/files/video-upload-sessions**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const sessionMatch = url.pathname.match(/\/video-upload-sessions\/(\d+)/)
    const sessionId = sessionMatch?.[1] ?? "301"
    const sessionBody = {
      id: Number(sessionId),
      ownerMemberId: 1,
      originalFilename: videoSessionFilename,
      contentType: "video/mp4",
      byteSize: videoSessionByteSize,
      folderPath: "/",
      partSizeBytes: 67_108_864,
      totalParts: 2,
      uploadedParts: videoPartNumbers,
      status: options.videoSessionStatus ?? "IN_PROGRESS",
      expiresAt: "2026-06-13T12:00:00Z",
      completedFileId: options.videoCompletedFileId ?? null,
    }

    if (request.method() === "POST" && url.pathname.endsWith("/video-upload-sessions")) {
      const payload = JSON.parse(request.postData() || "{}") as { originalFilename?: string; byteSize?: number }
      videoSessionCreates.push(payload.originalFilename || "")
      videoSessionFilename = payload.originalFilename || videoSessionFilename
      if (options.normalizeVideoSessionFilename) {
        videoSessionFilename = videoSessionFilename.normalize("NFC")
      }
      videoSessionByteSize = payload.byteSize || videoSessionByteSize
      await fulfillJson(
        route,
        {
          resultCode: "201-1",
          msg: "created",
          data: { ...sessionBody, originalFilename: videoSessionFilename, byteSize: videoSessionByteSize },
        },
        201
      )
      return
    }

    if (request.method() === "GET" && sessionMatch) {
      videoSessionGets.push(sessionId)
      if (options.failVideoSessionGetOnceStatus && !didFailVideoSessionGet) {
        didFailVideoSessionGet = true
        await fulfillJson(
          route,
          { resultCode: `${options.failVideoSessionGetOnceStatus}-1`, msg: "temporary session lookup failure" },
          options.failVideoSessionGetOnceStatus
        )
        return
      }
      await fulfillJson(route, {
        ...sessionBody,
        originalFilename: videoSessionFilename,
        byteSize: videoSessionByteSize,
        uploadedParts: [...videoPartNumbers],
      })
      return
    }

    if (request.method() === "PUT" && url.pathname.includes("/parts/")) {
      const partNumber = Number(url.pathname.match(/\/parts\/(\d+)$/)?.[1] || 0)
      const remainingFailures = remainingVideoPartFailures.get(partNumber) ?? 0
      if (remainingFailures > 0) {
        remainingVideoPartFailures.set(partNumber, remainingFailures - 1)
        await fulfillJson(route, { msg: "transient video part failure" }, 503)
        return
      }
      if (
        options.failVideoPartOnceNumber === partNumber &&
        !failedVideoPartOnceNumbers.has(partNumber)
      ) {
        failedVideoPartOnceNumbers.add(partNumber)
        await fulfillJson(route, { msg: "transient video part failure" }, 503)
        return
      }
      videoPartNumbers.push(partNumber)
      const byteSize = request.postDataBuffer()?.byteLength ?? 0
      await fulfillJson(route, {
        session: { ...sessionBody, uploadedParts: [...videoPartNumbers] },
        part: { partNumber, byteSize },
      })
      return
    }

    if (request.method() === "POST" && url.pathname.endsWith("/complete")) {
      videoCompletes.push(sessionId)
      const uploaded = {
        id: nextUploadId++,
        ownerMemberId: 1,
        originalFilename: videoSessionFilename,
        contentType: "video/mp4",
        byteSize: videoSessionByteSize,
        mediaKind: "VIDEO" as const,
        folderPath: "/",
        createdAt: "2026-06-12T12:00:00Z",
        modifiedAt: "2026-06-12T12:00:00Z",
      }
      uploadedFiles.unshift(uploaded)
      await fulfillJson(route, { resultCode: "200-1", msg: "completed", data: uploaded })
      return
    }

    if (request.method() === "DELETE" && sessionMatch) {
      videoCancels.push(sessionId)
      await fulfillJson(route, { resultCode: "200-1", msg: "cancelled" })
      return
    }

    await route.fallback()
  })

  await page.route("**/system/api/v1/adm/cloud/files/*/external-playback-tokens**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const match = url.pathname.match(/\/files\/(\d+)\/external-playback-tokens(?:\/(\d+))?$/)
    const fileId = match?.[1] ?? ""
    const tokenId = match?.[2] ? Number(match[2]) : null
    const method = request.method()
    const currentTokens = playbackTokensByFileId.get(fileId) ?? []
    if (method === "GET") {
      const tokenListDelay = options.externalPlaybackTokensListDelayMsByFileId?.[fileId]
      if (tokenListDelay) await delay(tokenListDelay)
      await fulfillJson(route, { tokens: currentTokens })
      return
    }
    if (method === "DELETE" && tokenId !== null) {
      playbackTokensByFileId.set(
        fileId,
        currentTokens.filter((item) => item.id !== tokenId)
      )
      await fulfillJson(route, { resultCode: "200-1", msg: "revoked" })
      return
    }
    if (method === "DELETE") {
      const revokedCount = currentTokens.length
      playbackTokensByFileId.set(fileId, [])
      await fulfillJson(route, { resultCode: "200-1", msg: "revoked", data: { revokedCount } })
      return
    }
    await route.fallback()
  })

  await page.route("**/system/api/v1/adm/cloud/files/*/external-playback-token", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const id = url.pathname.match(/\/files\/(\d+)\/external-playback-token$/)?.[1] ?? ""
    if (request.method() !== "POST" || !id) {
      await route.fallback()
      return
    }

    externalPlaybackTokenRequests.push(id)
    if (options.externalPlaybackTokenDelayMs) {
      await delay(options.externalPlaybackTokenDelayMs)
    }
    const tokenId = nextTokenId++
    const current = playbackTokensByFileId.get(id) ?? []
    current.unshift({
      id: tokenId,
      fileId: Number(id),
      purpose: "EXTERNAL_PLAYBACK",
      createdAt: "2026-06-26T06:00:00Z",
      expiresAt: "2026-06-26T12:05:00Z",
    })
    playbackTokensByFileId.set(id, current)
    await fulfillJson(
      route,
      {
        resultCode: "201-1",
        msg: "외부 재생 token이 발급되었습니다.",
        data: {
          fileId: Number(id),
          token: `external-token-${id}`,
          expiresAt: "2026-06-26T12:05:00Z",
          contentPath: `/system/api/v1/adm/cloud/files/${id}/external-content?token=external-token-${id}`,
        },
      },
      201
    )
  })

  await page.route("**/system/api/v1/adm/cloud/files/**", async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const id = url.pathname.match(/\/files\/(\d+)$/)?.[1] ?? ""
    if (url.pathname.includes("/video-upload-sessions")) {
      await route.fallback()
      return
    }
    if (
      url.pathname.includes("/external-playback-token") ||
      url.pathname.includes("/share-links") ||
      url.pathname.endsWith("/thumbnail")
    ) {
      await route.fallback()
      return
    }

    if (method === "GET" && id) {
      const file = [...uploadedFiles, ...lookupOnlyFiles, ...initialFiles].find((item) => String(item.id) === id)
      if (!file) {
        await fulfillJson(route, { resultCode: "404-1", msg: "클라우드 파일을 찾을 수 없습니다." }, 404)
        return
      }
      await fulfillJson(route, file)
      return
    }

    if (method === "PATCH" && id) {
      const target = [...uploadedFiles, ...lookupOnlyFiles, ...initialFiles].find((item) => String(item.id) === id)
      if (!target) {
        await fulfillJson(route, { resultCode: "404-1", msg: "클라우드 파일을 찾을 수 없습니다." }, 404)
        return
      }
      const payload = JSON.parse(request.postData() || "{}") as { originalFilename?: string; folderPath?: string }
      if (typeof payload.originalFilename === "string" && payload.originalFilename.trim()) {
        target.originalFilename = payload.originalFilename.trim()
      }
      if (typeof payload.folderPath === "string") {
        const normalizedFolder = normalizeFolderPathParam(payload.folderPath)
        target.folderPath = normalizedFolder
      }
      target.modifiedAt = "2026-06-13T09:00:00Z"
      await fulfillJson(route, {
        resultCode: "200-1",
        msg: "클라우드 파일 정보가 수정되었습니다.",
        data: target,
      })
      return
    }

    if (method === "DELETE" && id) {
      if (failedDeleteIds.has(id)) {
        await fulfillJson(route, { resultCode: "500-1", msg: "클라우드 파일 삭제에 실패했습니다." }, 500)
        return
      }
      deletedIds.push(id)
      await fulfillJson(route, { resultCode: "200-1", msg: "클라우드 파일이 삭제되었습니다." })
      return
    }

    await route.fallback()
  })

  await page.route("**/system/api/v1/adm/cloud/files**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const id = url.pathname.match(/\/files\/(\d+)$/)?.[1] ?? ""
    if (url.pathname.includes("/video-upload-sessions")) {
      await route.fallback()
      return
    }
    if (
      url.pathname.includes("/external-playback-token") ||
      url.pathname.includes("/share-links") ||
      url.pathname.endsWith("/thumbnail")
    ) {
      await route.fallback()
      return
    }
    const mediaKind = url.searchParams.get("mediaKind") || "ALL"
    const folderPath = normalizeFolderPathParam(url.searchParams.get("folderPath") || "")

    if (url.pathname.endsWith("/files/facets") && request.method() === "GET") {
      const activeFiles = [...uploadedFiles, ...initialFiles].filter((file) => !deletedIds.includes(String(file.id)))
      const sumByKind = (kind: string) => {
        const subset = activeFiles.filter((file) => file.mediaKind === kind)
        return { count: subset.length, bytes: subset.reduce((acc, file) => acc + file.byteSize, 0) }
      }
      const folders = Array.from(
        new Set(activeFiles.map((file) => normalizeFolderPathParam(file.folderPath)).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b))
      const photo = sumByKind("PHOTO")
      const video = sumByKind("VIDEO")
      const doc = sumByKind("DOCUMENT")
      await fulfillJson(route, {
        allCount: activeFiles.length,
        allBytes: activeFiles.reduce((acc, file) => acc + file.byteSize, 0),
        photoCount: photo.count,
        photoBytes: photo.bytes,
        videoCount: video.count,
        videoBytes: video.bytes,
        documentCount: doc.count,
        documentBytes: doc.bytes,
        folders,
      })
      return
    }

    if (url.pathname.endsWith("/files/bulk-delete") && request.method() === "POST") {
      const payload = JSON.parse(request.postData() || "{}") as { ids?: number[] }
      const requestedIds = Array.isArray(payload.ids) ? payload.ids : []
      bulkDeletedBatches.push(requestedIds.map(Number))
      const succeededNumericIds: number[] = []
      for (const rawId of requestedIds) {
        const strId = String(rawId)
        if (!failedDeleteIds.has(strId)) {
          deletedIds.push(strId)
          succeededNumericIds.push(Number(rawId))
        }
      }
      if (requestedIds.length > 0 && succeededNumericIds.length === 0) {
        await fulfillJson(route, { resultCode: "500-1", msg: "클라우드 파일 삭제에 실패했습니다." }, 500)
        return
      }
      await fulfillJson(route, {
        resultCode: "200-1",
        msg: "선택한 클라우드 파일이 삭제되었습니다.",
        data: { deletedIds: succeededNumericIds, deletedCount: succeededNumericIds.length },
      })
      return
    }

    if (request.method() === "GET" && id) {
      const file = [...uploadedFiles, ...lookupOnlyFiles, ...initialFiles].find((item) => String(item.id) === id)
      if (!file) {
        await fulfillJson(route, { resultCode: "404-1", msg: "클라우드 파일을 찾을 수 없습니다." }, 404)
        return
      }
      await fulfillJson(route, file)
      return
    }

    if (request.method() === "PATCH" && id) {
      const target = [...uploadedFiles, ...lookupOnlyFiles, ...initialFiles].find((item) => String(item.id) === id)
      if (!target) {
        await fulfillJson(route, { resultCode: "404-1", msg: "클라우드 파일을 찾을 수 없습니다." }, 404)
        return
      }
      const payload = JSON.parse(request.postData() || "{}") as { originalFilename?: string; folderPath?: string }
      if (typeof payload.originalFilename === "string" && payload.originalFilename.trim()) {
        target.originalFilename = payload.originalFilename.trim()
      }
      if (typeof payload.folderPath === "string") {
        const normalizedFolder = normalizeFolderPathParam(payload.folderPath)
        target.folderPath = normalizedFolder
      }
      target.modifiedAt = "2026-06-13T09:00:00Z"
      await fulfillJson(route, {
        resultCode: "200-1",
        msg: "클라우드 파일 정보가 수정되었습니다.",
        data: target,
      })
      return
    }

    if (request.method() === "DELETE" && id) {
      if (failedDeleteIds.has(id)) {
        await fulfillJson(route, { resultCode: "500-1", msg: "클라우드 파일 삭제에 실패했습니다." }, 500)
        return
      }
      deletedIds.push(id)
      await fulfillJson(route, { resultCode: "200-1", msg: "클라우드 파일이 삭제되었습니다." })
      return
    }

    if (request.method() === "POST") {
      const uploadedName = getUploadName(route)
      const clientFilename = getUploadTextField(route, "clientFilename")
      const metadata = getUploadFileMetadata(uploadedName)

      if (failedUploadNames.has(uploadedName) || failUploadOnceNames.has(uploadedName)) {
        failUploadOnceNames.delete(uploadedName)
        const status = options.failUploadStatusByName?.[uploadedName] ?? 500
        const message =
          status === 413
            ? "파일 용량이 너무 큽니다. 50MB 이하 파일로 다시 시도해주세요."
            : "외장 스토리지 저장에 실패했습니다."
        await fulfillJson(route, { resultCode: `${status}-1`, msg: message }, status)
        return
      }

      if (uploadedName.includes("취소할")) await delay(700)

      const rawUploadFolderPath = url.searchParams.get("folderPath") || getUploadTextField(route, "folderPath")
      const normalizedUploadFolder = normalizeFolderPathParam(rawUploadFolderPath)
      const uploaded = {
        id: nextUploadId++,
        ownerMemberId: 1,
        originalFilename: options.uploadResponseFilenames?.[uploadedName] ?? uploadedName,
        contentType: metadata.contentType,
        byteSize: route.request().postDataBuffer()?.byteLength ?? 0,
        mediaKind: metadata.mediaKind,
        folderPath: normalizedUploadFolder,
        createdAt: "2026-06-12T12:00:00Z",
        modifiedAt: "2026-06-12T12:00:00Z",
      }

      uploadedNames.push(uploadedName)
      uploadedFolderPaths.push(normalizedUploadFolder)
      uploadedClientFilenames.push(clientFilename)
      if (!uploadedName.includes("취소할")) uploadedFiles.unshift(uploaded)

      await fulfillJson(
        route,
        {
          resultCode: "201-1",
          msg: "클라우드 파일이 업로드되었습니다.",
          data: uploaded,
        },
        201
      ).catch(() => undefined)
      return
    }

    if (options.failList) {
      if (options.listDelayMs) await delay(options.listDelayMs)
      await fulfillJson(route, { resultCode: "500-1", msg: "클라우드 파일 목록 조회에 실패했습니다." }, 500)
      return
    }

    if (options.listDelayMs) await delay(options.listDelayMs)
    requestedKinds.push(mediaKind)
    requestedFolderPaths.push(folderPath)
    const keyword = (url.searchParams.get("kw") || "").toLowerCase()
    const files = [...uploadedFiles, ...initialFiles].filter((file) => {
      const isDeleted = deletedIds.includes(String(file.id))
      const kindMatches = mediaKind === "ALL" || file.mediaKind === mediaKind
      const folderMatches = !folderPath || normalizeFolderPathParam(file.folderPath) === folderPath
      const keywordMatches = !keyword || file.originalFilename.toLowerCase().includes(keyword)
      return !isDeleted && kindMatches && folderMatches && keywordMatches
    })
    await fulfillJson(route, { files })
  })

  await page.route(/\/system\/api\/v1\/adm\/cloud\/files\/\d+\/content(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url())
    const id = url.pathname.match(/\/files\/(\d+)\/content/)?.[1] ?? ""
    requestedContentIds.push(id)
    const file = [...uploadedFiles, ...initialFiles].find((item) => String(item.id) === id)
    const contentType = file?.contentType ?? "application/octet-stream"
    const isSvg =
      contentType.toLowerCase().includes("svg") || Boolean(file?.originalFilename.toLowerCase().endsWith(".svg"))
    const body =
      contentType === "application/pdf"
        ? invalidPdfIds.has(id)
          ? Buffer.from("invalid-pdf-bytes")
          : minimalPdf
        : isSvg
          ? Buffer.from(
              options.svgBodiesById?.[id] ??
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="#18181b"/></svg>',
              "utf8"
            )
          : contentType.startsWith("image/")
            ? pixelPng
            : Buffer.from("mock-private-cloud-content")

    if (options.contentDelayMs) await delay(options.contentDelayMs)
    await route.fulfill({
      status: 200,
      contentType,
      body,
      headers: {
        "accept-ranges": "bytes",
        "cache-control": "private, no-store, max-age=0",
      },
    })
  })

  await page.route(/\/system\/api\/v1\/adm\/cloud\/files\/\d+\/thumbnail(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url())
    const id = url.pathname.match(/\/files\/(\d+)\/thumbnail/)?.[1] ?? ""
    requestedThumbnailIds.push(id)
    if (options.contentDelayMs) await delay(options.contentDelayMs)
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: pixelPng,
      headers: {
        "cache-control": "private, max-age=0, must-revalidate",
      },
    })
  })

  await page.route("**/system/api/v1/adm/cloud/files/*/share-links**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const match = url.pathname.match(/\/files\/(\d+)\/share-links(?:\/(\d+))?$/)
    const fileId = match?.[1] ?? ""
    const tokenId = match?.[2] ? Number(match[2]) : null
    const method = request.method()
    const currentTokens = shareTokensByFileId.get(fileId) ?? []

    if (method === "GET") {
      const shareDelay = options.shareLinksDelayMsByFileId?.[fileId]
      if (shareDelay) await delay(shareDelay)
      await fulfillJson(route, { tokens: currentTokens })
      return
    }
    if (method === "POST") {
      const issueDelay = options.shareIssueDelayMsByFileId?.[fileId]
      if (issueDelay) await delay(issueDelay)
      const body = JSON.parse(request.postData() || "{}") as { ttlSeconds?: number }
      const ttlSeconds = Number(body.ttlSeconds || 86400)
      shareLinkRequests.push({ fileId, ttlSeconds })
      const issuedId = nextTokenId++
      const expiresAt = `2026-06-27T${String((ttlSeconds / 3600) % 24).padStart(2, "0")}:00:00Z`
      currentTokens.unshift({
        id: issuedId,
        fileId: Number(fileId),
        purpose: "SHARE_LINK",
        createdAt: "2026-06-26T00:00:00Z",
        expiresAt,
      })
      shareTokensByFileId.set(fileId, currentTokens)
      await fulfillJson(
        route,
        {
          resultCode: "201-1",
          msg: "공유 링크가 발급되었습니다.",
          data: {
            fileId: Number(fileId),
            token: `share-token-${fileId}-${ttlSeconds}`,
            expiresAt,
            contentPath: `/system/api/v1/public/cloud/files/${fileId}/share?token=share-token-${fileId}-${ttlSeconds}`,
          },
        },
        201
      )
      return
    }
    if (method === "DELETE" && tokenId !== null) {
      revokedShareLinkIds.push(tokenId)
      shareTokensByFileId.set(
        fileId,
        currentTokens.filter((item) => item.id !== tokenId)
      )
      await fulfillJson(route, { resultCode: "200-1", msg: "revoked" })
      return
    }
    if (method === "DELETE") {
      const revokedCount = currentTokens.length
      currentTokens.forEach((item) => revokedShareLinkIds.push(item.id))
      shareTokensByFileId.set(fileId, [])
      await fulfillJson(route, { resultCode: "200-1", msg: "revoked", data: { revokedCount } })
      return
    }
    await route.fallback()
  })

  return {
    requestedKinds,
    requestedFolderPaths,
    uploadedNames,
    uploadedFolderPaths,
    uploadedClientFilenames,
    videoSessionCreates,
    videoSessionGets,
    videoPartNumbers,
    videoCompletes,
    videoCancels,
    deletedIds,
    requestedContentIds,
    requestedThumbnailIds,
    externalPlaybackTokenRequests,
    shareLinkRequests,
    revokedShareLinkIds,
    bulkDeletedBatches,
  }
}

const switchToCloudListView = async (page: Page) => {
  await page.getByRole("button", { name: "목록 보기" }).click()
}

test.describe("관리자 클라우드", () => {
  test("Strapi형 비주얼 에셋 그리드·목록 전환, 다중 업로드 큐, 취소, 삭제와 owner 전용 preview drawer가 동작한다", async ({ page }) => {
    const mocks = await setupAdminCloudMocks(page)
    const browserErrors: string[] = []

    page.on("pageerror", (error) => {
      browserErrors.push(error.message)
    })
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text())
      if (
        message.type() === "warning" &&
        (message.text().includes("standardFontDataUrl") || message.text().includes("ZapfDingbats"))
      ) {
        browserErrors.push(message.text())
      }
    })
    await page.addInitScript(() => {
      Object.assign(window, { __adminCloudCopiedText: "", __adminCloudPromptText: "" })
      const clipboard = {
        writeText: async (text: string) => {
          Object.assign(window, { __adminCloudCopiedText: text })
        },
      }
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: clipboard,
      })
      Object.defineProperty(window, "prompt", {
        configurable: true,
        value: (_message: string, value?: string) => {
          Object.assign(window, { __adminCloudPromptText: value || "" })
          return value || ""
        },
      })
    })

    await page.goto("/admin/cloud")

    await expect(page.getByRole("heading", { name: "클라우드", level: 1 })).toBeVisible()
    const headerUploadButton = page.getByRole("button", {
      name: "파일 업로드",
      exact: true,
    })
    await expect(headerUploadButton).toBeVisible()
    await expect(headerUploadButton).toContainText("파일 업로드")
    const cloudDropSurface = page.locator("[data-drag-active]")
    await cloudDropSurface.dispatchEvent("dragover")
    await expect(cloudDropSurface).toHaveAttribute("data-drag-active", "true")
    await expect(page.getByText("파일을 놓아 클라우드에 업로드")).toBeVisible()
    await cloudDropSurface.dispatchEvent("dragleave")
    await expect(cloudDropSurface).toHaveAttribute("data-drag-active", "false")
    await expect(page.getByRole("link", { name: "클라우드" }).first()).toHaveAttribute("href", "/admin/cloud")
    await expect(page.getByRole("button", { name: "그리드 보기" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("button", { name: "목록 보기" })).toHaveAttribute("aria-pressed", "false")
    await expect(page.getByTestId("assets-grid")).toBeVisible()
    await expect(page.getByRole("listitem").filter({ hasText: /운영 점검 리포트\.pdf/ })).toBeVisible()
    await expect(page.getByRole("listitem").filter({ hasText: /home-server-rack\.png/ })).toBeVisible()
    await expect(page.getByRole("listitem").filter({ hasText: /deploy-walkthrough\.mp4/ })).toBeVisible()

    await switchToCloudListView(page)
    await expect(page.getByRole("button", { name: "목록 보기" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("row", { name: /운영 점검 리포트\.pdf/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /home-server-rack\.png/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /deploy-walkthrough\.mp4/ })).toBeVisible()
    await expect(page.getByText("표시할 파일이 없습니다.")).toHaveCount(0)
    await expect(page.getByLabel("클라우드 상세정보")).toHaveAttribute("data-mode", "inline")
    await expect(page.getByRole("button", { name: /새 폴더/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /즐겨찾기/ })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "상세 패널 보기" })).toBeVisible()
    await expect(page.getByText("문", { exact: true })).toHaveCount(0)
    await expect(page.getByText("PDF").first()).toBeVisible()
    await expect(page.getByLabel("관리자 검색")).toHaveCount(0)
    await expect(page.getByPlaceholder("관리자 메뉴 검색")).toHaveCount(0)

    const folderNav = page.getByLabel("폴더 경로 탐색").last()
    await folderNav.getByRole("button", { name: "photos", exact: true }).click()
    await expect.poll(() => mocks.requestedFolderPaths).toContain("photos")
    await expect(page.getByRole("row", { name: /home-server-rack\.png/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /운영 점검 리포트\.pdf/ })).toHaveCount(0)
    await page.getByRole("button", { name: "루트", exact: true }).click()

    const searchInput = page.getByLabel("클라우드 파일 검색")
    await searchInput.fill("deploy")
    await expect(page.getByRole("row", { name: /deploy-walkthrough\.mp4/ })).toBeVisible()

    await page.getByLabel("파일 종류 필터").getByRole("button", { name: "동영상" }).click()
    await expect.poll(() => mocks.requestedKinds).toContain("VIDEO")
    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: "필터 제외 문서.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 filtered cache guard"),
    })
    await expect.poll(() => mocks.uploadedNames).toContain("필터 제외 문서.pdf")
    await expect(page.getByRole("row", { name: /필터 제외 문서\.pdf/ })).toHaveCount(0)

    await page.getByLabel("파일 종류 필터").getByRole("button", { name: "전체" }).click()
    await searchInput.fill("")
    await page.getByLabel("클라우드 파일 업로드").setInputFiles([
      {
        name: "신규 운영 문서.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 mock upload"),
      },
      {
        name: "배포 캡처.png",
        mimeType: "image/png",
        buffer: pixelPng,
      },
    ])

    const uploadPanel = page.getByLabel("업로드 중인 파일")
    await expect(uploadPanel).toHaveCSS("position", "fixed")
    await expect(uploadPanel).toHaveCSS("z-index", "29")
    await expect(uploadPanel.getByRole("heading", { name: /항목 .* 업로드/ })).toBeVisible()
    await expect(uploadPanel.getByText("신규 운영 문서.pdf")).toBeVisible()
    await expect(uploadPanel.getByText("배포 캡처.png")).toBeVisible()
    await expect.poll(() => mocks.uploadedNames).toEqual(
      expect.arrayContaining(["신규 운영 문서.pdf", "배포 캡처.png"])
    )
    await expect(uploadPanel.getByText("완료").first()).toBeVisible()
    await expect(page.getByText("신규 운영 문서.pdf 업로드 완료")).toHaveCount(0)
    await expect(page.getByRole("row", { name: /신규 운영 문서\.pdf/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /배포 캡처\.png/ })).toBeVisible()

    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: "취소할 영상.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0]),
    })
    await expect(uploadPanel.getByText("취소할 영상.mp4")).toBeVisible()
    await uploadPanel.getByRole("button", { name: "취소할 영상.mp4 업로드 취소" }).click()
    await expect(uploadPanel.getByText("취소됨")).toBeVisible()
    await expect(page.getByRole("row", { name: /취소할 영상\.mp4/ })).toHaveCount(0)
    await uploadPanel.getByRole("button", { name: "종료된 업로드 항목 지우기" }).click()
    await expect(page.getByLabel("업로드 중인 파일")).toHaveCount(0)

    await page.locator('button[title="운영 점검 리포트.pdf"]').click()
    await expect(page.getByRole("heading", { name: "운영 점검 리포트.pdf" })).toBeVisible()
    await expect(page.getByText("계정 소유주만 볼 수 있음").first()).toBeVisible()
    await expect(page.getByText("미리보기 완료")).toBeVisible()
    await expectPdfPreviewFitsDetailPanel(page, "운영 점검 리포트.pdf PDF 미리보기")
    await page.getByRole("button", { name: "상세 패널 닫기" }).click()
    await expect(page.getByLabel("클라우드 상세정보")).toHaveCount(0)
    await page.getByRole("button", { name: "상세 패널 보기" }).click()
    await expect(page.getByRole("heading", { name: "운영 점검 리포트.pdf" })).toBeVisible()
    await page.waitForTimeout(100)
    expect(browserErrors.filter((message) => message.includes("Worker was terminated"))).toEqual([])
    expect(browserErrors.filter((message) => message.includes("standardFontDataUrl"))).toEqual([])
    expect(browserErrors.filter((message) => message.includes("ZapfDingbats"))).toEqual([])

    await page.locator('button[title="home-server-rack.png"]').click()
    await expect(page.getByRole("heading", { name: "home-server-rack.png" })).toBeVisible()
    await expect(page.getByAltText("home-server-rack.png")).toBeVisible()
    await expect(page.getByLabel("사진 썸네일")).toHaveCount(0)

    await page.locator('button[title="deploy-walkthrough.mp4"]').click()
    await expect(page.getByRole("heading", { name: "deploy-walkthrough.mp4" })).toBeVisible()
    await expect(page.getByText("IINA playback model")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "IINA 명령 복사" })).toBeVisible()
    await expect(page.getByRole("button", { name: "mpv 명령 복사" })).toBeVisible()
    await expect(page.getByText(/챕터 \d+개/)).toHaveCount(0)
    await expect(page.getByText(/재생 기록/)).toHaveCount(0)
    await expect(page.getByRole("button", { name: "자막" })).toHaveCount(0)

    const video = page.locator("video")
    await expect(video).toBeVisible()
    await page.getByRole("button", { name: "1.5x" }).click()
    await expect.poll(async () => video.evaluate((node) => (node as HTMLVideoElement).playbackRate)).toBe(1.5)
    await page.getByRole("button", { name: "IINA 명령 복사" }).click()
    await expect(page.getByRole("status")).toContainText("IINA 명령을 복사했습니다")
    await expect.poll(() => mocks.externalPlaybackTokenRequests).toEqual(["103"])
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { __adminCloudCopiedText?: string }).__adminCloudCopiedText || ""
        )
      )
      .toContain('iina "')
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { __adminCloudCopiedText?: string }).__adminCloudCopiedText || ""
        )
      )
      .toMatch(/^iina "https?:\/\//)
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { __adminCloudCopiedText?: string }).__adminCloudCopiedText || ""
        )
      )
      .toContain("/system/api/v1/adm/cloud/files/103/external-content?token=external-token-103")
    await page.evaluate(() => {
      Object.assign(window, { __adminCloudCopiedText: "", __adminCloudPromptText: "" })
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new DOMException("Clipboard denied", "NotAllowedError")
          },
        },
      })
    })
    await page.getByRole("button", { name: "mpv 명령 복사" }).click()
    await expect(page.getByRole("status").filter({ hasText: "mpv 명령을 표시했습니다. 6시간 동안 유효합니다." })).toBeVisible()
    await expect.poll(() => mocks.externalPlaybackTokenRequests).toEqual(["103", "103"])
    const manualCmdInput = page.getByLabel("수동 복사 명령")
    await expect(manualCmdInput).toBeVisible()
    await expect(manualCmdInput).toHaveValue(/^mpv "https?:\/\/.*\/system\/api\/v1\/adm\/cloud\/files\/103\/external-content\?token=external-token-103"$/)
    const promptText = await page.evaluate(
      () => (window as typeof window & { __adminCloudPromptText?: string }).__adminCloudPromptText || ""
    )
    expect(promptText).toBe("")

    await expect(page.getByRole("button", { name: "deploy-walkthrough.mp4 삭제" })).toHaveCount(0)
    await page.getByRole("checkbox", { name: "deploy-walkthrough.mp4 선택" }).check()
    await page.getByRole("button", { name: "선택 삭제" }).click()
    await expect(page.getByRole("dialog", { name: "파일 삭제" })).toBeVisible()
    expect(mocks.deletedIds).toEqual([])
    await page.getByRole("dialog", { name: "파일 삭제" }).getByRole("button", { name: "삭제" }).click()
    await expect.poll(() => mocks.deletedIds).toContain("103")
  })

  test("목록 로딩 중에도 클라우드 작업공간과 툴바를 유지한다", async ({ page }) => {
    await setupAdminCloudMocks(page, { listDelayMs: 450 })

    await page.goto("/admin/cloud")

    await expect(page.getByRole("heading", { name: "클라우드", level: 1 })).toBeVisible()
    await expect(page.locator('button[aria-label="파일 업로드"]').first()).toBeVisible()
    await expect(page.getByRole("status", { name: "파일 목록 로딩" })).toBeVisible()
    await expect(page.locator("[data-admin-cloud-skeleton-row]")).toHaveCount(3)
    await expect(page.getByText("파일을 불러오는 중입니다.")).toHaveCount(0)
    await expect(page.getByRole("listitem").filter({ hasText: /운영 점검 리포트\.pdf/ })).toBeVisible()
    await expect(page.getByRole("status", { name: "파일 목록 로딩" })).toHaveCount(0)
  })

  test("외부 재생 token 응답 중 선택이 바뀌면 이전 파일 명령을 복사하지 않는다", async ({ page }) => {
    const secondVideo: CloudFileFixture = {
      id: 105,
      ownerMemberId: 1,
      originalFilename: "release-demo.mp4",
      contentType: "video/mp4",
      byteSize: 4_194_304,
      mediaKind: "VIDEO",
      folderPath: "/video",
      createdAt: "2026-06-12T12:00:00Z",
      modifiedAt: "2026-06-12T12:00:00Z",
    }
    const mocks = await setupAdminCloudMocks(page, {
      externalPlaybackTokenDelayMs: 250,
      initialFiles: [...CLOUD_FILES, secondVideo],
    })

    await page.goto("/admin/cloud")
    await page.locator('button[title="deploy-walkthrough.mp4"]').click()
    await page.getByRole("button", { name: "IINA 명령 복사" }).click()
    await expect.poll(() => mocks.externalPlaybackTokenRequests).toEqual(["103"])

    await page.locator('button[title="release-demo.mp4"]').click()
    await expect(page.getByRole("heading", { name: "release-demo.mp4" })).toBeVisible()
    await page.waitForTimeout(350)

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { __adminCloudCopiedText?: string }).__adminCloudCopiedText || ""
        )
      )
      .toBe("")
    await expect(page.getByRole("status").filter({ hasText: /명령/ })).toHaveCount(0)
  })

  test("외부 재생 token 응답 중 상세 패널이 닫히면 이전 파일 명령을 복사하지 않는다", async ({ page }) => {
    const mocks = await setupAdminCloudMocks(page, {
      externalPlaybackTokenDelayMs: 250,
    })

    await page.goto("/admin/cloud")
    await page.locator('button[title="deploy-walkthrough.mp4"]').click()
    await page.getByRole("button", { name: "IINA 명령 복사" }).click()
    await expect.poll(() => mocks.externalPlaybackTokenRequests).toEqual(["103"])

    await page.getByRole("button", { name: "상세 패널 닫기" }).click()
    await expect(page.getByLabel("클라우드 상세정보")).toHaveCount(0)
    await page.waitForTimeout(350)

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { __adminCloudCopiedText?: string }).__adminCloudCopiedText || ""
        )
      )
      .toBe("")
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { __adminCloudPromptText?: string }).__adminCloudPromptText || ""
        )
      )
      .toBe("")
  })

  test.describe("대용량 동영상 분할 업로드", () => {
    test.describe.configure({ mode: "default" })

    test("100MB 초과 동영상은 resumable 세션과 조각 업로드로 처리한다", async ({ page }, testInfo) => {
      test.slow()
      const mocks = await setupAdminCloudMocks(page)
      const largeVideo = Buffer.alloc(101 * 1024 * 1024)
      Buffer.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]).copy(largeVideo)
      const largeVideoPath = testInfo.outputPath("대용량 교육 영상.mp4")
      writeFileSync(largeVideoPath, largeVideo)

      await page.goto("/admin/cloud")
      await switchToCloudListView(page)
      await page.getByLabel("클라우드 파일 업로드").setInputFiles(largeVideoPath)

      await expect.poll(() => mocks.videoSessionCreates).toContain("대용량 교육 영상.mp4")
      await expect.poll(() => mocks.videoPartNumbers, { timeout: 25_000 }).toEqual([1, 2])
      await expect.poll(() => mocks.videoCompletes, { timeout: 25_000 }).toEqual(["301"])
      await expect(page.getByLabel("업로드 중인 파일").getByText("완료", { exact: true })).toBeVisible()
      await expect(page.getByRole("row", { name: /대용량 교육 영상\.mp4/ })).toBeVisible()
      expect(mocks.uploadedNames).not.toContain("대용량 교육 영상.mp4")
      expect(mocks.videoCancels).toEqual([])
    })

  test("대용량 동영상 일시 503 실패는 재시도 백오프 후 자동 복구된다", async ({ page }, testInfo) => {
    const autoRecoverMocks = await setupAdminCloudMocks(page, { failVideoPartOnceNumber: 2 })
    const largeVideo = Buffer.alloc(101 * 1024 * 1024)
    Buffer.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]).copy(largeVideo)
    const autoVideoPath = testInfo.outputPath("자동복구 교육 영상.mp4")
    writeFileSync(autoVideoPath, largeVideo)

    await page.goto("/admin/cloud")
    await page.getByLabel("클라우드 파일 업로드").setInputFiles(autoVideoPath)
    await expect.poll(() => autoRecoverMocks.videoCompletes, { timeout: 25_000 }).toEqual(["301"])
    expect(autoRecoverMocks.videoPartNumbers).toEqual([1, 2])
  })

  test("대용량 동영상 part 재시도 소진 후 수동 재시도는 기존 세션의 업로드된 조각부터 이어간다", async ({
    page,
  }, testInfo) => {
    test.slow()
    const mocks = await setupAdminCloudMocks(page, { failVideoPartFailureCounts: { 2: 3 } })
    const largeVideo = Buffer.alloc(101 * 1024 * 1024)
    Buffer.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]).copy(largeVideo)
    const largeVideoPath = testInfo.outputPath("대용량 교육 영상.mp4")
    writeFileSync(largeVideoPath, largeVideo)

    await page.goto("/admin/cloud")
    await page.getByLabel("클라우드 파일 업로드").setInputFiles(largeVideoPath)

    const uploadPanel = page.getByLabel("업로드 중인 파일")
    await expect(page.getByText(/대용량 교육 영상\.mp4 업로드 실패/)).toBeVisible({ timeout: 25_000 })
    await expect(uploadPanel.getByRole("heading", { name: "항목 1개 업로드 실패/취소" })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.entries(window.localStorage)
            .filter(([key]) => key.startsWith("aquila-cloud-video-upload-session"))
            .map(([, value]) => value)
        )
      )
      .toEqual(["301"])
    expect(mocks.videoSessionCreates).toEqual(["대용량 교육 영상.mp4"])
    expect(mocks.videoPartNumbers).toEqual([1])
    expect(mocks.videoCancels).toEqual([])

    await uploadPanel.getByRole("button", { name: "대용량 교육 영상.mp4 업로드 다시 시도" }).click()

    await expect.poll(() => mocks.videoSessionGets).toContain("301")
    await expect.poll(() => mocks.videoPartNumbers).toEqual([1, 2])
    await expect.poll(() => mocks.videoCompletes).toEqual(["301"])
    expect(mocks.videoSessionCreates).toEqual(["대용량 교육 영상.mp4"])
    expect(mocks.videoCancels).toEqual([])
  })

  test("대용량 동영상 재시도는 서버 정규화 파일명 세션을 버리지 않는다", async ({ page }, testInfo) => {
    test.slow()
    const mocks = await setupAdminCloudMocks(page, {
      failVideoPartFailureCounts: { 2: 3 },
      normalizeVideoSessionFilename: true,
    })
    const largeVideo = Buffer.alloc(101 * 1024 * 1024)
    Buffer.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]).copy(largeVideo)
    const nfcFilename = "대용량 교육 영상.mp4"
    const nfdFilename = nfcFilename.normalize("NFD")
    const largeVideoPath = testInfo.outputPath(nfdFilename)
    writeFileSync(largeVideoPath, largeVideo)

    await page.goto("/admin/cloud")
    await page.getByLabel("클라우드 파일 업로드").setInputFiles(largeVideoPath)

    const uploadPanel = page.getByLabel("업로드 중인 파일")
    await expect(uploadPanel.getByRole("heading", { name: "항목 1개 업로드 실패/취소" })).toBeVisible({ timeout: 25_000 })
    await uploadPanel.getByRole("button", { name: `${nfdFilename} 업로드 다시 시도` }).click()

    await expect.poll(() => mocks.videoSessionGets).toContain("301")
    await expect.poll(() => mocks.videoPartNumbers).toEqual([1, 2])
    await expect.poll(() => mocks.videoCompletes).toEqual(["301"])
    expect(mocks.videoSessionCreates).toEqual([nfdFilename])
    expect(mocks.videoCancels).toEqual([])
  })

  test("대용량 동영상 세션 조회 일시 실패는 저장된 세션을 지우지 않는다", async ({ page }, testInfo) => {
    test.slow()
    const mocks = await setupAdminCloudMocks(page, {
      failVideoPartFailureCounts: { 2: 3 },
      failVideoSessionGetOnceStatus: 503,
    })
    const largeVideo = Buffer.alloc(101 * 1024 * 1024)
    Buffer.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]).copy(largeVideo)
    const largeVideoPath = testInfo.outputPath("대용량 교육 영상.mp4")
    writeFileSync(largeVideoPath, largeVideo)

    await page.goto("/admin/cloud")
    await page.getByLabel("클라우드 파일 업로드").setInputFiles(largeVideoPath)

    const uploadPanel = page.getByLabel("업로드 중인 파일")
    await expect(page.getByText(/대용량 교육 영상\.mp4 업로드 실패/)).toBeVisible({ timeout: 25_000 })
    await uploadPanel.getByRole("button", { name: "대용량 교육 영상.mp4 업로드 다시 시도" }).click()
    await expect(page.getByText(/대용량 교육 영상\.mp4 업로드 실패: 서버 오류가 발생했습니다/)).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.entries(window.localStorage)
            .filter(([key]) => key.startsWith("aquila-cloud-video-upload-session"))
            .map(([, value]) => value)
        )
      )
      .toEqual(["301"])
    expect(mocks.videoSessionCreates).toEqual(["대용량 교육 영상.mp4"])
    expect(mocks.videoCancels).toEqual([])

    await uploadPanel.getByRole("button", { name: "대용량 교육 영상.mp4 업로드 다시 시도" }).click()
    await expect.poll(() => mocks.videoSessionGets).toEqual(["301", "301"])
    await expect.poll(() => mocks.videoPartNumbers).toEqual([1, 2])
    await expect.poll(() => mocks.videoCompletes).toEqual(["301"])
  })

  test("대용량 동영상 완료 세션은 completedFileId로 복구하고 재업로드하지 않는다", async ({ page }, testInfo) => {
    const completedVideo: CloudFileFixture = {
      id: 205,
      ownerMemberId: 1,
      originalFilename: "대용량 교육 영상.mp4",
      contentType: "video/mp4",
      byteSize: 101 * 1024 * 1024,
      mediaKind: "VIDEO",
      folderPath: "/",
      createdAt: "2026-06-12T12:00:00Z",
      modifiedAt: "2026-06-12T12:00:00Z",
    }
    const mocks = await setupAdminCloudMocks(page, {
      lookupOnlyFiles: [completedVideo],
      videoCompletedFileId: completedVideo.id,
      videoSessionStatus: "COMPLETED",
    })
    const largeVideo = Buffer.alloc(101 * 1024 * 1024)
    Buffer.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]).copy(largeVideo)
    const largeVideoPath = testInfo.outputPath("대용량 교육 영상.mp4")
    writeFileSync(largeVideoPath, largeVideo)

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)
    await page.evaluate(() => {
      const originalGetItem = Storage.prototype.getItem
      Storage.prototype.getItem = function getItemWithCompletedVideoSession(key: string) {
        if (key.startsWith("aquila-cloud-video-upload-session")) return "301"
        return originalGetItem.call(this, key)
      }
    })
    await page.getByLabel("클라우드 파일 업로드").setInputFiles(largeVideoPath)

    await expect.poll(() => mocks.videoSessionGets).toEqual(["301"])
    await expect(page.getByLabel("업로드 중인 파일").getByText("완료", { exact: true })).toBeVisible()
    await expect(page.getByRole("row", { name: /대용량 교육 영상\.mp4/ })).toBeVisible()
    expect(mocks.videoSessionCreates).toEqual([])
    expect(mocks.videoPartNumbers).toEqual([])
    expect(mocks.videoCompletes).toEqual([])
    expect(mocks.videoCancels).toEqual([])
    })
  })

  test("사진 선택 시 상세 패널은 이미지 요청을 즉시 시작하고 텍스트 로딩 상태를 숨긴다", async ({ page }) => {
    const mocks = await setupAdminCloudMocks(page, { contentDelayMs: 450 })

    await page.addInitScript(() => {
      Object.assign(window, { __adminCloudPhotoLoadingTextSeen: false })

      const markIfLoadingTextExists = () => {
        if (document.body?.textContent?.includes("사진을 불러오는 중입니다.")) {
          Object.assign(window, { __adminCloudPhotoLoadingTextSeen: true })
        }
      }

      const startObserver = () => {
        markIfLoadingTextExists()
        new MutationObserver(markIfLoadingTextExists).observe(document.documentElement, {
          characterData: true,
          childList: true,
          subtree: true,
        })
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startObserver, { once: true })
      } else {
        startObserver()
      }
    })

    await page.goto("/admin/cloud")
    await page.locator('button[title="home-server-rack.png"]').click()

    await expect(page.getByRole("heading", { name: "home-server-rack.png" })).toBeVisible()
    await expect(page.getByText("사진을 불러오는 중입니다.")).toHaveCount(0)
    await expect.poll(() => mocks.requestedContentIds).toContain("102")
    await expect(page.getByLabel("클라우드 상세정보").getByAltText("home-server-rack.png")).toBeVisible()
    await expect(page.getByLabel("home-server-rack.png 사진 미리보기")).toHaveAttribute("aria-busy", "false")
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__adminCloudPhotoLoadingTextSeen))).toBe(false)
    await expect(page.getByText("사진을 불러오는 중입니다.")).toHaveCount(0)
  })

  test("개별 삭제 없이 선택 삭제 모달은 확인 전 API 호출을 막고 툴바 레이아웃을 유지한다", async ({ page }) => {
    const mocks = await setupAdminCloudMocks(page, { initialFiles: CLOUD_FILES })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)

    const longFileRow = page.getByRole("row", { name: /NCS기반 채용 직무설명자료.*게시\.pdf/ })
    await expect(longFileRow).toBeVisible()
    await expect(longFileRow.getByRole("button", { name: /삭제/ })).toHaveCount(0)
    await longFileRow.getByRole("checkbox", { name: /NCS기반 채용 직무설명자료.*게시\.pdf 선택/ }).check()
    await page.getByRole("button", { name: "선택 삭제" }).click()

    const dialog = page.getByRole("dialog", { name: "파일 삭제" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/NCS기반 채용 직무설명자료.*게시\.pdf/)).toBeVisible()
    await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(dialog.getByRole("button", { name: "삭제" })).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused()
    expect(mocks.deletedIds).toEqual([])

    const uploadButton = page.locator('button[aria-label="파일 업로드"]').first()
    await expect(uploadButton).toHaveCSS("white-space", "nowrap")
    const uploadButtonBox = await uploadButton.boundingBox()
    expect(uploadButtonBox).not.toBeNull()
    expect(uploadButtonBox!.height).toBeLessThanOrEqual(38)

    await dialog.getByRole("button", { name: "취소" }).click()
    await expect(dialog).toHaveCount(0)
    expect(mocks.deletedIds).toEqual([])

    await page.getByRole("button", { name: "선택 삭제" }).click()
    await expect(page.getByRole("dialog", { name: "파일 삭제" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: "파일 삭제" })).toHaveCount(0)
    expect(mocks.deletedIds).toEqual([])

    await page.getByRole("button", { name: "선택 삭제" }).click()
    await page.getByRole("dialog", { name: "파일 삭제" }).getByRole("button", { name: "삭제" }).click()
    await expect.poll(() => mocks.deletedIds).toContain("104")
    await expect(page.getByRole("status").filter({ hasText: /삭제 완료/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /NCS기반 채용 직무설명자료.*게시\.pdf/ })).toHaveCount(0)
  })

  test("긴 파일명과 업로드 완료 상태는 목록과 하단 업로드 패널에서 겹치지 않는다", async ({ page }) => {
    const mocks = await setupAdminCloudMocks(page, { initialFiles: CLOUD_FILES })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)

    const longFileRow = page.getByRole("row", { name: /NCS기반 채용 직무설명자료.*게시\.pdf/ })
    await expect(longFileRow).toBeVisible()
    const longFileName = longFileRow.locator('button[title$="게시.pdf"]')
    await expect(longFileName).toHaveAttribute("title", /게시\.pdf$/)
    await expect(longFileRow.getByLabel("문서")).toHaveText("PDF")
    await expect(longFileRow.getByRole("button", { name: /미리보기/ })).toHaveCount(0)

    await longFileName.click()
    await expect(page.getByRole("heading", { name: /NCS기반 채용 직무설명자료.*게시\.pdf/ })).toBeVisible()
    await expectPdfPreviewFitsDetailPanel(page, /NCS기반 채용 직무설명자료.*PDF 미리보기/)

    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: "★2026년 제3회 식약처 공무원(일반직) 경력경쟁채용시험 공고문_게시_긴파일명_상태겹침방지.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 long upload"),
    })
    await expect.poll(() => mocks.uploadedClientFilenames).toContain(
      "★2026년 제3회 식약처 공무원(일반직) 경력경쟁채용시험 공고문_게시_긴파일명_상태겹침방지.pdf"
    )

    const uploadPanel = page.getByLabel("업로드 중인 파일")
    await expect(uploadPanel.getByText(/상태겹침방지\.pdf/)).toBeVisible()
    const donePill = uploadPanel.getByText("완료", { exact: true })
    await expect(donePill).toBeVisible()
    await expect(page.getByText(/상태겹침방지\.pdf 업로드 완료/)).toHaveCount(0)
    const queueItemBox = await uploadPanel.getByText(/상태겹침방지\.pdf/).boundingBox()
    const donePillBox = await donePill.boundingBox()
    expect(queueItemBox).not.toBeNull()
    expect(donePillBox).not.toBeNull()
    expect(queueItemBox!.x + queueItemBox!.width).toBeLessThanOrEqual(donePillBox!.x + 2)
  })

  test("선택된 긴 PDF 행은 이름 셀 안의 종류 배지와 파일명 포커스가 명확하다", async ({ page }) => {
    await setupAdminCloudMocks(page, { initialFiles: CLOUD_FILES })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)

    const selectedRow = page.getByRole("row", { name: /운영 점검 리포트\.pdf/ })
    await expect(selectedRow).toBeVisible()
    await selectedRow.locator('button[title="운영 점검 리포트.pdf"]').click()
    const nameCell = selectedRow.locator("td").nth(1)
    const typeBadge = selectedRow.getByLabel("문서")
    await expect(typeBadge).toHaveText("PDF")
    await expect(nameCell.getByLabel("문서")).toBeVisible()

    const badgeBox = await typeBadge.boundingBox()
    const thumbnailBox = await selectedRow.locator('[data-kind="DOCUMENT"]').first().boundingBox()
    const selectedRowBox = await selectedRow.boundingBox()
    const selectedAccentCell = selectedRow.locator("td").first()
    expect(badgeBox).not.toBeNull()
    expect(thumbnailBox).not.toBeNull()
    expect(selectedRowBox).not.toBeNull()
    expect(badgeBox!.width).toBeGreaterThan(24)
    expect(badgeBox!.height).toBeGreaterThan(15)
    expect(thumbnailBox!.width).toBeGreaterThan(40)
    expect(thumbnailBox!.x).toBeGreaterThan(selectedRowBox!.x)
    await expect(selectedAccentCell).toHaveCSS("border-left-color", "rgb(24, 24, 27)")

    const nameButton = selectedRow.locator('button[title="운영 점검 리포트.pdf"]')
    await selectedRow.getByRole("checkbox", { name: "운영 점검 리포트.pdf 선택" }).focus()
    await page.keyboard.press("Tab")
    await expect(nameButton).toBeFocused()
    await expect(nameButton).toHaveCSS("outline-style", "solid")

    await expect(selectedRow.getByRole("button", { name: /미리보기/ })).toHaveCount(0)
    await expect(selectedRow.getByRole("button", { name: "운영 점검 리포트.pdf 삭제" })).toHaveCount(0)
  })

  test("파일이 많은 목록은 상세정보를 드로어로 열어 목록 폭을 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 1120, height: 800 })
    const manyFiles = Array.from({ length: 9 }, (_, index): CloudFileFixture => ({
      id: 300 + index,
      ownerMemberId: 1,
      originalFilename: `density-${index + 1}.png`,
      contentType: "image/png",
      byteSize: 32_768 + index,
      mediaKind: "PHOTO",
      folderPath: "/photos",
      createdAt: "2026-06-12T10:00:00Z",
      modifiedAt: "2026-06-12T10:00:00Z",
    }))
    await setupAdminCloudMocks(page, { initialFiles: manyFiles })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)

    const tableBoxBefore = await page.getByRole("table").boundingBox()
    await expect(page.getByLabel("클라우드 상세정보")).toHaveCount(0)
    await page.locator('button[title="density-1.png"]').click()

    const detailPanel = page.getByLabel("클라우드 상세정보")
    await expect(detailPanel).toBeVisible()
    await expect(detailPanel).toHaveCSS("position", "fixed")
    const tableBoxAfter = await page.getByRole("table").boundingBox()
    expect(tableBoxBefore).not.toBeNull()
    expect(tableBoxAfter).not.toBeNull()
    expect(Math.abs(tableBoxAfter!.width - tableBoxBefore!.width)).toBeLessThanOrEqual(2)
  })

  test("작은 화면 첫 진입은 상세정보 드로어로 파일 목록을 가리지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAdminCloudMocks(page, { initialFiles: CLOUD_FILES.slice(0, 2) })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)

    const firstRow = page.getByRole("row", { name: /운영 점검 리포트\.pdf/ })
    await expect(firstRow).toBeVisible()
    await expect(firstRow).not.toHaveAttribute("data-selected", "true")
    await expect(page.getByLabel("클라우드 상세정보")).toHaveCount(0)
    await page.locator('button[title="운영 점검 리포트.pdf"]').click()
    await expect(page.getByLabel("클라우드 상세정보")).toHaveCSS("position", "fixed")
  })

  test("작은 화면 빈 목록의 첫 업로드는 열린 상세정보를 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAdminCloudMocks(page, { initialFiles: [] })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)
    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: "모바일 첫 업로드.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 first mobile upload"),
    })

    await expect(page.getByRole("row", { name: /모바일 첫 업로드\.pdf/ })).toBeVisible()
    await expect(page.getByLabel("클라우드 상세정보")).toHaveCSS("position", "fixed")
    await expect(page.getByLabel("클라우드 상세정보").getByText("모바일 첫 업로드.pdf")).toBeVisible()
  })

  test("관리자 클라우드 진입만으로 알림 snapshot 백그라운드 요청을 시작하지 않는다", async ({ page }) => {
    let snapshotRequestCount = 0
    await page.addInitScript(() => {
      window.requestIdleCallback = (callback) => {
        window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0)
        return 1
      }
      window.cancelIdleCallback = () => {}
    })
    await setupAdminCloudMocks(page, { initialFiles: CLOUD_FILES })
    await page.route("**/member/api/v1/notifications/snapshot", async (route) => {
      snapshotRequestCount += 1
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ resultCode: "502-1", msg: "bad gateway" }),
      })
    })

    await page.goto("/admin/cloud")
    await expect(page.getByRole("heading", { name: "클라우드", level: 1 })).toBeVisible()
    await page.waitForTimeout(250)

    expect(snapshotRequestCount).toBe(0)
  })

  test("선택 삭제 일부 실패 시 성공 항목만 목록에서 제거하고 실패 알림을 유지한다", async ({ page }) => {
    const mocks = await setupAdminCloudMocks(page, { failDeleteIds: ["102"] })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)

    await page.getByRole("checkbox", { name: "운영 점검 리포트.pdf 선택" }).check()
    await page.getByRole("checkbox", { name: "home-server-rack.png 선택" }).check()
    await page.getByRole("button", { name: "선택 삭제" }).click()
    await expect(page.getByRole("dialog", { name: "파일 삭제" })).toBeVisible()
    expect(mocks.deletedIds).toEqual([])
    await page.getByRole("dialog", { name: "파일 삭제" }).getByRole("button", { name: "삭제" }).click()

    await expect.poll(() => mocks.deletedIds).toContain("101")
    await expect(page.getByRole("status").filter({ hasText: "1개 삭제 완료, 1개 실패" })).toBeVisible()
    await expect(page.getByRole("row", { name: /운영 점검 리포트\.pdf/ })).toHaveCount(0)
    await expect(page.getByRole("row", { name: /home-server-rack\.png/ })).toBeVisible()
    await expect(page.getByRole("checkbox", { name: "home-server-rack.png 선택" })).toBeChecked()
  })

  test("빈 클라우드에서 업로드 중인 파일은 목록 작업공간 안에서 상태를 보여준다", async ({ page }) => {
    await setupAdminCloudMocks(page, { initialFiles: [] })

    await page.goto("/admin/cloud")

    await expect(page.getByText("표시할 파일이 없습니다.")).toBeVisible()

    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: "취소할 영상.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0]),
    })

    const uploadPanel = page.getByLabel("업로드 중인 파일")
    await expect(uploadPanel).toHaveCSS("position", "fixed")
    await expect(uploadPanel.getByRole("heading", { name: /항목 .* 업로드/ })).toBeVisible()
    await expect(uploadPanel.getByText("취소할 영상.mp4")).toBeVisible()
    await expect(page.getByText("표시할 파일이 없습니다.")).toHaveCount(0)
    await expect(page.getByText("업로드 중인 파일이 있습니다.")).toBeVisible()

    await uploadPanel.getByRole("button", { name: "취소할 영상.mp4 업로드 취소" }).click()
    await expect(uploadPanel.getByText("취소됨")).toBeVisible()
  })

  test("클라우드 목록 조회 실패는 로딩 대신 오류와 다시 시도 액션을 보여준다", async ({ page }) => {
    await setupAdminCloudMocks(page, { failList: true })

    await page.goto("/admin/cloud")

    await expect(page.getByText("파일을 불러오는 중입니다.")).toHaveCount(0)
    await expect(page.getByText("파일 목록을 불러오지 못했습니다.")).toBeVisible()
    await expect(page.getByRole("button", { name: "파일 목록 다시 시도" })).toBeVisible()
  })

  test("클라우드 업로드 실패는 실패 사유와 재시도 버튼을 같은 항목에 남긴다", async ({ page }) => {
    await setupAdminCloudMocks(page, {
      failUploadNames: ["실패할 운영 문서.pdf"],
      initialFiles: [],
    })

    await page.goto("/admin/cloud")

    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: "실패할 운영 문서.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 failed upload"),
    })

    const uploadPanel = page.getByLabel("업로드 중인 파일")
    await expect(uploadPanel.getByText("실패할 운영 문서.pdf")).toBeVisible()
    await expect(uploadPanel.getByRole("heading", { name: "항목 1개 업로드 실패/취소" })).toBeVisible()
    await expect(uploadPanel.getByText(/외장 스토리지 저장에 실패했습니다/)).toBeVisible()
    await expect(uploadPanel.getByRole("button", { name: "실패할 운영 문서.pdf 업로드 다시 시도" })).toBeVisible()
  })

  test("클라우드 업로드 413 실패는 파일 용량 안내를 표시한다", async ({ page }) => {
    await setupAdminCloudMocks(page, {
      failUploadNames: ["대용량 포트폴리오.pdf"],
      failUploadStatusByName: {
        "대용량 포트폴리오.pdf": 413,
      },
      initialFiles: [],
    })

    await page.goto("/admin/cloud")

    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: "대용량 포트폴리오.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 oversized upload"),
    })

    const uploadPanel = page.getByLabel("업로드 중인 파일")
    await expect(uploadPanel.getByRole("heading", { name: "항목 1개 업로드 실패/취소" })).toBeVisible()
    await expect(uploadPanel.getByText(/파일 용량이 너무 큽니다/)).toBeVisible()
  })

  test("업로드 재시도 성공 시 이전 실패 알림은 작업 영역에 남지 않는다", async ({ page }) => {
    await setupAdminCloudMocks(page, {
      failUploadOnceNames: ["재시도 성공 문서.pdf"],
      initialFiles: [],
    })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)

    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: "재시도 성공 문서.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 retry upload"),
    })

    const uploadPanel = page.getByLabel("업로드 중인 파일")
    await expect(page.getByText(/재시도 성공 문서\.pdf 업로드 실패/)).toBeVisible()
    await uploadPanel.getByRole("button", { name: "재시도 성공 문서.pdf 업로드 다시 시도" }).click()

    await expect(uploadPanel.getByText("완료", { exact: true })).toBeVisible()
    await expect(page.getByText(/재시도 성공 문서\.pdf 업로드 실패/)).toHaveCount(0)
    await expect(page.getByText("재시도 성공 문서.pdf 업로드 완료")).toHaveCount(0)
    await expect(page.getByRole("row", { name: /재시도 성공 문서\.pdf/ })).toBeVisible()
  })

  test("PDF 파일명은 업로드 직후 클라이언트 원본명으로 보이고 렌더링 지연 문구를 노출하지 않는다", async ({ page }) => {
    const sourceName = "★2026년 제3회 식약처 공무원(일반직) 경력경쟁채용시험 공고문_게시.pdf"
    const damagedServerName = "_2026__ __3__ ___________________.pdf"
    await setupAdminCloudMocks(page, {
      initialFiles: [],
      uploadResponseFilenames: {
        [sourceName]: damagedServerName,
      },
    })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)
    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: sourceName,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 filename fallback"),
    })

    await expect(page.getByLabel("업로드 중인 파일").getByText(sourceName)).toBeVisible()
    const escapedSourceName = sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    await expect(page.getByRole("row", { name: new RegExp(escapedSourceName) })).toBeVisible()
    await expect(page.getByRole("row", { name: /___________________\.pdf/ })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: sourceName })).toBeVisible()
    await expect(page.getByLabel("클라우드 상세정보").getByText(sourceName)).toBeVisible()
    await expect(page.getByText(/렌더링 중|렌더링 대기|렌더링 준비|미리보기 준비|미리보기 대기/)).toHaveCount(0)
  })

  test("서버가 정상 정규화한 업로드 파일명은 클라이언트 원본명으로 덮어쓰지 않는다", async ({ page }) => {
    const clientName = "서버 정규화    문서.pdf"
    const serverName = "서버 정규화 문서.pdf"
    await setupAdminCloudMocks(page, {
      initialFiles: [],
      uploadResponseFilenames: {
        [clientName]: serverName,
      },
    })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)
    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: clientName,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 normalized filename"),
    })

    await expect(page.getByRole("row", { name: new RegExp(serverName) })).toBeVisible()
    await expect(page.getByRole("row", { name: /서버 정규화 {4}문서\.pdf/ })).toHaveCount(0)
    await expect(page.getByLabel("클라우드 상세정보").getByText(serverName)).toBeVisible()
  })

  test("손상된 서버 응답의 클라이언트 파일명 fallback은 보이지 않는 제어문자를 제거한다", async ({ page }) => {
    const clientName = "보고서\u202Ecod.exe.pdf"
    const displayName = "보고서cod.exe.pdf"
    await setupAdminCloudMocks(page, {
      initialFiles: [],
      uploadResponseFilenames: {
        [clientName]: "______.pdf",
      },
    })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)
    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: clientName,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 sanitized fallback filename"),
    })

    await expect(page.getByRole("row", { name: new RegExp(displayName) })).toBeVisible()
    await expect(page.getByRole("row", { name: /보고서.*cod\.exe\.pdf/ })).toHaveCount(1)
    await expect(page.getByLabel("클라우드 상세정보").getByText(displayName)).toBeVisible()
  })

  test("파일 정렬, 검색어 지우기, 상세 패널 다운로드·링크 복사·정보 수정이 동작한다", async ({ page }) => {
    const mocks = await setupAdminCloudMocks(page, { invalidPdfIds: ["104"] })
    await page.addInitScript(() => {
      Object.assign(window, { __adminCloudCopiedText: "" })
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            Object.assign(window, { __adminCloudCopiedText: text })
          },
        },
      })
    })

    await page.goto("/admin/cloud")
    await switchToCloudListView(page)

    const sortSelect = page.getByLabel("파일 정렬")
    await expect(sortSelect).toBeVisible()
    await sortSelect.selectOption("SIZE")
    const rowsBySize = page.locator("tbody tr")
    await expect(rowsBySize.first()).toContainText("deploy-walkthrough.mp4")

    const folderNav = page.getByLabel("폴더 경로 탐색").last()
    await expect(folderNav).toBeVisible()
    await folderNav.getByRole("button", { name: "ops", exact: true }).click()
    await expect.poll(() => mocks.requestedFolderPaths).toContain("ops")
    await expect(page.getByRole("row", { name: /운영 점검 리포트\.pdf/ })).toBeVisible()
    await expect(page.getByLabel("클라우드 파일 검색")).toHaveValue("")
    await page.getByRole("button", { name: "루트", exact: true }).click()

    await page.getByRole("button", { name: /새 폴더/ }).click()
    const newFolderDialog = page.getByRole("dialog", { name: "새 폴더 만들기" })
    await expect(newFolderDialog).toBeVisible()
    await newFolderDialog.getByLabel("폴더 경로").fill("2026 세미나")
    await newFolderDialog.getByRole("button", { name: "폴더 열기" }).click()
    await expect(newFolderDialog).toHaveCount(0)

    const searchInput = page.getByLabel("클라우드 파일 검색")
    await searchInput.fill("seminar")
    await expect(page.getByRole("button", { name: "검색어 지우기" })).toBeVisible()
    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: "seminar-발표.pdf",
      mimeType: "application/pdf",
      buffer: minimalPdf,
    })
    await expect.poll(() => mocks.uploadedFolderPaths).toContain("2026 세미나")
    await expect(page.getByRole("row", { name: /seminar-발표\.pdf/ })).toBeVisible()
    await page.getByRole("button", { name: "검색어 지우기" }).click()
    await expect(searchInput).toHaveValue("")
    await page.getByRole("button", { name: "루트", exact: true }).click()
    await expect(page.getByRole("row", { name: /운영 점검 리포트\.pdf/ })).toBeVisible()

    await page.locator('button[title="운영 점검 리포트.pdf"]').click()
    const detailPanel = page.getByLabel("클라우드 상세정보")
    await expect(detailPanel).toBeVisible()
    await expect(detailPanel.getByText("미리보기 완료")).toBeVisible()
    await expect(detailPanel.getByText("1 / 2쪽")).toBeVisible()
    await detailPanel.getByRole("button", { name: "다음 페이지" }).click()
    await expect(detailPanel.getByText("2 / 2쪽")).toBeVisible()
    await detailPanel.getByRole("button", { name: "이전 페이지" }).click()
    await expect(detailPanel.getByText("1 / 2쪽")).toBeVisible()

    const downloadLink = detailPanel.getByRole("link", { name: "다운로드" })
    await expect(downloadLink).toHaveAttribute(
      "href",
      /\/system\/api\/v1\/adm\/cloud\/files\/101\/content\?download=true$/
    )

    await detailPanel.getByRole("button", { name: "관리자 경로 복사" }).click()
    await expect(page.getByText("관리자 내부 경로를 복사했습니다.")).toBeVisible()
    const copiedLink = await page.evaluate(() => (window as unknown as { __adminCloudCopiedText?: string }).__adminCloudCopiedText)
    expect(copiedLink).toContain("/system/api/v1/adm/cloud/files/101/content")

    await detailPanel.getByRole("button", { name: "파일 삭제" }).click()
    const deleteDialog = page.getByRole("dialog", { name: "파일 삭제" })
    await expect(deleteDialog).toBeVisible()
    await deleteDialog.getByRole("button", { name: "취소" }).click()
    await expect(deleteDialog).toHaveCount(0)

    await detailPanel.getByLabel("파일 이름 수정").fill("연간 운영 점검 리포트.pdf")
    await detailPanel.getByLabel("폴더 경로 수정").fill("ops/2026")
    await detailPanel.getByRole("button", { name: "저장" }).click()

    await expect(page.getByText("파일 정보를 수정했습니다.")).toBeVisible()
    await expect(detailPanel.getByRole("heading", { name: "연간 운영 점검 리포트.pdf" })).toBeVisible()
    await expect(detailPanel.getByLabel("폴더 경로 수정")).toHaveValue("ops/2026")
    await expect(page.getByRole("row", { name: /연간 운영 점검 리포트\.pdf/ })).toBeVisible()

    await page.locator('button[title$="게시.pdf"]').click()
    await expect(detailPanel.getByText("미리보기를 불러오지 못했습니다")).toBeVisible()
    await expect(detailPanel.getByLabel("폴더 경로 수정")).toHaveValue("")
  })

  test("viewBox 전용 SVG 벡터 치수(640 × 400)·SVG 코드 토글·YARL 라이트박스 확대/축소/이동/Escape 닫기가 동작한다", async ({ page }) => {
    const viewBoxOnlySvg = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">',
      '  <rect width="640" height="400" fill="#18181b" />',
      '  <circle cx="320" cy="200" r="96" fill="#fafafa" />',
      "</svg>",
    ].join("\n")

    expect(parseSvgDimensionsFromMarkup(viewBoxOnlySvg)).toEqual({ width: 640, height: 400 })
    expect(
      parseSvgDimensionsFromMarkup('<svg width="100%" height="100%" viewBox="0 0 640 400"><path d="M0 0"/></svg>')
    ).toEqual({ width: 640, height: 400 })
    expect(parseSvgDimensionsFromMarkup('<svg width="320px" height="180px"></svg>')).toEqual({
      width: 320,
      height: 180,
    })
    expect(parseSvgDimensionsFromMarkup(`<svg viewBox="0 0 10 10">${"a".repeat(MAX_SVG_MARKUP_BYTES)}</svg>`)).toBeNull()
    expect(parseSvgDimensionsFromMarkup('<svg viewBox="0 0 10 10">\0</svg>')).toBeNull()

    const svgFixture: CloudFileFixture = {
      id: 191,
      ownerMemberId: 1,
      originalFilename: "architecture-diagram.svg",
      contentType: "image/svg+xml",
      byteSize: Buffer.byteLength(viewBoxOnlySvg, "utf8"),
      mediaKind: "PHOTO",
      folderPath: "/diagrams",
      createdAt: "2026-06-14T10:00:00Z",
      modifiedAt: "2026-06-14T10:00:00Z",
    }
    const secondFixture: CloudFileFixture = {
      id: 192,
      ownerMemberId: 1,
      originalFilename: "server-topology.png",
      contentType: "image/png",
      byteSize: pixelPng.byteLength,
      mediaKind: "PHOTO",
      folderPath: "/diagrams",
      createdAt: "2026-06-14T09:00:00Z",
      modifiedAt: "2026-06-14T09:00:00Z",
    }

    await setupAdminCloudMocks(page, {
      initialFiles: [svgFixture, secondFixture],
      svgBodiesById: { "191": viewBoxOnlySvg },
    })

    await page.goto("/admin/cloud")

    const svgCardImg = page.getByTestId("assets-grid").getByAltText("architecture-diagram.svg")
    await expect(svgCardImg).toBeVisible()
    await expect(svgCardImg).toHaveCSS("object-fit", "contain")
    const svgCardImgBox = await svgCardImg.boundingBox()
    expect(svgCardImgBox?.height ?? 0).toBeGreaterThanOrEqual(80)

    await page.locator('button[title="architecture-diagram.svg"]').click()
    const detailPanel = page.getByLabel("클라우드 상세정보")
    await expect(detailPanel.getByRole("heading", { name: "architecture-diagram.svg" })).toBeVisible()
    await expect(detailPanel.getByText("해상도")).toBeVisible()
    await expect(detailPanel.getByText("640 × 400")).toBeVisible()

    await detailPanel.getByRole("button", { name: "SVG 코드 보기" }).click()
    await expect(detailPanel.getByText(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 640 400">/)).toBeVisible()
    await detailPanel.getByRole("button", { name: "SVG 렌더링 보기" }).click()
    await expect(detailPanel.getByAltText("architecture-diagram.svg")).toBeVisible()

    await detailPanel.getByRole("button", { name: "전체화면 미리보기" }).click()
    const lightbox = page.getByRole("dialog", { name: "architecture-diagram.svg 미리보기" })
    await expect(lightbox).toBeVisible()
    await expect(lightbox.getByText("1 / 2")).toBeVisible()
    await expect(lightbox.getByText(/640 × 400/)).toBeVisible()

    const slideImage = lightbox.getByAltText("architecture-diagram.svg")
    await expect(slideImage).toHaveAttribute("data-zoom", "1")
    const svgBox = await slideImage.boundingBox()
    expect(svgBox?.width ?? 0).toBeGreaterThanOrEqual(400)
    expect(svgBox?.height ?? 0).toBeGreaterThanOrEqual(250)
    await lightbox.getByRole("button", { name: "확대" }).click()
    await expect(slideImage).toHaveAttribute("data-zoom", "1.5")
    await lightbox.getByRole("button", { name: "축소" }).click()
    await expect(slideImage).toHaveAttribute("data-zoom", "1")

    await lightbox.getByRole("button", { name: "다음 파일 보기" }).click()
    const nextLightbox = page.getByRole("dialog", { name: "server-topology.png 미리보기" })
    await expect(nextLightbox).toBeVisible()
    await expect(nextLightbox.getByText("2 / 2")).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: /미리보기$/ })).toHaveCount(0)
    await expect(detailPanel).toBeVisible()
  })

  test("만료 기한 선택형 공유 링크 발급/회수, 4개 이상 대기열 완주, 플로팅 벌크 이동·컨텍스트 이름 변경이 동작한다", async ({
    page,
  }) => {
    const mocks = await setupAdminCloudMocks(page, { initialFiles: CLOUD_FILES })
    await page.addInitScript(() => {
      Object.assign(window, { __adminCloudCopiedText: "" })
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            Object.assign(window, { __adminCloudCopiedText: text })
          },
        },
      })
    })

    await page.goto("/admin/cloud")

    // 1. Custom-Expiry Signed Share Link Modal (7일 / 1시간 발급, 조회, 회수)
    await page.locator('button[title="home-server-rack.png"]').click()
    const detailPanel = page.getByLabel("클라우드 상세정보")
    await detailPanel.getByRole("button", { name: "공유 링크" }).click()

    const shareDialog = page.getByRole("dialog", { name: "공유 링크 관리" })
    await expect(shareDialog).toBeVisible()
    await shareDialog.getByRole("button", { name: "7일" }).click()
    await shareDialog.getByRole("button", { name: "공유 링크 발급" }).click()
    await expect.poll(() => mocks.shareLinkRequests).toEqual([{ fileId: "102", ttlSeconds: 604800 }])
    await expect(shareDialog.getByLabel("서명 외부 공유 링크")).toHaveValue(
      /\/system\/api\/v1\/public\/cloud\/files\/102\/share\?token=share-token-102-604800/
    )
    await shareDialog.getByRole("tab", { name: "관리자 내부 경로" }).click()
    await expect(shareDialog.getByLabel("관리자 내부 경로")).toHaveValue(/\/system\/api\/v1\/adm\/cloud\/files\/102\/content/)
    await shareDialog.getByRole("tab", { name: "서명 외부 공유 링크" }).click()
    await expect(shareDialog.getByRole("button", { name: "회수" }).first()).toBeVisible()
    await shareDialog.getByRole("button", { name: "모두 회수" }).click()
    await expect.poll(() => mocks.revokedShareLinkIds.length).toBeGreaterThan(0)
    await shareDialog.getByRole("button", { name: "닫기" }).click()
    await expect(shareDialog).toHaveCount(0)

    // 2. Upload 4+ files simultaneously to verify scheduler re-entry finishes every queued item
    await page.getByLabel("클라우드 파일 업로드").setInputFiles([
      { name: "batch-1.txt", mimeType: "text/plain", buffer: Buffer.from("one") },
      { name: "batch-2.txt", mimeType: "text/plain", buffer: Buffer.from("two") },
      { name: "batch-3.txt", mimeType: "text/plain", buffer: Buffer.from("three") },
      { name: "batch-4.txt", mimeType: "text/plain", buffer: Buffer.from("four") },
    ])
    await expect.poll(() => mocks.uploadedNames, { timeout: 10_000 }).toEqual(
      expect.arrayContaining(["batch-1.txt", "batch-2.txt", "batch-3.txt", "batch-4.txt"])
    )

    // 3. List view: sortable column header + context menu rename + FloatingBulkBar MoveItemsModal
    await switchToCloudListView(page)
    await page.getByRole("button", { name: "이름" }).click()
    await page.getByRole("checkbox", { name: "batch-1.txt 선택" }).check()
    await page.getByRole("checkbox", { name: "batch-2.txt 선택" }).check()
    const bulkBar = page.getByRole("region", { name: "2개 선택됨" })
    await expect(bulkBar).toBeVisible()
    await bulkBar.getByRole("button", { name: "폴더 이동" }).click()

    const moveDialog = page.getByRole("dialog", { name: "선택한 2개 파일 이동" })
    await expect(moveDialog).toBeVisible()
    await moveDialog.getByRole("textbox", { name: "이동할 폴더" }).fill("2026 세미나/자료")
    await moveDialog.getByRole("button", { name: "이동" }).click()
    await expect(moveDialog).toHaveCount(0)
    await expect(page.getByRole("status").filter({ hasText: "2개 파일을 이동했습니다." })).toBeVisible()

    await page.locator('button[title="batch-3.txt"]').click({ button: "right" })
    const contextMenu = page.getByRole("menu", { name: "batch-3.txt 더 보기" })
    await expect(contextMenu).toBeVisible()
    await contextMenu.getByRole("menuitem", { name: /이름 변경/ }).click()

    const renameDialog = page.getByRole("dialog", { name: "파일 이름 변경" })
    await expect(renameDialog).toBeVisible()
    await renameDialog.getByRole("textbox", { name: "새 파일 이름" }).fill("batch-3-renamed.txt")
    await renameDialog.getByRole("button", { name: "저장" }).click()
    await expect(renameDialog).toHaveCount(0)
    await expect(page.getByRole("row", { name: /batch-3-renamed\.txt/ })).toBeVisible()

    // 4. Keyboard F2 shortcut opens rename dialog for active file
    await page.locator('button[title="batch-3-renamed.txt"]').click()
    await page.locator("body").press("F2")
    await expect(page.getByRole("dialog", { name: "파일 이름 변경" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: "파일 이름 변경" })).toHaveCount(0)
  })

  test("CloudShareLinkModal은 navigator.clipboard 미지원 시 거짓 복사 토스트 없이 에러 토스트를 표시한다", async ({
    page,
  }) => {
    const mocks = await setupAdminCloudMocks(page, { initialFiles: CLOUD_FILES })
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      })
    })

    await page.goto("/admin/cloud")
    await page.locator('button[title="home-server-rack.png"]').click()
    await page.getByLabel("클라우드 상세정보").getByRole("button", { name: "공유 링크" }).click()

    const shareDialog = page.getByRole("dialog", { name: "공유 링크 관리" })
    await expect(shareDialog).toBeVisible()
    await shareDialog.getByRole("button", { name: "공유 링크 발급" }).click()
    await expect.poll(() => mocks.shareLinkRequests.length).toBe(1)

    const shareErrorToast = page.getByRole("status").filter({ hasText: "클립보드 접근 권한이 없습니다" })
    await expect(shareErrorToast).toBeVisible()
    await expect(page.getByText(/복사됨/)).toHaveCount(0)
    const toastZOrder = await shareErrorToast.evaluate((toastEl) => {
      const dialog = document.querySelector('[role="dialog"]')
      const backdrop = dialog?.parentElement
      const rect = toastEl.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return {
        toastZ: Number.parseInt(window.getComputedStyle(toastEl).zIndex || "0", 10),
        backdropZ: Number.parseInt(backdrop ? window.getComputedStyle(backdrop).zIndex || "0" : "0", 10),
        hitsToast: hit !== null && (hit === toastEl || toastEl.contains(hit)),
      }
    })
    expect(toastZOrder.toastZ).toBeGreaterThan(toastZOrder.backdropZ)
    expect(toastZOrder.hitsToast).toBe(true)
    await shareErrorToast.getByRole("button", { name: "닫기" }).click()
    await expect(shareErrorToast).toHaveCount(0)
    await expect(shareDialog.getByLabel("서명 외부 공유 링크")).toHaveValue(
      /\/system\/api\/v1\/public\/cloud\/files\/102\/share\?token=/
    )

    await shareDialog.getByRole("tab", { name: "관리자 내부 경로" }).click()
    const copyInternalBtn = shareDialog.getByRole("button", { name: "관리자 경로 복사" })
    await copyInternalBtn.click()
    await expect(
      page.getByRole("status").filter({ hasText: "클립보드 접근 권한이 없습니다" })
    ).toBeVisible()
    await expect(copyInternalBtn).toHaveText("관리자 경로 복사")
    await expect(page.getByText(/복사됨/)).toHaveCount(0)
  })

  test("(pointer: coarse) 환경에서 그리드·테이블 체크박스 >=44x44px 터치 영역과 CloudModalBackdrop z-index(210 > 160)가 충족된다", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    })
    const page = await context.newPage()
    try {
      await setupAdminCloudMocks(page, { initialFiles: CLOUD_FILES })
      await page.goto("/admin/cloud")

      const pointerCoarse = await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)
      expect(pointerCoarse).toBe(true)

      const gridCheckbox = page.getByRole("checkbox", { name: "home-server-rack.png 선택" })
      const gridHitArea = gridCheckbox.locator("..")
      await expect(gridHitArea).toBeVisible()
      const gridBox = await gridHitArea.boundingBox()
      expect(gridBox?.width ?? 0).toBeGreaterThanOrEqual(44)
      expect(gridBox?.height ?? 0).toBeGreaterThanOrEqual(44)
      await gridHitArea.click({ position: { x: 4, y: 4 } })
      await expect(gridCheckbox).toBeChecked()

      await switchToCloudListView(page)
      const tableCheckbox = page.getByRole("checkbox", { name: "home-server-rack.png 선택" })
      const tableHitArea = tableCheckbox.locator("..")
      await expect(tableHitArea).toBeVisible()
      const tableBox = await tableHitArea.boundingBox()
      expect(tableBox?.width ?? 0).toBeGreaterThanOrEqual(44)
      expect(tableBox?.height ?? 0).toBeGreaterThanOrEqual(44)
      await expect(tableCheckbox).toBeChecked()
      await tableHitArea.click({ position: { x: 4, y: 4 } })
      await expect(tableCheckbox).not.toBeChecked()
      await tableHitArea.click({ position: { x: 4, y: 4 } })
      await expect(tableCheckbox).toBeChecked()
      await tableHitArea.click({ position: { x: 4, y: 4 } })
      await expect(tableCheckbox).not.toBeChecked()

      await page.getByRole("button", { name: /새 폴더/ }).click()
      const newFolderDialog = page.getByRole("dialog", { name: "새 폴더 만들기" })
      await expect(newFolderDialog).toBeVisible()
      const backdropZIndex = await newFolderDialog
        .locator("..")
        .evaluate((el) => Number(window.getComputedStyle(el).zIndex))
      expect(backdropZIndex).toBe(210)
      expect(backdropZIndex).toBeGreaterThan(160)
    } finally {
      await context.close()
    }
  })

  test("?folder=docs 직접 진입 시 facets.folders 기반 하위 폴더 브레드크럼 탐색과 OLDEST 정렬 URL 동기화가 동작한다", async ({
    page,
  }) => {
    const folderFiles: CloudFileFixture[] = [
      {
        id: 201,
        ownerMemberId: 1,
        originalFilename: "docs-older.pdf",
        contentType: "application/pdf",
        byteSize: 1024,
        mediaKind: "DOCUMENT",
        folderPath: "docs",
        createdAt: "2026-06-08T09:00:00Z",
        modifiedAt: "2026-06-08T09:00:00Z",
      },
      {
        id: 202,
        ownerMemberId: 1,
        originalFilename: "docs-root.pdf",
        contentType: "application/pdf",
        byteSize: 2048,
        mediaKind: "DOCUMENT",
        folderPath: "docs",
        createdAt: "2026-06-10T09:00:00Z",
        modifiedAt: "2026-06-10T09:00:00Z",
      },
      {
        id: 203,
        ownerMemberId: 1,
        originalFilename: "docs-2026.pdf",
        contentType: "application/pdf",
        byteSize: 3072,
        mediaKind: "DOCUMENT",
        folderPath: "docs/2026",
        createdAt: "2026-06-12T09:00:00Z",
        modifiedAt: "2026-06-12T09:00:00Z",
      },
      {
        id: 204,
        ownerMemberId: 1,
        originalFilename: "docs-2026-q1.pdf",
        contentType: "application/pdf",
        byteSize: 4096,
        mediaKind: "DOCUMENT",
        folderPath: "docs/2026/q1",
        createdAt: "2026-06-14T09:00:00Z",
        modifiedAt: "2026-06-14T09:00:00Z",
      },
      {
        id: 205,
        ownerMemberId: 1,
        originalFilename: "photos-unrelated.png",
        contentType: "image/png",
        byteSize: 512,
        mediaKind: "PHOTO",
        folderPath: "photos",
        createdAt: "2026-06-15T09:00:00Z",
        modifiedAt: "2026-06-15T09:00:00Z",
      },
    ]

    await setupAdminCloudMocks(page, { initialFiles: folderFiles })
    await page.goto("/admin/cloud?folder=docs")
    await switchToCloudListView(page)

    await expect(page.getByRole("row", { name: /docs-root\.pdf/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /docs-older\.pdf/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /docs-2026\.pdf/ })).toHaveCount(0)

    const subfolder2026 = page.locator('button[title="/docs/2026"]')
    await expect(subfolder2026).toBeVisible()
    await subfolder2026.click()

    await expect.poll(() => new URL(page.url()).searchParams.get("folder")).toBe("docs/2026")
    await expect(page.getByRole("row", { name: /docs-2026\.pdf/ })).toBeVisible()
    await expect(page.locator('button[title="/docs/2026/q1"]')).toBeVisible()

    await page.locator('nav[aria-label="폴더 경로 탐색"] button[title="/docs"]').click()
    await expect.poll(() => new URL(page.url()).searchParams.get("folder")).toBe("docs")
    await expect(page.getByRole("row", { name: /docs-root\.pdf/ })).toBeVisible()

    await page.getByLabel("파일 정렬").selectOption("OLDEST")
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("OLDEST")
    expect(new URL(page.url()).searchParams.get("dir")).toBeNull()
    await expect(page.locator("tbody tr").first()).toContainText("docs-older.pdf")

    await page.goto("/admin/cloud?folder=docs&sort=OLDEST&dir=desc")
    await expect(page.getByRole("row", { name: /docs-root\.pdf/ })).toBeVisible()
    await page.waitForTimeout(200)
    expect(new URL(page.url()).searchParams.get("sort")).toBe("OLDEST")
    expect(new URL(page.url()).searchParams.get("dir")).toBe("desc")
    await expect(page.locator("tbody tr").first()).toContainText("docs-root.pdf")

    const savedPrefsJson = await page.evaluate(() =>
      window.localStorage.getItem("admin.cloud.viewPreferences.v1")
    )
    expect(savedPrefsJson).not.toBeNull()
    expect(JSON.parse(savedPrefsJson ?? "{}").viewMode).toBe("list")

    await page.goto("/admin/cloud?folder=docs&dir=asc")
    await expect(page.getByRole("row", { name: /docs-root\.pdf/ })).toBeVisible()
    await page.waitForTimeout(200)
    expect(new URL(page.url()).searchParams.get("sort")).toBeNull()
    expect(new URL(page.url()).searchParams.get("dir")).toBe("asc")
    await expect(page.locator("tbody tr").first()).toContainText("docs-older.pdf")

    const prefsAfterUrlHydration = await page.evaluate(() =>
      window.localStorage.getItem("admin.cloud.viewPreferences.v1")
    )
    expect(JSON.parse(prefsAfterUrlHydration ?? "{}")).toMatchObject({
      viewMode: "list",
      sortMode: "OLDEST",
    })

    const pushedSpaRoute = await page.evaluate(async () => {
      const nextWin = window as Window & {
        next?: { router?: { push: (url: string) => Promise<boolean> } }
      }
      if (!nextWin.next?.router) return false
      await nextWin.next.router.push("/admin/cloud")
      return true
    })
    expect(pushedSpaRoute).toBe(true)
    await expect.poll(() => new URL(page.url()).search).toBe("")
    await expect(page.locator('button[title="/docs"]')).toBeVisible()
    await expect(page.locator('button[title="/photos"]')).toBeVisible()
    await expect(page.getByRole("row", { name: /photos-unrelated\.png/ })).toBeVisible()

    await page.goBack()
    await expect.poll(() => new URL(page.url()).searchParams.get("folder")).toBe("docs")
    await expect.poll(() => new URL(page.url()).searchParams.get("dir")).toBe("asc")
    await expect(page.getByRole("row", { name: /docs-root\.pdf/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /photos-unrelated\.png/ })).toHaveCount(0)
    await expect(page.locator('button[title="/photos"]')).toHaveCount(0)
    await expect(page.locator("tbody tr").first()).toContainText("docs-older.pdf")
  })

  test("CloudShareLinkModal과 CloudInspectorVideoSection은 파일 전환 시 이전 토큰을 즉시 비우고 지연 응답 덮어쓰기를 차단하며 .sh 업로드를 허용한다", async ({
    page,
  }) => {
    const secondVideo: CloudFileFixture = {
      id: 105,
      ownerMemberId: 1,
      originalFilename: "release-demo.mp4",
      contentType: "video/mp4",
      byteSize: 4_194_304,
      mediaKind: "VIDEO",
      folderPath: "/video",
      createdAt: "2026-06-12T12:00:00Z",
      modifiedAt: "2026-06-12T12:00:00Z",
    }
    const mocks = await setupAdminCloudMocks(page, {
      initialFiles: [...CLOUD_FILES, secondVideo],
      initialShareTokensByFileId: {
        "102": [
          {
            id: 9501,
            fileId: 102,
            purpose: "SHARE_LINK",
            createdAt: "2026-06-26T00:00:00Z",
            expiresAt: "2026-06-27T00:00:00Z",
          },
        ],
        "101": [],
      },
      shareLinksDelayMsByFileId: {
        "102": 350,
      },
      initialPlaybackTokensByFileId: {
        "103": [
          {
            id: 9601,
            fileId: 103,
            purpose: "EXTERNAL_PLAYBACK",
            createdAt: "2026-06-26T00:00:00Z",
            expiresAt: "2026-06-27T00:00:00Z",
          },
        ],
        "105": [
          {
            id: 9602,
            fileId: 105,
            purpose: "EXTERNAL_PLAYBACK",
            createdAt: "2026-06-26T00:00:00Z",
            expiresAt: "2026-06-27T00:00:00Z",
          },
        ],
      },
      externalPlaybackTokenDelayMs: 400,
      externalPlaybackTokensListDelayMsByFileId: {
        "103": 400,
      },
      shareIssueDelayMsByFileId: {
        "102": 400,
      },
    })

    await page.goto("/admin/cloud")

    // 1) CloudShareLinkModal: 102 지연 응답 중 닫고 101로 열면 9501이 남지 않고 지연 응답도 덮어쓰지 않음
    await page.locator('button[title="home-server-rack.png"]').click()
    await page.getByLabel("클라우드 상세정보").getByRole("button", { name: "공유 링크" }).click()
    const shareDialog = page.getByRole("dialog", { name: "공유 링크 관리" })
    await expect(shareDialog.getByText(/#9501/)).toBeVisible()
    await shareDialog.getByRole("button", { name: "닫기" }).click()
    await expect(shareDialog).toHaveCount(0)

    await page.locator('button[title="운영 점검 리포트.pdf"]').click()
    await page.getByLabel("클라우드 상세정보").getByRole("button", { name: "공유 링크" }).click()
    await expect(shareDialog).toBeVisible()
    await expect(shareDialog.getByText(/#9501/)).toHaveCount(0)
    await expect(shareDialog.getByText("발급된 활성 링크가 없습니다.")).toBeVisible()
    await shareDialog.getByRole("button", { name: "닫기" }).click()

    // 102 지연 요청 발생 -> 완료 전 닫기 -> 101 즉시 열기 -> 102 응답 도착 후에도 9501 미노출
    await page.locator('button[title="home-server-rack.png"]').click()
    await page.getByLabel("클라우드 상세정보").getByRole("button", { name: "공유 링크" }).click()
    await shareDialog.getByRole("button", { name: "닫기" }).click()
    await page.locator('button[title="운영 점검 리포트.pdf"]').click()
    await page.getByLabel("클라우드 상세정보").getByRole("button", { name: "공유 링크" }).click()
    await page.waitForTimeout(450)
    await expect(shareDialog.getByText(/#9501/)).toHaveCount(0)
    await expect(shareDialog.getByText("발급된 활성 링크가 없습니다.")).toBeVisible()
    await shareDialog.getByRole("button", { name: "닫기" }).click()

    // 1b) 동일 파일 모달 닫기 -> 즉시 재오픈 시 이전 발급 세션 응답 덮어쓰기 차단
    await page.locator('button[title="home-server-rack.png"]').click()
    await page.getByLabel("클라우드 상세정보").getByRole("button", { name: "공유 링크" }).click()
    await shareDialog.getByRole("button", { name: "공유 링크 발급" }).click()
    await shareDialog.getByRole("button", { name: "닫기" }).click()
    await page.getByLabel("클라우드 상세정보").getByRole("button", { name: "공유 링크" }).click()
    await page.waitForTimeout(500)
    await expect(shareDialog.getByLabel("서명 외부 공유 링크")).toHaveCount(0)
    await expect(page.getByText(/서명 외부 공유 링크 — 복사됨/)).toHaveCount(0)
    await shareDialog.getByRole("button", { name: "닫기" }).click()

    // 2) CloudInspectorVideoSection: 103 지연 조회 중 105로 전환하면 9602만 표시되고 9601로 덮어쓰지 않음
    await page.locator('button[title="deploy-walkthrough.mp4"]').click()
    await page.locator('button[title="release-demo.mp4"]').click()
    const detailPanel = page.getByLabel("클라우드 상세정보")
    await expect(detailPanel.getByText(/#9602/)).toBeVisible()
    await page.waitForTimeout(500)
    await expect(detailPanel.getByText(/#9602/)).toBeVisible()
    await expect(detailPanel.getByText(/#9601/)).toHaveCount(0)

    // 2b) 동일 동영상 103 -> 명령 발급 중 105 -> 즉시 103 복귀 시 이전 세션 명령 결과 차단
    await page.locator('button[title="deploy-walkthrough.mp4"]').click()
    await detailPanel.getByRole("button", { name: "IINA 명령 복사" }).click()
    await page.locator('button[title="release-demo.mp4"]').click()
    await page.locator('button[title="deploy-walkthrough.mp4"]').click()
    await page.waitForTimeout(500)
    await expect(detailPanel.getByLabel("수동 복사 명령")).toHaveCount(0)
    await expect(detailPanel.getByText(/IINA 명령을/)).toHaveCount(0)

    // 3) .sh 텍스트 스크립트 업로드 허용 확인
    await page.getByLabel("클라우드 파일 업로드").setInputFiles({
      name: "deploy.sh",
      mimeType: "application/x-sh",
      buffer: Buffer.from("#!/usr/bin/env bash\necho deploy\n"),
    })
    await expect.poll(() => mocks.uploadedNames).toContain("deploy.sh")
  })
})
