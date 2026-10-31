import {
  MERMAID_FLOWCHART_HEADER_PATTERN,
  MERMAID_INIT_DIRECTIVE_PATTERN,
  MERMAID_RENDER_TIMEOUT_MS,
  MERMAID_RISKY_INIT_KEY_PATTERN,
  MERMAID_RISKY_STYLE_DIRECTIVE_PATTERN,
  formatMermaidErrorReason,
} from "src/libs/markdown/mermaidRuntimeConfig"

const MERMAID_VISUAL_OVERRIDE_KEY_PATTERN = /\b(?:themeVariables|themeCSS|theme|darkMode)\b/i
const MERMAID_INIT_ENTRY_KEY_PATTERN = /^(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$-]*))\s*:/
const MERMAID_LINE_NUMBER_PATTERN = /line\s+(\d+)/i
const MERMAID_ERROR_GUIDANCE_TEXT =
  "특수문자나 긴 라벨은 따옴표로 감싸고, 블록/화살표 문법이 줄 단위로 닫혔는지 먼저 확인해 주세요."

export const stripRiskyFlowchartDirectives = (source: string) =>
  source
    .split("\n")
    .filter((line) => !MERMAID_RISKY_STYLE_DIRECTIVE_PATTERN.test(line))
    .join("\n")

const stripLeadingMermaidInitDirective = (source: string) => {
  const directiveMatch = MERMAID_INIT_DIRECTIVE_PATTERN.exec(source)
  if (!directiveMatch) return source
  return source.slice(directiveMatch[0].length).trimStart()
}

type TopLevelSplitState = {
  entries: string[]
  current: string
  quote: "'" | '"' | null
  escaped: boolean
  depth: number
}

const stepQuotedEntryChar = (state: TopLevelSplitState, char: string) => {
  state.current += char
  if (state.escaped) {
    state.escaped = false
    return
  }
  if (char === "\\") {
    state.escaped = true
    return
  }
  if (char === state.quote) {
    state.quote = null
  }
}

const isOpeningBracket = (char: string) => char === "{" || char === "[" || char === "("
const isClosingBracket = (char: string) => char === "}" || char === "]" || char === ")"

const stepUnquotedEntryChar = (state: TopLevelSplitState, char: string) => {
  if (char === "'" || char === '"') {
    state.quote = char
    state.current += char
    return
  }
  if (isOpeningBracket(char)) {
    state.depth += 1
    state.current += char
    return
  }
  if (isClosingBracket(char)) {
    state.depth = Math.max(0, state.depth - 1)
    state.current += char
    return
  }
  if (char === "," && state.depth === 0) {
    const trimmed = state.current.trim()
    if (trimmed) state.entries.push(trimmed)
    state.current = ""
    return
  }
  state.current += char
}

const splitMermaidTopLevelEntries = (value: string) => {
  const state: TopLevelSplitState = {
    entries: [],
    current: "",
    quote: null,
    escaped: false,
    depth: 0,
  }
  for (const char of value) {
    if (state.quote) {
      stepQuotedEntryChar(state, char)
    } else {
      stepUnquotedEntryChar(state, char)
    }
  }
  const trimmed = state.current.trim()
  if (trimmed) state.entries.push(trimmed)
  return state.entries
}

const extractMermaidInitEntryKey = (entry: string) => {
  const match = MERMAID_INIT_ENTRY_KEY_PATTERN.exec(entry.trim())
  return match?.[1] || match?.[2] || match?.[3] || null
}

const collectSafeInitEntries = (entries: readonly string[]): string[] | null => {
  const safeEntries: string[] = []
  for (const entry of entries) {
    const key = extractMermaidInitEntryKey(entry)
    if (!key) return null
    if (!MERMAID_RISKY_INIT_KEY_PATTERN.test(key)) {
      safeEntries.push(entry.trim())
    }
  }
  return safeEntries
}

const stripRiskyFlowchartInitDirective = (source: string) => {
  const directiveMatch = MERMAID_INIT_DIRECTIVE_PATTERN.exec(source)
  if (!directiveMatch) return source

  const [directive, directiveKind, rawConfigLiteral] = directiveMatch
  const remainder = source.slice(directive.length)
  const trimmedConfig = rawConfigLiteral.trim()
  if (!MERMAID_VISUAL_OVERRIDE_KEY_PATTERN.test(trimmedConfig)) return source
  if (!trimmedConfig.startsWith("{") || !trimmedConfig.endsWith("}")) return remainder

  const entries = splitMermaidTopLevelEntries(trimmedConfig.slice(1, -1))
  const safeEntries = entries.length > 0 ? collectSafeInitEntries(entries) : null
  if (!safeEntries || safeEntries.length === 0) return remainder

  const sanitizedDirective = `%%{${directiveKind}: { ${safeEntries.join(", ")} }}%%`
  return remainder.trim() ? `${sanitizedDirective}\n${remainder.trimStart()}` : sanitizedDirective
}

export const sanitizeRenderableMermaidSource = (source: string) => {
  const trimmed = source.trim()
  const flowchartCandidate = stripLeadingMermaidInitDirective(trimmed)
  if (!MERMAID_FLOWCHART_HEADER_PATTERN.test(flowchartCandidate)) return trimmed

  const withoutRiskyInitDirective = stripRiskyFlowchartInitDirective(trimmed)
  const sanitized = stripRiskyFlowchartDirectives(withoutRiskyInitDirective).trim()
  return sanitized || withoutRiskyInitDirective || trimmed
}

