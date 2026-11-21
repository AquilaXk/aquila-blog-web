/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/AssetsPage.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetsGrid.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - transloadit/uppy packages/@uppy/core/src/Uppy.ts (MIT License, Copyright (c) Transloadit Ltd)
 */
import type { CloudFile, CloudMediaKind } from "src/apis/backend/cloud"
import { formatFileSize, formatWithNormalizedHours } from "src/libs/utils"

export const MAX_SVG_MARKUP_BYTES = 256 * 1024
const MAX_SVG_DIMENSION_COORD = 1_000_000

export type CloudAssetDimensions = {
  width: number
  height: number
}

export type CloudMediaFilter = "ALL" | CloudMediaKind
export type CloudSortMode = "LATEST" | "OLDEST" | "NAME" | "SIZE"
export type UploadQueueStatus = "queued" | "uploading" | "done" | "failed" | "cancelled"
export type UploadQueueItem = {
  id: string
  file: File
  name: string
  byteSize: number
  folderPath: string
  status: UploadQueueStatus
  progress: number
  message: string
  uploadedFileId?: number
  retryCount?: number
}
export type CloudSearchParams = {
  folderPath?: string
  keyword?: string
}

export const CLOUD_FILTERS: Array<{ value: CloudMediaFilter; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "DOCUMENT", label: "문서" },
  { value: "PHOTO", label: "사진" },
  { value: "VIDEO", label: "동영상" },
]

export const CLOUD_SORT_OPTIONS: ReadonlyArray<{ key: CloudSortMode; label: string }> = [
  { key: "LATEST", label: "최신순" },
  { key: "OLDEST", label: "오래된순" },
  { key: "NAME", label: "이름순" },
  { key: "SIZE", label: "크기순" },
]

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const

export const getCloudKindLabel = (kind: CloudMediaFilter) => {
  if (kind === "DOCUMENT") return "문서"
  if (kind === "PHOTO") return "사진"
  if (kind === "VIDEO") return "동영상"
  return "전체"
}

export const getCloudInspectorHeading = (file: CloudFile): string => file.originalFilename

export const isSvgCloudFile = (
  file: Pick<CloudFile, "contentType" | "originalFilename">
): boolean => {
  if ((file.contentType || "").toLowerCase().includes("svg")) return true
  const trimmed = (file.originalFilename || "").trim()
  const dotIdx = trimmed.lastIndexOf(".")
  return dotIdx >= 0 && trimmed.slice(dotIdx + 1).toLowerCase() === "svg"
}

export const isImageCloudFile = (
  file: Pick<CloudFile, "mediaKind" | "contentType" | "originalFilename">
): boolean =>
  file.mediaKind === "PHOTO" ||
  (file.contentType || "").toLowerCase().includes("image") ||
  isSvgCloudFile(file)

