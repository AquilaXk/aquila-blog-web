import { normalizePostImageUrl } from "src/libs/markdown/postImageUrlPolicy"

export const MARKDOWN_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

export const MARKDOWN_ATTACHMENT_TOO_LARGE_MESSAGE = "첨부 파일은 10MB 이하여야 합니다."
export const MARKDOWN_ATTACHMENT_UNSAFE_TYPE_MESSAGE =
  "HTML, SVG, JavaScript 등 실행 가능한 파일은 첨부할 수 없습니다."
export const MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE = "첨부 파일 업로드에 실패했습니다."
export const MARKDOWN_ATTACHMENT_URL_MISSING_MESSAGE = "첨부 파일 업로드 결과 URL을 확인할 수 없습니다."
export const MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE = "이미지 업로드에 실패했습니다."
export const MARKDOWN_IMAGE_URL_MISSING_MESSAGE = "이미지 업로드 결과 URL을 확인할 수 없습니다."

const DANGEROUS_ATTACHMENT_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".svg",
  ".svgz",
  ".js",
  ".mjs",
  ".cjs",
  ".xhtml",
])

const DANGEROUS_ATTACHMENT_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "application/ecmascript",
  "text/ecmascript",
])

export type MarkdownFileUploadResult = {
  url?: string
  name?: string
  mimeType?: string
  sizeBytes?: number
  description?: string
}

export type MarkdownImageUploadResult = {
  alt?: string
  title?: string
  url?: string
  src?: string
  width?: number
  height?: number
  widthPx?: number
  heightPx?: number
}

const extractLowercaseExtension = (pathOrName: string): string => {
  const clean = pathOrName.split(/[?#]/, 1)[0]?.trim() || ""
  const base = clean.slice(clean.lastIndexOf("/") + 1)
  const dotIdx = base.lastIndexOf(".")
  if (dotIdx <= 0) return ""
  return base.slice(dotIdx).toLowerCase()
}

export const isDangerousMarkdownAttachmentType = (name: string, mimeType = ""): boolean => {
  const ext = extractLowercaseExtension(name)
  if (ext && DANGEROUS_ATTACHMENT_EXTENSIONS.has(ext)) return true

  const normalizedMime = mimeType.split(";", 1)[0]?.trim().toLowerCase() || ""
  return Boolean(normalizedMime && DANGEROUS_ATTACHMENT_MIME_TYPES.has(normalizedMime))
}

export const validateMarkdownAttachmentSize = (file: Pick<File, "size"> & Partial<Pick<File, "name" | "type">>): string | null => {
  if (file.size > MARKDOWN_ATTACHMENT_MAX_BYTES) {
    return MARKDOWN_ATTACHMENT_TOO_LARGE_MESSAGE
  }
  if (isDangerousMarkdownAttachmentType(file.name || "", file.type || "")) {
    return MARKDOWN_ATTACHMENT_UNSAFE_TYPE_MESSAGE
  }
  return null
}

const hasControlChars = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.codePointAt(i) ?? 0
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

const normalizeSafeAttachmentUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim()
  if (!trimmed || hasControlChars(trimmed) || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return ""
  }

  try {
    if (trimmed.startsWith("/")) {
      const parsed = new URL(trimmed, "https://attachment-policy.invalid")
      const ext = extractLowercaseExtension(parsed.pathname)
      if (ext && DANGEROUS_ATTACHMENT_EXTENSIONS.has(ext)) return ""
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    const parsed = new URL(trimmed)
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
      return ""
    }
    const ext = extractLowercaseExtension(parsed.pathname)
    if (ext && DANGEROUS_ATTACHMENT_EXTENSIONS.has(ext)) return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

export const escapeMarkdownLinkLabel = (value: string) => value.replace(/[\\[\]]/g, String.raw`\$&`)

const LINK_DEST_ENCODED_CODES = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5c, 0x7f])

const shouldEncodeLinkDestinationCode = (code: number): boolean =>
  code <= 0x20 || LINK_DEST_ENCODED_CODES.has(code)

export const escapeMarkdownLinkDestination = (url: string): string => {
  let encoded = ""
  for (const ch of url) {
    const code = ch.codePointAt(0) ?? 0
    encoded += shouldEncodeLinkDestinationCode(code)
      ? `%${code.toString(16).toUpperCase().padStart(2, "0")}`
      : ch
  }
  return encoded
}

export const resolveMarkdownAttachmentLink = (
  uploaded: MarkdownFileUploadResult,
  fallbackName: string
): { markdown: string } | { error: string } => {
  const safeUrl = normalizeSafeAttachmentUrl(String(uploaded.url || ""))
  if (!safeUrl) {
    return { error: MARKDOWN_ATTACHMENT_URL_MISSING_MESSAGE }
  }

  const name = String(uploaded.name || fallbackName).trim() || fallbackName
  return {
    markdown: `\n\n[${escapeMarkdownLinkLabel(name)}](${escapeMarkdownLinkDestination(safeUrl)})\n`,
  }
}

const appendImageDimensionsIfMissing = (
  src: string,
  width: number | undefined,
  height: number | undefined
): string => {
  if (width == null || height == null || width <= 0 || height <= 0 || /[?&](?:w|width)=/i.test(src)) {
    return src
  }
  const separator = src.includes("?") ? "&" : "?"
  return `${src}${separator}w=${Math.round(width)}&h=${Math.round(height)}`
}

export const resolveMarkdownImageEmbed = (
  uploaded: MarkdownImageUploadResult,
  fallbackName: string,
  options?: { publicApiOrigin?: string },
): { markdown: string } | { error: string } => {
  const rawSrc = String(uploaded.url || uploaded.src || "").trim()
  const normalizedSrc = rawSrc ? normalizePostImageUrl(rawSrc, options) : ""
  if (!normalizedSrc) {
    return { error: MARKDOWN_IMAGE_URL_MISSING_MESSAGE }
  }

  const alt = String(uploaded.alt || uploaded.title || fallbackName).trim() || fallbackName
  const width = uploaded.width ?? uploaded.widthPx
  const height = uploaded.height ?? uploaded.heightPx
  const src = appendImageDimensionsIfMissing(normalizedSrc, width, height)

  return {
    markdown: `\n\n![${escapeMarkdownLinkLabel(alt)}](${escapeMarkdownLinkDestination(src)})\n`,
  }
}