export const stabilizeMermaidSvgLabels = (_svgElement: SVGSVGElement) => {}

const escapeMermaidHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

export const isMermaidRenderTimeoutError = (error: unknown) =>
  formatMermaidErrorReason(error, "").includes("MERMAID_RENDER_TIMEOUT")

const toMermaidErrorMessage = (error: unknown) => {
  const normalized = formatMermaidErrorReason(error, "")
    .replace(/\s+/g, " ")
    .trim()
  const lineMatch = MERMAID_LINE_NUMBER_PATTERN.exec(normalized)
  if (lineMatch) {
    return `${lineMatch[1]}번째 줄 근처 문법을 확인해 주세요.`
  }
  if (isMermaidRenderTimeoutError(error)) {
    return "다이어그램이 복잡해 렌더 시간이 초과되었습니다. 노드/연결을 나누거나 확대 보기로 확인해 주세요."
  }
  if (normalized.toLowerCase().includes("parse error")) {
    return "문법을 해석하지 못했습니다. 블록 문법을 다시 확인해 주세요."
  }
  return "문법 또는 블록 구조를 확인해 주세요."
}

export const renderMermaidErrorState = ({ source, error }: { source: string; error: unknown }) => {
  const escapedSource = escapeMermaidHtml(source)
  const escapedError = escapeMermaidHtml(formatMermaidErrorReason(error, "알 수 없는 오류"))
  const guidance = escapeMermaidHtml(toMermaidErrorMessage(error))
  return `
    <div class="aq-mermaid-error-state" role="status" aria-live="polite">
      <div class="aq-mermaid-error-title">Mermaid를 렌더하지 못했습니다.</div>
      <p class="aq-mermaid-error-description">${guidance}</p>
      <p class="aq-mermaid-error-guidance">${MERMAID_ERROR_GUIDANCE_TEXT}</p>
      <details class="aq-mermaid-error-details">
        <summary>Mermaid 코드 보기</summary>
        <code class="aq-mermaid-error-code">${escapedSource}</code>
      </details>
      <details class="aq-mermaid-error-details">
        <summary>상세 오류 보기</summary>
        <code class="aq-mermaid-error-code">${escapedError}</code>
      </details>
    </div>
  `
}

const clearElementChildrenSafely = (element: HTMLElement) => {
  if (typeof element.replaceChildren === "function") {
    element.replaceChildren()
    return
  }
  while (element.firstChild && typeof element.removeChild === "function") {
    element.removeChild(element.firstChild)
  }
  const descriptor = Object.getOwnPropertyDescriptor(element, "textContent")
  if (!descriptor || descriptor.writable || typeof descriptor.set === "function") {
    element.textContent = ""
  }
}

const createErrorDomElement = (
  doc: Document,
  tagName: string,
  className?: string,
  text?: string
): HTMLElement => {
  const element = doc.createElement(tagName)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

const appendChildSafely = (parent: HTMLElement, child: HTMLElement) => {
  if (typeof parent.appendChild === "function") {
    parent.appendChild(child)
  }
}

const createErrorDetailsDom = (doc: Document, summaryText: string, codeText: string): HTMLElement => {
  const details = createErrorDomElement(doc, "details", "aq-mermaid-error-details")
  appendChildSafely(details, createErrorDomElement(doc, "summary", undefined, summaryText))
  appendChildSafely(details, createErrorDomElement(doc, "code", "aq-mermaid-error-code", codeText))
  return details
}

export const mountMermaidErrorStateDom = (
  block: HTMLElement,
  { source, error }: { source: string; error: unknown }
): void => {
  const doc = block.ownerDocument ?? document
  const errorText = formatMermaidErrorReason(error, "알 수 없는 오류")
  const guidance = toMermaidErrorMessage(error)
  const container = createErrorDomElement(doc, "div", "aq-mermaid-error-state")
  if (typeof container.setAttribute === "function") {
    container.setAttribute("role", "status")
    container.setAttribute("aria-live", "polite")
  }
  appendChildSafely(
    container,
    createErrorDomElement(doc, "div", "aq-mermaid-error-title", "Mermaid를 렌더하지 못했습니다.")
  )
  appendChildSafely(
    container,
    createErrorDomElement(doc, "p", "aq-mermaid-error-description", guidance)
  )
  appendChildSafely(
    container,
    createErrorDomElement(doc, "p", "aq-mermaid-error-guidance", MERMAID_ERROR_GUIDANCE_TEXT)
  )
  appendChildSafely(container, createErrorDetailsDom(doc, "Mermaid 코드 보기", source))
  appendChildSafely(container, createErrorDetailsDom(doc, "상세 오류 보기", errorText))
  clearElementChildrenSafely(block)
  appendChildSafely(block, container)
}

export const isNegativeRectWidthError = (error: unknown) => {
  const message = formatMermaidErrorReason(error, "")
  return message.includes("attribute width") && message.includes("negative value")
}

export const isMermaidSyntaxError = (error: unknown) => {
  const normalized = formatMermaidErrorReason(error, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
  if (!normalized) return false

  return (
    normalized.includes("parse error") ||
    normalized.includes("syntax error") ||
    normalized.includes("lexical error") ||
    normalized.includes("expecting") ||
    normalized.includes("unknown diagram")
  )
}

export const createMermaidRenderTimeoutError = () =>
  new Error(`MERMAID_RENDER_TIMEOUT:${MERMAID_RENDER_TIMEOUT_MS}`)
