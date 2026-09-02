import { normalizeCategoryValue } from "src/libs/utils"
import type { SummaryIntent } from "./EditorStudioWorkspaceControllerRootModel"
import {
  clampThumbnailFocusX,
  clampThumbnailFocusY,
  clampThumbnailZoom,
  DEFAULT_THUMBNAIL_FOCUS_X,
  DEFAULT_THUMBNAIL_FOCUS_Y,
  DEFAULT_THUMBNAIL_ZOOM,
  parseThumbnailFocusXFromUrl,
  parseThumbnailFocusYFromUrl,
  parseThumbnailZoomFromUrl,
  stripThumbnailFocusFromUrl,
} from "src/libs/thumbnailFocus"
import {
  dedupeStrings,
  normalizeSafeImageUrl,
  type LocalDraftPayload,
  type LocalDraftSource,
} from "./editorStudioMetaModel"

export const TAG_CATALOG_STORAGE_KEY = "admin.editor.customTags"
export const CATEGORY_CATALOG_STORAGE_KEY = "admin.editor.customCategories"
export const LOCAL_DRAFT_CREATE_STORAGE_KEY = "admin.editor.localDraft.create.v3"
export const LOCAL_DRAFT_POST_STORAGE_KEY_PREFIX = "admin.editor.localDraft.post."
export const LOCAL_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const LOCAL_DRAFT_POST_SLOT_LIMIT = 20

export const isLocalDraftExpired = (savedAt: string, nowMs: number = Date.now()) => {
  const savedAtMs = Date.parse(savedAt)
  if (!Number.isFinite(savedAtMs)) return true
  if (savedAtMs > nowMs) return true
  return nowMs - savedAtMs >= LOCAL_DRAFT_MAX_AGE_MS
}

export const resolveLocalDraftSource = (
  editorMode: "create" | "edit",
  postId: string
): LocalDraftSource => {
  const normalizedPostId = postId.trim()
  if (editorMode === "edit" && normalizedPostId) {
    return { kind: "post", postId: normalizedPostId }
  }
  return { kind: "create" }
}

export const localDraftStorageKey = (source: LocalDraftSource): string => {
  if (source.kind === "create") return LOCAL_DRAFT_CREATE_STORAGE_KEY
  return `${LOCAL_DRAFT_POST_STORAGE_KEY_PREFIX}${source.postId.trim()}.v3`
}

export const describeLocalDraftSlot = (
  draft: Pick<LocalDraftPayload, "title" | "savedAt" | "source">
): string => {
  const savedClock = draft.savedAt ? draft.savedAt.slice(11, 16) : ""
  const savedSuffix = savedClock ? ` · ${savedClock}` : ""
  if (draft.source.kind === "create") {
    return `새 글${savedSuffix}`
  }
  const title = draft.title.trim() || "제목 없음"
  return `글 #${draft.source.postId} · ${title}${savedSuffix}`
}

export const readStoredCatalog = (storageKey: string) => {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? dedupeStrings(parsed.filter((item): item is string => typeof item === "string"))
      : []
  } catch {
    return []
  }
}

export const persistCatalog = (storageKey: string, values: string[]) => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(storageKey, JSON.stringify(dedupeStrings(values)))
}

const normalizeLocalDraftSource = (
  parsed: Partial<LocalDraftPayload>,
  fallback: LocalDraftSource
): LocalDraftSource | null => {
  const source = parsed.source
  if (!source || typeof source !== "object") return fallback
  if (source.kind === "create") return { kind: "create" }
  if (source.kind === "post" && typeof source.postId === "string" && source.postId.trim()) {
    return { kind: "post", postId: source.postId.trim() }
  }
  return fallback
}

