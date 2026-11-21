import { expect, test } from "@playwright/test"
import { ApiError, ApiTimeoutError, apiFetch } from "../../src/apis/backend/client"
import { registerServerApiFetchMetrics } from "src/libs/server/apiFetchMetrics"

test.beforeEach(() => {
  registerServerApiFetchMetrics()
})

test("ApiError.requestId keeps constructor value and normalizes blanks", () => {
  expect(new ApiError(500, "/x", "", "req-abc").requestId).toBe("req-abc")
  expect(new ApiError(500, "/x", "", "  req-abc  ").requestId).toBe("req-abc")
  expect(new ApiError(500, "/x", "").requestId).toBeNull()
  expect(new ApiError(500, "/x", "", "   ").requestId).toBeNull()
  expect(new ApiTimeoutError("/x", 1_000).requestId).toBeNull()
})

test("apiFetch keeps the canonical outbound request ID when the backend returns a different ID", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ msg: "권한이 없습니다." }), {
      status: 403,
      headers: {
        "content-type": "application/json",
        "x-request-id": "backend-response-id",
      },
    })) as typeof fetch

  try {
    await apiFetch("/member/api/v1/auth/me", { headers: { "x-request-id": "7f3c2a1b-4d5e-6789-abcd-ef0123456789" } })
    throw new Error("expected apiFetch to reject")
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).requestId).toBe("7f3c2a1b-4d5e-6789-abcd-ef0123456789")
    expect((error as ApiError).userMessage).toBe("권한이 없습니다.")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("apiFetch generates an ApiError.requestId when no request ID is supplied", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ msg: "권한이 없습니다." }), {
      status: 403,
      headers: {
        "content-type": "application/json",
      },
    })) as typeof fetch

  try {
    await apiFetch("/member/api/v1/auth/me")
    throw new Error("expected apiFetch to reject")
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).requestId).toMatch(/^[0-9a-f-]{36}$/i)
  } finally {
    globalThis.fetch = originalFetch
  }
})
