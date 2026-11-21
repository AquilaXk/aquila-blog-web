const FRONTMATTER_THUMBNAIL_REGEX =
  /^\s*(?:thumbnail|thumb|cover|coverimage|cover_image)\s*:\s*['"]?([^'"\r\n]+)['"]?\s*$/im
const MARKDOWN_FIRST_IMAGE_REGEX = /!\[[^\][\r\n]*\]\(\s*([^)\s"']+)(?:\s+["'][^"']*["'])?\s*\)/
const HTML_FIRST_IMAGE_REGEX = /<img\b[^>]*?\bsrc=["']([^"']+)["']/i

export const extractFirstPostContentImageUrl = (
  content?: string | null,
  html?: string | null
): string => {
  const rawContent = typeof content === "string" ? content : ""
  if (rawContent) {
    const frontmatterThumb = FRONTMATTER_THUMBNAIL_REGEX.exec(rawContent)?.[1]?.trim()
    if (frontmatterThumb) return frontmatterThumb
    const mdMatch = MARKDOWN_FIRST_IMAGE_REGEX.exec(rawContent)?.[1]?.trim()
    if (mdMatch) return mdMatch
    const inlineHtmlMatch = HTML_FIRST_IMAGE_REGEX.exec(rawContent)?.[1]?.trim()
    if (inlineHtmlMatch) return inlineHtmlMatch
  }
  const rawHtml = typeof html === "string" ? html : ""
  if (rawHtml) {
    const htmlMatch = HTML_FIRST_IMAGE_REGEX.exec(rawHtml)?.[1]?.trim()
    if (htmlMatch) return htmlMatch
  }
  return ""
}