const parseLocalDraftPayload = (
  raw: string,
  fallbackSource: LocalDraftSource
): LocalDraftPayload | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<LocalDraftPayload>
    if (!parsed || typeof parsed !== "object") return null
    const savedAt = typeof parsed.savedAt === "string" ? parsed.savedAt : ""
    if (isLocalDraftExpired(savedAt)) return null

    const source = normalizeLocalDraftSource(parsed, fallbackSource)
    if (!source) return null

    const visibility = parsed.visibility
    const isValidVisibility =
      visibility === "PRIVATE" || visibility === "PUBLIC_UNLISTED" || visibility === "PUBLIC_LISTED"
    const rawThumbnailUrl =
      typeof parsed.thumbnailUrl === "string" ? normalizeSafeImageUrl(parsed.thumbnailUrl) : ""
    const legacyFocusX = parseThumbnailFocusXFromUrl(rawThumbnailUrl, DEFAULT_THUMBNAIL_FOCUS_X)
    const legacyFocusY = parseThumbnailFocusYFromUrl(rawThumbnailUrl, DEFAULT_THUMBNAIL_FOCUS_Y)
    const legacyZoom = parseThumbnailZoomFromUrl(rawThumbnailUrl, DEFAULT_THUMBNAIL_ZOOM)
    const parsedFocusX =
      typeof parsed.thumbnailFocusX === "number"
        ? clampThumbnailFocusX(parsed.thumbnailFocusX)
        : legacyFocusX
    const parsedFocusY =
      typeof parsed.thumbnailFocusY === "number"
        ? clampThumbnailFocusY(parsed.thumbnailFocusY)
        : legacyFocusY
    const parsedZoom =
      typeof parsed.thumbnailZoom === "number"
        ? clampThumbnailZoom(parsed.thumbnailZoom)
        : legacyZoom

    const postVersion =
      typeof parsed.postVersion === "number" && Number.isFinite(parsed.postVersion)
        ? parsed.postVersion
        : null

    const summary = typeof parsed.summary === "string" ? parsed.summary : null
    const summarySource =
      parsed.summarySource === "MANUAL" ||
      parsed.summarySource === "LEADING_BLOCK" ||
      parsed.summarySource === "EXTRACTED" ||
      parsed.summarySource === "MIGRATED" ||
      parsed.summarySource === "NONE"
        ? parsed.summarySource
        : null
    const summaryIntent: SummaryIntent | null =
      parsed.summaryIntent && typeof parsed.summaryIntent === "object" && "kind" in parsed.summaryIntent
        ? parsed.summaryIntent.kind === "unchanged"
          ? { kind: "unchanged" }
          : parsed.summaryIntent.kind === "auto"
            ? { kind: "auto" }
            : parsed.summaryIntent.kind === "manual" && typeof parsed.summaryIntent.summary === "string"
              ? { kind: "manual", summary: parsed.summaryIntent.summary }
              : null
        : null
    if (summary == null || summarySource == null || summaryIntent == null) return null
    if ((summarySource === "NONE") !== (summary.length === 0)) return null
    if (summarySource !== "NONE" && summary.trim().length === 0) return null
    if (summaryIntent.kind === "manual" && summaryIntent.summary !== summary) return null

    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      content: typeof parsed.content === "string" ? parsed.content : "",
      summary,
      summarySource,
      summaryIntent,
      thumbnailUrl: stripThumbnailFocusFromUrl(rawThumbnailUrl),
      thumbnailFocusX: parsedFocusX,
      thumbnailFocusY: parsedFocusY,
      thumbnailZoom: parsedZoom,
      tags: Array.isArray(parsed.tags)
        ? dedupeStrings(parsed.tags.filter((item): item is string => typeof item === "string"))
        : [],
      category: typeof parsed.category === "string" ? normalizeCategoryValue(parsed.category) : "",
      visibility: isValidVisibility ? visibility : "PUBLIC_LISTED",
      savedAt,
      source,
      postVersion,
    }
  } catch {
    return null
  }
}

const listPostDraftEntries = (): Array<{ key: string; savedAtMs: number }> => {
  if (typeof window === "undefined") return []
  const entries: Array<{ key: string; savedAtMs: number }> = []
  const keys: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(LOCAL_DRAFT_POST_STORAGE_KEY_PREFIX) || !key.endsWith(".v3")) continue
    keys.push(key)
  }
  for (const key of keys) {
    const raw = window.localStorage.getItem(key)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as { savedAt?: string }
      const savedAtMs = Date.parse(typeof parsed.savedAt === "string" ? parsed.savedAt : "")
      if (!Number.isFinite(savedAtMs) || isLocalDraftExpired(parsed.savedAt ?? "")) {
        window.localStorage.removeItem(key)
        continue
      }
      entries.push({ key, savedAtMs })
    } catch {
      window.localStorage.removeItem(key)
    }
  }
  return entries
}

const enforceLocalDraftPostSlotLimit = () => {
  if (typeof window === "undefined") return
  const entries = listPostDraftEntries().sort((left, right) => left.savedAtMs - right.savedAtMs)
  const overflow = entries.length - LOCAL_DRAFT_POST_SLOT_LIMIT
  if (overflow <= 0) return
  for (const entry of entries.slice(0, overflow)) {
    window.localStorage.removeItem(entry.key)
  }
}

export const readLocalDraft = (source: LocalDraftSource): LocalDraftPayload | null => {
  if (typeof window === "undefined") return null

  try {
    const storageKey = localDraftStorageKey(source)
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = parseLocalDraftPayload(raw, source)
    if (!parsed) {
      window.localStorage.removeItem(storageKey)
      return null
    }
    if (parsed.source.kind !== source.kind) {
      window.localStorage.removeItem(storageKey)
      return null
    }
    if (source.kind === "post" && parsed.source.kind === "post" && parsed.source.postId !== source.postId) {
      window.localStorage.removeItem(storageKey)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export const persistLocalDraft = (payload: LocalDraftPayload) => {
  if (typeof window === "undefined") return

  const source = payload.source
  const storageKey = localDraftStorageKey(source)
  window.localStorage.setItem(storageKey, JSON.stringify(payload))
  if (source.kind === "post") {
    enforceLocalDraftPostSlotLimit()
  }
}

export const removeLocalDraft = (source: LocalDraftSource) => {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(localDraftStorageKey(source))
}
