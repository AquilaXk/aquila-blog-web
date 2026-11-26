import type { ClipboardEvent as ReactClipboardEvent } from "react"
import { ApiError, ApiNetworkError, ApiTimeoutError } from "src/apis/backend/client"
import type { SiteLanguage } from "src/libs/language"
import {
  fetchEditorUnfurl,
  formatUnfurlDirectiveBlock,
  inferDirectiveKindForPastedUrl,
} from "src/libs/unfurl/fetchEditorUnfurl"
import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import { isLivePreviewSurfaceMode, type MarkdownEditorSurfaceMode } from "./markdownEditorLivePreview"
import { planReplaceSelection, type PlannedTextMutation } from "./markdownEditorTextMutation"
import {
  getMarkdownUploadErrorMessages,
  MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
  MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE,
} from "./markdownEditorUploadModel"
import {
  convertSafeHtmlPasteToMarkdown,
  isOffsetInsideInlineCodeSpan,
  shouldBypassHtmlPasteConversion,
  shouldReportEmptyHtmlPasteError,
} from "./markdownEditorHtmlPasteModel"
import {
  findExactSubstringIndex,
  parseSingleHttpUrl,
  planLinkifySelectionWithUrl,
  planReplaceExactSubstring,
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
  language?: SiteLanguage
}

const GENERIC_CLIENT_STATUS_MESSAGES = new Set([
  "요청 값이 올바르지 않습니다.",
  "요청 처리 중 오류가 발생했습니다.",
])

const hasKoreanText = (value: string): boolean => /[가-힣]/.test(value)

const resolveLocalizedUploadFallback = (
  fallbackMessage: string,
  language: SiteLanguage,
  kind: "image" | "file"
): string => {
  if (language !== "en") return fallbackMessage
  if (
    fallbackMessage === MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE ||
    fallbackMessage === MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE
  ) {
    const messages = getMarkdownUploadErrorMessages("en")
    return kind === "image" ? messages.imageFailed : messages.attachmentFailed
  }
  return fallbackMessage
}

const resolveApiUploadErrorMessage = (
  error: ApiError,
  fallbackMessage: string,
  language: SiteLanguage
): string => {
  if (error.status >= 500) return fallbackMessage
  const usableUserMessage =
    error.userMessage && !(language === "en" && hasKoreanText(error.userMessage))
      ? error.userMessage
      : ""
  if (error.status === 413) {
    return (
      usableUserMessage ||
      (language === "en"
        ? "The uploaded file is too large. Reduce the file size and try again."
        : "업로드 파일 용량이 너무 큽니다. 용량을 줄여 다시 시도해주세요.")
    )
  }
  if (error.status === 401 || error.status === 403 || error.status === 429) {
    return usableUserMessage || fallbackMessage
  }
  if (usableUserMessage && !GENERIC_CLIENT_STATUS_MESSAGES.has(usableUserMessage)) {
    return usableUserMessage
  }
  return fallbackMessage
}

const resolveGenericErrorLocalizedMessage = (error: Error, language: SiteLanguage): string | null => {
  const trimmed = error.message.trim()
  if (!trimmed) return null
  if (language === "ko") {
    if (!hasKoreanText(trimmed)) return null
    return /Exception|endpoint|bucket|provider|stack/i.test(trimmed) ? null : trimmed
  }
  if (hasKoreanText(trimmed)) return null
  return /Exception|Error:|TypeError|ReferenceError|SyntaxError|endpoint|bucket|provider|stack|ECONN|ENOTFOUND|fetch/i.test(
    trimmed
  )
    ? null
    : trimmed
}

export const resolveMarkdownEditorUploadErrorMessage = (
  error: unknown,
  { kind, fallbackMessage, language = "ko" }: ResolveMarkdownEditorUploadErrorOptions
): string => {
  const resolvedFallback = resolveLocalizedUploadFallback(fallbackMessage, language, kind)
  if (error instanceof ApiTimeoutError) {
    return language === "en"
      ? "Upload timed out. Wait a moment and try again."
      : "업로드 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."
  }
  if (error instanceof ApiNetworkError) {
    return language === "en"
      ? "Network connection failed. Wait a moment and try again."
      : "네트워크 연결에 실패했습니다. 잠시 후 다시 시도해주세요."
  }
  if (error instanceof ApiError) {
    return resolveApiUploadErrorMessage(error, resolvedFallback, language)
  }
  if (error instanceof Error) {
    return resolveGenericErrorLocalizedMessage(error, language) ?? resolvedFallback
  }
  return resolvedFallback
}

