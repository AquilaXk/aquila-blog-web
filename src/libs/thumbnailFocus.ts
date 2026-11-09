const THUMBNAIL_FOCUS_X_TOKEN_REGEX = /::aqfx=([-+]?\d*\.?\d+)/g
const THUMBNAIL_FOCUS_TOKEN_REGEX = /::aqfy=([-+]?\d*\.?\d+)/g
const THUMBNAIL_ZOOM_TOKEN_REGEX = /::aqfz=([-+]?\d*\.?\d+)/g

export const DEFAULT_THUMBNAIL_FOCUS_X = 50
export const DEFAULT_THUMBNAIL_FOCUS_Y = 38
export const DEFAULT_THUMBNAIL_ZOOM = 1
export const MIN_THUMBNAIL_ZOOM = 1
export const MAX_THUMBNAIL_ZOOM = 2.5

const clampRounded = (
  value: number,
  fallback: number,
  min: number,
  max: number,
  factor: number
) => {
  if (!Number.isFinite(value)) return fallback
  if (value < min) return min
  if (value > max) return max
  return Math.round(value * factor) / factor
}

const extractLastTokenNumber = (
  raw: string,
  regex: RegExp,
  clampFn: (value: number) => number
): number | null => {
  const value = raw.trim()
  if (!value) return null
  let match: RegExpMatchArray | null = null
  for (const token of value.matchAll(regex)) {
    match = token
  }
  if (!match || match.length < 2) return null
  const parsed = Number.parseFloat(match[1])
  return Number.isFinite(parsed) ? clampFn(parsed) : null
}

export const clampThumbnailFocusX = (value: number) =>
  clampRounded(value, DEFAULT_THUMBNAIL_FOCUS_X, 0, 100, 10)

export const clampThumbnailFocusY = (value: number) =>
  clampRounded(value, DEFAULT_THUMBNAIL_FOCUS_Y, 0, 100, 10)

export const getThumbnailFocusXFromUrl = (raw: string): number | null =>
  extractLastTokenNumber(raw, THUMBNAIL_FOCUS_X_TOKEN_REGEX, clampThumbnailFocusX)

export const getThumbnailFocusYFromUrl = (raw: string): number | null =>
  extractLastTokenNumber(raw, THUMBNAIL_FOCUS_TOKEN_REGEX, clampThumbnailFocusY)

export const parseThumbnailFocusYFromUrl = (
  raw: string,
  fallback = DEFAULT_THUMBNAIL_FOCUS_Y
) => getThumbnailFocusYFromUrl(raw) ?? fallback

export const parseThumbnailFocusXFromUrl = (
  raw: string,
  fallback = DEFAULT_THUMBNAIL_FOCUS_X
) => getThumbnailFocusXFromUrl(raw) ?? fallback

export const clampThumbnailZoom = (value: number) =>
  clampRounded(value, DEFAULT_THUMBNAIL_ZOOM, MIN_THUMBNAIL_ZOOM, MAX_THUMBNAIL_ZOOM, 100)

export const getThumbnailZoomFromUrl = (raw: string): number | null =>
  extractLastTokenNumber(raw, THUMBNAIL_ZOOM_TOKEN_REGEX, clampThumbnailZoom)

export const parseThumbnailZoomFromUrl = (
  raw: string,
  fallback = DEFAULT_THUMBNAIL_ZOOM
) => getThumbnailZoomFromUrl(raw) ?? fallback

export const stripThumbnailFocusFromUrl = (raw: string): string => {
  const value = raw.trim()
  if (!value) return ""

  const stripped = value
    .replaceAll(THUMBNAIL_FOCUS_X_TOKEN_REGEX, "")
    .replaceAll(THUMBNAIL_FOCUS_TOKEN_REGEX, "")
    .replaceAll(THUMBNAIL_ZOOM_TOKEN_REGEX, "")
  if (stripped.endsWith("#")) return stripped.slice(0, -1)
  return stripped
}

export const applyThumbnailFocusYToUrl = (raw: string, focusY: number): string => {
  const normalizedUrl = stripThumbnailFocusFromUrl(raw)
  if (!normalizedUrl) return ""

  const normalizedFocus = clampThumbnailFocusY(focusY)
  if (normalizedUrl.includes("#")) return `${normalizedUrl}::aqfy=${normalizedFocus}`
  return `${normalizedUrl}#::aqfy=${normalizedFocus}`
}

export const applyThumbnailTransformToUrl = (
  raw: string,
  options: { focusX: number; focusY: number; zoom: number }
): string => {
  const normalizedUrl = stripThumbnailFocusFromUrl(raw)
  if (!normalizedUrl) return ""

  const normalizedFocusX = clampThumbnailFocusX(options.focusX)
  const normalizedFocus = clampThumbnailFocusY(options.focusY)
  const normalizedZoom = clampThumbnailZoom(options.zoom)
  const token = `::aqfx=${normalizedFocusX}::aqfy=${normalizedFocus}::aqfz=${normalizedZoom}`
  if (normalizedUrl.includes("#")) return `${normalizedUrl}${token}`
  return `${normalizedUrl}#${token}`
}
