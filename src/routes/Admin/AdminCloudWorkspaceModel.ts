import type { CloudFile, CloudMediaKind } from "src/apis/backend/cloud"
import { formatFileSize } from "src/libs/utils"

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

export const getCloudFilenameParts = (filename: string) => {
  const trimmed = filename.trim()
  const dotIndex = trimmed.lastIndexOf(".")
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return { stem: trimmed || "이름 없는 파일", extension: "" }
  }

  return {
    stem: trimmed.slice(0, dotIndex),
    extension: trimmed.slice(dotIndex),
  }
}

export const formatCloudFileSize = (bytes: number) =>
  formatFileSize(bytes, { fallback: "0 B" })

export const formatCloudDate = (value?: string) => {
  if (!value) return "날짜 없음"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "날짜 없음"
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
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

const toCloudTimestamp = (value?: string): number => {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export const sortCloudFiles = (
  files: readonly CloudFile[],
  sortMode: CloudSortMode,
): CloudFile[] => {
  const copy = [...files]
  copy.sort((a, b) => {
    if (sortMode === "OLDEST") {
      const timeDiff = toCloudTimestamp(a.createdAt) - toCloudTimestamp(b.createdAt)
      return timeDiff !== 0 ? timeDiff : a.id - b.id
    }
    if (sortMode === "NAME") {
      const nameDiff = a.originalFilename.localeCompare(b.originalFilename, "ko", { numeric: true })
      return nameDiff !== 0 ? nameDiff : a.id - b.id
    }
    if (sortMode === "SIZE") {
      const sizeDiff = b.byteSize - a.byteSize
      return sizeDiff !== 0 ? sizeDiff : b.id - a.id
    }
    const timeDiff = toCloudTimestamp(b.createdAt) - toCloudTimestamp(a.createdAt)
    return timeDiff !== 0 ? timeDiff : b.id - a.id
  })
  return copy
}

export const doesCloudFileMatchFilters = (
  file: CloudFile,
  filter: CloudMediaFilter,
  searchText: string,
) => {
  const searchParams = resolveCloudSearchParams(searchText)
  const normalizedKeyword = (searchParams.keyword ?? "").toLowerCase()
  const matchesKind = filter === "ALL" || file.mediaKind === filter
  const matchesFolderPath =
    !searchParams.folderPath ||
    normalizeCloudFolderPathSearch(file.folderPath) === searchParams.folderPath
  const matchesKeyword = !normalizedKeyword || file.originalFilename.toLowerCase().includes(normalizedKeyword)
  return matchesKind && matchesFolderPath && matchesKeyword
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

  ;[...primary, ...secondary].forEach((file) => {
    if (seen.has(file.id)) return
    seen.add(file.id)
    merged.push(file)
  })

  return merged
}

export const getCloudSummary = (files: readonly CloudFile[]) => {
  const totalBytes = files.reduce((sum, file) => sum + file.byteSize, 0)
  const countByKind = files.reduce(
    (summary, file) => {
      summary[file.mediaKind] += 1
      return summary
    },
    { DOCUMENT: 0, PHOTO: 0, VIDEO: 0 }
  )

  return {
    totalCount: files.length,
    totalBytes,
    totalSize: formatCloudFileSize(totalBytes),
    documentCount: countByKind.DOCUMENT,
    photoCount: countByKind.PHOTO,
    videoCount: countByKind.VIDEO,
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
