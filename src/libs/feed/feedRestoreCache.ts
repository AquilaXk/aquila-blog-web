export const FEED_EXPLORER_RESTORE_KEY_PREFIX = "feed:explorer:state:v2"
export const FEED_EXPLORER_SNAPSHOT_SUFFIX = ":snapshot"
export const FEED_EXPLORER_CURSOR_SUFFIX = ":cursor"

const hasSessionStorage = () =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"

export const clearFeedExplorerRestoreCache = () => {
  if (!hasSessionStorage()) return

  try {
    const keysToRemove: string[] = []
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index)
      if (key && key.startsWith(FEED_EXPLORER_RESTORE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => {
      window.sessionStorage.removeItem(key)
    })
  } catch {
    // 스토리지 접근이 차단된 환경에서는 조용히 무시한다.
  }
}
