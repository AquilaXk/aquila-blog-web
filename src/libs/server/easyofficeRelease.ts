import type { IncomingMessage } from "node:http"
import { lookup } from "node:dns/promises"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib"
import { isPrivateIpv4, isPrivateIpv6 } from "src/libs/network/publicHostSafety"
import { invalidateServerSnapshotCache, readServerSnapshot } from "src/libs/server/serverSnapshotCache"

export const MAX_RELEASE_METADATA_BYTES = 65_536
export const MAX_RELEASE_REDIRECTS = 4
export const MAX_CHECKSUM_LINES = 64
export const DEFAULT_RELEASE_FETCH_TIMEOUT_MS = 3_500
export const EASYOFFICE_RELEASE_SNAPSHOT_TTL_MS = 15 * 60 * 1_000

export const EASYOFFICE_LATEST_MANIFEST_URL =
  "https://github.com/AquilaXk/easyoffice/releases/latest/download/latest.json"
export const EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL =
  "https://github.com/AquilaXk/easyoffice/releases/download"
export const EASYOFFICE_RELEASE_TAG_BASE_URL =
  "https://github.com/AquilaXk/easyoffice/releases/tag"

export const EASYOFFICE_BINARY_ASSET_NAMES = [
  "EasyOffice-macos-universal.dmg",
  "EasyOffice-windows-x64-setup.exe",
  "EasyOffice-linux-x64.deb",
  "EasyOffice-linux-arm64.deb",
  "EasyOffice-linux-x64.rpm",
  "EasyOffice-linux-x64.AppImage",
] as const

export type EasyOfficeReleaseSnapshot = {
  version: string
  tag: string
  publishedDate: string
  releaseUrl: string
  checksums: Record<string, string>
}

export type ResolvedPublicAddress = { address: string; family: number }
export type ReleaseLookupFn = (
  hostname: string,
  options: { all: true; verbatim: true }
) => Promise<ReadonlyArray<ResolvedPublicAddress>>

export type BoundedReleaseResponseStream = {
  statusCode?: number
  headers: IncomingMessage["headers"]
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown
  on(event: "end", listener: () => void): unknown
  on(event: "close", listener: () => void): unknown
  on(event: "error", listener: (error: Error) => void): unknown
  destroy: (error?: Error) => unknown
  resume: () => unknown
}

export type ReleaseTransportFn = (
  url: URL,
  signal: AbortSignal
) => Promise<BoundedReleaseResponseStream>

const RELEASE_SNAPSHOT_CACHE_PREFIX = "public:easyoffice:"
const USER_AGENT = "Aquila-Blog-Web-ReleaseSync/1.0"
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308])
const ALLOWED_RELEASE_HOSTS = new Set([
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
  "objects-origin.githubusercontent.com",
  "github-releases.githubusercontent.com",
])
const KNOWN_BINARY_ASSET_SET = new Set<string>(EASYOFFICE_BINARY_ASSET_NAMES)

const CHAR_DIGIT = 1
const CHAR_HEX_MASK = 1 | 2 | 4
const ASCII_TABLE = new Uint8Array(128)
for (let c = 48; c <= 57; c += 1) ASCII_TABLE[c] = CHAR_DIGIT
for (let c = 97; c <= 102; c += 1) ASCII_TABLE[c] = 2
for (let c = 65; c <= 70; c += 1) ASCII_TABLE[c] = 4

let lastKnownGoodSnapshot: EasyOfficeReleaseSnapshot | null = null
let releaseStateGeneration = 0

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const pad2 = (value: number): string => (value < 10 ? `0${value}` : String(value))

export const isValidStableSemver = (value: string): boolean => {
  if (typeof value !== "string" || value.length < 5 || value.length > 32) return false
  let segments = 1
  let segLen = 0
  let segStartsWithZero = false
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code === 46) {
      if (segLen === 0 || segments >= 3) return false
      segments += 1
      segLen = 0
      segStartsWithZero = false
      continue
    }
    if (code >= 128 || (ASCII_TABLE[code]! & CHAR_DIGIT) === 0) return false
    if (segLen === 0) segStartsWithZero = code === 48
    else if (segStartsWithZero) return false
    segLen += 1
  }
  return segments === 3 && segLen > 0
}

export const formatUtcReleaseDate = (epochMs: number): string => {
  if (!Number.isFinite(epochMs)) throw new Error("유효하지 않은 릴리스 시각입니다.")
  const date = new Date(epochMs)
  return `${date.getUTCFullYear()}.${pad2(date.getUTCMonth() + 1)}.${pad2(date.getUTCDate())}`
}

