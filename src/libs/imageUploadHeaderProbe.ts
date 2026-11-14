export const MAX_IMAGE_UPLOAD_DIMENSION = 8192
export const MAX_IMAGE_UPLOAD_PIXELS = 33_554_432
export const IMAGE_HEADER_PROBE_BYTES = 65_536
export const MAX_JPEG_HEADER_SCAN_OFFSET = 4 * 1024 * 1024
export const MAX_JPEG_HEADER_SEGMENTS = 256

const JPEG_JUMP_WINDOW_BYTES = 16_384
const MAX_JPEG_INTER_MARKER_FILL_BYTES = 4096

export type ProbedImageFormat = "png" | "jpeg" | "gif" | "webp"

export type ProbedImageHeader = {
  format: ProbedImageFormat
  width: number
  height: number
  isOpaque: boolean
}

const IS_LITTLE_ENDIAN = (() => {
  const probe = new Uint32Array(1)
  new Uint8Array(probe.buffer)[0] = 1
  return probe[0] === 1
})()

// On little-endian, RGBA byte [R,G,B,A] sits at bits 24..31; on big-endian, bits 0..7.
const ALPHA_WORD_MASK = (IS_LITTLE_ENDIAN ? 0xff000000 : 0x000000ff) >>> 0

const readUInt16BE = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0

const readUInt16LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] | (bytes[offset + 1] << 8)) >>> 0

const readUInt24LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)) >>> 0

const readUInt32BE = (bytes: Uint8Array, offset: number): number =>
  (((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]) >>> 0

const readUInt32LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    ((bytes[offset + 3] << 24) >>> 0)) >>> 0

const matchesAscii4 = (bytes: Uint8Array, offset: number, expected: number): boolean =>
  offset + 4 <= bytes.length && readUInt32BE(bytes, offset) === expected

export const assertImageDimensionsSafe = (width: number, height: number): void => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_UPLOAD_DIMENSION ||
    height > MAX_IMAGE_UPLOAD_DIMENSION ||
    width * height > MAX_IMAGE_UPLOAD_PIXELS
  ) {
    throw new Error("이미지 해상도가 허용 범위를 초과했습니다. 8192x8192 이하의 이미지를 사용해주세요.")
  }
}

const probePngHeader = (bytes: Uint8Array): ProbedImageHeader | null => {
  if (
    bytes.length < 26 ||
    readUInt32BE(bytes, 0) !== 0x89504e47 ||
    readUInt32BE(bytes, 4) !== 0x0d0a1a0a ||
    readUInt32BE(bytes, 12) !== 0x49484452 // IHDR
  ) {
    return null
  }

  const width = readUInt32BE(bytes, 16)
  const height = readUInt32BE(bytes, 20)
  const colorType = bytes[25]
  assertImageDimensionsSafe(width, height)

  let hasTrns = false
  let cursor = 8
  while (cursor + 8 <= bytes.length) {
    const chunkLen = readUInt32BE(bytes, cursor)
    const chunkType = readUInt32BE(bytes, cursor + 4)
    if (chunkType === 0x74524e53) { // tRNS
      hasTrns = true
      break
    }
    if (chunkType === 0x49444154 || chunkType === 0x49454e44) { // IDAT or IEND
      break
    }
    const next = cursor + 12 + chunkLen
    if (next <= cursor || next > bytes.length) break
    cursor = next
  }

  return {
    format: "png",
    width,
    height,
    isOpaque: (colorType === 0 || colorType === 2) && !hasTrns,
  }
}

const isJpegSofMarker = (marker: number): boolean =>
  (marker >= 0xc0 && marker <= 0xc3) ||
  (marker >= 0xc5 && marker <= 0xc7) ||
  (marker >= 0xc9 && marker <= 0xcb) ||
  (marker >= 0xcd && marker <= 0xcf)

const probeJpegHeader = (bytes: Uint8Array): ProbedImageHeader | null => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return null
  }

  let cursor = 2
  let segmentsVisited = 0
  while (cursor < bytes.length && segmentsVisited < MAX_JPEG_HEADER_SEGMENTS) {
    if (bytes[cursor] !== 0xff) return null
    let fillCount = 0
    while (cursor < bytes.length && bytes[cursor] === 0xff) {
      cursor += 1
      fillCount += 1
      if (fillCount > MAX_JPEG_INTER_MARKER_FILL_BYTES) return null
    }
    if (cursor >= bytes.length) return null

    const marker = bytes[cursor]!
    cursor += 1
    segmentsVisited += 1

    if (marker === 0x00 || marker === 0xd9 || marker === 0xda) {
      return null
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue
    }
    if (cursor + 2 > bytes.length) return null

    const segmentLength = readUInt16BE(bytes, cursor)
    if (segmentLength < 2) return null

    if (isJpegSofMarker(marker)) {
      if (segmentLength < 8 || cursor + 7 > bytes.length) return null
      const height = readUInt16BE(bytes, cursor + 3)
      const width = readUInt16BE(bytes, cursor + 5)
      assertImageDimensionsSafe(width, height)
      return { format: "jpeg", width, height, isOpaque: true }
    }

    cursor += segmentLength
  }

  return null
}