export const appendCloudAssetVersionUrl = (url: string, versionStamp?: string): string => {
  const stamp = versionStamp?.trim()
  if (!stamp) return url
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}v=${encodeURIComponent(stamp)}`
}

const isAsciiWhitespace = (code: number): boolean =>
  code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0c

const isAttrNameStop = (code: number): boolean =>
  isAsciiWhitespace(code) || code === 0x3d || code === 0x3e || code === 0x2f

const isUnquotedValStop = (code: number): boolean =>
  isAsciiWhitespace(code) || code === 0x3e || code === 0x2f

const parseSvgPixelLength = (raw: string | null): number | null => {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || !/^\+?(?:\d+\.?\d*|\.\d+)(?:px)?$/i.test(trimmed)) return null
  const value = Number.parseFloat(trimmed)
  if (!Number.isFinite(value) || value <= 0 || value > MAX_SVG_DIMENSION_COORD) return null
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : null
}

const parseSvgViewBoxDimensions = (raw: string | null): CloudAssetDimensions | null => {
  if (!raw) return null
  const tokens = raw.trim().split(/[\s,]+/)
  if (tokens.length !== 4) return null
  const [minX, minY, vbWidth, vbHeight] = tokens.map(Number)
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null
  if (!Number.isFinite(vbWidth) || vbWidth <= 0 || vbWidth > MAX_SVG_DIMENSION_COORD) return null
  if (!Number.isFinite(vbHeight) || vbHeight <= 0 || vbHeight > MAX_SVG_DIMENSION_COORD) return null
  const width = Math.round(vbWidth)
  const height = Math.round(vbHeight)
  return width > 0 && height > 0 ? { width, height } : null
}

const locateSvgStartTagBodyOffset = (svgText: string): number => {
  const len = svgText.length
  let i = svgText.charCodeAt(0) === 0xfeff ? 1 : 0
  while (i < len) {
    const lt = svgText.indexOf("<", i)
    if (lt < 0 || lt + 3 >= len) return -1
    if (svgText.startsWith("<!--", lt)) {
      const endComment = svgText.indexOf("-->", lt + 4)
      if (endComment < 0) return -1
      i = endComment + 3
      continue
    }
    if (svgText.startsWith("<?", lt)) {
      const endPi = svgText.indexOf("?>", lt + 2)
      if (endPi < 0) return -1
      i = endPi + 2
      continue
    }
    if (svgText.slice(lt, lt + 9).toLowerCase() === "<!doctype") {
      let cursor = lt + 9
      let bracketDepth = 0
      while (cursor < len) {
        const ch = svgText.charCodeAt(cursor)
        if (ch === 0x5b) bracketDepth += 1
        else if (ch === 0x5d && bracketDepth > 0) bracketDepth -= 1
        else if (ch === 0x3e && bracketDepth === 0) break
        cursor += 1
      }
      if (cursor >= len) return -1
      i = cursor + 1
      continue
    }
    const c1 = svgText.charCodeAt(lt + 1) | 0x20
    const c2 = svgText.charCodeAt(lt + 2) | 0x20
    const c3 = svgText.charCodeAt(lt + 3) | 0x20
    const nextCode = lt + 4 < len ? svgText.charCodeAt(lt + 4) : 0x3e
    if (c1 === 0x73 && c2 === 0x76 && c3 === 0x67 && isUnquotedValStop(nextCode)) {
      return lt + 4
    }
    i = lt + 1
  }
  return -1
}

export const parseSvgDimensionsFromMarkup = (svgText: string): CloudAssetDimensions | null => {
  if (!svgText || svgText.length > MAX_SVG_MARKUP_BYTES || svgText.indexOf("\0") !== -1) {
    return null
  }
  let cursor = locateSvgStartTagBodyOffset(svgText)
  if (cursor < 0) return null

  const len = svgText.length
  let widthAttr: string | null = null
  let heightAttr: string | null = null
  let viewBoxAttr: string | null = null

  while (cursor < len) {
    while (cursor < len && isAsciiWhitespace(svgText.charCodeAt(cursor))) cursor += 1
    if (cursor >= len) return null
    const ch = svgText.charCodeAt(cursor)
    if (ch === 0x3e) break
    if (ch === 0x2f) {
      cursor += 1
      continue
    }
    const nameStart = cursor
    while (cursor < len && !isAttrNameStop(svgText.charCodeAt(cursor))) cursor += 1
    if (cursor === nameStart) {
      cursor += 1
      continue
    }
    const attrName = svgText.slice(nameStart, cursor).toLowerCase()
    while (cursor < len && isAsciiWhitespace(svgText.charCodeAt(cursor))) cursor += 1
    if (cursor >= len || svgText.charCodeAt(cursor) !== 0x3d) continue
    cursor += 1
    while (cursor < len && isAsciiWhitespace(svgText.charCodeAt(cursor))) cursor += 1
    if (cursor >= len) return null

    const quote = svgText.charCodeAt(cursor)
    let attrValue = ""
    if (quote === 0x22 || quote === 0x27) {
      const closeIdx = svgText.indexOf(quote === 0x22 ? '"' : "'", cursor + 1)
      if (closeIdx < 0) return null
      attrValue = svgText.slice(cursor + 1, closeIdx)
      cursor = closeIdx + 1
    } else {
      const valStart = cursor
      while (cursor < len && !isUnquotedValStop(svgText.charCodeAt(cursor))) cursor += 1
      attrValue = svgText.slice(valStart, cursor)
    }

    if (attrName === "width") widthAttr = attrValue
    else if (attrName === "height") heightAttr = attrValue
    else if (attrName === "viewbox") viewBoxAttr = attrValue
  }

  const parsedWidth = parseSvgPixelLength(widthAttr)
  const parsedHeight = parseSvgPixelLength(heightAttr)
  if (parsedWidth !== null && parsedHeight !== null) {
    return { width: parsedWidth, height: parsedHeight }
  }
  return parseSvgViewBoxDimensions(viewBoxAttr)
}

export const getCloudKindBadge = (file: CloudFile) => {
  const extension = getCloudFileExtension(file.originalFilename)
  if (file.mediaKind === "DOCUMENT") return extension || "DOC"
  if (file.mediaKind === "PHOTO") return extension || "IMG"
  return extension || "MP4"
}

export const getCloudKindIconLabel = (file: CloudFile) => {
  return getCloudKindBadge(file)
}

export const getCloudFileExtension = (filename: string) => {
  const trimmed = filename.trim()
  const extension = trimmed.includes(".") ? trimmed.split(".").pop() : ""
  const normalized = extension?.replace(/[^A-Za-z0-9]+/g, "").toUpperCase() ?? ""
  return normalized.slice(0, 4)
}

export const formatCloudFileSize = (bytes: number) =>
  formatFileSize(bytes, { fallback: "0 B" })

const CLOUD_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Seoul",
})

export const formatCloudDate = (value?: string) => {
  if (!value) return "날짜 없음"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "날짜 없음"
  return formatWithNormalizedHours(CLOUD_DATE_FORMATTER, date)
}

export const getUploadStatusLabel = (status: UploadQueueStatus) => {
  if (status === "queued") return "대기"
  if (status === "uploading") return "업로드 중"
  if (status === "done") return "완료"
  if (status === "failed") return "실패"
  return "취소됨"
}

export const isUploadActive = (status: UploadQueueStatus) => status === "queued" || status === "uploading"

export const normalizeCloudFolderPathSearch = (value: string) => value.trim().replace(/^\/+|\/+$/g, "")

export const resolveCloudSearchParams = (input: string): CloudSearchParams => {
  const trimmed = input.trim()
  if (!trimmed) return { folderPath: "", keyword: "" }
  if (!trimmed.startsWith("/")) return { folderPath: "", keyword: trimmed }

  const spaceIndex = trimmed.search(/\s/)
  const rawFolder = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)
  const rawKeyword = spaceIndex === -1 ? "" : trimmed.slice(spaceIndex + 1).trim()
  const folderPath = normalizeCloudFolderPathSearch(rawFolder)

  return {
    folderPath,
    keyword: rawKeyword,
  }
}

export const extractCloudFolders = (
  files: readonly CloudFile[],
  activeFolderPath = "",
): string[] => {
  const folders = new Set<string>()
  const normalizedActive = normalizeCloudFolderPathSearch(activeFolderPath)
  if (normalizedActive) folders.add(normalizedActive)
  files.forEach((file) => {
    const normalized = normalizeCloudFolderPathSearch(file.folderPath)
    if (normalized) folders.add(normalized)
  })
  return Array.from(folders).sort((a, b) => a.localeCompare(b, "ko", { numeric: true }))
}

export const applyCloudFolderFilter = (currentSearchText: string, folderPath: string): string => {
  const current = resolveCloudSearchParams(currentSearchText)
  const normalizedTarget = normalizeCloudFolderPathSearch(folderPath)
  const currentFolder = normalizeCloudFolderPathSearch(current.folderPath ?? "")
  const currentKeyword = (current.keyword ?? "").trim()

  if (!normalizedTarget || normalizedTarget === currentFolder) {
    return currentKeyword
  }

  return currentKeyword ? `/${normalizedTarget} ${currentKeyword}` : `/${normalizedTarget}`
}

export const updateCachedCloudFilesForMutation = (
  current: readonly CloudFile[],
  updated: CloudFile,
  filter: CloudMediaFilter,
  keyword: string,
): CloudFile[] => {
  if (!doesCloudFileMatchFilters(updated, filter, keyword)) {
    return current.filter((item) => item.id !== updated.id)
  }
  if (current.some((item) => item.id === updated.id)) {
    return current.map((item) => (item.id === updated.id ? updated : item))
  }
  return [updated, ...current]
}

const toCloudTimestamp = (value?: string): number => {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export const sortCloudFiles = (
  files: readonly CloudFile[],
  sortMode: CloudSortMode,
): CloudFile[] => {
  if (sortMode === "NAME") {
    const copy = [...files]
    copy.sort((a, b) => {
      const nameDiff = a.originalFilename.localeCompare(b.originalFilename, "ko", { numeric: true })
      return nameDiff !== 0 ? nameDiff : a.id - b.id
    })
    return copy
  }
  if (sortMode === "SIZE") {
    const copy = [...files]
    copy.sort((a, b) => {
      const sizeDiff = b.byteSize - a.byteSize
      return sizeDiff !== 0 ? sizeDiff : b.id - a.id
    })
    return copy
  }
  const withTimestamps = files.map((file) => ({
    file,
    ts: toCloudTimestamp(file.modifiedAt || file.createdAt),
  }))
  if (sortMode === "OLDEST") {
    withTimestamps.sort((a, b) => {
      const timeDiff = a.ts - b.ts
      return timeDiff !== 0 ? timeDiff : a.file.id - b.file.id
    })
  } else {
    withTimestamps.sort((a, b) => {
      const timeDiff = b.ts - a.ts
      return timeDiff !== 0 ? timeDiff : b.file.id - a.file.id
    })
  }
  return withTimestamps.map((entry) => entry.file)
}

export const doesCloudFileMatchSearchParams = (
  file: CloudFile,
  filter: CloudMediaFilter,
  searchParams: CloudSearchParams,
  normalizedKeyword = (searchParams.keyword ?? "").toLowerCase(),
) => {
  const matchesKind = filter === "ALL" || file.mediaKind === filter
  const matchesFolderPath =
    !searchParams.folderPath ||
    normalizeCloudFolderPathSearch(file.folderPath) === searchParams.folderPath
  const matchesKeyword = !normalizedKeyword || file.originalFilename.toLowerCase().includes(normalizedKeyword)
  return matchesKind && matchesFolderPath && matchesKeyword
}

export const doesCloudFileMatchFilters = (
  file: CloudFile,
  filter: CloudMediaFilter,
  searchText: string,
) => {
  const searchParams = resolveCloudSearchParams(searchText)
  return doesCloudFileMatchSearchParams(file, filter, searchParams)
}

export type CloudEmptyStateInput = {
  activeUploadCount: number
  debouncedKeyword: string
  filter: CloudMediaFilter
  isError: boolean
  isFetching: boolean
  isLoading: boolean
  keyword: string
}

export const isCloudSearchPending = (keyword: string, debouncedKeyword: string) => keyword !== debouncedKeyword

export const resolveCloudEmptyTitle = ({
  activeUploadCount,
  debouncedKeyword,
  filter,
  isError,
  isFetching,
  isLoading,
  keyword,
}: CloudEmptyStateInput) => {
  if (isLoading) return "파일을 불러오는 중입니다."
  if (isError) return "파일 목록을 불러오지 못했습니다."
  if (activeUploadCount > 0) return "업로드 중인 파일이 있습니다."
  if (isCloudSearchPending(keyword, debouncedKeyword) || isFetching) return "검색 중입니다."
  if (debouncedKeyword || filter !== "ALL") return "선택한 조건에 맞는 파일이 없습니다."
  return "표시할 파일이 없습니다."
}

export const shouldShowCloudEmptyLoading = ({
  filesCount,
  isLoading,
  isSearchPending,
}: {
  filesCount: number
  isLoading: boolean
  isSearchPending: boolean
}) => filesCount === 0 && (isLoading || isSearchPending)

export const mergeCloudFiles = (primary: CloudFile[], secondary: CloudFile[]) => {
  const seen = new Set<number>()
  const merged: CloudFile[] = []

  for (const file of primary) {
    if (seen.has(file.id)) continue
    seen.add(file.id)
    merged.push(file)
  }
  for (const file of secondary) {
    if (seen.has(file.id)) continue
    seen.add(file.id)
    merged.push(file)
  }

  return merged
}

export const getCloudSummary = (files: readonly CloudFile[]) => {
  let totalBytes = 0
  let documentCount = 0
  let photoCount = 0
  let videoCount = 0

  for (const file of files) {
    totalBytes += file.byteSize
    if (file.mediaKind === "DOCUMENT") documentCount += 1
    else if (file.mediaKind === "PHOTO") photoCount += 1
    else if (file.mediaKind === "VIDEO") videoCount += 1
  }

  return {
    totalCount: files.length,
    totalBytes,
    totalSize: formatCloudFileSize(totalBytes),
    documentCount,
    photoCount,
    videoCount,
  }
}

let nextUploadQueueItemSequence = 1

export const createUploadQueueItem = (file: File, folderPath: string): UploadQueueItem => {
  const sequence = nextUploadQueueItemSequence
  nextUploadQueueItemSequence += 1
  return {
    id: `${Date.now()}-${file.name}-${file.size}-${sequence}`,
    file,
    name: file.name,
    byteSize: file.size,
    folderPath,
    status: "queued",
    progress: 0,
    message: "업로드 대기 중",
  }
}

export const applyUploadQueueProgress = (
  current: UploadQueueItem[],
  targetId: string,
  progress: number,
  message: string
): UploadQueueItem[] =>
  current.map((item) =>
    item.id === targetId && item.status !== "cancelled" ? { ...item, progress, message } : item
  )

export const applyUploadQueueSuccess = (
  current: UploadQueueItem[],
  targetId: string,
  uploadedFileId: number
): UploadQueueItem[] =>
  current.map((item) =>
    item.id === targetId && item.status !== "cancelled"
      ? {
          ...item,
          status: "done",
          progress: 100,
          message: "업로드 완료",
          uploadedFileId,
        }
      : item
  )

export const applyUploadQueueFailure = (
  current: UploadQueueItem[],
  targetId: string,
  aborted: boolean,
  failureMessage: string
): UploadQueueItem[] =>
  current.map((item) =>
    item.id === targetId
      ? {
          ...item,
          status: aborted ? "cancelled" : "failed",
          progress: aborted ? 0 : 100,
          message: failureMessage,
        }
      : item
  )

const sanitizeClientFilenameForDisplayFallback = (filename: string) => {
  const normalized = filename
    .replace(/[\r\n\t]/g, " ")
    .replace(/[\\/]/g, "_")
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()

  return Array.from(normalized).slice(0, 255).join("")
}

export const preferClientFilenameForUploadedFile = (uploaded: CloudFile, clientFilename: string): CloudFile => {
  const normalizedClientFilename = sanitizeClientFilenameForDisplayFallback(clientFilename)
  if (!normalizedClientFilename) return uploaded
  const serverFilename = uploaded.originalFilename.trim()
  if (normalizedClientFilename === serverFilename) return uploaded

  const clientHasReadableUnicode = /[^\x00-\x7F]/u.test(normalizedClientFilename)
  const serverLostReadableUnicode = !/[^\x00-\x7F]/u.test(serverFilename)
  const serverLooksLikePlaceholder = /_{4,}/.test(serverFilename)
  if (!clientHasReadableUnicode || !serverLostReadableUnicode || !serverLooksLikePlaceholder) return uploaded

  return {
    ...uploaded,
    originalFilename: normalizedClientFilename,
  }
}

export const isAbortLikeError = (error: unknown) =>
  error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")
