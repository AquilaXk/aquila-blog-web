// 참조 구현: transloadit/uppy (MIT) & strapi/strapi (MIT) — 워드 단위 매직바이트 · SVG XSS · 용량 상한 Fail-Closed 선검증 가드
export type FileSignatureValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

// CloudStorageProperties.kt 정본 상한과 일치 (사진 50MiB, 직접 문서/아카이브 95MiB, resumable 동영상 5GiB)
export const MAX_CLOUD_IMAGE_BYTES = 50 * 1024 * 1024
export const MAX_CLOUD_DOCUMENT_BYTES = 95 * 1024 * 1024
export const MAX_CLOUD_VIDEO_BYTES = 5 * 1024 * 1024 * 1024
export const MAX_SVG_SCAN_BYTES = 2 * 1024 * 1024

// 매직바이트 Big-Endian 워드 상수
const MAGIC_PNG = 0x89504e47 // \x89PNG
const MAGIC_GIF8 = 0x47494638 // GIF8
const MAGIC_RIFF = 0x52494646 // RIFF
const MAGIC_WEBP = 0x57454250 // WEBP
const MAGIC_AVI = 0x41564920 // "AVI "
const MAGIC_FTYP = 0x66747970 // ftyp (MP4 / MOV / AVIF / HEIC)
const MAGIC_MOOV = 0x6d6f6f76 // QuickTime moov
const MAGIC_MDAT = 0x6d646174 // QuickTime mdat
const MAGIC_WIDE = 0x77696465 // QuickTime wide
const MAGIC_FREE = 0x66726565 // QuickTime free
const MAGIC_EBML = 0x1a45dfa3 // WebM / Matroska EBML
const MAGIC_PDF_HEAD = 0x25504446 // %PDF
const MAGIC_PDF_DASH = 0x2d // -
const MAGIC_ICO = 0x00000100 // ICO

// 실행 바이너리 차단 시그니처 (PE/MZ, ELF, Mach-O)
const MAGIC_MZ = 0x4d5a
const MAGIC_ELF = 0x7f454c46
const MAGIC_MACHO_32 = 0xfeedface
const MAGIC_MACHO_64 = 0xfeedfacf
const MAGIC_MACHO_32_LE = 0xcefaedfe
const MAGIC_MACHO_64_LE = 0xcffaedfe

const SVG_XSS_PATTERN =
  /<\s*script\b|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|<\s*foreignobject\b|\bon[a-z]+\s*=/i

const BLOCKED_EXECUTABLE_EXTENSIONS = new Set([
  "exe",
  "dll",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "ps1",
  "vbs",
  "sh",
  "elf",
])

const RASTER_PHOTO_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "ico",
  "avif",
])

const PHOTO_EXTENSIONS = new Set([...RASTER_PHOTO_EXTENSIONS, "svg"])

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "mkv", "avi"])

const getExtension = (name: string): string => {
  const dot = name.lastIndexOf(".")
  return dot >= 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ""
}

const inferRasterExtensionFromMime = (lowerMime: string): string => {
  if (lowerMime === "image/png") return "png"
  if (lowerMime === "image/jpeg" || lowerMime === "image/jpg") return "jpg"
  if (lowerMime === "image/gif") return "gif"
  if (lowerMime === "image/webp") return "webp"
  if (lowerMime === "image/bmp") return "bmp"
  if (lowerMime === "image/x-icon" || lowerMime === "image/vnd.microsoft.icon") return "ico"
  if (lowerMime === "image/avif") return "avif"
  return ""
}

export const resolveCloudMediaCategory = (
  filename: string,
  mimeType: string
): "photo" | "video" | "document" => {
  const ext = getExtension(filename)
  const lowerMime = mimeType.toLowerCase()
  if (lowerMime.startsWith("image/") || PHOTO_EXTENSIONS.has(ext)) {
    return "photo"
  }
  if (lowerMime.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) {
    return "video"
  }
  return "document"
}

const formatLimitLabel = (maxBytes: number): string => {
  const gib = 1024 * 1024 * 1024
  if (maxBytes >= gib && maxBytes % gib === 0) {
    return `${maxBytes / gib}GB`
  }
  return `${Math.round(maxBytes / (1024 * 1024))}MB`
}

const isBlockedExecutableHeader = (view: DataView, byteLength: number): boolean => {
  if (byteLength >= 2 && view.getUint16(0, false) === MAGIC_MZ) {
    return true
  }
  if (byteLength >= 4) {
    const word0 = view.getUint32(0, false)
    if (
      word0 === MAGIC_ELF ||
      word0 === MAGIC_MACHO_32 ||
      word0 === MAGIC_MACHO_64 ||
      word0 === MAGIC_MACHO_32_LE ||
      word0 === MAGIC_MACHO_64_LE
    ) {
      return true
    }
  }
  return false
}

const isValidRasterPhotoSignature = (view: DataView, byteLength: number, ext: string): boolean => {
  if (byteLength < 4) return false
  const word0 = view.getUint32(0, false)
  if (ext === "png") return word0 === MAGIC_PNG
  if (ext === "jpg" || ext === "jpeg") {
    return view.getUint16(0, false) === 0xffd8 && view.getUint8(2) === 0xff
  }
  if (ext === "gif") return word0 === MAGIC_GIF8
  if (ext === "webp") {
    return byteLength >= 12 && word0 === MAGIC_RIFF && view.getUint32(8, false) === MAGIC_WEBP
  }
  if (ext === "bmp") return view.getUint16(0, false) === 0x424d
  if (ext === "ico") return word0 === MAGIC_ICO
  if (ext === "avif") return byteLength >= 12 && view.getUint32(4, false) === MAGIC_FTYP
  return false
}

