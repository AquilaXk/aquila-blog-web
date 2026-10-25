import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorListCommand = "unordered" | "ordered" | "task"

export type ListMarkerMatch =
  | { kind: "unordered" | "task" | "quote"; indent: string; marker: string; content: string }
  | { kind: "ordered"; indent: string; marker: string; content: string; number: number }

const TASK_PREFIX_RE = /^[-*+] \[[ xX]\] (.*)$/
const UNORDERED_PREFIX_RE = /^([-*+] )(.*)$/
const ORDERED_PREFIX_RE = /^((\d+)\. )(.*)$/
const QUOTE_PREFIX_RE = /^> (.*)$/

export const matchListMarkerLine = (line: string): ListMarkerMatch | null => {
  const trimmed = line.trimStart()
  if (!trimmed) return null
  const indent = line.slice(0, line.length - trimmed.length)
  const first = trimmed[0]

  if (first === "-" || first === "*" || first === "+") {
    const task = TASK_PREFIX_RE.exec(trimmed)
    if (task) return { kind: "task", indent, marker: "- [ ] ", content: task[1] }
    const unordered = UNORDERED_PREFIX_RE.exec(trimmed)
    if (unordered) return { kind: "unordered", indent, marker: unordered[1], content: unordered[2] }
    return null
  }

  if (first >= "0" && first <= "9") {
    const ordered = ORDERED_PREFIX_RE.exec(trimmed)
    if (!ordered) return null
    return {
      kind: "ordered",
      indent,
      marker: ordered[1],
      content: ordered[3],
      number: Number.parseInt(ordered[2], 10) || 1,
    }
  }

  if (first === ">") {
    const quote = QUOTE_PREFIX_RE.exec(trimmed)
    if (quote) return { kind: "quote", indent, marker: "> ", content: quote[1] }
  }

  return null
}

type LogicalLine = {
  start: number
  end: number
  text: string
  intersectsFence: boolean
}

const fenceLine = /^(?: {0,3}>)*[ \t]*(?:(?:[-*+](?: \[[ xX]\])? |\d+\. )[ \t]*)?( {0,3})(`{3,}|~{3,})(.*)$/

const logicalLines = (value: string): LogicalLine[] => {
  const result: LogicalLine[] = []
  let offset = 0
  let inFence = false
  let openMarker = ""
  let openLength = 0

  while (true) {
    const nextBreak = value.indexOf("\n", offset)
    const end = nextBreak === -1 ? value.length : nextBreak
    const text = value.slice(offset, end)
    const match = fenceLine.exec(text)
    let intersectsFence = inFence
    if (match) {
      const marker = match[2]?.[0] ?? ""
      const length = match[2]?.length ?? 0
      const info = match[3] ?? ""
      intersectsFence = true
      if (!inFence) {
        inFence = true
        openMarker = marker
        openLength = length
      } else if (marker === openMarker && length >= openLength && info.trim() === "") {
        inFence = false
        openMarker = ""
        openLength = 0
      }
    }
    result.push({ start: offset, end, text, intersectsFence })
    if (nextBreak === -1) break
    offset = end + 1
  }

  return result
}

const lineIndexAt = (lines: LogicalLine[], offset: number): number => {
  for (let index = 0; index < lines.length; index += 1) {
    if (offset <= lines[index]!.end) return index
  }
  return lines.length - 1
}

type LineTransformation = {
  line: LogicalLine
  indentLength: number
  oldMarkerLength: number
  newMarkerLength: number
  replacement: string
  replacementStart: number
}

export const planToggleListCommand = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  command: MarkdownEditorListCommand
): PlannedTextMutation | null => {
  if (
    !Number.isInteger(selectionStart) ||
    !Number.isInteger(selectionEnd) ||
    selectionStart < 0 ||
    selectionEnd < selectionStart ||
    selectionEnd > value.length
  ) {
    return null
  }

  const lines = logicalLines(value)
  const firstIndex = lineIndexAt(lines, selectionStart)
  const lastIndex = lineIndexAt(lines, selectionEnd === selectionStart ? selectionEnd : selectionEnd - 1)
  const selected = lines.slice(firstIndex, lastIndex + 1)
  if (selected.some((line) => line.intersectsFence)) return null

  const rangeStart = selected[0]!.start
  const rangeEnd = selected[selected.length - 1]!.end
  const matches = selected.map((line) => matchListMarkerLine(line.text))
  const removeMarkers = matches.every((match) => match?.kind === command)
  const orderedNumbers = new Map<string, number>()
  let runningReplacementStart = rangeStart
  const transformations = selected.map((line, index): LineTransformation => {
    const match = matches[index]
    const indent = match?.indent ?? /^\s*/.exec(line.text)?.[0] ?? ""
    const oldMarkerLength = match && match.kind !== "quote" ? match.marker.length : 0
    const content = match && match.kind !== "quote" ? match.content : line.text.slice(indent.length)
    const marker = removeMarkers
      ? ""
      : command === "ordered"
        ? `${(orderedNumbers.get(indent) ?? 0) + 1}. `
        : command === "task"
          ? "- [ ] "
          : "- "

    if (!removeMarkers && command === "ordered") {
      orderedNumbers.set(indent, (orderedNumbers.get(indent) ?? 0) + 1)
    }

    const lineReplacement = `${indent}${marker}${content}`
    const replacementStart = runningReplacementStart
    runningReplacementStart += lineReplacement.length + 1

    return {
      line,
      indentLength: indent.length,
      oldMarkerLength,
      newMarkerLength: marker.length,
      replacement: lineReplacement,
      replacementStart,
    }
  })

  const replacement = transformations.map((transformation) => transformation.replacement).join("\n")
  const totalDelta = replacement.length - (rangeEnd - rangeStart)

  const rebaseOffset = (offset: number): number => {
    if (offset < rangeStart) return offset
    if (offset > rangeEnd) return offset + totalDelta

    const transformation = transformations.find(({ line }) => offset <= line.end) ?? transformations[transformations.length - 1]!
    const relative = offset - transformation.line.start
    const { indentLength, replacementStart } = transformation

    if (relative < indentLength) return replacementStart + relative
    if (relative <= indentLength + transformation.oldMarkerLength) {
      return replacementStart + indentLength + transformation.newMarkerLength
    }
    return replacementStart + relative + transformation.newMarkerLength - transformation.oldMarkerLength
  }

  return {
    rangeStart,
    rangeEnd,
    replacement,
    selectionStart: rebaseOffset(selectionStart),
    selectionEnd: rebaseOffset(selectionEnd),
  }
}