export const shouldLinkifySelectionOnUrlPaste = (
  viewMode: MarkdownEditorSurfaceMode | undefined,
  currentValue: string,
  selection: TextareaSelection
): boolean => {
  if (selection.from >= selection.to) return false
  const resolved = viewMode ?? "live"
  if (resolved !== "live" && resolved !== "split") return false
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

export const tryApplyStandaloneUrlPaste = ({
  event,
  viewMode,
  currentValue,
  selection,
  plainText,
  applyPlannedMarkdownMutation,
  applyBackgroundMarkdownMutation,
  isCurrentGeneration,
  getCurrentValue,
}: {
  event: ReactClipboardEvent<HTMLElement>
  viewMode: MarkdownEditorSurfaceMode | undefined
  currentValue: string
  selection: TextareaSelection
  plainText: string
  applyPlannedMarkdownMutation: (plan: PlannedTextMutation, options?: MarkdownMutationOptions) => boolean
  applyBackgroundMarkdownMutation: (plan: PlannedTextMutation) => boolean
  isCurrentGeneration: () => boolean
  getCurrentValue: () => string
}): boolean => {
  const hasShiftKey = Boolean((event as unknown as { shiftKey?: boolean }).shiftKey)
  if (selection.from !== selection.to || hasShiftKey) return false
  if (!isLivePreviewSurfaceMode(viewMode ?? "live")) return false
  if (isOffsetInsideFencedCodeBlock(currentValue, selection.from)) return false
  if (isOffsetInsideInlineCodeSpan(currentValue, selection.from)) return false

  const url = parseSingleHttpUrl(plainText)
  if (!url) return false

  const lineStart = currentValue.lastIndexOf("\n", Math.max(0, selection.from - 1)) + 1
  const nextBreak = currentValue.indexOf("\n", selection.from)
  const lineEnd = nextBreak === -1 ? currentValue.length : nextBreak
  const lineText = currentValue.slice(lineStart, lineEnd)
  const directiveMatch = /^:::(bookmark|embed)(?:\s+(https?:\/\/)?)?\s*$/.exec(lineText.trim())
  const isBlankLine = lineText.trim().length === 0

  if (!isBlankLine && !directiveMatch) return false

  const kind = directiveMatch
    ? (directiveMatch[1] as "bookmark" | "embed")
    : inferDirectiveKindForPastedUrl(url)

  event.preventDefault()
  let placeholderBlock = formatUnfurlDirectiveBlock(kind, url)
  if (directiveMatch) {
    const closeToken = "\n:::"
    const afterLine = currentValue.slice(lineEnd)
    const hasClosingLine = /^\n\s*:::(?:\n|$)/.test(afterLine) || /^\n\n\s*:::(?:\n|$)/.test(afterLine)
    const replaceStart = lineStart
    const replaceEnd = hasClosingLine
      ? lineEnd + afterLine.indexOf(closeToken) + closeToken.length
      : lineEnd
    applyPlannedMarkdownMutation(planReplaceSelection(replaceStart, replaceEnd, placeholderBlock))
  } else {
    applyPlannedMarkdownMutation(planReplaceSelection(lineStart, lineEnd, placeholderBlock))
  }

  if (typeof fetch === "function") {
    void fetchEditorUnfurl(url).then((meta) => {
      if (!meta || !isCurrentGeneration()) return
      const latest = getCurrentValue()
      if (findExactSubstringIndex(latest, placeholderBlock) === -1) return
      const enriched = formatUnfurlDirectiveBlock(kind, url, meta)
      const replacePlan = planReplaceExactSubstring(latest, placeholderBlock, enriched, 0, 0)
      if (replacePlan) {
        placeholderBlock = enriched
        applyBackgroundMarkdownMutation(replacePlan)
      }
    })
  }
  return true
}

export type HtmlPasteHandlerContext = {
  event: ReactClipboardEvent<HTMLElement>
  html: string
  plainText: string
  viewMode: MarkdownEditorSurfaceMode
  currentValue: string
  selection: TextareaSelection
  language?: SiteLanguage
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
  language = "ko",
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
      setEditorError(language === "en" ? "No safe HTML content could be pasted." : imported.message)
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
