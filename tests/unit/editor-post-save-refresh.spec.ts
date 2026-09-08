import { expect, test } from "@playwright/test"
import { revalidateSavedPost, resolvePostSaveRefresh } from "../../src/routes/Admin/editorPostSaveRefresh"

const originalFetch = globalThis.fetch
test.afterEach(() => { globalThis.fetch = originalFetch })

test("저장 후 갱신은 같은 출처에 취소 가능한 단일 POST를 보낸다", async () => {
  let calls = 0
  globalThis.fetch = async (url, init) => {
    calls += 1
    expect(url).toBe("/api/revalidate")
    expect(init?.method).toBe("POST")
    expect(init?.credentials).toBe("include")
    expect(JSON.parse(String(init?.body))).toEqual({ paths: ["/posts/771"] })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    return new Response(null, { status: 204 })
  }
  await revalidateSavedPost(771)
  expect(calls).toBe(1)
})

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

test("갱신 요청 지연은 실제 취소되며 저장 재전송 없이 안내한다", async () => {
  test.setTimeout(12_000)
  let calls = 0
  let aborted = false
  globalThis.fetch = (_url, init) => {
    calls += 1
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true
        reject(init.signal?.reason)
      }, { once: true })
    })
  }
  const notice = await resolvePostSaveRefresh(() => revalidateSavedPost(771), "수정 완료")
  expect(aborted).toBe(true)
  expect(calls).toBe(1)
  expect(notice.text).toContain("저장은 완료됐지만")
})

test("갱신 HTTP 실패는 응답 본문을 기다리거나 노출하지 않는다", async () => {
  let bodyReads = 0
  globalThis.fetch = async () => {
    const response = new Response("provider internals", { status: 500 })
    response.text = async () => { bodyReads += 1; return "provider internals" }
    return response
  }
  await expect(revalidateSavedPost(771)).rejects.toThrow("공개 화면 갱신 요청에 실패했습니다.")
  expect(bodyReads).toBe(0)
})
