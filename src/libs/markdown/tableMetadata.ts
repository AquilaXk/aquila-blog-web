export const TABLE_MIN_COLUMN_WIDTH_PX = 44
export const TABLE_MIN_ROW_HEIGHT_PX = 44
export const TABLE_WIDE_COLUMN_MIN_WIDTH_PX = 180
export const TABLE_WIDE_PROMOTION_COLUMN_BUDGET_PX = 180

export type MarkdownTableCellAlignment = "left" | "center" | "right"
export type MarkdownTableOverflowMode = "normal" | "wide"

export type MarkdownTableCellLayout = {
  align?: MarkdownTableCellAlignment | null
  backgroundColor?: string | null
  header?: boolean
  colspan?: number | null
  rowspan?: number | null
  hidden?: boolean
}

export type MarkdownTableLayout = {
  headerRow?: boolean
  headerColumn?: boolean
  fitWidth?: boolean
  overflowMode?: MarkdownTableOverflowMode
  columnWidths?: Array<number | null>
  rowHeights?: Array<number | null>
  columnAlignments?: Array<MarkdownTableCellAlignment | null>
  cells?: Array<Array<MarkdownTableCellLayout | null>>
}

const normalizeTableMetricValue = (
  value: unknown,
  minimum: number
): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.max(minimum, Math.round(value))
}

const trimTrailingNulls = <T>(values: Array<T | null>): Array<T | null> | undefined => {
  let lastMeaningfulIndex = -1
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] !== null) {
      lastMeaningfulIndex = index
    }
  }
  return lastMeaningfulIndex < 0 ? undefined : values.slice(0, lastMeaningfulIndex + 1)
}

const normalizeTableMetricList = (
  values: unknown,
  minimum: number
): Array<number | null> | undefined => {
  if (!Array.isArray(values)) return undefined
  return trimTrailingNulls(values.map((value) => normalizeTableMetricValue(value, minimum)))
}

const normalizeTableCellAlignment = (
  value: unknown
): MarkdownTableCellAlignment | null => {
  if (value !== "left" && value !== "center" && value !== "right") return null
  return value
}

const normalizeTableAlignmentList = (
  values: unknown
): Array<MarkdownTableCellAlignment | null> | undefined => {
  if (!Array.isArray(values)) return undefined
  return trimTrailingNulls(values.map((value) => normalizeTableCellAlignment(value)))
}

const SAFE_CSS_VAR_COLOR_PATTERN = /^var\(\s*--[\w-]{1,64}\s*\)$/
const SAFE_NAMED_COLOR_PATTERN = /^[a-zA-Z]{3,24}$/
const UNSAFE_CSS_VALUE_CHARS_PATTERN = /[;:{}<>\\"'`]/
const DECIMAL_NUMBER_TOKEN_PATTERN = /^(?:\d+|\d*\.\d+)$/
const BYTE_CHANNEL_TOKEN_PATTERN = /^\d{1,3}$/
const HUE_NUMBER_TOKEN_PATTERN = /^-?\d{1,3}(?:\.\d+)?$/
const PERCENT_NUMBER_TOKEN_PATTERN = /^\d{1,3}(?:\.\d+)?$/

const isHexDigitCode = (code: number): boolean =>
  (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102)

const isSafeHexColor = (value: string): boolean => {
  if (!value.startsWith("#")) return false
  const hexLength = value.length - 1
  if (hexLength !== 3 && hexLength !== 4 && hexLength !== 6 && hexLength !== 8) {
    return false
  }
  for (let index = 1; index < value.length; index += 1) {
    if (!isHexDigitCode(value.codePointAt(index) ?? 0)) {
      return false
    }
  }
  return true
}

const extractFunctionalColorArgs = (
  lowerValue: string,
  fnNames: readonly string[]
): string[] | null => {
  if (!lowerValue.endsWith(")")) return null
  for (const name of fnNames) {
    const prefix = `${name}(`
    if (lowerValue.startsWith(prefix)) {
      const inner = lowerValue.slice(prefix.length, -1)
      return inner.split(",").map((part) => part.trim())
    }
  }
  return null
}

const isValidAlphaToken = (token: string): boolean => {
  if (!DECIMAL_NUMBER_TOKEN_PATTERN.test(token)) return false
  const alpha = Number(token)
  return alpha >= 0 && alpha <= 1
}

const isValidByteChannel = (token: string): boolean =>
  BYTE_CHANNEL_TOKEN_PATTERN.test(token) && Number(token) <= 255

const isValidHueToken = (token: string): boolean => {
  const numericToken = token.endsWith("deg") ? token.slice(0, -3) : token
  return HUE_NUMBER_TOKEN_PATTERN.test(numericToken)
}

const isValidPercentToken = (token: string): boolean => {
  if (!token.endsWith("%")) return false
  const numericToken = token.slice(0, -1)
  return PERCENT_NUMBER_TOKEN_PATTERN.test(numericToken) && Number(numericToken) <= 100
}

const isSafeRgbColor = (lowerValue: string): boolean => {
  const args = extractFunctionalColorArgs(lowerValue, ["rgb", "rgba"])
  if (!args || (args.length !== 3 && args.length !== 4)) return false
  const hasValidRgb =
    isValidByteChannel(args[0] ?? "") &&
    isValidByteChannel(args[1] ?? "") &&
    isValidByteChannel(args[2] ?? "")
  if (!hasValidRgb) return false
  return args.length === 3 || isValidAlphaToken(args[3] ?? "")
}

const isSafeHslColor = (lowerValue: string): boolean => {
  const args = extractFunctionalColorArgs(lowerValue, ["hsl", "hsla"])
  if (!args || (args.length !== 3 && args.length !== 4)) return false
  const hasValidHsl =
    isValidHueToken(args[0] ?? "") &&
    isValidPercentToken(args[1] ?? "") &&
    isValidPercentToken(args[2] ?? "")
  if (!hasValidHsl) return false
  return args.length === 3 || isValidAlphaToken(args[3] ?? "")
}

const hasForbiddenColorKeyword = (lowerValue: string): boolean =>
  lowerValue.includes("url(") ||
  lowerValue.includes("expression(") ||
  lowerValue.includes("javascript")

const isSupportedSafeColorToken = (normalized: string, lowerValue: string): boolean =>
  isSafeHexColor(normalized) ||
  SAFE_CSS_VAR_COLOR_PATTERN.test(normalized) ||
  SAFE_NAMED_COLOR_PATTERN.test(normalized) ||
  isSafeRgbColor(lowerValue) ||
  isSafeHslColor(lowerValue)

export const normalizeTableBackgroundColor = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized || normalized.length > 64 || UNSAFE_CSS_VALUE_CHARS_PATTERN.test(normalized)) {
    return null
  }
  const lowerValue = normalized.toLowerCase()
  if (hasForbiddenColorKeyword(lowerValue)) return null
  return isSupportedSafeColorToken(normalized, lowerValue) ? normalized : null
}

