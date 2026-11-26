// 참조 구현: filebrowser/filebrowser (Apache-2.0) & supabase/supabase StorageExplorer (Apache-2.0) — 폴더 경로 탐색·URL 상태·안전 선호도 저장
import type { CloudFile } from "src/apis/backend/cloud"
import type { CloudMediaFilter, CloudSortDirection, CloudSortMode } from "../AdminCloudWorkspaceModel"

const CLOUD_VIEW_PREFERENCES_STORAGE_KEY = "admin.cloud.viewPreferences.v1"

export type CloudViewMode = "grid" | "list"

export type CloudViewPreferences = {
  viewMode: CloudViewMode
  sortMode: CloudSortMode
  sortDirection: CloudSortDirection
}

export type CloudBreadcrumbItem = {
  label: string
  path: string
}

export const normalizeCloudFolderPath = (raw: string): string =>
  raw
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")

export const validateCloudFolderPath = (raw: string): { ok: true; path: string } | { ok: false } => {
  const normalized = normalizeCloudFolderPath(raw)
  if (!normalized) return { ok: true, path: "" }
  if (normalized.length > 180) return { ok: false }
  const segments = normalized.split("/")
  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed || trimmed === "." || trimmed === ".." || /[\u0000-\u001F\u007F]/.test(trimmed)) {
      return { ok: false }
    }
  }
  return {
    ok: true,
    path: segments.map((segment) => segment.trim()).join("/"),
  }
}

export const buildCloudFolderBreadcrumbs = (
  activeFolderPath: string,
  rootLabel = "루트"
): CloudBreadcrumbItem[] => {
  const crumbs: CloudBreadcrumbItem[] = [{ label: rootLabel, path: "" }]
  const normalized = normalizeCloudFolderPath(activeFolderPath)
  if (!normalized) return crumbs

  const parts = normalized.split("/")
  let accumulated = ""
  for (const part of parts) {
    accumulated = accumulated ? `${accumulated}/${part}` : part
    crumbs.push({ label: part, path: accumulated })
  }
  return crumbs
}

export const extractAllCloudFolders = (
  files: readonly CloudFile[],
  knownFolders: readonly string[] = [],
  activeFolderPath = ""
): string[] => {
  const folderSet = new Set<string>()
  const normalizedActive = normalizeCloudFolderPath(activeFolderPath)
  if (normalizedActive) folderSet.add(normalizedActive)

  knownFolders.forEach((folder) => {
    const normalized = normalizeCloudFolderPath(folder)
    if (normalized) folderSet.add(normalized)
  })
  files.forEach((file) => {
    const normalized = normalizeCloudFolderPath(file.folderPath)
    if (normalized) folderSet.add(normalized)
  })

  return Array.from(folderSet).sort((a, b) => a.localeCompare(b, "ko", { numeric: true }))
}

export const extractDirectChildFolders = (
  allFolders: readonly string[],
  activeFolderPath: string
): string[] => {
  const normalizedActive = normalizeCloudFolderPath(activeFolderPath)
  const prefix = normalizedActive ? `${normalizedActive}/` : ""
  const directChildren = new Set<string>()

  allFolders.forEach((folder) => {
    if (prefix) {
      if (!folder.startsWith(prefix)) return
      const rest = folder.slice(prefix.length)
      const firstSegment = rest.split("/")[0]
      if (firstSegment) directChildren.add(`${normalizedActive}/${firstSegment}`)
    } else {
      const firstSegment = folder.split("/")[0]
      if (firstSegment) directChildren.add(firstSegment)
    }
  })

  return Array.from(directChildren).sort((a, b) => a.localeCompare(b, "ko", { numeric: true }))
}

export type CloudWorkspaceUrlState = {
  folderPath: string
  keyword: string
  mediaFilter: CloudMediaFilter
  sortMode: CloudSortMode
  sortDirection: CloudSortDirection
}

const VALID_FILTERS = new Set<CloudMediaFilter>(["ALL", "DOCUMENT", "PHOTO", "VIDEO"])
const VALID_SORTS = new Set<CloudSortMode>(["LATEST", "OLDEST", "NAME", "SIZE"])

const readQueryString = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || "" : value || ""

export const parseCloudWorkspaceUrlQuery = (
  query: Record<string, string | string[] | undefined>
): Partial<CloudWorkspaceUrlState> => {
  const parsed: Partial<CloudWorkspaceUrlState> = {}
  const folderRaw = readQueryString(query.folder)
  if (folderRaw) {
    const normalized = normalizeCloudFolderPath(folderRaw)
    if (normalized) parsed.folderPath = normalized
  }
  const kwRaw = readQueryString(query.kw)
  if (kwRaw) parsed.keyword = kwRaw

  const kindRaw = readQueryString(query.kind).toUpperCase() as CloudMediaFilter
  if (VALID_FILTERS.has(kindRaw)) parsed.mediaFilter = kindRaw

  const sortRaw = readQueryString(query.sort).toUpperCase() as CloudSortMode
  if (VALID_SORTS.has(sortRaw)) parsed.sortMode = sortRaw

  const dirRaw = readQueryString(query.dir).toLowerCase()
  if (dirRaw === "asc" || dirRaw === "desc") parsed.sortDirection = dirRaw

  return parsed
}

export const buildCloudWorkspaceUrlQuery = ({
  folderPath,
  keyword,
  mediaFilter,
  sortMode,
  sortDirection,
}: CloudWorkspaceUrlState): Record<string, string> => {
  const nextQuery: Record<string, string> = {}
  const normalizedFolder = normalizeCloudFolderPath(folderPath)
  if (normalizedFolder) nextQuery.folder = normalizedFolder
  if (keyword.trim()) nextQuery.kw = keyword
  if (mediaFilter !== "ALL") nextQuery.kind = mediaFilter
  if (sortMode !== "LATEST") nextQuery.sort = sortMode
  if (sortDirection !== getDefaultSortDirection(sortMode)) {
    nextQuery.dir = sortDirection
  }
  return nextQuery
}

export const getDefaultSortDirection = (sortMode: CloudSortMode): CloudSortDirection => {
  if (sortMode === "NAME" || sortMode === "OLDEST") return "asc"
  return "desc"
}

export const loadCloudViewPreferences = (
  defaults: CloudViewPreferences = { viewMode: "grid", sortMode: "LATEST", sortDirection: "desc" }
): CloudViewPreferences => {
  if (typeof window === "undefined") return defaults
  try {
    const raw = window.localStorage.getItem(CLOUD_VIEW_PREFERENCES_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<CloudViewPreferences>
    const viewMode: CloudViewMode =
      parsed.viewMode === "list" || parsed.viewMode === "grid" ? parsed.viewMode : defaults.viewMode
    const sortMode: CloudSortMode =
      parsed.sortMode && VALID_SORTS.has(parsed.sortMode) ? parsed.sortMode : defaults.sortMode
    const sortDirection: CloudSortDirection =
      parsed.sortDirection === "asc" || parsed.sortDirection === "desc"
        ? parsed.sortDirection
        : getDefaultSortDirection(sortMode)
    return { viewMode, sortMode, sortDirection }
  } catch {
    return defaults
  }
}

export const saveCloudViewPreferences = (prefs: CloudViewPreferences): void => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CLOUD_VIEW_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // 스토리지 차단(SecurityError / QuotaExceededError) 환경에서 Fail-Safe 무시
  }
}
