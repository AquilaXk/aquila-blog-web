import { toCanonicalPostPath } from "src/libs/utils/postPath"

type RefreshNotice = { tone: "success" | "error"; text: string }
const POST_SAVE_REFRESH_TIMEOUT_MS = 8_000

export const revalidateSavedPost = async (postId: string | number): Promise<void> => {
  const controller = new AbortController()
  // 저장 이후의 조회 갱신 때문에 편집 화면이 무기한 잠기지 않도록 요청을 취소한다.
  const timeout = setTimeout(() => controller.abort(), POST_SAVE_REFRESH_TIMEOUT_MS)
  try {
    const response = await fetch("/api/revalidate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: [toCanonicalPostPath(postId)] }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error("공개 화면 갱신 요청에 실패했습니다.")
  } finally {
    clearTimeout(timeout)
  }
}

// 서버 저장이 확정된 뒤의 조회 갱신 실패를 저장 실패로 되돌리지 않는다.
export const resolvePostSaveRefresh = async (
  refresh: () => Promise<void>,
  successText: string
): Promise<RefreshNotice> => {
  try {
    await refresh()
    return { tone: "success", text: successText }
  } catch {
    return {
      tone: "error",
      text: "저장은 완료됐지만 공개 화면 갱신에 실패했습니다. 다시 저장할 필요는 없습니다.",
    }
  }
}