const normalizeBackgroundColor = normalizeTableBackgroundColor

const toTrimmedPrimitiveText = (value: unknown): string => {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

const normalizePositiveInteger = (value: unknown): number | null => {
  const numericValue =
    typeof value === "number" ? value : Number.parseInt(toTrimmedPrimitiveText(value), 10)
  if (!Number.isFinite(numericValue) || numericValue < 1) return null
  return Math.max(1, Math.round(numericValue))
}

const normalizeOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value
  const text = toTrimmedPrimitiveText(value)
  if (text === "true") return true
  if (text === "false") return false
  return undefined
}

const toSpanAboveOne = (rawSpan: number | null): number | undefined =>
  rawSpan && rawSpan > 1 ? rawSpan : undefined

const compactObject = <T extends Record<string, unknown>>(entries: T): Partial<T> | null => {
  const result: Partial<T> = {}
  let hasEntry = false
  for (const [key, entryValue] of Object.entries(entries)) {
    if (entryValue !== undefined && entryValue !== null) {
      ;(result as Record<string, unknown>)[key] = entryValue
      hasEntry = true
    }
  }
  return hasEntry ? result : null
}

const normalizeTableCellLayout = (
  value: unknown
): MarkdownTableCellLayout | null => {
  if (!value || typeof value !== "object") return null

  const candidate = value as MarkdownTableCellLayout
  return compactObject({
    align: normalizeTableCellAlignment(candidate.align),
    backgroundColor: normalizeBackgroundColor(candidate.backgroundColor),
    header: normalizeOptionalBoolean((candidate as { header?: unknown }).header),
    colspan: toSpanAboveOne(normalizePositiveInteger(candidate.colspan)),
    rowspan: toSpanAboveOne(normalizePositiveInteger(candidate.rowspan)),
    hidden: candidate.hidden === true ? true : undefined,
  })
}

const normalizeTableCellRow = (row: unknown): Array<MarkdownTableCellLayout | null> => {
  if (!Array.isArray(row)) return []
  return trimTrailingNulls(row.map((cell) => normalizeTableCellLayout(cell))) ?? []
}

const normalizeTableCellMatrix = (
  value: unknown
): Array<Array<MarkdownTableCellLayout | null>> | undefined => {
  if (!Array.isArray(value)) return undefined
  const normalizedRows = value.map((row) => normalizeTableCellRow(row))
  let lastMeaningfulRowIndex = -1
  for (let index = 0; index < normalizedRows.length; index += 1) {
    if ((normalizedRows[index]?.length ?? 0) > 0) {
      lastMeaningfulRowIndex = index
    }
  }
  return lastMeaningfulRowIndex < 0
    ? undefined
    : normalizedRows.slice(0, lastMeaningfulRowIndex + 1)
}

