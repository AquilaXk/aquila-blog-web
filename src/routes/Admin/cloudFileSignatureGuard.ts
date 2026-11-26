// 참조 구현: transloadit/uppy (MIT) & strapi/strapi (MIT) — 워드 단위 매직바이트·차원 상한·SVG XSS·UTF-8 선검증 가드
import type { SiteLanguage } from "src/libs/language"
import { getCloudSignatureMessages } from "./cloud/cloudSignatureMessages"

export type FileSignatureValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

type SignatureMessages = ReturnType<typeof getCloudSignatureMessages>

// CloudStorageProperties.kt / ImageUploadAdmissionValidator.kt 정본 상한과 일치
export const MAX_CLOUD_IMAGE_BYTES = 50 * 1024 * 1024
export const MAX_CLOUD_DOCUMENT_BYTES = 95 * 1024 * 1024
export const MAX_CLOUD_VIDEO_BYTES = 5 * 1024 * 1024 * 1024
export const MAX_SVG_SCAN_BYTES = 5 * 1024 * 1024
export const MAX_CLOUD_PHOTO_DIMENSION = 16_384
export const MAX_CLOUD_PHOTO_PIXELS = 100_000_000
const TEXT_PREFIX_SCAN_BYTES = 64 * 1024

// 매직바이트 Big-Endian 워드 상수
const MAGIC_PNG = 0x89504e47 // \x89PNG
const MAGIC_PNG_IHDR = 0x49484452 // IHDR
const MAGIC_GIF8 = 0x47494638 // GIF8
const MAGIC_RIFF = 0x52494646 // RIFF
const MAGIC_WEBP = 0x57454250 // WEBP
const MAGIC_WAVE = 0x57415645 // WAVE
const MAGIC_FTYP = 0x66747970 // ftyp
const MAGIC_MOOV = 0x6d6f6f76 // QuickTime moov
const MAGIC_MDAT = 0x6d646174 // QuickTime mdat
const MAGIC_WIDE = 0x77696465 // QuickTime wide
const MAGIC_FREE = 0x66726565 // QuickTime free
const MAGIC_SKIP = 0x736b6970 // QuickTime skip
const MAGIC_EBML = 0x1a45dfa3 // WebM / Matroska EBML
const MAGIC_PDF_HEAD = 0x25504446 // %PDF
const MAGIC_PDF_DASH = 0x2d // -
const MAGIC_ICO = 0x00000100 // ICO
const MAGIC_ZIP_LOCAL = 0x504b0304 // PK\x03\x04
const MAGIC_ZIP_EMPTY = 0x504b0506 // PK\x05\x06
const MAGIC_ZIP_SPANNED = 0x504b0708 // PK\x07\x08
const MAGIC_FLAC = 0x664c6143 // fLaC
const MAGIC_OGGS = 0x4f676753 // OggS
const MAGIC_7Z_HEAD = 0x377abcaf // 7z part 0..3
const MAGIC_7Z_TAIL = 0x271c // 7z part 4..5

// 실행 바이너리 차단 시그니처 (PE/MZ, ELF, Mach-O)
const MAGIC_MZ = 0x4d5a
const MAGIC_ELF = 0x7f454c46
const MAGIC_MACHO_32 = 0xfeedface
const MAGIC_MACHO_64 = 0xfeedfacf
const MAGIC_MACHO_32_LE = 0xcefaedfe
const MAGIC_MACHO_64_LE = 0xcffaedfe

// SVG XSS Fail-Closed 패턴 (백엔드 CloudArchiveAndDocumentInspector와 정합)
const SVG_XSS_PATTERN =
  /<!\s*(?:doctype|entity)\b|&#|<\s*script\b|<\s*foreignobject\b|<\s*iframe\b|<\s*object\b|<\s*embed\b|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|\bon[a-z]+\s*=/i

// 128바이트 ASCII 허용 테이블 (\t, \n, \f, \r, 0x20..0x7E)
const TEXT_ASCII_ALLOWED = new Uint8Array(128)
TEXT_ASCII_ALLOWED[0x09] = 1
TEXT_ASCII_ALLOWED[0x0a] = 1
TEXT_ASCII_ALLOWED[0x0c] = 1
TEXT_ASCII_ALLOWED[0x0d] = 1
for (let c = 0x20; c <= 0x7e; c += 1) {
  TEXT_ASCII_ALLOWED[c] = 1
}

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
  "dmg",
  "pkg",
  "app",
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

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "mkv"])