export const parseEasyOfficeReleaseManifest = (
  rawJson: string
): Omit<EasyOfficeReleaseSnapshot, "checksums"> => {
  if (!rawJson || Buffer.byteLength(rawJson, "utf8") > MAX_RELEASE_METADATA_BYTES) {
    throw new Error("릴리스 매니페스트 크기가 허용 범위를 벗어났습니다.")
  }
  const parsed: unknown = JSON.parse(rawJson)
  if (!isPlainRecord(parsed)) throw new Error("릴리스 매니페스트 형식이 올바르지 않습니다.")
  const version = parsed.version
  if (typeof version !== "string" || !isValidStableSemver(version)) {
    throw new Error("릴리스 매니페스트 버전 형식이 올바르지 않습니다.")
  }
  const pubEpochMs = typeof parsed.pub_date === "string" ? Date.parse(parsed.pub_date) : Number.NaN
  if (!Number.isFinite(pubEpochMs)) throw new Error("릴리스 발행일 형식이 올바르지 않습니다.")
  if (!isPlainRecord(parsed.platforms)) throw new Error("릴리스 플랫폼 목록 형식이 올바르지 않습니다.")

  const platformKeys = Object.keys(parsed.platforms)
  if (platformKeys.length === 0) throw new Error("릴리스 플랫폼 목록이 비어 있습니다.")

  const tag = `v${version}`
  const expectedPrefix = `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/${tag}/`
  for (let i = 0; i < platformKeys.length; i += 1) {
    const entry = parsed.platforms[platformKeys[i]!]
    if (
      !isPlainRecord(entry) ||
      typeof entry.url !== "string" ||
      !entry.url.startsWith(expectedPrefix) ||
      entry.url.includes("..")
    ) {
      throw new Error("릴리스 플랫폼 URL이 현재 릴리스 태그와 일치하지 않습니다.")
    }
  }
  return {
    version,
    tag,
    publishedDate: formatUtcReleaseDate(pubEpochMs),
    releaseUrl: `${EASYOFFICE_RELEASE_TAG_BASE_URL}/${tag}`,
  }
}

export const parseEasyOfficeChecksums = (rawText: string): Record<string, string> => {
  if (!rawText || Buffer.byteLength(rawText, "utf8") > MAX_RELEASE_METADATA_BYTES) {
    throw new Error("체크섬 파일 크기가 허용 범위를 벗어났습니다.")
  }
  const checksums: Record<string, string> = {}
  const seenFiles = new Set<string>()
  let nonEmptyLines = 0
  let cursor = 0

  while (cursor <= rawText.length) {
    const nextNewline = rawText.indexOf("\n", cursor)
    let lineEnd = nextNewline === -1 ? rawText.length : nextNewline
    if (lineEnd > cursor && rawText.charCodeAt(lineEnd - 1) === 13) lineEnd -= 1
    if (lineEnd > cursor) {
      nonEmptyLines += 1
      if (nonEmptyLines > MAX_CHECKSUM_LINES) throw new Error("체크섬 줄 수가 허용 상한을 초과했습니다.")
      if (
        lineEnd - cursor < 67 ||
        rawText.charCodeAt(cursor + 64) !== 32 ||
        rawText.charCodeAt(cursor + 65) !== 32
      ) {
        throw new Error("체크섬 줄 형식이 올바르지 않습니다.")
      }
      for (let i = 0; i < 64; i += 1) {
        const code = rawText.charCodeAt(cursor + i)
        if (code >= 128 || (ASCII_TABLE[code]! & CHAR_HEX_MASK) === 0) {
          throw new Error("SHA-256 해시에 유효하지 않은 문자가 포함되어 있습니다.")
        }
      }
      const fileName = rawText.slice(cursor + 66, lineEnd)
      if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName === "..") {
        throw new Error("체크섬 파일명이 올바르지 않습니다.")
      }
      if (seenFiles.has(fileName)) throw new Error(`중복된 체크섬 항목(${fileName})은 허용되지 않습니다.`)
      seenFiles.add(fileName)
      if (KNOWN_BINARY_ASSET_SET.has(fileName)) {
        checksums[fileName] = rawText.slice(cursor, cursor + 64).toLowerCase()
      }
    }
    if (nextNewline === -1) break
    cursor = nextNewline + 1
  }

  for (let i = 0; i < EASYOFFICE_BINARY_ASSET_NAMES.length; i += 1) {
    const required = EASYOFFICE_BINARY_ASSET_NAMES[i]!
    if (!Object.prototype.hasOwnProperty.call(checksums, required)) {
      throw new Error(`필수 설치 파일 체크섬(${required})이 누락되었습니다.`)
    }
  }
  return checksums
}

