import type { ClipboardEvent as ReactClipboardEvent } from "react"
import { ApiError, ApiNetworkError, ApiTimeoutError } from "src/apis/backend/client"
import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import type { MarkdownEditorSurfaceMode } from "./markdownEditorLivePreview"
import { planReplaceSelection, type PlannedTextMutation } from "./markdownEditorTextMutation"
import {
  convertSafeHtmlPasteToMarkdown,
  isOffsetInsideInlineCodeSpan,
  shouldBypassHtmlPasteConversion,
  shouldReportEmptyHtmlPasteError,
} from "./markdownEditorHtmlPasteModel"
import {
  parseSingleHttpUrl,
  planLinkifySelectionWithUrl,
} from "./markdownEditorPasteDropModel"

export type TextareaSelection = {
  from: number
  to: number
}

export type MarkdownMutationOptions = {
  clearUploadError?: boolean
}

export type ResolveMarkdownEditorUploadErrorOptions = {
  kind: "image" | "file"
  fileName: string
  fallbackMessage: string
}

const GENERIC_CLIENT_STATUS_MESSAGES = new Set([
  "요청 값이 올바르지 않습니다.",
  "요청 처리 중 오류가 발생했습니다.",
])

const resolveApiUploadErrorMessage = (error: ApiError, fallbackMessage: string): string => {
  if (error.status >= 500) return fallbackMessage
  if (error.status === 413) {
    return error.userMessage || "업로드 파일 용량이 너무 큽니다. 용량을 줄여 다시 시도해주세요."
  }
  if (error.status === 401 || error.status === 403 || error.status === 429) {
    return error.userMessage || fallbackMessage
  }
  if (error.userMessage && !GENERIC_CLIENT_STATUS_MESSAGES.has(error.userMessage)) {
    return error.userMessage
  }
  return fallbackMessage
}

const resolveGenericErrorKoreanMessage = (error: Error): string | null => {
  const trimmed = error.message.trim()
  if (!trimmed || !/[가-힣]/.test(trimmed)) return null
  return /Exception|endpoint|bucket|provider|stack/i.test(trimmed) ? null : trimmed
}

export const resolveMarkdownEditorUploadErrorMessage = (
  error: unknown,
  { fallbackMessage }: ResolveMarkdownEditorUploadErrorOptions
): string => {
  if (error instanceof ApiTimeoutError) {
    return "업로드 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."
  }
  if (error instanceof ApiNetworkError) {
    return "네트워크 연결에 실패했습니다. 잠시 후 다시 시도해주세요."
  }
  if (error instanceof ApiError) {
    return resolveApiUploadErrorMessage(error, fallbackMessage)
  }
  if (error instanceof Error) {
    return resolveGenericErrorKoreanMessage(error) ?? fallbackMessage
  }
  return fallbackMessage
}

export const shouldLinkifySelectionOnUrlPaste = (
  viewMode: MarkdownEditorSurfaceMode | undefined,
  currentValue: string,
  selection: TextareaSelection
): boolean => {
  if (selection.from >= selection.to) return false
  if ((viewMode ?? "live") !== "live") return false
  if (isOffsetInsideFencedCodeBlock(currentValue, selection.from)) return false
  if (isOffsetInsideInlineCodeSpan(currentValue, selection.from)) return false
  return true
}

export const tryApplyUrlSelectionLinkify = (
  event: ReactClipboardEvent<HTMLElement>,
  viewMode: MarkdownEditorSurfaceMode | undefined,
  currentValue: string,
  selection: TextareaSelection,
  plainText: string,
  applyPlannedMarkdownMutation: (plan: PlannedTextMutation, options?: MarkdownMutationOptions) => boolean
): boolean => {
  if (!shouldLinkifySelectionOnUrlPaste(viewMode, currentValue, selection)) return false
  const url = parseSingleHttpUrl(plainText)
  if (!url) return false
  event.preventDefault()
  const selectedText = currentValue.slice(selection.from, selection.to)
  applyPlannedMarkdownMutation(planLinkifySelectionWithUrl(selection.from, selection.to, selectedText, url))
  return true
}

export type HtmlPasteHandlerContext = {
  event: ReactClipboardEvent<HTMLElement>
  html: string
  plainText: string
  viewMode: MarkdownEditorSurfaceMode
  currentValue: string
  selection: TextareaSelection
  applyRecordedMarkdownMutation: (plan: PlannedTextMutation) => boolean
  setEditorError: (message: string) => void
}

export const applyHtmlPasteIfEligible = ({
  event,
  html,
  plainText,
  viewMode,
  currentValue,
  selection,
  applyRecordedMarkdownMutation,
  setEditorError,
}: HtmlPasteHandlerContext) => {
  const clipboardTypes = Array.from(event.clipboardData?.types ?? [])
  if (
    shouldBypassHtmlPasteConversion({
      viewMode,
      markdown: currentValue,
      selectionFrom: selection.from,
      clipboardTypes,
      html,
      plainText,
    })
  ) {
    return
  }
  const imported = convertSafeHtmlPasteToMarkdown(html)
  event.preventDefault()
  if (imported.kind === "error") {
    if (shouldReportEmptyHtmlPasteError(html, plainText)) {
      setEditorError(imported.message)
      return
    }
    applyRecordedMarkdownMutation(
      planReplaceSelection(selection.from, selection.to, plainText.replace(/\r\n?/g, "\n"))
    )
    return
  }
  if (imported.kind === "markdown") {
    applyRecordedMarkdownMutation(planReplaceSelection(selection.from, selection.to, imported.markdown))
  }
}