const normalizeOverflowMode = (value: unknown): MarkdownTableOverflowMode | undefined =>
  value === "wide" || value === "normal" ? value : undefined

const normalizeStrictBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined

export const normalizeMarkdownTableLayout = (
  layout?: MarkdownTableLayout | null
): MarkdownTableLayout | null => {
  if (!layout) return null

  return compactObject({
    headerRow: normalizeStrictBoolean(layout.headerRow),
    headerColumn: normalizeStrictBoolean(layout.headerColumn),
    fitWidth: layout.fitWidth === true ? true : undefined,
    overflowMode: normalizeOverflowMode(layout.overflowMode),
    columnWidths: normalizeTableMetricList(layout.columnWidths, TABLE_MIN_COLUMN_WIDTH_PX),
    rowHeights: normalizeTableMetricList(layout.rowHeights, TABLE_MIN_ROW_HEIGHT_PX),
    columnAlignments: normalizeTableAlignmentList(layout.columnAlignments),
    cells: normalizeTableCellMatrix(layout.cells),
  })
}

const extractAqTableCommentJson = (line: string): string | null => {
  const trimmed = line.trim()
  if (!trimmed.startsWith("<!--") || !trimmed.endsWith("-->")) return null
  const inner = trimmed.slice(4, -3).trim()
  if (!inner.startsWith("aq-table")) return null
  const afterKeyword = inner.slice("aq-table".length)
  if (!afterKeyword.startsWith(" ") && !afterKeyword.startsWith("\t")) return null
  const jsonPayload = afterKeyword.trim()
  return jsonPayload.startsWith("{") && jsonPayload.endsWith("}") ? jsonPayload : null
}

export const parseMarkdownTableLayoutComment = (
  line: string
): MarkdownTableLayout | null => {
  const jsonPayload = extractAqTableCommentJson(line)
  if (!jsonPayload) return null

  try {
    const parsed = JSON.parse(jsonPayload) as MarkdownTableLayout
    return normalizeMarkdownTableLayout(parsed)
  } catch {
    return null
  }
}

export const serializeMarkdownTableLayoutComment = (
  layout?: MarkdownTableLayout | null
): string => {
  const normalized = normalizeMarkdownTableLayout(layout)
  if (!normalized) return ""
  return `<!-- aq-table ${JSON.stringify(normalized)} -->`
}

type ExtractedTableLayouts = {
  cleanedMarkdown: string
  layouts: Array<MarkdownTableLayout | null>
}

type FencedCodeBlockMarker = {
  marker: "`" | "~"
  length: number
}

