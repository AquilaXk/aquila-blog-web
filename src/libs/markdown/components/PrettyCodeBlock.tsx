// 참조 구현: Docusaurus (`facebook/docusaurus`, `packages/docusaurus-theme-common/src/hooks/useCodeWordWrap.ts`, `WordWrapButton`, `CopyButton`, `Icon/WordWrap`, `Icon/Copy`, `Icon/Success`, MIT License, Copyright (c) Meta Platforms, Inc. and affiliates.) & Fumadocs (`fuma-nama/fumadocs`, `packages/base-ui/src/components/codeblock.tsx`, MIT License, Copyright (c) 2024 Fuma Nama)
import { CSSProperties, FC, ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { type SiteLanguage, useLanguage } from "src/libs/language"
import { toLanguageLabel } from "src/libs/markdown/rendering"

const CODE_BLOCK_EXTRA_LABELS = {
  ko: {
    copyFailed: "복사 실패",
    copyFailedButton: "복사 실패",
    copyFailedAria: "코드 복사에 실패했습니다",
    wrapLabel: "자동 줄바꿈",
    wrapAria: "긴 줄 자동 줄바꿈 전환",
  },
  en: {
    copyFailed: "Copy failed",
    copyFailedButton: "COPY FAILED",
    copyFailedAria: "Failed to copy code",
    wrapLabel: "Toggle word wrap",
    wrapAria: "Toggle word wrap",
  },
} as const

export const getCodeBlockExtraLabels = (language: SiteLanguage) =>
  CODE_BLOCK_EXTRA_LABELS[language]

export const COLLAPSIBLE_CODE_LINE_THRESHOLD = 35
export const CODE_COLLAPSED_BIT = 1
export const CODE_COPIED_BIT = 1 << 1
export const CODE_COPY_FAILED_BIT = 1 << 2
export const CODE_WRAPPED_BIT = 1 << 3
export const CODE_SCROLLABLE_BIT = 1 << 4

const WORD_WRAP_PATH_D =
  "M4 19h6v-2H4v2zM20 5H4v2h16V5zm-3 6H4v2h13.25c1.1 0 2 .9 2 2s-.9 2-2 2H15v-2l-3 3l3 3v-2h2c2.21 0 4-1.79 4-4s-1.79-4-4-4z"
const COPY_ICON_PATH_D =
  "M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"
const CHECK_ICON_PATH_D = "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"

export const CODE_WORD_WRAP_ICON_SVG = `<svg aria-hidden="true" viewBox="0 0 24 24" class="aq-code-icon"><path fill="currentColor" d="${WORD_WRAP_PATH_D}"/></svg>`

export const CODE_COPY_STACK_ICONS_HTML =
  '<span class="aq-code-copy-icons" aria-hidden="true">' +
  `<svg aria-hidden="true" viewBox="0 0 24 24" class="aq-code-copy-icon"><path fill="currentColor" d="${COPY_ICON_PATH_D}"/></svg>` +
  `<svg aria-hidden="true" viewBox="0 0 24 24" class="aq-code-copy-success-icon"><path fill="currentColor" d="${CHECK_ICON_PATH_D}"/></svg>` +
  "</span>"

export const isCodeShellHorizontallyScrollable = (
  shell: Pick<HTMLElement, "scrollWidth" | "clientWidth"> | null
): boolean => Boolean(shell && shell.scrollWidth > shell.clientWidth + 1)

export const packCodeBlockUiState = (
  isCollapsed: boolean,
  copyState: "idle" | "copied" | "failed" = "idle",
  isWrapped = false,
  isScrollable = false
): number =>
  (isCollapsed ? CODE_COLLAPSED_BIT : 0) |
  (copyState === "copied" ? CODE_COPIED_BIT : 0) |
  (copyState === "failed" ? CODE_COPY_FAILED_BIT : 0) |
  (isWrapped ? CODE_WRAPPED_BIT : 0) |
  (isScrollable ? CODE_SCROLLABLE_BIT : 0)

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

const resolveCollapsedAttr = (
  isCollapsible: boolean,
  isCollapsed: boolean
): "true" | "false" | undefined => {
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
  const [uiMask, setUiMask] = useState(() => packCodeBlockUiState(isCollapsible, "idle", false, false))
  const isCollapsed = (uiMask & CODE_COLLAPSED_BIT) !== 0
  const copied = (uiMask & CODE_COPIED_BIT) !== 0
  const copyFailed = (uiMask & CODE_COPY_FAILED_BIT) !== 0
  const isWrapped = (uiMask & CODE_WRAPPED_BIT) !== 0
  const isScrollable = (uiMask & CODE_SCROLLABLE_BIT) !== 0
  const [voiceOverTick, setVoiceOverTick] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const copyResetTimerRef = useRef<number | null>(null)
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
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isWrapped) return
    const shell = shellRef.current
    if (!shell) return

    const syncOverflow = () => {
      const hasOverflow = isCodeShellHorizontallyScrollable(shell)
      setUiMask((prev) => {
        const prevHasOverflow = (prev & CODE_SCROLLABLE_BIT) !== 0
        if (prevHasOverflow === hasOverflow) return prev
        return hasOverflow ? prev | CODE_SCROLLABLE_BIT : prev & ~CODE_SCROLLABLE_BIT
      })
    }

    syncOverflow()
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(syncOverflow)
      observer.observe(shell)
      const pre = shell.querySelector("pre")
      if (pre) observer.observe(pre)
      return () => observer.disconnect()
    }
    window.addEventListener("resize", syncOverflow, { passive: true })
    return () => window.removeEventListener("resize", syncOverflow)
  }, [isCollapsed, isWrapped, rawCode])

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(rawCode)
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current)
    }
    setVoiceOverTick((prev) => !prev)
    setUiMask((prev) =>
      packCodeBlockUiState(
        (prev & CODE_COLLAPSED_BIT) !== 0,
        ok ? "copied" : "failed",
        (prev & CODE_WRAPPED_BIT) !== 0,
        (prev & CODE_SCROLLABLE_BIT) !== 0
      )
    )
    copyResetTimerRef.current = window.setTimeout(() => {
      copyResetTimerRef.current = null
      setUiMask((prev) =>
        packCodeBlockUiState(
          (prev & CODE_COLLAPSED_BIT) !== 0,
          "idle",
          (prev & CODE_WRAPPED_BIT) !== 0,
          (prev & CODE_SCROLLABLE_BIT) !== 0
        )
      )
    }, 1400)
  }

  return (
    <div
      className="aq-code-block"
      data-collapsed={resolveCollapsedAttr(isCollapsible, isCollapsed)}
      data-highlight-lines={highlightLines || undefined}
      data-wrap={isWrapped ? "true" : "false"}
      data-scrollable={isScrollable || isWrapped ? "true" : "false"}
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
            title={extraLabels.wrapLabel}
            onClick={() => setUiMask((prev) => prev ^ CODE_WRAPPED_BIT)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="aq-code-icon">
              <path fill="currentColor" d={WORD_WRAP_PATH_D} />
            </svg>
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
            <span className="aq-code-copy-icons" aria-hidden="true">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="aq-code-copy-icon">
                <path fill="currentColor" d={COPY_ICON_PATH_D} />
              </svg>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="aq-code-copy-success-icon">
                <path fill="currentColor" d={CHECK_ICON_PATH_D} />
              </svg>
            </span>
          </button>
        </div>
        <span className="aq-sr-only" aria-live="polite">
          {copied
            ? `${t("codeCopied")}${voiceOverTick ? "\u00A0" : ""}`
            : copyFailed
            ? `${extraLabels.copyFailed}${voiceOverTick ? "\u00A0" : ""}`
            : ""}
        </span>
      </div>
      <div className="aq-code-body">
        <div
          ref={shellRef}
          className="aq-code-shell"
          tabIndex={0}
          role="region"
          aria-label={primaryTitle || "코드 영역"}
        >
          {preElement}
        </div>
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
