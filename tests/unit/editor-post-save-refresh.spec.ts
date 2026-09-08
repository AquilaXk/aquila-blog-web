import { expect, test } from "@playwright/test"
import { resolvePostSaveRefresh } from "../../src/routes/Admin/editorPostSaveRefresh"

test("공개 화면 갱신 결과는 확정된 저장 결과를 뒤집지 않는다", async () => {
  let calls = 0
  const success = "수정 완료"
  expect(await resolvePostSaveRefresh(async () => { calls += 1 }, success))
    .toEqual({ tone: "success", text: success })
  expect(await resolvePostSaveRefresh(async () => {
    calls += 1
    throw new Error("provider response must not reach the notice")
  }, success)).toEqual({
    tone: "error",
    text: "저장은 완료됐지만 공개 화면 갱신에 실패했습니다. 다시 저장할 필요는 없습니다.",
  })
  expect(calls).toBe(2)
})