const FENCE_OPEN_PATTERN = /^(`{3,}|~{3,})/

const isIndentedCodeLine = (line: string) => line.startsWith("    ") || line.startsWith("\t")

const parseFencedCodeBlockMarker = (line: string): FencedCodeBlockMarker | null => {
  if (isIndentedCodeLine(line)) return null
  const match = FENCE_OPEN_PATTERN.exec(line.trim())
  if (!match) return null

  const fence = match[1] ?? ""
  return {
    marker: fence[0] as FencedCodeBlockMarker["marker"],
    length: fence.length,
  }
}

const isFencedCodeBlockClosingLine = (
  line: string,
  openingMarker: FencedCodeBlockMarker
) => {
  const trimmedLine = line.trim()
  let markerLength = 0

  while (trimmedLine[markerLength] === openingMarker.marker) {
    markerLength += 1
  }

  return (
    markerLength >= openingMarker.length &&
    trimmedLine.slice(markerLength).trim().length === 0
  )
}

const isUnescapedPipeAt = (line: string, index: number) => {
  if (line[index] !== "|") return false

  let slashCount = 0
  for (let slashIndex = index - 1; slashIndex >= 0 && line[slashIndex] === "\\"; slashIndex -= 1) {
    slashCount += 1
  }

  return slashCount % 2 === 0
}

const countUnescapedPipeDelimiters = (line: string) => {
  let count = 0
  for (let index = 0; index < line.length; index += 1) {
    if (isUnescapedPipeAt(line, index)) count += 1
  }
  return count
}

const countGfmTableCells = (line: string) => {
  const trimmed = line.trim()
  const delimiterCount = countUnescapedPipeDelimiters(trimmed)
  if (delimiterCount < 1) return 0

  const hasLeadingPipe = isUnescapedPipeAt(trimmed, 0)
  const hasTrailingPipe = isUnescapedPipeAt(trimmed, trimmed.length - 1)
  return delimiterCount + 1 - (hasLeadingPipe ? 1 : 0) - (hasTrailingPipe ? 1 : 0)
}

const isSeparatorCellToken = (rawCell: string): boolean => {
  const cell = rawCell.trim()
  if (!cell) return false
  const start = cell.startsWith(":") ? 1 : 0
  const end = cell.endsWith(":") ? cell.length - 1 : cell.length
  if (end - start < 2) return false
  for (let index = start; index < end; index += 1) {
    if (cell.codePointAt(index) !== 45) return false
  }
  return true
}

const isTableSeparatorLine = (line: string): boolean => {
  if (isIndentedCodeLine(line)) return false
  const trimmed = line.trim()
  if (!trimmed.includes("|") || !trimmed.includes("-")) return false
  const start = trimmed.startsWith("|") ? 1 : 0
  const end = trimmed.endsWith("|") ? trimmed.length - 1 : trimmed.length
  const cells = trimmed.slice(start, end).split("|")
  return cells.length >= 2 && cells.every(isSeparatorCellToken)
}

const isLikelyTableRow = (line: string, precountedCells?: number) => {
  const cellCount = precountedCells ?? countGfmTableCells(line)
  if (isIndentedCodeLine(line) || cellCount < 2) return false
  const trimmed = line.trim()
  return trimmed.length >= 3 && trimmed.slice(1, -1).includes("|")
}

const isLikelyGfmTable = (headerLine: string, separatorLine: string) => {
  if (!isTableSeparatorLine(separatorLine)) return false
  const headerCells = countGfmTableCells(headerLine)
  if (!isLikelyTableRow(headerLine, headerCells)) return false
  return headerCells === countGfmTableCells(separatorLine)
}

export const stepFencedCodeState = (
  line: string,
  currentMarker: FencedCodeBlockMarker | null
): FencedCodeBlockMarker | null => {
  if (currentMarker) {
    return isFencedCodeBlockClosingLine(line, currentMarker) ? null : currentMarker
  }
  return parseFencedCodeBlockMarker(line)
}

export const isGfmTableAt = (lines: readonly string[], headerIndex: number): boolean =>
  isLikelyGfmTable(lines[headerIndex] || "", lines[headerIndex + 1] || "")

const normalizeTableSourceLineEndings = (markdown: string): string =>
  markdown.includes("\r") ? markdown.replace(/\r\n?/g, "\n") : markdown

const collectPlainTableLayouts = (lines: string[]): Array<MarkdownTableLayout | null> => {
  const layouts: Array<MarkdownTableLayout | null> = []
  let fencedCodeBlockMarker: FencedCodeBlockMarker | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    const wasInFencedCode = fencedCodeBlockMarker !== null
    fencedCodeBlockMarker = stepFencedCodeState(line, fencedCodeBlockMarker)
    if (wasInFencedCode || fencedCodeBlockMarker !== null) continue
    if (isGfmTableAt(lines, index)) {
      layouts.push(null)
    }
  }

  return layouts
}

const extractCommentedTableLayouts = (lines: string[]): ExtractedTableLayouts => {
  const cleanedLines: string[] = []
  const layouts: Array<MarkdownTableLayout | null> = []
  const explicitTableHeaderLines = new Set<number>()
  let fencedMarker: FencedCodeBlockMarker | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    const wasInFence = fencedMarker !== null
    fencedMarker = stepFencedCodeState(line, fencedMarker)
    if (wasInFence || fencedMarker !== null) {
      cleanedLines.push(line)
      continue
    }
    const layout = parseMarkdownTableLayoutComment(line)
    if (layout && isGfmTableAt(lines, index + 1)) {
      layouts.push(layout)
      explicitTableHeaderLines.add(index + 1)
      continue
    }
    if (!explicitTableHeaderLines.has(index) && isGfmTableAt(lines, index)) {
      layouts.push(null)
    }
    cleanedLines.push(line)
  }

  return { cleanedMarkdown: cleanedLines.join("\n"), layouts }
}

export const extractMarkdownTableLayouts = (markdown: string): ExtractedTableLayouts => {
  const normalizedMarkdown = normalizeTableSourceLineEndings(markdown)
  const hasAqTableComment = normalizedMarkdown.includes("aq-table")
  if (!normalizedMarkdown.includes("|") && !hasAqTableComment) {
    return { cleanedMarkdown: normalizedMarkdown, layouts: [] }
  }
  const lines = normalizedMarkdown.split("\n")
  if (!hasAqTableComment) {
    return { cleanedMarkdown: normalizedMarkdown, layouts: collectPlainTableLayouts(lines) }
  }
  return extractCommentedTableLayouts(lines)
}