const ZIP_DOCUMENT_AND_ARCHIVE_EXTENSIONS = new Set(["zip", "hwpx", "docx", "xlsx", "pptx"])
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "opus", "m4a", "aac", "flac"])
const ARCHIVE_EXTENSIONS = new Set(["zip", "tar", "gz", "tgz", "7z"])
const TEXT_EXTENSIONS = new Set([
  "txt",
  "log",
  "ini",
  "conf",
  "cfg",
  "toml",
  "env",
  "md",
  "markdown",
  "mdx",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "ndjson",
  "yaml",
  "yml",
  "xml",
  "html",
  "htm",
  "css",
  "js",
  "mjs",
  "ts",
  "tsx",
  "jsx",
  "kt",
  "kts",
  "java",
  "py",
  "go",
  "rs",
  "sql",
])

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "application/xml",
  "application/javascript",
])

const ALLOWED_NON_MEDIA_EXTENSIONS = new Set([
  "pdf",
  ...ZIP_DOCUMENT_AND_ARCHIVE_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...ARCHIVE_EXTENSIONS,
  ...TEXT_EXTENSIONS,
])

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

const validateRasterPhotoHeader = (
  view: DataView,
  byteLength: number,
  ext: string,
  msg: SignatureMessages
): FileSignatureValidationResult => {
  if (byteLength < 4) {
    return { ok: false, reason: msg.rasterMismatch }
  }
  const word0 = view.getUint32(0, false)

  if (ext === "png") {
    if (word0 !== MAGIC_PNG) {
      return { ok: false, reason: msg.pngHeader }
    }
    if (byteLength >= 24 && view.getUint32(12, false) === MAGIC_PNG_IHDR) {
      const width = view.getUint32(16, false)
      const height = view.getUint32(20, false)
      if (
        width > MAX_CLOUD_PHOTO_DIMENSION ||
        height > MAX_CLOUD_PHOTO_DIMENSION ||
        width * height > MAX_CLOUD_PHOTO_PIXELS
      ) {
        return { ok: false, reason: msg.pngDimensions }
      }
    }
    return { ok: true }
  }

  if (ext === "jpg" || ext === "jpeg") {
    return view.getUint16(0, false) === 0xffd8 && view.getUint8(2) === 0xff
      ? { ok: true }
      : { ok: false, reason: msg.jpgHeader }
  }
  if (ext === "gif") {
    if (word0 !== MAGIC_GIF8) {
      return { ok: false, reason: msg.gifHeader }
    }
    if (byteLength >= 10) {
      const width = view.getUint16(6, true)
      const height = view.getUint16(8, true)
      if (
        width > MAX_CLOUD_PHOTO_DIMENSION ||
        height > MAX_CLOUD_PHOTO_DIMENSION ||
        width * height > MAX_CLOUD_PHOTO_PIXELS
      ) {
        return { ok: false, reason: msg.gifDimensions }
      }
    }
    return { ok: true }
  }
  if (ext === "webp") {
    return byteLength >= 12 && word0 === MAGIC_RIFF && view.getUint32(8, false) === MAGIC_WEBP
      ? { ok: true }
      : { ok: false, reason: msg.webpHeader }
  }
  if (ext === "bmp") {
    if (view.getUint16(0, false) !== 0x424d) {
      return { ok: false, reason: msg.bmpHeader }
    }
    if (byteLength >= 26) {
      const width = Math.abs(view.getInt32(18, true))
      const height = Math.abs(view.getInt32(22, true))
      if (
        width > MAX_CLOUD_PHOTO_DIMENSION ||
        height > MAX_CLOUD_PHOTO_DIMENSION ||
        width * height > MAX_CLOUD_PHOTO_PIXELS
      ) {
        return { ok: false, reason: msg.bmpDimensions }
      }
    }
    return { ok: true }
  }
  if (ext === "ico") {
    return word0 === MAGIC_ICO ? { ok: true } : { ok: false, reason: msg.icoHeader }
  }
  if (ext === "avif") {
    return byteLength >= 12 && view.getUint32(4, false) === MAGIC_FTYP
      ? { ok: true }
      : { ok: false, reason: msg.avifHeader }
  }
  return { ok: false, reason: msg.rasterMismatch }
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
  word4 === MAGIC_FREE ||
  word4 === MAGIC_SKIP

const isValidVideoSignature = (
  view: DataView,
  byteLength: number,
  ext: string,
  lowerMime: string
): boolean => {
  if (ext && !VIDEO_EXTENSIONS.has(ext)) {
    return false
  }
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

  return false
}

const isValidAudioSignature = (
  view: DataView,
  bytes: Uint8Array,
  byteLength: number,
  ext: string,
  lowerMime: string
): boolean => {
  if (ext === "wav" || lowerMime === "audio/wav" || lowerMime === "audio/x-wav") {
    return byteLength >= 12 && view.getUint32(0, false) === MAGIC_RIFF && view.getUint32(8, false) === MAGIC_WAVE
  }
  if (ext === "flac" || lowerMime === "audio/flac") {
    return byteLength >= 4 && view.getUint32(0, false) === MAGIC_FLAC
  }
  if (ext === "ogg" || ext === "opus" || lowerMime === "audio/ogg" || lowerMime === "audio/opus") {
    return byteLength >= 4 && view.getUint32(0, false) === MAGIC_OGGS
  }
  if (ext === "m4a" || lowerMime === "audio/mp4" || lowerMime === "audio/x-m4a") {
    return byteLength >= 8 && isIsoBaseMediaVideoAtom(view.getUint32(4, false))
  }
  if (ext === "aac" || lowerMime === "audio/aac") {
    if (byteLength >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xf6) === 0xf0) return true
    return byteLength >= 8 && isIsoBaseMediaVideoAtom(view.getUint32(4, false))
  }
  if (ext === "mp3" || lowerMime === "audio/mpeg" || lowerMime === "audio/mp3") {
    const hasId3 = byteLength >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33
    const hasSync =
      byteLength >= 2 &&
      bytes[0] === 0xff &&
      (bytes[1]! & 0xe0) === 0xe0 &&
      (bytes[1]! & 0x06) !== 0
    return hasId3 || hasSync
  }
  return false
}

