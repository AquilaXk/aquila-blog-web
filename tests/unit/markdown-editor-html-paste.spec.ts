import { expect, test } from "@playwright/test"
import {
  HTML_PASTE_EMPTY_CONTENT_MESSAGE,
  createHtmlPasteEmptyResult,
  normalizeHtmlPasteText,
  resolveSafeHtmlPasteHref,
  resolveSafeHtmlPasteImportBoundary,
} from "../../src/components/markdown-editor/markdownEditorHtmlPasteModel"

test.describe("markdown editor safe HTML paste model", () => {
  test("keeps the null-html and empty-html result boundary explicit", () => {
    expect(resolveSafeHtmlPasteImportBoundary(null)).toEqual({ kind: "none" })
    expect(resolveSafeHtmlPasteImportBoundary(" \r\n ")).toEqual(createHtmlPasteEmptyResult())
    expect(createHtmlPasteEmptyResult()).toEqual({
      kind: "error",
      message: HTML_PASTE_EMPTY_CONTENT_MESSAGE,
    })
  })

  test("accepts only credential-free absolute http URLs", () => {
    expect(resolveSafeHtmlPasteHref("https://example.com/docs?q=1")).toBe("https://example.com/docs?q=1")
    expect(resolveSafeHtmlPasteHref("http://example.com")).toBe("http://example.com/")
    expect(resolveSafeHtmlPasteHref("/relative")).toBeNull()
    expect(resolveSafeHtmlPasteHref("https://user:pass@example.com")).toBeNull()
    expect(resolveSafeHtmlPasteHref("javascript:alert(1)")).toBeNull()
    expect(resolveSafeHtmlPasteHref("data:text/html,x")).toBeNull()
  })

  test("normalizes clipboard text without retaining control whitespace", () => {
    expect(normalizeHtmlPasteText("  alpha\r\n beta\u00a0 gamma  ")).toBe(" alpha\n beta gamma ")
    expect(normalizeHtmlPasteText("\u0000\t\n")).toBe("")
  })
})
