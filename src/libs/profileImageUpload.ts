import {
  hasAlphaTransparency,
  type ProbedImageHeader,
  readAndProbeImageFileHeader,
} from "./imageUploadHeaderProbe"
import {
  bytesToMbText,
  clampProfileImageEditFocus,
  clampProfileImageEditFocusBySource,
  clampProfileImageEditZoom,
  constrainByLongEdge,
  ensureFileIsUploadable,
  extensionFromMimeType,
  IMAGE_UPLOAD_POLICIES,
  type ImageUploadPolicy,
  type ImageUploadTarget,
  normalizeMimeType,
  POST_IMAGE_UPLOAD_RULE_LABEL,
  type PreparedImageUpload,
  PROFILE_IMAGE_EDIT_DEFAULT_FOCUS_X,
  PROFILE_IMAGE_EDIT_DEFAULT_FOCUS_Y,
  PROFILE_IMAGE_EDIT_DEFAULT_OUTPUT_SIZE,
  PROFILE_IMAGE_EDIT_MAX_ZOOM,
  PROFILE_IMAGE_EDIT_MIN_ZOOM,
  PROFILE_IMAGE_UPLOAD_RULE_LABEL,
  type ProfileImageEditTransform,
  type ProfileImageSourceSize,
  resolveProfileImageEditDrawRatios,
  resolveTransferOutputMimeTypes,
  sanitizeFileBaseName,
} from "./profileImagePolicy"

export {
  clampProfileImageEditFocus,
  clampProfileImageEditFocusBySource,
  clampProfileImageEditZoom,
  ensureFileIsUploadable,
  hasAlphaTransparency,
  POST_IMAGE_UPLOAD_RULE_LABEL,
  type PreparedImageUpload,
  PROFILE_IMAGE_EDIT_DEFAULT_FOCUS_X,
  PROFILE_IMAGE_EDIT_DEFAULT_FOCUS_Y,
  PROFILE_IMAGE_EDIT_DEFAULT_OUTPUT_SIZE,
  PROFILE_IMAGE_EDIT_MAX_ZOOM,
  PROFILE_IMAGE_EDIT_MIN_ZOOM,
  PROFILE_IMAGE_UPLOAD_RULE_LABEL,
  type ProfileImageEditTransform,
  type ProfileImageSourceSize,
  resolveProfileImageEditDrawRatios,
  resolveTransferOutputMimeTypes,
}

const MIN_RETRY_LONG_EDGE = 480
const RETRY_SCALE_FACTOR = 0.86
const LOSSY_QUALITY_STEPS = [0.9, 0.82, 0.74, 0.66, 0.58]

type EncodedCandidate = {
  blob: Blob
  mimeType: string
  width: number
  height: number
}

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality)
  })

const canvasEncodeSupportCache = new Map<string, boolean>()

const isCanvasEncodeSupported = (mimeType: string): boolean => {
  const cached = canvasEncodeSupportCache.get(mimeType)
  if (cached !== undefined) return cached

  let supported = false
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas")
    try {
      supported = canvas.toDataURL(mimeType).startsWith(`data:${mimeType}`)
    } catch {
      supported = false
    }
  }
  canvasEncodeSupportCache.set(mimeType, supported)
  return supported
}

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("이미지 파일을 읽을 수 없습니다. 손상된 파일인지 확인해주세요."))
    }

    image.src = objectUrl
  })

const detectCanvasAlphaTransparency = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  sourceMimeType: string,
  probedHeader?: ProbedImageHeader,
): boolean => {
  const normalizedSource = normalizeMimeType(sourceMimeType || "")
  if (normalizedSource === "image/jpeg" || probedHeader?.isOpaque) return false
  const context = canvas.getContext("2d", { alpha: true })
  if (!context || typeof context.getImageData !== "function") {
    return normalizedSource === "image/png" || normalizedSource === "image/webp" || normalizedSource === "image/gif"
  }
  try {
    const imageData = context.getImageData(0, 0, Math.max(1, width), Math.max(1, height))
    return hasAlphaTransparency(imageData.data)
  } catch {
    return normalizedSource === "image/png" || normalizedSource === "image/webp" || normalizedSource === "image/gif"
  }
}

const drawToCanvas = (
  image: HTMLImageElement,
  width: number,
  height: number
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d", { alpha: true })
  if (!context) {
    throw new Error("이미지 최적화 캔버스 초기화에 실패했습니다.")
  }

  context.drawImage(image, 0, 0, width, height)
  return canvas
}

const encodeCandidates = async (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  policy: ImageUploadPolicy,
  outputMimeTypes: readonly string[] = policy.outputMimeTypes
): Promise<EncodedCandidate[]> => {
  const candidates: EncodedCandidate[] = []

  for (const mimeType of outputMimeTypes) {
    if (!isCanvasEncodeSupported(mimeType)) continue

    if (mimeType === "image/png") {
      const blob = await canvasToBlob(canvas, mimeType)
      if (blob) {
        candidates.push({ blob, mimeType, width, height })
      }
      continue
    }

    for (const quality of LOSSY_QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, mimeType, quality)
      if (!blob) continue

      candidates.push({ blob, mimeType, width, height })
      if (blob.size <= policy.targetBytes) break
    }
  }

  return candidates.sort((a, b) => a.blob.size - b.blob.size)
}

