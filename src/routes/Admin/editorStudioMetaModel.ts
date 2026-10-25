import { getApiBaseUrl } from "src/apis/backend/client"
import { normalizeMetaItems } from "src/apis/backend/posts/PostApiMappers"
import {
  hasNonCanonicalPostImageSource,
  isCanonicalPostImageUploadUrl,
} from "src/libs/markdown/postImageUrlPolicy"
import { normalizeCategoryValue } from "src/libs/utils"
import type { SummaryIntent } from "./EditorStudioWorkspaceControllerRootModel"
import {
  DEFAULT_THUMBNAIL_FOCUS_X,
  DEFAULT_THUMBNAIL_FOCUS_Y,
  DEFAULT_THUMBNAIL_ZOOM,
  parseThumbnailFocusXFromUrl,
  parseThumbnailFocusYFromUrl,
  parseThumbnailZoomFromUrl,
  stripThumbnailFocusFromUrl,
} from "src/libs/thumbnailFocus"
import type { PostVisibility } from "./editorStudioState"
import { dedupeStrings } from "./editorStudioMetaModelHelpers"

export { dedupeStrings } from "./editorStudioMetaModelHelpers"

export type ParsedEditorMeta = {
  body: string
  tags: string[]
  category: string
  thumbnail: string
  customFrontmatterLines?: string[]
}

export type ResolvedEditorMetaSnapshot = {
  body: string
  tags: string[]
  category: string
  thumbnailUrl: string
  thumbnailFocusX: number
  thumbnailFocusY: number
  thumbnailZoom: number
  customFrontmatterLines?: string[]
}

export type MetaUsageMap = Record<string, number>

export type LocalDraftSource =
  | { kind: "create" }
  | { kind: "post"; postId: string }

export type LocalDraftPayload = {
  title: string
  content: string
  summary: string
  summarySource: "MANUAL" | "LEADING_BLOCK" | "EXTRACTED" | "MIGRATED" | "NONE"
  summaryIntent: SummaryIntent
  thumbnailUrl: string
  thumbnailFocusX: number
  thumbnailFocusY: number
  thumbnailZoom: number
  tags: string[]
  category: string
  visibility: PostVisibility
  savedAt: string
  source: LocalDraftSource
  postVersion?: number | null
}

export type LocalDraftFingerprintPayload = Omit<LocalDraftPayload, "savedAt" | "source" | "postVersion">

export const localDraftSourcesEqual = (left: LocalDraftSource, right: LocalDraftSource): boolean => {
  if (left.kind === "create" && right.kind === "create") return true
  if (left.kind === "post" && right.kind === "post") return left.postId === right.postId
  return false
}

const markdownImagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/
const PREVIEW_THUMBNAIL_ALLOWED_PATH_PREFIX = "/post/api/v1/images/posts/"
const PREVIEW_THUMBNAIL_DISALLOWED_CHAR_REGEX = /[\u0000-\u001F\u007F<>"'`\\]/
const PREVIEW_THUMBNAIL_ALLOWED_PATH_REGEX = /^\/post\/api\/v1\/images\/posts\/[A-Za-z0-9._~/%-]+$/
const PREVIEW_THUMBNAIL_ALLOWED_QUERY_REGEX = /^\?(?:[A-Za-z0-9._~/%=&-]*)$/
const FRONTMATTER_DELIMITER_REGEX = /^\s*---\s*$/
const LEADING_EDITOR_METADATA_LINE_REGEX =
  /^\s*(tags?|categories?|thumbnail|thumb|cover|coverimage|cover_image)\s*:\s*(.+)\s*$/i
const EDITOR_BODY_PLACEHOLDER = "내용을 입력하세요."
const EDITOR_TOGGLE_TITLE_PLACEHOLDER = "토글 제목"
export const PREVIEW_SUMMARY_MAX_LENGTH = 150
export const PREVIEW_SUMMARY_MAX_CONTENT_LENGTH = 50_000

const normalizeMetaScalar = (raw: string) => raw.trim().replace(/^['"]|['"]$/g, "")

export const extractFirstMarkdownImage = (content: string): string => {
  const match = markdownImagePattern.exec(content)
  return match?.[1]?.trim() || ""
}

const FNV1A_32_OFFSET_BASIS = 2166136261
const FNV1A_32_PRIME = 16777619
let cachedFingerprintInput = ""
let cachedFingerprintValue = `${0}:${FNV1A_32_OFFSET_BASIS >>> 0}`

export const computeContentFingerprint = (content: string): string => {
  if (content === cachedFingerprintInput) return cachedFingerprintValue
  let hash = FNV1A_32_OFFSET_BASIS
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index)
    hash = Math.imul(hash, FNV1A_32_PRIME)
  }
  cachedFingerprintInput = content
  cachedFingerprintValue = `${content.length}:${hash >>> 0}`
  return cachedFingerprintValue
}

export const normalizeSafeImageUrl = (raw: string): string => {
  return isCanonicalPostImageUploadUrl(raw) ? raw.trim() : ""
}

const toSafePreviewThumbnailPath = (pathname: string, search: string): string => {
  if (!PREVIEW_THUMBNAIL_ALLOWED_PATH_REGEX.test(pathname)) return ""
  if (!search) return pathname
  if (!PREVIEW_THUMBNAIL_ALLOWED_QUERY_REGEX.test(search)) return ""
  return `${pathname}${search}`
}

const resolvePreviewThumbnailApiOrigin = (): string => {
  try {
    return new URL(getApiBaseUrl()).origin
  } catch {
    return ""
  }
}

export const normalizeSafePreviewThumbnailUrl = (raw: string): string => {
  const value = raw.trim()
  if (!value) return ""
  if (PREVIEW_THUMBNAIL_DISALLOWED_CHAR_REGEX.test(value)) return ""

  if (value.startsWith("/")) {
    if (value.startsWith("//")) return ""
    try {
      const parsed = new URL(value, "https://preview.local")
      const safePath = toSafePreviewThumbnailPath(parsed.pathname, parsed.search)
      if (!safePath) return ""
      const apiOrigin = resolvePreviewThumbnailApiOrigin()
      if (typeof window !== "undefined" && apiOrigin && window.location.origin !== apiOrigin) {
        return `${apiOrigin}${safePath}`
      }
      return safePath
    } catch {
      return ""
    }
  }

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return ""
    if (parsed.username || parsed.password) return ""

    const allowedHosts = new Set<string>()
    const baseUrl = getApiBaseUrl()
    try {
      allowedHosts.add(new URL(baseUrl).host)
    } catch {
      return ""
    }
    if (typeof window !== "undefined" && window.location.host) {
      allowedHosts.add(window.location.host)
    }
    if (!allowedHosts.has(parsed.host)) return ""
    if (!parsed.pathname.startsWith(PREVIEW_THUMBNAIL_ALLOWED_PATH_PREFIX)) return ""
    const safePath = toSafePreviewThumbnailPath(parsed.pathname, parsed.search)
    if (!safePath) return ""
    const apiOrigin = resolvePreviewThumbnailApiOrigin()
    if (typeof window !== "undefined" && parsed.origin === window.location.origin) {
      return safePath
    }
    if (apiOrigin && parsed.origin === apiOrigin) {
      return `${apiOrigin}${safePath}`
    }
    return `${parsed.origin}${safePath}`
  } catch {
    return ""
  }
}

const isYamlLine = (line: string): boolean => {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (trimmed.startsWith("#")) return true
  if (/^[a-z0-9_.-]+\s*:/i.test(trimmed)) return true
  if (/^-\s+/.test(trimmed)) return true
  if (/^\s{2,}/.test(line)) return true
  return false
}

