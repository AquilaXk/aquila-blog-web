type RefreshNotice = { tone: "success" | "error"; text: string }

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