const probeJpegFileHeaderBounded = async (
  file: File,
  initialBytes: Uint8Array,
): Promise<ProbedImageHeader | null> => {
  const scanLimit = Math.min(file.size, MAX_JPEG_HEADER_SCAN_OFFSET)
  if (scanLimit < 4 || initialBytes.length < 4) return null
  if (initialBytes[0] !== 0xff || initialBytes[1] !== 0xd8 || initialBytes[2] !== 0xff) {
    return null
  }

  let windowStart = 0
  let windowBytes =
    initialBytes.length > scanLimit ? initialBytes.subarray(0, scanLimit) : initialBytes

  const ensureWindow = async (offset: number, needed: number): Promise<boolean> => {
    if (offset < 0 || offset + needed > scanLimit) return false
    if (offset >= windowStart && offset + needed <= windowStart + windowBytes.length) {
      return true
    }
    const sliceEnd = Math.min(scanLimit, offset + Math.max(needed, JPEG_JUMP_WINDOW_BYTES))
    windowBytes = new Uint8Array(await file.slice(offset, sliceEnd).arrayBuffer())
    windowStart = offset
    return windowBytes.length >= needed
  }

  const byteAt = (offset: number): number => windowBytes[offset - windowStart]!

  let cursor = 2
  let segmentsVisited = 0
  while (segmentsVisited < MAX_JPEG_HEADER_SEGMENTS) {
    if (!(await ensureWindow(cursor, 2))) return null
    if (byteAt(cursor) !== 0xff) return null

    let fillCount = 0
    while (byteAt(cursor) === 0xff) {
      cursor += 1
      fillCount += 1
      if (fillCount > MAX_JPEG_INTER_MARKER_FILL_BYTES) return null
      if (!(await ensureWindow(cursor, 1))) return null
    }

    const marker = byteAt(cursor)
    cursor += 1
    segmentsVisited += 1

    if (marker === 0x00 || marker === 0xd9 || marker === 0xda) {
      return null
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue
    }

    if (!(await ensureWindow(cursor, 2))) return null
    const segmentLength = (byteAt(cursor) << 8) | byteAt(cursor + 1)
    if (segmentLength < 2) return null

    if (isJpegSofMarker(marker)) {
      if (segmentLength < 8 || !(await ensureWindow(cursor, 7))) return null
      const height = (byteAt(cursor + 3) << 8) | byteAt(cursor + 4)
      const width = (byteAt(cursor + 5) << 8) | byteAt(cursor + 6)
      assertImageDimensionsSafe(width, height)
      return { format: "jpeg", width, height, isOpaque: true }
    }

    cursor += segmentLength
  }

  return null
}

const probeGifHeader = (bytes: Uint8Array): ProbedImageHeader | null => {
  if (bytes.length < 10) return null
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x38) return null
  if ((bytes[4] !== 0x37 && bytes[4] !== 0x39) || bytes[5] !== 0x61) return null

  const width = readUInt16LE(bytes, 6)
  const height = readUInt16LE(bytes, 8)
  assertImageDimensionsSafe(width, height)
  return { format: "gif", width, height, isOpaque: false }
}