const splitFrontmatterBlock = (content: string, allowArbitraryFrontmatter = false) => {
  const normalized = content.replace(/\r\n?/g, "\n").trimStart()
  const firstBreak = normalized.indexOf("\n")
  const firstLine = firstBreak === -1 ? normalized : normalized.slice(0, firstBreak)
  if (!FRONTMATTER_DELIMITER_REGEX.test(firstLine)) {
    return {
      metadataLines: [] as string[],
      body: normalized,
    }
  }
  const lines = normalized.split("\n")

  for (let index = 1; index < lines.length; index += 1) {
    if (!FRONTMATTER_DELIMITER_REGEX.test(lines[index] || "")) continue
    const metadataLines = lines.slice(1, index)
    const meaningfulLines = metadataLines.filter((line) => line.trim().length > 0)
    const isSupportedMetadata =
      meaningfulLines.length > 0 &&
      meaningfulLines.every((line) =>
        allowArbitraryFrontmatter
          ? isYamlLine(line)
          : /^\s*(tags?|category|categories|thumbnail|thumb|cover|coverimage|cover_image)\s*:\s*\S.*$/i.test(line)
      )
    if (!isSupportedMetadata) return { metadataLines: [] as string[], body: normalized }
    return {
      metadataLines,
      body: lines
        .slice(index + 1)
        .join("\n")
        .replace(/^\n+/, ""),
    }
  }

  return {
    metadataLines: [] as string[],
    body: normalized,
  }
}

const stripLeadingEditorMetadataLines = (content: string) => {
  const normalized = content.replace(/\r\n?/g, "\n")
  const firstBreak = normalized.indexOf("\n")
  const firstLine = firstBreak === -1 ? normalized : normalized.slice(0, firstBreak)
  if (firstLine.trim() && !LEADING_EDITOR_METADATA_LINE_REGEX.test(firstLine)) {
    return {
      consumed: 0,
      metadataLines: [] as string[],
      body: normalized,
    }
  }
  const lines = normalized.split("\n")
  let consumed = 0

  for (const line of lines) {
    if (!line.trim()) {
      consumed += 1
      break
    }
    if (!LEADING_EDITOR_METADATA_LINE_REGEX.test(line)) break
    consumed += 1
  }

  return {
    consumed,
    metadataLines: consumed > 0 ? lines.slice(0, consumed) : ([] as string[]),
    body: consumed > 0 ? lines.slice(consumed).join("\n").trimStart() : normalized,
  }
}

export const resolveEditorBodyFallback = (content: string, parsedBody: string) => {
  if (parsedBody.trim().length > 0) return parsedBody
  const normalized = content.replace(/\r\n?/g, "\n").trimStart()
  if (normalized.trim().length === 0) return parsedBody

  const frontmatterSplit = splitFrontmatterBlock(normalized)
  const inlineMetadataSplit = stripLeadingEditorMetadataLines(frontmatterSplit.body)
  return inlineMetadataSplit.body.trim().length > 0 ? inlineMetadataSplit.body : parsedBody
}

export const resolveEditorMetaSnapshot = (
  content: string,
  options?: { allowArbitraryFrontmatter?: boolean }
): ResolvedEditorMetaSnapshot => {
  const parsed = parseEditorMeta(content, options)
  const resolvedBody = parsed.body
  const parsedThumbnail = normalizeSafeImageUrl(parsed.thumbnail)
  const fallbackThumbnail = normalizeSafeImageUrl(extractFirstMarkdownImage(resolvedBody))
  const syncedThumbnail = stripThumbnailFocusFromUrl(parsedThumbnail || fallbackThumbnail)
  const syncedThumbnailFocusX = parseThumbnailFocusXFromUrl(
    parsedThumbnail || fallbackThumbnail,
    DEFAULT_THUMBNAIL_FOCUS_X
  )
  const syncedThumbnailFocusY = parseThumbnailFocusYFromUrl(
    parsedThumbnail || fallbackThumbnail,
    DEFAULT_THUMBNAIL_FOCUS_Y
  )
  const syncedThumbnailZoom = parseThumbnailZoomFromUrl(parsedThumbnail || fallbackThumbnail, DEFAULT_THUMBNAIL_ZOOM)

  return {
    body: resolvedBody,
    tags: parsed.tags,
    category: parsed.category,
    thumbnailUrl: syncedThumbnail,
    thumbnailFocusX: syncedThumbnailFocusX,
    thumbnailFocusY: syncedThumbnailFocusY,
    thumbnailZoom: syncedThumbnailZoom,
    customFrontmatterLines: parsed.customFrontmatterLines,
  }
}

