const STANDALONE_MARKDOWN_IMAGE_REGEX =
  /^!\[([^\]]*)\]\((.+?)(?:\s+"([^"]*)")?\)(?:\s*\{([^}]*)\})?\s*$/


export const clampImageWidthPx = (value: number) => Math.min(960, Math.max(180, Math.round(value)))
export const clampImageDimensionPx = (value: number) => Math.min(2400, Math.max(10, Math.round(value)))

export const normalizeImageAlign = (
  value: string | null | undefined
): "left" | "center" | "wide" | "full" | undefined => {
  if (!value) return undefined

  const normalized = value.trim().toLowerCase()
  if (normalized === "left" || normalized === "center" || normalized === "wide" || normalized === "full") {
    return normalized
  }

  return undefined
}

export type ParsedStandaloneMarkdownImage = {
  alt: string
  src: string
  title: string
  widthPx?: number
  heightPx?: number
  aspectRatio?: string
  align?: "left" | "center" | "wide" | "full"
}

export const parseStandaloneMarkdownImageLine = (
  line: string
): ParsedStandaloneMarkdownImage | null => {
  const match = line.trim().match(STANDALONE_MARKDOWN_IMAGE_REGEX)
  if (!match) return null

  const alt = match[1] || ""
  const src = (match[2] || "").trim()
  const title = (match[3] || "").trim()
  const metadata = (match[4] || "").trim()
  const widthFromSuffixMatch = metadata.match(/(?:^|\s)width=(\d{2,4})(?:$|\s)/i)
  const heightFromSuffixMatch = metadata.match(/(?:^|\s)height=(\d{2,4})(?:$|\s)/i)
  const alignFromSuffixMatch = metadata.match(/(?:^|\s)align=(left|center|wide|full)(?:$|\s)/i)
  const widthFromSuffix = Number.parseInt(widthFromSuffixMatch?.[1] || "", 10)
  const heightFromSuffix = Number.parseInt(heightFromSuffixMatch?.[1] || "", 10)
  const widthFromTitleMatch = title.match(/(?:^|\s)width=(\d{2,4})(?:$|\s)/i)
  const heightFromTitleMatch = title.match(/(?:^|\s)height=(\d{2,4})(?:$|\s)/i)
  const widthFromTitle = Number.parseInt(widthFromTitleMatch?.[1] || "", 10)
  const heightFromTitle = Number.parseInt(heightFromTitleMatch?.[1] || "", 10)
  const explicitWidth = Number.isFinite(widthFromSuffix)
    ? widthFromSuffix
    : Number.isFinite(widthFromTitle)
      ? widthFromTitle
      : undefined
  const explicitHeight = Number.isFinite(heightFromSuffix)
    ? heightFromSuffix
    : Number.isFinite(heightFromTitle)
      ? heightFromTitle
      : undefined

  if (!src) return null

  let urlWidth: number | undefined
  let urlHeight: number | undefined
  try {
    const parsedUrl = new URL(src, "https://dummy.local")
    const w = parsedUrl.searchParams.get("w") || parsedUrl.searchParams.get("width")
    const h = parsedUrl.searchParams.get("h") || parsedUrl.searchParams.get("height")
    if (w && /^\d+$/.test(w)) urlWidth = Number.parseInt(w, 10)
    if (h && /^\d+$/.test(h)) urlHeight = Number.parseInt(h, 10)
  } catch {}

  const hasExplicitRatio = explicitWidth != null && explicitHeight != null && explicitWidth > 0 && explicitHeight > 0
  const hasUrlRatio = urlWidth != null && urlHeight != null && urlWidth > 0 && urlHeight > 0

  let finalWidth: number | undefined
  let finalHeight: number | undefined
  let aspectRatio: string | undefined

  if (hasExplicitRatio) {
    aspectRatio = `${explicitWidth} / ${explicitHeight}`
    finalWidth = clampImageWidthPx(explicitWidth!)
    finalHeight = clampImageDimensionPx(Math.round(finalWidth * (explicitHeight! / explicitWidth!)))
  } else if (hasUrlRatio) {
    aspectRatio = `${urlWidth} / ${urlHeight}`
    if (explicitWidth != null) {
      finalWidth = clampImageWidthPx(explicitWidth)
      finalHeight = clampImageDimensionPx(Math.round(finalWidth * (urlHeight! / urlWidth!)))
    } else if (explicitHeight != null) {
      finalHeight = clampImageDimensionPx(explicitHeight)
      finalWidth = clampImageWidthPx(Math.round(finalHeight * (urlWidth! / urlHeight!)))
    } else {
      if (urlWidth! > 960) {
        finalWidth = clampImageWidthPx(urlWidth!)
        finalHeight = clampImageDimensionPx(Math.round(finalWidth * (urlHeight! / urlWidth!)))
      } else if (urlWidth! < 180) {
        finalWidth = clampImageWidthPx(urlWidth!)
        finalHeight = clampImageDimensionPx(Math.round(finalWidth * (urlHeight! / urlWidth!)))
      } else {
        finalWidth = urlWidth
        finalHeight = urlHeight
      }
    }
  } else {
    finalWidth = explicitWidth != null
      ? clampImageWidthPx(explicitWidth)
      : urlWidth
        ? clampImageWidthPx(urlWidth)
        : undefined
    finalHeight = explicitHeight != null
      ? clampImageDimensionPx(explicitHeight)
      : urlHeight
        ? clampImageDimensionPx(urlHeight)
        : undefined
  }

  return {
    alt,
    src,
    title,
    widthPx: finalWidth,
    heightPx: finalHeight,
    aspectRatio,
    align: normalizeImageAlign(alignFromSuffixMatch?.[1]),
  }
}

export const serializeStandaloneMarkdownImageLine = ({
  alt,
  src,
  title,
  widthPx,
  heightPx,
  align,
}: ParsedStandaloneMarkdownImage) => {
  const trimmedTitle = title
    .trim()
    .replace(/\s*width=\d{2,4}\s*/gi, " ")
    .replace(/\s*height=\d{2,4}\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  const titlePart = trimmedTitle ? ` "${trimmedTitle}"` : ""
  const metadataParts = [
    widthPx ? `width=${clampImageWidthPx(widthPx)}` : "",
    heightPx ? `height=${clampImageDimensionPx(heightPx)}` : "",
    normalizeImageAlign(align) ? `align=${normalizeImageAlign(align)}` : "",
  ].filter(Boolean)
  const metadataPart = metadataParts.length > 0 ? ` {${metadataParts.join(" ")}}` : ""
  return `![${alt}](${src}${titlePart})${metadataPart}`
}
