import { expect, test } from "@playwright/test"
import { safeTokenCompare } from "../../src/libs/server/safeTokenCompare"

test.describe("safeTokenCompare", () => {
  test("returns true for matching strings", () => {
    expect(safeTokenCompare("secret123", "secret123")).toBe(true)
    expect(safeTokenCompare("a".repeat(64), "a".repeat(64))).toBe(true)
  })

  test("returns false for non-matching strings of same length", () => {
    expect(safeTokenCompare("secret123", "secret124")).toBe(false)
  })

  test("returns false for non-matching strings of different length", () => {
    expect(safeTokenCompare("secret123", "secret")).toBe(false)
  })

  test("returns false for empty or falsy inputs", () => {
    expect(safeTokenCompare("", "secret")).toBe(false)
    expect(safeTokenCompare("secret", "")).toBe(false)
    expect(safeTokenCompare("", "")).toBe(false)
    expect(safeTokenCompare(null, "secret")).toBe(false)
    expect(safeTokenCompare(undefined, "secret")).toBe(false)
    expect(safeTokenCompare("secret", null)).toBe(false)
    expect(safeTokenCompare("secret", undefined)).toBe(false)
  })
})