const isValidPdfSignature = (view: DataView, byteLength: number): boolean =>
  byteLength >= 5 &&
  view.getUint32(0, false) === MAGIC_PDF_HEAD &&
  view.getUint8(4) === MAGIC_PDF_DASH

const isIsoBaseMediaVideoAtom = (word4: number): boolean =>
  word4 === MAGIC_FTYP ||
  word4 === MAGIC_MOOV ||
  word4 === MAGIC_MDAT ||
  word4 === MAGIC_WIDE ||
  word4 === MAGIC_FREE

const isValidVideoSignature = (
  view: DataView,
  byteLength: number,
  ext: string,
  lowerMime: string
): boolean => {
  const isMp4Family =
    ext === "mp4" ||
    ext === "mov" ||
    ext === "m4v" ||
    lowerMime === "video/mp4" ||
    lowerMime === "video/quicktime" ||
    lowerMime === "video/x-m4v"
  if (isMp4Family) {
    return byteLength >= 8 && isIsoBaseMediaVideoAtom(view.getUint32(4, false))
  }

  const isEbmlFamily =
    ext === "webm" ||
    ext === "mkv" ||
    lowerMime === "video/webm" ||
    lowerMime === "video/x-matroska"
  if (isEbmlFamily) {
    return byteLength >= 4 && view.getUint32(0, false) === MAGIC_EBML
  }

  if (ext === "avi" || lowerMime === "video/x-msvideo") {
    return (
      byteLength >= 12 &&
      view.getUint32(0, false) === MAGIC_RIFF &&
      view.getUint32(8, false) === MAGIC_AVI
    )
  }

  return byteLength >= 8 && (
    isIsoBaseMediaVideoAtom(view.getUint32(4, false)) ||
    view.getUint32(0, false) === MAGIC_EBML
  )
}

const validateSvgPayload = async (file: File): Promise<FileSignatureValidationResult> => {
  if (file.size > MAX_SVG_SCAN_BYTES) {
    return { ok: false, reason: "SVG 파일 크기가 안전 스캔 상한(2MB)을 초과했습니다." }
  }
  const svgSlice = file.slice(0, Math.min(file.size, MAX_SVG_SCAN_BYTES))
  const svgBuffer = await svgSlice.arrayBuffer()
  const text = new TextDecoder("utf-8", { fatal: false }).decode(svgBuffer)
  const lowerText = text.toLowerCase()
  if (!lowerText.includes("<svg")) {
    return { ok: false, reason: "유효한 SVG 루트 태그가 없는 파일입니다." }
  }
  if (SVG_XSS_PATTERN.test(lowerText)) {
    return { ok: false, reason: "스크립트 또는 이벤트 핸들러가 포함된 SVG는 업로드할 수 없습니다." }
  }
  return { ok: true }
}

export const validateCloudFileBeforeUpload = async (
  file: File
): Promise<FileSignatureValidationResult> => {
  if (file.size <= 0) {
    return { ok: false, reason: "빈 파일(0바이트)은 업로드할 수 없습니다." }
  }

  const ext = getExtension(file.name)
  const lowerMime = (file.type || "").toLowerCase()
  if (BLOCKED_EXECUTABLE_EXTENSIONS.has(ext)) {
    return { ok: false, reason: "실행 파일 형식은 업로드할 수 없습니다." }
  }

  const category = resolveCloudMediaCategory(file.name, lowerMime)
  const maxBytes =
    category === "photo"
      ? MAX_CLOUD_IMAGE_BYTES
      : category === "video"
        ? MAX_CLOUD_VIDEO_BYTES
        : MAX_CLOUD_DOCUMENT_BYTES

  if (file.size > maxBytes) {
    return {
      ok: false,
      reason: `파일 크기가 허용 상한(${formatLimitLabel(maxBytes)})을 초과했습니다.`,
    }
  }

  try {
    const headerSlice = file.slice(0, Math.min(file.size, 64))
    const headerBuffer = await headerSlice.arrayBuffer()
    const view = new DataView(headerBuffer)
    const byteLength = headerBuffer.byteLength

    if (isBlockedExecutableHeader(view, byteLength)) {
      return { ok: false, reason: "실행 바이너리 시그니처가 감지되어 업로드를 차단했습니다." }
    }

    const isSvg = ext === "svg" || lowerMime === "image/svg+xml"
    if (isSvg) {
      return await validateSvgPayload(file)
    }

    const rasterExt = RASTER_PHOTO_EXTENSIONS.has(ext)
      ? ext
      : inferRasterExtensionFromMime(lowerMime)
    if (rasterExt && !isValidRasterPhotoSignature(view, byteLength, rasterExt)) {
      return { ok: false, reason: "이미지 확장자와 실제 파일 헤더 시그니처가 일치하지 않습니다." }
    }

    if ((ext === "pdf" || lowerMime === "application/pdf") && !isValidPdfSignature(view, byteLength)) {
      return { ok: false, reason: "PDF 파일 헤더 시그니처(%PDF-)가 일치하지 않습니다." }
    }

    if (
      (VIDEO_EXTENSIONS.has(ext) || lowerMime.startsWith("video/")) &&
      !isValidVideoSignature(view, byteLength, ext, lowerMime)
    ) {
      return { ok: false, reason: "동영상 컨테이너 헤더 시그니처(ftyp/EBML)가 일치하지 않습니다." }
    }

    return { ok: true }
  } catch {
    return { ok: false, reason: "파일 헤더를 읽을 수 없습니다." }
  }
}