const isValidZipContainer = (view: DataView, byteLength: number): boolean => {
  if (byteLength < 4) return false
  const word0 = view.getUint32(0, false)
  return word0 === MAGIC_ZIP_LOCAL || word0 === MAGIC_ZIP_EMPTY || word0 === MAGIC_ZIP_SPANNED
}

const validateSvgPayload = async (
  file: File,
  msg: SignatureMessages
): Promise<FileSignatureValidationResult> => {
  if (file.size > MAX_SVG_SCAN_BYTES) {
    return { ok: false, reason: msg.svgSizeLimit }
  }
  const svgSlice = file.slice(0, Math.min(file.size, MAX_SVG_SCAN_BYTES))
  const svgBuffer = await svgSlice.arrayBuffer()
  const svgBytes = new Uint8Array(svgBuffer)
  if (svgBytes.includes(0x00)) {
    return { ok: false, reason: msg.svgNulByte }
  }
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(svgBytes)
  } catch {
    return { ok: false, reason: msg.svgInvalidUtf8 }
  }
  const lowerText = text.toLowerCase()
  if (!lowerText.includes("<svg")) {
    return { ok: false, reason: msg.svgNoRoot }
  }
  if (SVG_XSS_PATTERN.test(lowerText)) {
    return { ok: false, reason: msg.svgXss }
  }
  return { ok: true }
}

const validateTextPayload = async (
  file: File,
  ext: string,
  msg: SignatureMessages
): Promise<FileSignatureValidationResult> => {
  const sliceLen = Math.min(file.size, TEXT_PREFIX_SCAN_BYTES)
  const buf = await file.slice(0, sliceLen).arrayBuffer()
  const bytes = new Uint8Array(buf)
  const allowEsc = ext === "log"
  for (let i = 0; i < bytes.length; i += 1) {
    const code = bytes[i]!
    if (code < 128 && TEXT_ASCII_ALLOWED[code] !== 1 && !(allowEsc && code === 0x1b)) {
      return { ok: false, reason: msg.textBinaryCtrl }
    }
  }
  // 64KB 경계에서 멀티바이트 UTF-8 문자가 잘렸을 수 있으므로 1~3바이트 여유를 두고 검사
  let checkEnd = bytes.length
  if (file.size > sliceLen && checkEnd > 3) {
    while (checkEnd > bytes.length - 4 && (bytes[checkEnd - 1]! & 0xc0) === 0x80) {
      checkEnd -= 1
    }
    if (checkEnd > 0 && (bytes[checkEnd - 1]! & 0xc0) === 0xc0) {
      checkEnd -= 1
    }
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, checkEnd))
  } catch {
    return { ok: false, reason: msg.textInvalidUtf8 }
  }
  return { ok: true }
}

