import { FC, ReactNode, useEffect, useMemo, useState } from "react"
import { toLanguageLabel } from "src/libs/markdown/rendering"

export const COLLAPSIBLE_CODE_LINE_THRESHOLD = 35
export const CODE_COLLAPSED_BIT = 1 << 0
export const CODE_COPIED_BIT = 1 << 1
export const CODE_COPY_FAILED_BIT = 1 << 2

export const packCodeBlockUiState = (
  isCollapsed: boolean,
  copyStateOrCopied: "idle" | "copied" | "failed" | boolean = "idle",
  copyFailed = false
): number => {
  const isCopied = copyStateOrCopied === "copied" || copyStateOrCopied === true
  const isFailed = copyStateOrCopied === "failed" || copyFailed
  return (
    (isCollapsed ? CODE_COLLAPSED_BIT : 0) |
    (isCopied ? CODE_COPIED_BIT : 0) |
    (isFailed ? CODE_COPY_FAILED_BIT : 0)
  )
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
  for (let i = 0; i < rawCode.length; i += 1) {
    if (rawCode.charCodeAt(i) === 10) {
      count += 1
    }
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
  const lineCount = useMemo(() => countRawCodeLines(rawCode), [rawCode])
  const isCollapsible = lineCount > COLLAPSIBLE_CODE_LINE_THRESHOLD
  const [uiMask, setUiMask] = useState(() => packCodeBlockUiState(isCollapsible, "idle"))
  const isCollapsed = (uiMask & CODE_COLLAPSED_BIT) !== 0
  const copied = (uiMask & CODE_COPIED_BIT) !== 0
  const copyFailed = (uiMask & CODE_COPY_FAILED_BIT) !== 0
  const label = title?.trim() || toLanguageLabel(language)

  useEffect(() => {
    const shouldCollapse = lineCount > COLLAPSIBLE_CODE_LINE_THRESHOLD
    setUiMask((prev) =>
      shouldCollapse ? prev | CODE_COLLAPSED_BIT : prev & ~CODE_COLLAPSED_BIT
    )
  }, [lineCount])

  useEffect(() => {
    if ((uiMask & (CODE_COPIED_BIT | CODE_COPY_FAILED_BIT)) === 0) return
    const timeout = window.setTimeout(
      () => setUiMask((prev) => prev & ~(CODE_COPIED_BIT | CODE_COPY_FAILED_BIT)),
      1400
    )
    return () => window.clearTimeout(timeout)
  }, [uiMask])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode)
      setUiMask((prev) => (prev & ~CODE_COPY_FAILED_BIT) | CODE_COPIED_BIT)
    } catch (error) {
      console.warn("[code-block] copy failed", error)
      setUiMask((prev) => (prev & ~CODE_COPIED_BIT) | CODE_COPY_FAILED_BIT)
    }
  }

  return (
    <div
      className="aq-code-block"
      data-collapsed={resolveCollapsedAttr(isCollapsible, isCollapsed)}
      data-highlight-lines={highlightLines || undefined}
    >
      <div className="aq-code-toolbar">
        <span className="aq-code-title">{label}</span>
        <button
          type="button"
          className={`aq-code-copy${copied ? " is-copied" : ""}${copyFailed ? " is-failed" : ""}`}
          onClick={handleCopy}
          aria-label={copied ? "코드가 복사되었습니다" : copyFailed ? "코드 복사에 실패했습니다" : "코드 복사"}
          title={copied ? "복사됨" : copyFailed ? "복사 실패" : "복사"}
        >
          {copied ? "COPIED" : copyFailed ? "Copy failed" : "COPY"}
        </button>
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
          {isCollapsed ? `전체 코드 펼치기 (${lineCount}줄)` : "코드 접기"}
        </button>
      ) : null}
    </div>
  )
}

export default PrettyCodeBlock