const hasUnsafeParentSegment = (rawUrl: string): boolean => {
  const pathOnly = rawUrl.replace(/^[a-z]+:\/\/[^/]+/i, "").split(/[?#]/, 1)[0] || ""
  const segments = pathOnly.split(/[\\/]/)
  for (let i = 0; i < segments.length; i += 1) {
    try {
      if (decodeURIComponent(segments[i]!) === "..") return true
    } catch {
      return true
    }
  }
  return false
}

export const assertSafeGitHubReleaseUrl = (rawUrl: string): URL => {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error("릴리스 URL 형식이 올바르지 않습니다.")
  }
  const hostname = parsed.hostname.trim().toLowerCase()
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("인증 정보가 없는 HTTPS 릴리스 URL만 허용됩니다.")
  }
  if (parsed.port && parsed.port !== "443") throw new Error("표준 443 포트의 HTTPS URL만 허용됩니다.")
  if (!ALLOWED_RELEASE_HOSTS.has(hostname) || hasUnsafeParentSegment(rawUrl)) {
    throw new Error("허용된 GitHub 릴리스 호스트 및 안전 경로만 조회할 수 있습니다.")
  }
  if (hostname === "github.com" && !parsed.pathname.startsWith("/AquilaXk/easyoffice/")) {
    throw new Error("허용된 EasyOffice 저장소 경로만 조회할 수 있습니다.")
  }
  const safeUrl = new URL(parsed.toString())
  safeUrl.hostname = hostname
  safeUrl.hash = ""
  return safeUrl
}

export const resolvePublicReleaseAddress = async (
  hostname: string,
  lookupFn: ReleaseLookupFn = lookup
): Promise<ResolvedPublicAddress> => {
  if (isIP(hostname) !== 0) throw new Error("IP 주소 직접 조회는 허용되지 않습니다.")
  const resolved = await lookupFn(hostname, { all: true, verbatim: true })
  if (resolved.length === 0) throw new Error("릴리스 호스트의 공인 IP를 확인할 수 없습니다.")
  const hasPrivate = resolved.some(({ address, family }) =>
    family === 4 ? isPrivateIpv4(address) : family === 6 ? isPrivateIpv6(address) : true
  )
  if (hasPrivate) throw new Error("비공개 네트워크로 해석되는 릴리스 호스트는 차단됩니다.")
  return resolved.find(({ family }) => family === 4) || resolved[0]!
}

export const decodeBoundedReleaseBuffer = (buffer: Buffer, contentEncoding: string): Buffer => {
  if (buffer.byteLength > MAX_RELEASE_METADATA_BYTES) {
    throw new Error("릴리스 메타데이터 응답이 허용 상한을 초과했습니다.")
  }
  const normalized = contentEncoding.trim().toLowerCase()
  if (!normalized || normalized === "identity") return buffer
  const zlibOptions = { maxOutputLength: MAX_RELEASE_METADATA_BYTES }
  if (normalized === "gzip") return gunzipSync(buffer, zlibOptions)
  if (normalized === "deflate") return inflateSync(buffer, zlibOptions)
  if (normalized === "br") return brotliDecompressSync(buffer, zlibOptions)
  throw new Error("지원하지 않는 릴리스 응답 인코딩입니다.")
}

export const readBoundedReleaseStream = (
  response: BoundedReleaseResponseStream,
  abortUpstream?: () => void
): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    const statusCode = response.statusCode || 502
    if (REDIRECT_STATUS_CODES.has(statusCode)) {
      response.destroy()
      resolve(Buffer.alloc(0))
      return
    }
    const declaredRaw = response.headers["content-length"]
    const declaredLength =
      typeof declaredRaw === "string" ? Number.parseInt(declaredRaw, 10) : Number.NaN
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RELEASE_METADATA_BYTES) {
      const limitError = new Error("릴리스 응답 길이가 허용 상한을 초과했습니다.")
      response.destroy()
      abortUpstream?.()
      reject(limitError)
      return
    }

    const chunks: Buffer[] = []
    let receivedBytes = 0
    let settled = false
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      reject(error)
    }

    response.on("data", (chunk) => {
      if (settled) return
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      receivedBytes += buf.byteLength
      if (receivedBytes > MAX_RELEASE_METADATA_BYTES) {
        const limitError = new Error("릴리스 스트림 크기가 허용 상한을 초과했습니다.")
        response.destroy()
        abortUpstream?.()
        fail(limitError)
        return
      }
      chunks.push(buf)
    })
    response.on("error", fail)
    response.on("close", () => {
      if (!settled) fail(new Error("릴리스 응답 연결이 조기에 종료되었습니다."))
    })
    response.on("end", () => {
      if (settled) return
      try {
        const rawBody = Buffer.concat(chunks, receivedBytes)
        const enc = response.headers["content-encoding"]
        const encoding = Array.isArray(enc) ? enc.join(",") : enc || ""
        const decoded = decodeBoundedReleaseBuffer(rawBody, encoding)
        settled = true
        resolve(decoded)
      } catch (error) {
        fail(error)
      }
    })
  })

