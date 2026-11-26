/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/AssetsPage.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetsGrid.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - transloadit/uppy packages/@uppy/core/src/Uppy.ts (MIT License, Copyright (c) Transloadit Ltd)
 */
import type { CloudFile, CloudMediaKind } from "src/apis/backend/cloud"
import type { SiteLanguage } from "src/libs/language"
import { formatFileSize, formatWithNormalizedHours } from "src/libs/utils"
export {
  MAX_SVG_MARKUP_BYTES,
  parseSvgDimensionsFromMarkup,
  type CloudAssetDimensions,
} from "./cloud/cloudSvgDimensionParser"

export type CloudMediaFilter = "ALL" | CloudMediaKind
export type CloudSortMode = "LATEST" | "OLDEST" | "NAME" | "SIZE"
export type CloudSortDirection = "asc" | "desc"
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
  loadedBytes?: number
  speedBps?: number
  etaSeconds?: number | null
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

export const getCloudKindLabel = (kind: CloudMediaFilter, language: SiteLanguage = "ko") => {
  if (language === "en") {
    if (kind === "DOCUMENT") return "Document"
    if (kind === "PHOTO") return "Photo"
    if (kind === "VIDEO") return "Video"
    return "All"
  }
  if (kind === "DOCUMENT") return "문서"
  if (kind === "PHOTO") return "사진"
  if (kind === "VIDEO") return "동영상"
  return "전체"
}

export const splitCloudFilenameParts = (
  filename: string
): { stem: string; extension: string } => {
  const trimmed = filename.trim()
  const dotIdx = trimmed.lastIndexOf(".")
  if (dotIdx <= 0 || dotIdx === trimmed.length - 1) {
    return { stem: trimmed, extension: "" }
  }
  const ext = trimmed.slice(dotIdx)
  if (ext.length > 10 || /\s/.test(ext)) {
    return { stem: trimmed, extension: "" }
  }
  return {
    stem: trimmed.slice(0, dotIdx),
    extension: ext,
  }
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

const CLOUD_DATE_FORMATTER_KO = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Seoul",
})

const CLOUD_DATE_FORMATTER_EN = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Seoul",
})

export const formatCloudDate = (value?: string, language: SiteLanguage = "ko") => {
  const emptyLabel = language === "en" ? "No date" : "날짜 없음"
  if (!value) return emptyLabel
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return emptyLabel
  return formatWithNormalizedHours(
    language === "en" ? CLOUD_DATE_FORMATTER_EN : CLOUD_DATE_FORMATTER_KO,
    date
  )
}

export const getUploadStatusLabel = (status: UploadQueueStatus, language: SiteLanguage = "ko") => {
  if (language === "en") {
    if (status === "queued") return "Queued"
    if (status === "uploading") return "Uploading"
    if (status === "done") return "Done"
    if (status === "failed") return "Failed"
    return "Cancelled"
  }
  if (status === "queued") return "대기"
  if (status === "uploading") return "업로드 중"
  if (status === "done") return "완료"
  if (status === "failed") return "실패"
  return "취소됨"
}

export const isUploadActive = (status: UploadQueueStatus) =>
  status === "queued" || status === "uploading"

export const normalizeCloudFolderPathSearch = (value: string) =>
  value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")

