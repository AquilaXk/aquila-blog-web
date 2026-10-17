import { FC, ReactNode, useEffect, useMemo, useState } from "react"
import { toLanguageLabel } from "src/libs/markdown/rendering"

export const COLLAPSIBLE_CODE_LINE_THRESHOLD = 35

type PrettyCodeBlockProps = {
  language: string
  title?: string
  rawCode: string
  highlightLines?: string
  preElement: ReactNode
}

const countRawCodeLines = (rawCode: string): number => {
  if (!rawCode) return 0
  let count = 1
  for (let i = 0; i < rawCode.length; i += 1) {
    if (rawCode.charCodeAt(i) === 10) {
      count += 1
    }
  }
  return count
}

const PrettyCodeBlock: FC<PrettyCodeBlockProps> = ({
  language,
  title,
  rawCode,
  highlightLines,
  preElement,
}) => {
  const [copied, setCopied] = useState(false)
  const lineCount = useMemo(() => countRawCodeLines(rawCode), [rawCode])
  const isCollapsible = lineCount > COLLAPSIBLE_CODE_LINE_THRESHOLD
  const [isCollapsed, setIsCollapsed] = useState(isCollapsible)
  const label = title?.trim() || toLanguageLabel(language)

  useEffect(() => {
    setIsCollapsed(lineCount > COLLAPSIBLE_CODE_LINE_THRESHOLD)
  }, [lineCount])

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode)
      setCopied(true)
    } catch (error) {
      console.warn("[code-block] copy failed", error)
    }
  }

  return (
    <div
      className="aq-code-block"
      data-collapsed={isCollapsible ? (isCollapsed ? "true" : "false") : undefined}
      data-highlight-lines={highlightLines || undefined}
    >
      <div className="aq-code-toolbar">
        <span className="aq-code-title">{label}</span>
        <button
          type="button"
          className={`aq-code-copy${copied ? " is-copied" : ""}`}
          onClick={handleCopy}
          aria-label={copied ? "코드가 복사되었습니다" : "코드 복사"}
          title={copied ? "복사됨" : "복사"}
        >
          {copied ? "COPIED" : "COPY"}
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
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          {isCollapsed ? `전체 코드 펼치기 (${lineCount}줄)` : "코드 접기"}
        </button>
      ) : null}
    </div>
  )
}

export default PrettyCodeBlock