export const buildEditorStateFingerprint = ({
  title,
  content,
  summary,
  summarySource,
  summaryIntent,
  thumbnailUrl,
  thumbnailFocusX,
  thumbnailFocusY,
  thumbnailZoom,
  tags,
  category,
  visibility,
}: LocalDraftFingerprintPayload) =>
  JSON.stringify({
    title,
    content: computeContentFingerprint(content),
    summary: computeContentFingerprint(summary),
    summarySource,
    summaryIntent,
    thumbnailUrl,
    thumbnailFocusX,
    thumbnailFocusY,
    thumbnailZoom,
    tags: dedupeStrings(tags),
    category: category ? normalizeCategoryValue(category) : "",
    visibility,
  })

export const parseEditorMeta = (
  content: string,
  options?: { allowArbitraryFrontmatter?: boolean }
): ParsedEditorMeta => {
  let trimmed = content.replace(/\r\n?/g, "\n").trimStart()
  const tags: string[] = []
  let category = ""
  let thumbnail = ""
  const customFrontmatterLines: string[] = []

  const pushTags = (items: string[]) => {
    dedupeStrings(items).forEach((item) => {
      if (!tags.includes(item)) tags.push(item)
    })
  }

  const setCategory = (items: string[]) => {
    const nextCategory = dedupeStrings(items).map(normalizeCategoryValue)[0] || ""
    if (nextCategory) category = nextCategory
  }

  const frontmatterSplit = splitFrontmatterBlock(trimmed, options?.allowArbitraryFrontmatter)
  if (frontmatterSplit.metadataLines.length > 0) {
    frontmatterSplit.metadataLines.forEach((line) => {
      const [rawKey, ...rest] = line.split(":")
      if (!rawKey || rest.length === 0) {
        if (options?.allowArbitraryFrontmatter) customFrontmatterLines.push(line)
        return
      }
      const key = rawKey.trim().toLowerCase()
      const value = rest.join(":").trim()
      if (!value && !options?.allowArbitraryFrontmatter) return

      if (key === "tags" || key === "tag") pushTags(normalizeMetaItems(value))
      else if (key === "category" || key === "categories") setCategory(normalizeMetaItems(value))
      else if (key === "thumbnail" || key === "thumb" || key === "cover" || key === "coverimage" || key === "cover_image") {
        thumbnail = normalizeMetaScalar(value)
      } else if (options?.allowArbitraryFrontmatter) {
        customFrontmatterLines.push(line)
      }
    })
    trimmed = frontmatterSplit.body.trimStart()
  }

  const leadingMetadataSplit = stripLeadingEditorMetadataLines(trimmed)
  if (leadingMetadataSplit.consumed > 0) {
    leadingMetadataSplit.metadataLines.forEach((line) => {
      const match = line.match(LEADING_EDITOR_METADATA_LINE_REGEX)
      if (!match) return

      const key = match[1].toLowerCase()
      const value = match[2]
      if (key === "tag" || key === "tags") pushTags(normalizeMetaItems(value))
      if (key === "category" || key === "categories") setCategory(normalizeMetaItems(value))
      if (key === "thumbnail" || key === "thumb" || key === "cover" || key === "coverimage" || key === "cover_image") {
        thumbnail = normalizeMetaScalar(value)
      }
    })
    trimmed = leadingMetadataSplit.body
  }

  return {
    body: resolveEditorBodyFallback(content, trimmed),
    tags,
    category,
    thumbnail,
    customFrontmatterLines: customFrontmatterLines.length > 0 ? customFrontmatterLines : undefined,
  }
}

const serializeMetaItems = (items: string[]) => items.map((item) => JSON.stringify(item)).join(", ")