export const extractCloudFolders = (
  files: readonly CloudFile[],
  activeFolderPath = ""
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

export const updateCachedCloudFilesForMutation = (
  current: readonly CloudFile[],
  updated: CloudFile,
  filter: CloudMediaFilter,
  keyword: string,
  activeFolderPath = ""
): CloudFile[] => {
  if (!doesCloudFileMatchFilters(updated, filter, keyword, activeFolderPath)) {
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
  direction?: CloudSortDirection
): CloudFile[] => {
  if (sortMode === "NAME") {
    const dir = direction ?? "asc"
    const copy = [...files]
    copy.sort((a, b) => {
      const nameDiff = a.originalFilename.localeCompare(b.originalFilename, "ko", { numeric: true })
      const diff = nameDiff !== 0 ? nameDiff : a.id - b.id
      return dir === "asc" ? diff : -diff
    })
    return copy
  }
  if (sortMode === "SIZE") {
    const dir = direction ?? "desc"
    const copy = [...files]
    copy.sort((a, b) => {
      const sizeDiff = b.byteSize - a.byteSize
      const diff = sizeDiff !== 0 ? sizeDiff : b.id - a.id
      return dir === "desc" ? diff : -diff
    })
    return copy
  }
  const withTimestamps = files.map((file) => ({
    file,
    ts: toCloudTimestamp(file.modifiedAt || file.createdAt),
  }))
  const effectiveDir: CloudSortDirection = direction ?? (sortMode === "OLDEST" ? "asc" : "desc")
  if (effectiveDir === "asc") {
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
  normalizedKeyword = (searchParams.keyword ?? "").trim().toLowerCase()
) => {
  const matchesKind = filter === "ALL" || file.mediaKind === filter
  const targetFolder = normalizeCloudFolderPathSearch(searchParams.folderPath ?? "")
  const matchesFolderPath =
    !targetFolder || normalizeCloudFolderPathSearch(file.folderPath) === targetFolder
  const matchesKeyword =
    !normalizedKeyword || file.originalFilename.toLowerCase().includes(normalizedKeyword)
  return matchesKind && matchesFolderPath && matchesKeyword
}

export const doesCloudFileMatchFilters = (
  file: CloudFile,
  filter: CloudMediaFilter,
  keyword: string,
  folderPath = ""
) =>
  doesCloudFileMatchSearchParams(file, filter, {
    folderPath: normalizeCloudFolderPathSearch(folderPath),
    keyword: keyword.trim(),
  })

export type CloudEmptyStateInput = {
  activeUploadCount: number
  debouncedKeyword: string
  filter: CloudMediaFilter
  isError: boolean
  isFetching: boolean
  isLoading: boolean
  keyword: string
  language?: SiteLanguage
}

export const isCloudSearchPending = (keyword: string, debouncedKeyword: string) =>
  keyword !== debouncedKeyword

export const resolveCloudEmptyTitle = ({
  activeUploadCount,
  debouncedKeyword,
  filter,
  isError,
  isFetching,
  isLoading,
  keyword,
  language = "ko",
}: CloudEmptyStateInput) => {
  if (language === "en") {
    if (isLoading) return "Loading files..."
    if (isError) return "Could not load cloud files."
    if (activeUploadCount > 0) return "Uploads are in progress."
    if (isCloudSearchPending(keyword, debouncedKeyword) || isFetching) return "Searching..."
    if (debouncedKeyword || filter !== "ALL") return "No files match your filters."
    return "No files to display."
  }
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

export const createUploadQueueItem = (
  file: File,
  folderPath: string,
  language: SiteLanguage = "ko"
): UploadQueueItem => {
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
    message: language === "en" ? "Queued" : "업로드 대기 중",
  }
}

export const applyUploadQueueProgress = (
  current: UploadQueueItem[],
  targetId: string,
  progress: number,
  message: string,
  metrics?: { loadedBytes?: number; speedBps?: number; etaSeconds?: number | null }
): UploadQueueItem[] =>
  current.map((item) =>
    item.id === targetId && item.status !== "cancelled"
      ? {
          ...item,
          progress,
          message,
          loadedBytes: metrics?.loadedBytes ?? item.loadedBytes,
          speedBps: metrics?.speedBps ?? item.speedBps,
          etaSeconds: metrics?.etaSeconds !== undefined ? metrics.etaSeconds : item.etaSeconds,
        }
      : item
  )

export const applyUploadQueueSuccess = (
  current: UploadQueueItem[],
  targetId: string,
  uploadedFileId: number,
  language: SiteLanguage = "ko"
): UploadQueueItem[] =>
  current.map((item) =>
    item.id === targetId && item.status !== "cancelled"
      ? {
          ...item,
          status: "done",
          progress: 100,
          message: language === "en" ? "Uploaded" : "업로드 완료",
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
