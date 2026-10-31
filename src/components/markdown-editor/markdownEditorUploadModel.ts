import { normalizePostImageUrl } from "src/libs/markdown/postImageUrlPolicy"

export const MARKDOWN_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

export const MARKDOWN_ATTACHMENT_TOO_LARGE_MESSAGE = "첨부 파일은 10MB 이하여야 합니다."
export const MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE = "첨부 파일 업로드에 실패했습니다."
export const MARKDOWN_ATTACHMENT_URL_MISSING_MESSAGE = "첨부 파일 업로드 결과 URL을 확인할 수 없습니다."
export const MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE = "이미지 업로드에 실패했습니다."
export const MARKDOWN_IMAGE_URL_MISSING_MESSAGE = "이미지 업로드 결과 URL을 확인할 수 없습니다."

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

export const validateMarkdownAttachmentSize = (file: File): string | null => {
  if (file.size > MARKDOWN_ATTACHMENT_MAX_BYTES) {
    return MARKDOWN_ATTACHMENT_TOO_LARGE_MESSAGE
  }
  return null
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
  const url = String(uploaded.url || "").trim()
  if (!url) {
    return { error: MARKDOWN_ATTACHMENT_URL_MISSING_MESSAGE }
  }

  const name = String(uploaded.name || fallbackName).trim() || fallbackName
  return {
    markdown: `\n\n[${escapeMarkdownLinkLabel(name)}](${escapeMarkdownLinkDestination(url)})\n`,
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