const toPreparedFile = (
  candidate: EncodedCandidate,
  sourceFile: File,
  originalWidth: number,
  originalHeight: number
): PreparedImageUpload => {
  const baseName = sanitizeFileBaseName(sourceFile.name)
  const extension = extensionFromMimeType(candidate.mimeType)
  const optimizedName = `${baseName}.${extension}`

  return {
    file: new File([candidate.blob], optimizedName, { type: candidate.mimeType }),
    optimized: true,
    originalBytes: sourceFile.size,
    optimizedBytes: candidate.blob.size,
    originalWidth,
    originalHeight,
    width: candidate.width,
    height: candidate.height,
  }
}

const DIRECT_PASSTHROUGH_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

const isSourceImageAlreadyWithinPolicy = (
  sourceFile: File,
  sourceMimeType: string,
  originalWidth: number,
  originalHeight: number,
  constrained: { width: number; height: number },
  policy: ImageUploadPolicy
): boolean =>
  sourceFile.size <= policy.maxBytes &&
  constrained.width === originalWidth &&
  constrained.height === originalHeight &&
  DIRECT_PASSTHROUGH_MIME_TYPES.has(sourceMimeType)

const pickSmallerCandidate = (
  currentBest: EncodedCandidate | null,
  candidate: EncodedCandidate | null
): EncodedCandidate | null => {
  if (!candidate) return currentBest
  if (!currentBest || candidate.blob.size < currentBest.blob.size) return candidate
  return currentBest
}

const findBestEncodedImageCandidate = async (
  image: HTMLImageElement,
  initialSize: { width: number; height: number },
  sourceMimeType: string,
  policy: ImageUploadPolicy,
  probedHeader?: ProbedImageHeader,
): Promise<EncodedCandidate | null> => {
  let bestCandidate: EncodedCandidate | null = null
  let currentWidth = initialSize.width
  let currentHeight = initialSize.height
  let outputMimeTypes: readonly string[] | null = null

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = drawToCanvas(image, currentWidth, currentHeight)
    outputMimeTypes ??= resolveTransferOutputMimeTypes(policy.outputMimeTypes, {
      sourceMimeType,
      hasTransparency: detectCanvasAlphaTransparency(
        canvas,
        currentWidth,
        currentHeight,
        sourceMimeType,
        probedHeader,
      ),
    })
    const candidates = await encodeCandidates(canvas, currentWidth, currentHeight, policy, outputMimeTypes)
    const smallestCandidate = candidates[0] ?? null
    bestCandidate = pickSmallerCandidate(bestCandidate, smallestCandidate)

    if (smallestCandidate && smallestCandidate.blob.size <= policy.maxBytes) {
      return smallestCandidate
    }
    if (Math.max(currentWidth, currentHeight) <= MIN_RETRY_LONG_EDGE) break

    currentWidth = Math.max(1, Math.round(currentWidth * RETRY_SCALE_FACTOR))
    currentHeight = Math.max(1, Math.round(currentHeight * RETRY_SCALE_FACTOR))
  }

  return bestCandidate && bestCandidate.blob.size <= policy.maxBytes ? bestCandidate : null
}

const optimizeImageByPolicy = async (
  sourceFile: File,
  policy: ImageUploadPolicy,
  probedHeader?: ProbedImageHeader,
): Promise<PreparedImageUpload> => {
  const sourceMimeType = normalizeMimeType(sourceFile.type || "")
  const looksLikeGif =
    probedHeader?.format === "gif" ||
    sourceMimeType === "image/gif" ||
    sourceFile.name.trim().toLowerCase().endsWith(".gif")
  const image = await loadImageFromFile(sourceFile)
  const originalWidth = image.naturalWidth || image.width
  const originalHeight = image.naturalHeight || image.height

  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new Error("이미지 해상도를 확인할 수 없습니다.")
  }

  const constrained = constrainByLongEdge(originalWidth, originalHeight, policy.maxLongEdge)
  if (
    isSourceImageAlreadyWithinPolicy(
      sourceFile,
      sourceMimeType,
      originalWidth,
      originalHeight,
      constrained,
      policy
    )
  ) {
    return {
      file: sourceFile,
      optimized: false,
      originalBytes: sourceFile.size,
      optimizedBytes: sourceFile.size,
      originalWidth,
      originalHeight,
      width: originalWidth,
      height: originalHeight,
    }
  }

  if (looksLikeGif) {
    throw new Error(
      `움직이는 GIF는 자동 최적화 시 프레임 손실이 발생할 수 있습니다. ${bytesToMbText(policy.maxBytes)} 이하 GIF로 업로드해주세요.`
    )
  }

  const acceptedCandidate = await findBestEncodedImageCandidate(
    image,
    constrained,
    sourceMimeType,
    policy,
    probedHeader,
  )
  if (acceptedCandidate) {
    return toPreparedFile(acceptedCandidate, sourceFile, originalWidth, originalHeight)
  }

  throw new Error(
    `자동 최적화 후에도 업로드 용량 제한(${bytesToMbText(policy.maxBytes)})을 초과합니다. 더 작은 이미지를 사용해주세요.`
  )
}

