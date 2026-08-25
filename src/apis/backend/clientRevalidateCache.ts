const DEFAULT_REVALIDATE_CACHE_TTL_MS = 15_000
const REVALIDATE_CACHE_MAX_TTL_MS = 300_000
const REVALIDATE_CACHE_MAX_ENTRIES = 200

type RevalidateCacheEntry = {
  etag: string
  payload: unknown
  maxAgeMs: number
}

const isServer = typeof window === "undefined"
const browserRevalidateCache = new Map<string, RevalidateCacheEntry>()

const hasNoStoreCacheControl = (cacheControlHeader: string | null) =>
  cacheControlHeader
    ?.split(",")
    .some((directive) => directive.trim().toLowerCase() === "no-store") ?? false

const parseCacheControlMaxAgeMs = (cacheControlHeader: string | null) => {
  if (!cacheControlHeader) return DEFAULT_REVALIDATE_CACHE_TTL_MS
  const matched = /(?:^|,)\s*max-age=(\d+)/i.exec(cacheControlHeader)
  if (!matched) return DEFAULT_REVALIDATE_CACHE_TTL_MS
  const seconds = Number.parseInt(matched[1], 10)
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_REVALIDATE_CACHE_TTL_MS
  return Math.min(seconds * 1000, REVALIDATE_CACHE_MAX_TTL_MS)
}

export const getRevalidateCacheEntry = (url: string) => {
  if (isServer) return null
  const cached = browserRevalidateCache.get(url)
  if (!cached) return null
  return cached
}

export const setRevalidateCacheEntry = (
  url: string,
  etag: string,
  payload: unknown,
  cacheControlHeader: string | null,
) => {
  if (isServer) return
  if (hasNoStoreCacheControl(cacheControlHeader)) {
    browserRevalidateCache.delete(url)
    return
  }

  const maxAgeMs = parseCacheControlMaxAgeMs(cacheControlHeader)
  browserRevalidateCache.set(url, {
    etag,
    payload,
    maxAgeMs,
  })

  if (browserRevalidateCache.size <= REVALIDATE_CACHE_MAX_ENTRIES) return
  const oldestKey = browserRevalidateCache.keys().next().value
  if (oldestKey) browserRevalidateCache.delete(oldestKey)
}

export const refreshRevalidateCacheEntry = (
  url: string,
  fallback: RevalidateCacheEntry,
  etagHeader: string | null,
  cacheControlHeader: string | null,
) => {
  if (isServer) return
  if (hasNoStoreCacheControl(cacheControlHeader)) {
    browserRevalidateCache.delete(url)
    return
  }

  const maxAgeMs =
    cacheControlHeader === null ? fallback.maxAgeMs : parseCacheControlMaxAgeMs(cacheControlHeader)
  const nextEtag = etagHeader?.trim() || fallback.etag
  browserRevalidateCache.set(url, {
    etag: nextEtag,
    payload: fallback.payload,
    maxAgeMs,
  })
}

export const evictBrowserRevalidatePayloadCacheEntries = (predicate: (url: string) => boolean) => {
  if (isServer) return

  const cacheKeysToDelete: string[] = []
  browserRevalidateCache.forEach((_, url) => {
    if (predicate(url)) cacheKeysToDelete.push(url)
  })
  cacheKeysToDelete.forEach((url) => {
    browserRevalidateCache.delete(url)
  })
}
