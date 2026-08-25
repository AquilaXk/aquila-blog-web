import { expect, test } from "@playwright/test"
import { isValidRequestId, resolveRequestId } from "src/libs/server/requestId"

test("request IDs preserve only complete valid values under the fixed contract", () => {
  expect(isValidRequestId("req-ABC_123.456")).toBe(true)
  expect(isValidRequestId("x".repeat(120))).toBe(true)
  expect(isValidRequestId("-")).toBe(false)
  expect(isValidRequestId("x".repeat(121))).toBe(false)
  expect(isValidRequestId("request id")).toBe(false)
  expect(isValidRequestId("req/abc")).toBe(false)
})

test("missing or invalid request IDs receive secure UUIDs instead of partial sanitization", () => {
  const generated = "123e4567-e89b-42d3-a456-426614174000"
  const generate = () => generated

  expect(resolveRequestId("req-ABC_123.456", generate)).toBe("req-ABC_123.456")
  expect(resolveRequestId(" bad value ", generate)).toBe(generated)
  expect(resolveRequestId("-", generate)).toBe(generated)
  expect(resolveRequestId(undefined, generate)).toBe(generated)
})
