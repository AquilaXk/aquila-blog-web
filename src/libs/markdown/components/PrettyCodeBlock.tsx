import { CSSProperties, FC, ReactNode, useEffect, useMemo, useState } from "react"
import { type SiteLanguage, useLanguage } from "src/libs/language"
import { toLanguageLabel } from "src/libs/markdown/rendering"

const CODE_BLOCK_EXTRA_LABELS = {
  ko: {
    copyFailed: "복사 실패",
    copyFailedButton: "복사 실패",
    copyFailedAria: "코드 복사에 실패했습니다",
    wrapLabel: "줄 바꿈",
    wrapAria: "코드 줄 바꿈 토글",
  },
  en: {
    copyFailed: "Copy failed",
    copyFailedButton: "COPY FAILED",
    copyFailedAria: "Failed to copy code",
    wrapLabel: "Wrap",
    wrapAria: "Toggle line wrapping",
  },
} as const

export const getCodeBlockExtraLabels = (language: SiteLanguage) =>
  CODE_BLOCK_EXTRA_LABELS[language]

export const COLLAPSIBLE_CODE_LINE_THRESHOLD = 35
export const CODE_COLLAPSED_BIT = 1
export const CODE_COPIED_BIT = 1 << 1
export const CODE_COPY_FAILED_BIT = 1 << 2
export const CODE_WRAPPED_BIT = 1 << 3

export const packCodeBlockUiState = (
  isCollapsed: boolean,
  copyState: "idle" | "copied" | "failed" = "idle",
  isWrapped = false
): number =>
  (isCollapsed ? CODE_COLLAPSED_BIT : 0) |
  (copyState === "copied" ? CODE_COPIED_BIT : 0) |
  (copyState === "failed" ? CODE_COPY_FAILED_BIT : 0) |
  (isWrapped ? CODE_WRAPPED_BIT : 0)

export const resolveCodeGutterWidth = (lineCount: number): string => {
  const digits = Math.max(2, String(Math.max(1, lineCount)).length)
  return `calc(${digits}ch + 0.9rem)`
}

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to execCommand fallback when clipboard API fails
    }
  }

  if (typeof document !== "undefined" && typeof document.execCommand === "function") {
    try {
      const textarea = document.createElement("textarea")
      textarea.value = text
      textarea.setAttribute("readonly", "")
      textarea.style.position = "fixed"
      textarea.style.top = "-9999px"
      textarea.style.left = "-9999px"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const copied = document.execCommand("copy")
      document.body.removeChild(textarea)
      if (copied) return true
    } catch {
      return false
    }
  }

  return false
}

type PrettyCodeBlockProps = {
  language: string
  title?: string
  rawCode: string
  highlightLines?: string
  preElement: ReactNode
}

export const countRawCodeLines = (rawCode: string): number => {
  if (!rawCode) return 0
  let count = 1
  let offset = 0
  while (true) {
    const nextBreak = rawCode.indexOf("\n", offset)
    if (nextBreak === -1) break
    count += 1
    offset = nextBreak + 1
  }
  return count
}

const resolveCollapsedAttr = (isCollapsible: boolean, isCollapsed: boolean): "true" | "false" | undefined => {
  if (!isCollapsible) return undefined
  return isCollapsed ? "true" : "false"
}