export const validateCloudFileBeforeUpload = async (
  file: File,
  language: SiteLanguage = "ko"
): Promise<FileSignatureValidationResult> => {
  const msg = getCloudSignatureMessages(language)
  if (file.size <= 0) {
    return { ok: false, reason: msg.emptyFile }
  }

  const ext = getExtension(file.name)
  const lowerMime = (file.type || "").toLowerCase()
  if (BLOCKED_EXECUTABLE_EXTENSIONS.has(ext)) {
    return { ok: false, reason: msg.blockedExecutableExt }
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
      reason: msg.sizeExceeded(formatLimitLabel(maxBytes)),
    }
  }

  try {
    const headerSlice = file.slice(0, Math.min(file.size, 64))
    const headerBuffer = await headerSlice.arrayBuffer()
    const view = new DataView(headerBuffer)
    const bytes = new Uint8Array(headerBuffer)
    const byteLength = headerBuffer.byteLength

    if (isBlockedExecutableHeader(view, byteLength)) {
      return { ok: false, reason: msg.blockedExecutableHeader }
    }

    if (ext === "svg" || lowerMime === "image/svg+xml") {
      return await validateSvgPayload(file, msg)
    }

    const rasterExt = RASTER_PHOTO_EXTENSIONS.has(ext)
      ? ext
      : inferRasterExtensionFromMime(lowerMime)
    if (rasterExt) {
      return validateRasterPhotoHeader(view, byteLength, rasterExt, msg)
    }

    if (ext === "pdf" || lowerMime === "application/pdf") {
      return isValidPdfSignature(view, byteLength) ? { ok: true } : { ok: false, reason: msg.pdfHeader }
    }

    if (VIDEO_EXTENSIONS.has(ext) || lowerMime.startsWith("video/")) {
      return isValidVideoSignature(view, byteLength, ext, lowerMime)
        ? { ok: true }
        : { ok: false, reason: msg.videoHeader }
    }

    if (AUDIO_EXTENSIONS.has(ext) || lowerMime.startsWith("audio/")) {
      return isValidAudioSignature(view, bytes, byteLength, ext, lowerMime)
        ? { ok: true }
        : { ok: false, reason: msg.audioHeader }
    }

    if (ZIP_DOCUMENT_AND_ARCHIVE_EXTENSIONS.has(ext)) {
      return isValidZipContainer(view, byteLength) ? { ok: true } : { ok: false, reason: msg.zipHeader }
    }

    if (ext === "gz" || ext === "tgz") {
      return byteLength >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08
        ? { ok: true }
        : { ok: false, reason: msg.gzipHeader }
    }

    if (ext === "7z") {
      return byteLength >= 6 &&
        view.getUint32(0, false) === MAGIC_7Z_HEAD &&
        view.getUint16(4, false) === MAGIC_7Z_TAIL
        ? { ok: true }
        : { ok: false, reason: msg.sevenZipHeader }
    }

    if (ext === "tar") {
      if (file.size < 512) {
        return { ok: false, reason: msg.tarHeader }
      }
      const tarBuf = await file.slice(0, 512).arrayBuffer()
      const tarBytes = new Uint8Array(tarBuf)
      const hasUstar =
        tarBytes[257] === 0x75 &&
        tarBytes[258] === 0x73 &&
        tarBytes[259] === 0x74 &&
        tarBytes[260] === 0x61 &&
        tarBytes[261] === 0x72
      return hasUstar ? { ok: true } : { ok: false, reason: msg.tarUstar }
    }

    if (TEXT_EXTENSIONS.has(ext) || lowerMime.startsWith("text/") || TEXT_MIME_TYPES.has(lowerMime)) {
      return await validateTextPayload(file, ext, msg)
    }

    if (!ALLOWED_NON_MEDIA_EXTENSIONS.has(ext)) {
      return { ok: false, reason: msg.unsupportedFormat }
    }

    return { ok: true }
  } catch {
    return { ok: false, reason: msg.headerReadError }
  }
}
