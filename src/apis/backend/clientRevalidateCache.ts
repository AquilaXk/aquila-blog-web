const REVALIDATE_CACHE_MAX_ENTRIES = 200

type RevalidateCacheEntry = {
  etag: string
  payload: unknown
}

const isServer = typeof window === "undefined"
const browserRevalidateCache = new Map<string, RevalidateCacheEntry>()

const hasNoStoreCacheControl = (cacheControlHeader: string | null) =>
  cacheControlHeader
    ?.split(",")
    .some((directive) => directive.trim().toLowerCase() === "no-store") ?? false

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

  browserRevalidateCache.set(url, {
    etag,
    payload,
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

  const nextEtag = etagHeader?.trim() || fallback.etag
  browserRevalidateCache.set(url, {
    etag: nextEtag,
    payload: fallback.payload,
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