const PrettyCodeBlock: FC<PrettyCodeBlockProps> = ({
  language,
  title,
  rawCode,
  highlightLines,
  preElement,
}) => {
  const { t, language: uiLanguage } = useLanguage()
  const extraLabels = getCodeBlockExtraLabels(uiLanguage)
  const lineCount = useMemo(() => countRawCodeLines(rawCode), [rawCode])
  const isCollapsible = lineCount > COLLAPSIBLE_CODE_LINE_THRESHOLD
  const [uiMask, setUiMask] = useState(() => packCodeBlockUiState(isCollapsible, "idle", false))
  const isCollapsed = (uiMask & CODE_COLLAPSED_BIT) !== 0
  const copied = (uiMask & CODE_COPIED_BIT) !== 0
  const copyFailed = (uiMask & CODE_COPY_FAILED_BIT) !== 0
  const isWrapped = (uiMask & CODE_WRAPPED_BIT) !== 0
  const copyStatusBits = uiMask & (CODE_COPIED_BIT | CODE_COPY_FAILED_BIT)
  const languageLabel = toLanguageLabel(language)
  const trimmedTitle = title?.trim() || ""
  const hasExplicitTitle =
    trimmedTitle.length > 0 && trimmedTitle.toLowerCase() !== languageLabel.toLowerCase()
  const primaryTitle = hasExplicitTitle ? trimmedTitle : languageLabel
  const gutterWidth = useMemo(() => resolveCodeGutterWidth(lineCount), [lineCount])

  useEffect(() => {
    const shouldCollapse = lineCount > COLLAPSIBLE_CODE_LINE_THRESHOLD
    setUiMask((prev) =>
      shouldCollapse ? prev | CODE_COLLAPSED_BIT : prev & ~CODE_COLLAPSED_BIT
    )
  }, [lineCount])

  useEffect(() => {
    if (copyStatusBits === 0) return
    const timeout = window.setTimeout(
      () =>
        setUiMask((prev) =>
          packCodeBlockUiState(
            (prev & CODE_COLLAPSED_BIT) !== 0,
            "idle",
            (prev & CODE_WRAPPED_BIT) !== 0
          )
        ),
      1400
    )
    return () => window.clearTimeout(timeout)
  }, [copyStatusBits])

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(rawCode)
    setUiMask((prev) =>
      packCodeBlockUiState(
        (prev & CODE_COLLAPSED_BIT) !== 0,
        ok ? "copied" : "failed",
        (prev & CODE_WRAPPED_BIT) !== 0
      )
    )
  }

  return (
    <div
      className="aq-code-block"
      data-collapsed={resolveCollapsedAttr(isCollapsible, isCollapsed)}
      data-highlight-lines={highlightLines || undefined}
      data-wrap={isWrapped ? "true" : "false"}
      style={{ "--aq-code-gutter-width": gutterWidth } as CSSProperties}
    >
      <div className="aq-code-toolbar">
        <span className="aq-code-title">{primaryTitle}</span>
        <div className="aq-code-actions">
          {hasExplicitTitle && languageLabel ? (
            <span className="aq-code-lang">{languageLabel}</span>
          ) : null}
          <button
            type="button"
            className="aq-code-wrap"
            aria-pressed={isWrapped}
            aria-label={extraLabels.wrapAria}
            onClick={() => setUiMask((prev) => prev ^ CODE_WRAPPED_BIT)}
          >
            {extraLabels.wrapLabel}
          </button>
          <button
            type="button"
            className={`aq-code-copy${copied ? " is-copied" : ""}${copyFailed ? " is-failed" : ""}`}
            onClick={handleCopy}
            aria-label={
              copied ? t("codeCopiedAria") : copyFailed ? extraLabels.copyFailedAria : t("codeCopyAria")
            }
            title={copied ? t("codeCopied") : copyFailed ? extraLabels.copyFailed : t("codeCopy")}
          >
            {copied ? t("codeCopiedButton") : copyFailed ? extraLabels.copyFailedButton : t("codeCopyButton")}
          </button>
        </div>
        <span className="aq-sr-only" aria-live="polite">
          {copied ? t("codeCopied") : copyFailed ? extraLabels.copyFailed : ""}
        </span>
      </div>
      <div className="aq-code-body">
        <div className="aq-code-shell">{preElement}</div>
      </div>
      {isCollapsible ? (
        <button
          type="button"
          className="aq-code-collapse-toggle"
          aria-expanded={!isCollapsed}
          onClick={() => setUiMask((prev) => prev ^ CODE_COLLAPSED_BIT)}
        >
          {isCollapsed ? `${t("codeExpandPrefix")} (${lineCount}${t("codeLinesUnit")})` : t("codeCollapse")}
        </button>
      ) : null}
    </div>
  )
}

export default PrettyCodeBlock
