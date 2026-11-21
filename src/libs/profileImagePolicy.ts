const MEGABYTE = 1024 * 1024

export type ImageUploadTarget = "profile" | "post"

export type ImageUploadPolicy = {
  maxBytes: number
  targetBytes: number
  maxLongEdge: number
  maxSourceBytes: number
  outputMimeTypes: readonly string[]
}

export type PreparedImageUpload = {
  file: File
  optimized: boolean
  originalBytes: number
  optimizedBytes: number
  originalWidth: number
  originalHeight: number
  width: number
  height: number
}

export type ProfileImageEditTransform = {
  focusX: number
  focusY: number
  zoom: number
  outputSize?: number
}

export type ProfileImageSourceSize = {
  width: number
  height: number
}

export const IMAGE_UPLOAD_POLICIES: Record<ImageUploadTarget, ImageUploadPolicy> = {
  profile: {
    maxBytes: 2 * MEGABYTE,
    targetBytes: 700 * 1024,
    maxLongEdge: 1024,
    maxSourceBytes: 30 * MEGABYTE,
    outputMimeTypes: ["image/webp", "image/jpeg", "image/png"],
  },
  post: {
    maxBytes: 8 * MEGABYTE,
    targetBytes: 3_500 * 1024,
    maxLongEdge: 2560,
    maxSourceBytes: 40 * MEGABYTE,
    outputMimeTypes: ["image/webp", "image/jpeg", "image/png"],
  },
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/gif",
  "image/webp",
  "image/x-webp",
])

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"]

export const PROFILE_IMAGE_UPLOAD_RULE_LABEL = "JPG/PNG/GIF/WebP, 자동 최적화 후 최대 2MB"
export const POST_IMAGE_UPLOAD_RULE_LABEL = "JPG/PNG/GIF/WebP, 자동 최적화 후 최대 8MB"
export const PROFILE_IMAGE_EDIT_DEFAULT_FOCUS_X = 50
export const PROFILE_IMAGE_EDIT_DEFAULT_FOCUS_Y = 38
export const PROFILE_IMAGE_EDIT_MIN_ZOOM = 1
export const PROFILE_IMAGE_EDIT_MAX_ZOOM = 2.8
export const PROFILE_IMAGE_EDIT_DEFAULT_OUTPUT_SIZE = 512

export const normalizeMimeType = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace("image/jpg", "image/jpeg")
    .replace("image/pjpeg", "image/jpeg")
    .replace("image/x-png", "image/png")
    .replace("image/x-webp", "image/webp")

const hasAllowedExtension = (fileName: string): boolean => {
  const normalized = fileName.trim().toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => normalized.endsWith(ext))
}

export const bytesToMbText = (bytes: number): string => `${(bytes / MEGABYTE).toFixed(1)}MB`

export const clampProfileImageEditFocus = (value: number): number => {
  if (!Number.isFinite(value)) return PROFILE_IMAGE_EDIT_DEFAULT_FOCUS_X
  return Math.min(100, Math.max(0, value))
}

export const clampProfileImageEditZoom = (value: number): number => {
  if (!Number.isFinite(value)) return PROFILE_IMAGE_EDIT_MIN_ZOOM
  return Math.min(PROFILE_IMAGE_EDIT_MAX_ZOOM, Math.max(PROFILE_IMAGE_EDIT_MIN_ZOOM, value))
}

export const resolveProfileImageEditDrawRatios = (
  sourceSize: ProfileImageSourceSize,
  zoom: number
): { drawWidth: number; drawHeight: number } => {
  const safeZoom = clampProfileImageEditZoom(zoom)
  const sourceWidth = Math.max(1, sourceSize.width)
  const sourceHeight = Math.max(1, sourceSize.height)
  const sourceAspect = sourceWidth / sourceHeight

  const baseDrawWidth = sourceAspect >= 1 ? sourceAspect : 1
  const baseDrawHeight = sourceAspect >= 1 ? 1 : 1 / sourceAspect

  return {
    drawWidth: baseDrawWidth * safeZoom,
    drawHeight: baseDrawHeight * safeZoom,
  }
}

export const clampProfileImageEditFocusBySource = ({
  focusX,
  focusY,
  zoom,
  sourceSize,
}: {
  focusX: number
  focusY: number
  zoom: number
  sourceSize: ProfileImageSourceSize
}): { focusX: number; focusY: number } => {
  const { drawWidth, drawHeight } = resolveProfileImageEditDrawRatios(sourceSize, zoom)
  const minCenterX = Math.max(0, 1 - drawWidth / 2)
  const maxCenterX = Math.min(1, drawWidth / 2)
  const minCenterY = Math.max(0, 1 - drawHeight / 2)
  const maxCenterY = Math.min(1, drawHeight / 2)

  const normalizedFocusX = clampProfileImageEditFocus(focusX) / 100
  const normalizedFocusY = clampProfileImageEditFocus(focusY) / 100

  const safeCenterX = minCenterX <= maxCenterX ? Math.min(maxCenterX, Math.max(minCenterX, normalizedFocusX)) : 0.5
  const safeCenterY = minCenterY <= maxCenterY ? Math.min(maxCenterY, Math.max(minCenterY, normalizedFocusY)) : 0.5

  return {
    focusX: safeCenterX * 100,
    focusY: safeCenterY * 100,
  }
}

export const ensureFileIsUploadable = (file: File, target: ImageUploadTarget): string => {
  const policy = IMAGE_UPLOAD_POLICIES[target]
  if (file.size <= 0) {
    throw new Error("빈 파일은 업로드할 수 없습니다.")
  }

  if (file.size > policy.maxSourceBytes) {
    throw new Error(`원본 파일이 너무 큽니다. ${bytesToMbText(policy.maxSourceBytes)} 이하 파일로 시도해주세요.`)
  }

  const mimeType = normalizeMimeType(file.type || "")
  const validMimeType = mimeType.length > 0 && ALLOWED_MIME_TYPES.has(mimeType)
  const validExtension = hasAllowedExtension(file.name)

  if (!validMimeType || !validExtension) {
    throw new Error("지원하지 않는 이미지 형식입니다. JPG/PNG/GIF/WebP 파일만 업로드할 수 있습니다.")
  }

  return mimeType
}

export const sanitizeFileBaseName = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf(".")
  const rawBase = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName
  const normalized = rawBase.trim().replace(/[^a-zA-Z0-9가-힣._-]/g, "-").replace(/-+/g, "-")
  return normalized || "image"
}

export const extensionFromMimeType = (mimeType: string): string => {
  if (mimeType === "image/webp") return "webp"
  if (mimeType === "image/jpeg") return "jpg"
  if (mimeType === "image/png") return "png"
  return "jpg"
}

export const constrainByLongEdge = (
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number } => {
  const longEdge = Math.max(width, height)
  if (longEdge <= maxLongEdge) {
    return { width, height }
  }

  const scale = maxLongEdge / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export const resolveTransferOutputMimeTypes = (
  outputMimeTypes: readonly string[],
  options: { sourceMimeType: string; hasTransparency: boolean }
): string[] => {
  const normalizedSource = normalizeMimeType(options.sourceMimeType || "")
  if (!options.hasTransparency || normalizedSource === "image/jpeg") {
    return [...outputMimeTypes]
  }
  const alphaSafe = outputMimeTypes
    .map(normalizeMimeType)
    .filter((mime) => mime !== "image/jpeg")
  if (!alphaSafe.includes("image/png")) {
    alphaSafe.push("image/png")
  }
  return alphaSafe
}