export const composeEditorContent = (
  body: string,
  tags: string[],
  options?: { category?: string; thumbnail?: string; customFrontmatterLines?: string[] }
) => {
  const normalizedBody = body.trim()
  const normalizedTags = dedupeStrings(tags)
  const normalizedCategory = options?.category ? normalizeCategoryValue(options.category) : ""
  const normalizedThumbnail = options?.thumbnail?.trim() || ""
  const metadataLines: string[] = []

  if (options?.customFrontmatterLines?.length) {
    for (const line of options.customFrontmatterLines) {
      metadataLines.push(line)
    }
  }

  if (normalizedTags.length > 0) metadataLines.push(`tags: [${serializeMetaItems(normalizedTags)}]`)
  if (normalizedCategory) metadataLines.push(`category: [${serializeMetaItems([normalizedCategory])}]`)
  if (normalizedThumbnail) metadataLines.push(`thumbnail: ${JSON.stringify(normalizedThumbnail)}`)

  if (metadataLines.length === 0) return normalizedBody
  if (!normalizedBody) return `---\n${metadataLines.join("\n")}\n---`

  return `---\n${metadataLines.join("\n")}\n---\n\n${normalizedBody}`
}

export const buildLocalDraftFingerprint = (payload: LocalDraftFingerprintPayload) =>
  buildEditorStateFingerprint(payload)

const TOGGLE_TITLE_PLACEHOLDER_LINE = `:::toggle ${EDITOR_TOGGLE_TITLE_PLACEHOLDER}`

type FenceMarker = "`" | "~"

const updateFenceMarker = (
  current: FenceMarker | null,
  trimmed: string
): { marker: FenceMarker | null; isFenceLine: boolean } => {
  const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed)
  if (!fenceMatch) return { marker: current, isFenceLine: false }
  const nextMarker = fenceMatch[1][0] as FenceMarker
  if (!current) return { marker: nextMarker, isFenceLine: true }
  return { marker: current === nextMarker ? null : current, isFenceLine: true }
}

const detectPlaceholderLineIssue = (trimmed: string): string | null => {
  if (trimmed === EDITOR_BODY_PLACEHOLDER) {
    return "본문에 기본 placeholder 문구가 남아 있습니다. 실제 내용으로 교체한 뒤 다시 시도해주세요."
  }
  if (trimmed === TOGGLE_TITLE_PLACEHOLDER_LINE) {
    return "토글 제목이 기본값으로 남아 있습니다. 실제 제목으로 바꾼 뒤 다시 시도해주세요."
  }
  return null
}

let cachedPlaceholderInput: string | null = null
let cachedPlaceholderIssue: string | null = null

export const detectPublishPlaceholderIssue = (content: string): string | null => {
  if (content === cachedPlaceholderInput) return cachedPlaceholderIssue
  let fenceMarker: FenceMarker | null = null
  let cursor = 0

  while (cursor <= content.length) {
    const nextBreak = content.indexOf("\n", cursor)
    const rawLine = nextBreak === -1 ? content.slice(cursor) : content.slice(cursor, nextBreak)
    const trimmed = rawLine.trim()
    if (trimmed) {
      const fenceState = updateFenceMarker(fenceMarker, trimmed)
      fenceMarker = fenceState.marker
      if (!fenceState.isFenceLine && !fenceMarker && !trimmed.startsWith(">")) {
        const lineIssue = detectPlaceholderLineIssue(trimmed)
        if (lineIssue) {
          cachedPlaceholderInput = content
          cachedPlaceholderIssue = lineIssue
          return lineIssue
        }
      }
    }
    if (nextBreak === -1) break
    cursor = nextBreak + 1
  }

  const imageIssue = hasNonCanonicalPostImageSource(content)
    ? "본문 이미지는 업로드한 Aquila 이미지 URL만 사용할 수 있습니다. 이미지를 다시 업로드한 뒤 시도해주세요."
    : null
  cachedPlaceholderInput = content
  cachedPlaceholderIssue = imageIssue
  return imageIssue
}