const prepareImageForUpload = async (file: File, target: ImageUploadTarget): Promise<PreparedImageUpload> => {
  const normalizedMimeType = ensureFileIsUploadable(file, target)
  const probedHeader = await readAndProbeImageFileHeader(file, normalizedMimeType)
  return await optimizeImageByPolicy(file, IMAGE_UPLOAD_POLICIES[target], probedHeader)
}

export const buildProfileImageEditedFile = async (
  sourceFile: File,
  transform: ProfileImageEditTransform
): Promise<File> => {
  const normalizedMimeType = ensureFileIsUploadable(sourceFile, "profile")
  const probedHeader = await readAndProbeImageFileHeader(sourceFile, normalizedMimeType)

  const image = await loadImageFromFile(sourceFile)
  const outputSize = Math.max(256, Math.round(transform.outputSize || PROFILE_IMAGE_EDIT_DEFAULT_OUTPUT_SIZE))
  const zoom = clampProfileImageEditZoom(transform.zoom)

  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("프로필 편집에 사용할 이미지 해상도를 확인할 수 없습니다.")
  }

  const sourceSize = { width: sourceWidth, height: sourceHeight }
  const { focusX, focusY } = clampProfileImageEditFocusBySource({
    focusX: transform.focusX,
    focusY: transform.focusY,
    zoom,
    sourceSize,
  })
  const { drawWidth: drawWidthRatio, drawHeight: drawHeightRatio } = resolveProfileImageEditDrawRatios(
    sourceSize,
    zoom
  )
  const drawWidth = drawWidthRatio * outputSize
  const drawHeight = drawHeightRatio * outputSize
  const centerX = (focusX / 100) * outputSize
  const centerY = (focusY / 100) * outputSize
  const offsetX = centerX - drawWidth / 2
  const offsetY = centerY - drawHeight / 2

  const canvas = document.createElement("canvas")
  canvas.width = outputSize
  canvas.height = outputSize

  const context = canvas.getContext("2d", { alpha: true })
  if (!context) {
    throw new Error("프로필 편집 캔버스를 준비하지 못했습니다.")
  }

  context.clearRect(0, 0, outputSize, outputSize)
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)

  const sourceMimeType = normalizeMimeType(sourceFile.type || "")
  const hasTransparency = detectCanvasAlphaTransparency(
    canvas,
    outputSize,
    outputSize,
    sourceMimeType,
    probedHeader,
  )
  const webpBlob = isCanvasEncodeSupported("image/webp") ? await canvasToBlob(canvas, "image/webp", 0.92) : null
  const fallbackMimeType = hasTransparency ? "image/png" : "image/jpeg"
  const fallbackBlob =
    webpBlob ||
    (await canvasToBlob(canvas, fallbackMimeType, fallbackMimeType === "image/jpeg" ? 0.92 : undefined))
  if (!fallbackBlob) {
    throw new Error("프로필 편집 이미지를 생성하지 못했습니다.")
  }

  const mimeType = webpBlob ? "image/webp" : fallbackMimeType
  const extension = extensionFromMimeType(mimeType)
  const baseName = sanitizeFileBaseName(sourceFile.name)
  const fileName = `${baseName}-profile-edit.${extension}`
  return new File([fallbackBlob], fileName, { type: mimeType })
}

export const prepareProfileImageForUpload = async (file: File): Promise<PreparedImageUpload> =>
  await prepareImageForUpload(file, "profile")

export const preparePostImageForUpload = async (file: File): Promise<PreparedImageUpload> =>
  await prepareImageForUpload(file, "post")

export const buildImageOptimizationSummary = (prepared: PreparedImageUpload): string => {
  if (!prepared.optimized) {
    return "원본 이미지 기준을 충족해 추가 최적화 없이 업로드했습니다."
  }

  return `자동 최적화 적용: ${bytesToMbText(prepared.originalBytes)} → ${bytesToMbText(prepared.optimizedBytes)} (${prepared.originalWidth}x${prepared.originalHeight} → ${prepared.width}x${prepared.height})`
}

export const normalizeProfileImageUploadError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  const normalizedMessage = message.trim()

  if (normalizedMessage.includes("Failed to fetch") || normalizedMessage.includes("NetworkError")) {
    return "서버 연결이 중단되었습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요."
  }

  if (normalizedMessage.includes("413")) {
    return "업로드 가능한 파일 용량을 초과했습니다. 더 작은 이미지로 다시 시도해주세요."
  }

  return normalizedMessage
}