const probeWebpHeader = (bytes: Uint8Array): ProbedImageHeader | null => {
  if (
    bytes.length < 25 ||
    !matchesAscii4(bytes, 0, 0x52494646) || // RIFF
    !matchesAscii4(bytes, 8, 0x57454250) // WEBP
  ) {
    return null
  }

  const chunkType = readUInt32BE(bytes, 12)
  const chunkSize = readUInt32LE(bytes, 16)
  if (chunkType === 0x56503820) { // "VP8 "
    if (
      bytes.length >= 30 &&
      chunkSize >= 10 &&
      (bytes[20]! & 0x01) === 0 &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      const width = readUInt16LE(bytes, 26) & 0x3fff
      const height = readUInt16LE(bytes, 28) & 0x3fff
      assertImageDimensionsSafe(width, height)
      return { format: "webp", width, height, isOpaque: true }
    }
    return null
  }

  if (chunkType === 0x5650384c) { // "VP8L"
    if (bytes.length >= 25 && chunkSize >= 5 && bytes[20] === 0x2f) {
      const bits = readUInt32LE(bytes, 21)
      if ((bits >>> 29) !== 0) return null
      const width = (bits & 0x3fff) + 1
      const height = ((bits >>> 14) & 0x3fff) + 1
      const hasAlpha = ((bits >>> 28) & 1) !== 0
      assertImageDimensionsSafe(width, height)
      return { format: "webp", width, height, isOpaque: !hasAlpha }
    }
    return null
  }

  if (chunkType === 0x56503858) { // "VP8X"
    if (bytes.length >= 30 && chunkSize === 10) {
      const flags = bytes[20]!
      const width = readUInt24LE(bytes, 24) + 1
      const height = readUInt24LE(bytes, 27) + 1
      assertImageDimensionsSafe(width, height)
      return { format: "webp", width, height, isOpaque: (flags & 0x10) === 0 }
    }
    return null
  }

  return null
}

const MIME_TO_EXPECTED_FORMAT: Record<string, ProbedImageFormat> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
}

const validateProbedMimeFormat = (
  probed: ProbedImageHeader,
  expectedMimeType?: string,
): ProbedImageHeader => {
  const normalizedMime = expectedMimeType?.trim().toLowerCase()
  const expectedFormat = normalizedMime ? MIME_TO_EXPECTED_FORMAT[normalizedMime] : undefined
  if (expectedFormat && probed.format !== expectedFormat) {
    throw new Error("파일 형식과 실제 이미지 데이터가 일치하지 않습니다.")
  }
  return probed
}

export const probeImageHeaderFromBytes = (
  bytes: Uint8Array,
  expectedMimeType?: string,
): ProbedImageHeader => {
  const probed =
    probePngHeader(bytes) ??
    probeJpegHeader(bytes) ??
    probeGifHeader(bytes) ??
    probeWebpHeader(bytes)

  if (!probed) {
    throw new Error("유효한 JPG/PNG/GIF/WebP 이미지 헤더를 확인할 수 없습니다.")
  }

  return validateProbedMimeFormat(probed, expectedMimeType)
}

export const readAndProbeImageFileHeader = async (
  file: File,
  expectedMimeType?: string,
): Promise<ProbedImageHeader> => {
  const slice = file.slice(0, IMAGE_HEADER_PROBE_BYTES)
  const initialBytes = new Uint8Array(await slice.arrayBuffer())
  if (
    initialBytes.length >= 4 &&
    initialBytes[0] === 0xff &&
    initialBytes[1] === 0xd8 &&
    initialBytes[2] === 0xff
  ) {
    const probedJpeg = await probeJpegFileHeaderBounded(file, initialBytes)
    if (!probedJpeg) {
      throw new Error("유효한 JPG/PNG/GIF/WebP 이미지 헤더를 확인할 수 없습니다.")
    }
    return validateProbedMimeFormat(probedJpeg, expectedMimeType)
  }

  return probeImageHeaderFromBytes(initialBytes, expectedMimeType)
}

/**
 * Check whether an RGBA `Uint8ClampedArray` buffer has any pixel with alpha < 255.
 * Uses endian-aware `Uint32Array` 4-pixel unrolling when 4-byte aligned.
 */
export const hasAlphaTransparency = (rgbaData: Uint8ClampedArray): boolean => {
  const pixelCount = rgbaData.length >>> 2
  if (pixelCount === 0) return false

  if ((rgbaData.byteOffset & 3) === 0 && rgbaData.byteLength >= 4) {
    const words = new Uint32Array(rgbaData.buffer, rgbaData.byteOffset, pixelCount)
    const unrolledLimit = pixelCount & ~3
    let i = 0
    for (; i < unrolledLimit; i += 4) {
      const combined = words[i] & words[i + 1] & words[i + 2] & words[i + 3]
      if (((combined & ALPHA_WORD_MASK) >>> 0) !== ALPHA_WORD_MASK) {
        return true
      }
    }
    for (; i < pixelCount; i += 1) {
      if (((words[i] & ALPHA_WORD_MASK) >>> 0) !== ALPHA_WORD_MASK) {
        return true
      }
    }
    return false
  }

  for (let index = 3; index < rgbaData.length; index += 4) {
    if (rgbaData[index] < 255) return true
  }
  return false
}