const fetchHttpsReleaseStream = async (
  currentUrl: URL,
  signal: AbortSignal,
  lookupFn: ReleaseLookupFn
): Promise<BoundedReleaseResponseStream> => {
  const resolved = await resolvePublicReleaseAddress(currentUrl.hostname, lookupFn)
  return await new Promise<BoundedReleaseResponseStream>((resolve, reject) => {
    const request = httpsRequest(
      {
        protocol: "https:",
        hostname: resolved.address,
        family: resolved.family,
        port: 443,
        path: `${currentUrl.pathname}${currentUrl.search}`,
        method: "GET",
        servername: currentUrl.hostname,
        signal,
        headers: {
          host: currentUrl.host,
          "user-agent": USER_AGENT,
          accept: "application/json, text/plain;q=0.9",
          "accept-encoding": "gzip, deflate, br",
        },
      },
      (response) => resolve(response)
    )
    request.on("error", reject)
    request.end()
  })
}

export const fetchBoundedGitHubReleaseText = async (
  initialUrl: string,
  options?: { timeoutMs?: number; transport?: ReleaseTransportFn; lookup?: ReleaseLookupFn }
): Promise<string> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_RELEASE_FETCH_TIMEOUT_MS)
  let currentUrl = assertSafeGitHubReleaseUrl(initialUrl)

  try {
    for (let hop = 0; hop <= MAX_RELEASE_REDIRECTS; hop += 1) {
      if (options?.transport && options.lookup) {
        await resolvePublicReleaseAddress(currentUrl.hostname, options.lookup)
      }
      const response = options?.transport
        ? await options.transport(currentUrl, controller.signal)
        : await fetchHttpsReleaseStream(currentUrl, controller.signal, options?.lookup ?? lookup)

      const statusCode = response.statusCode || 502
      if (REDIRECT_STATUS_CODES.has(statusCode)) {
        const rawLoc = response.headers.location
        response.destroy()
        const location = Array.isArray(rawLoc) ? rawLoc[0] : rawLoc
        if (!location || hop === MAX_RELEASE_REDIRECTS) {
          throw new Error("릴리스 리다이렉트 경로가 유효하지 않거나 횟수를 초과했습니다.")
        }
        currentUrl = assertSafeGitHubReleaseUrl(new URL(location, currentUrl).toString())
        continue
      }
      if (statusCode !== 200) {
        response.destroy()
        throw new Error(`릴리스 메타데이터 응답 오류(${statusCode})`)
      }
      return (await readBoundedReleaseStream(response, () => controller.abort())).toString("utf8")
    }
    throw new Error("릴리스 리다이렉트 횟수를 초과했습니다.")
  } finally {
    clearTimeout(timer)
  }
}

export const getLastKnownGoodEasyOfficeRelease = (): EasyOfficeReleaseSnapshot | null =>
  lastKnownGoodSnapshot

export const resolveEasyOfficeReleaseSnapshot = async (options?: {
  timeoutMs?: number
  ttlMs?: number
  transport?: ReleaseTransportFn
  lookup?: ReleaseLookupFn
  cacheKeySuffix?: string
}): Promise<EasyOfficeReleaseSnapshot | null> => {
  const ttlMs = options?.ttlMs ?? EASYOFFICE_RELEASE_SNAPSHOT_TTL_MS
  const suffix = options?.cacheKeySuffix ? `:${options.cacheKeySuffix}` : ""
  const startGen = releaseStateGeneration
  const result = await readServerSnapshot<EasyOfficeReleaseSnapshot>(
    `${RELEASE_SNAPSHOT_CACHE_PREFIX}latest${suffix}`,
    ttlMs,
    async () => {
      try {
        const fetchOpts = {
          timeoutMs: options?.timeoutMs,
          transport: options?.transport,
          lookup: options?.lookup,
        }
        const manifestRaw = await fetchBoundedGitHubReleaseText(EASYOFFICE_LATEST_MANIFEST_URL, fetchOpts)
        const manifest = parseEasyOfficeReleaseManifest(manifestRaw)
        const checksumsRaw = await fetchBoundedGitHubReleaseText(
          `${EASYOFFICE_RELEASE_DOWNLOAD_BASE_URL}/${manifest.tag}/SHA256SUMS.txt`,
          fetchOpts
        )
        const snapshot: EasyOfficeReleaseSnapshot = {
          ...manifest,
          checksums: parseEasyOfficeChecksums(checksumsRaw),
        }
        if (startGen === releaseStateGeneration) {
          lastKnownGoodSnapshot = snapshot
        }
        return snapshot
      } catch {
        return null
      }
    }
  )
  return result.value ?? lastKnownGoodSnapshot
}

export const resetEasyOfficeReleaseStateForTests = (): void => {
  releaseStateGeneration += 1
  lastKnownGoodSnapshot = null
  invalidateServerSnapshotCache(RELEASE_SNAPSHOT_CACHE_PREFIX)
}
