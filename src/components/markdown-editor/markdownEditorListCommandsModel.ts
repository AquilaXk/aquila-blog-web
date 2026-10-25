import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorListCommand = "unordered" | "ordered" | "task"

export type ListMarkerMatch =
  | { kind: "unordered" | "task" | "quote"; indent: string; marker: string; content: string }
  | { kind: "ordered"; indent: string; marker: string; content: string; number: number }

const TASK_LINE_RE = /^(?<indent>\s*)(?<marker>[-*+] \[[ xX]\] )(?<content>.*)$/
const UNORDERED_LINE_RE = /^(?<indent>\s*)(?<marker>[-*+] )(?<content>.*)$/
const ORDERED_LINE_RE = /^(?<indent>\s*)(?<marker>(?<number>\d+)\. )(?<content>.*)$/
const QUOTE_LINE_RE = /^(?<indent>\s*)(?<marker>> )(?<content>.*)$/

export const matchListMarkerLine = (line: string): ListMarkerMatch | null => {
  let i = 0
  while (i < line.length) {
    const ch = line.charCodeAt(i)
    if (ch !== 32 && ch !== 9) break
    i += 1
  }
  if (i >= line.length) return null

  const code = line.charCodeAt(i)
  if (code === 45 || code === 42 || code === 43) {
    const task = TASK_LINE_RE.exec(line)
    if (task?.groups) {
      return {
        kind: "task",
        indent: task.groups.indent ?? "",
        marker: "- [ ] ",
        content: task.groups.content ?? "",
      }
    }

    const unordered = UNORDERED_LINE_RE.exec(line)
    if (unordered?.groups) {
      return {
        kind: "unordered",
        indent: unordered.groups.indent ?? "",
        marker: unordered.groups.marker ?? "- ",
        content: unordered.groups.content ?? "",
      }
    }
    return null
  }

  if (code >= 48 && code <= 57) {
    const ordered = ORDERED_LINE_RE.exec(line)
    if (ordered?.groups) {
      return {
        kind: "ordered",
        indent: ordered.groups.indent ?? "",
        marker: ordered.groups.marker ?? "1. ",
        content: ordered.groups.content ?? "",
        number: Number.parseInt(ordered.groups.number ?? "1", 10) || 1,
      }
    }
    return null
  }

  if (code === 62) {
    const quote = QUOTE_LINE_RE.exec(line)
    if (quote?.groups) {
      return {
        kind: "quote",
        indent: quote.groups.indent ?? "",
        marker: "> ",
        content: quote.groups.content ?? "",
      }
    }
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
  oldMarkerLength: number
  newMarkerLength: number
  replacement: string
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

  const matches = selected.map((line) => matchListMarkerLine(line.text))
  const removeMarkers = matches.every((match) => match?.kind === command)
  const orderedNumbers = new Map<string, number>()
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

    return {
      line,
      oldMarkerLength,
      newMarkerLength: marker.length,
      replacement: `${indent}${marker}${content}`,
    }
  })

  const rangeStart = selected[0]!.start
  const rangeEnd = selected[selected.length - 1]!.end
  const replacement = transformations.map((transformation) => transformation.replacement).join("\n")
  const totalDelta = replacement.length - (rangeEnd - rangeStart)

  const rebaseOffset = (offset: number): number => {
    if (offset < rangeStart) return offset
    if (offset > rangeEnd) return offset + totalDelta

    const transformation = transformations.find(({ line }) => offset <= line.end) ?? transformations[transformations.length - 1]!
    const relative = offset - transformation.line.start
    const indentLength = /^\s*/.exec(transformation.line.text)?.[0].length ?? 0
    const replacementStart = rangeStart + transformations
      .slice(0, transformations.indexOf(transformation))
      .reduce((length, item) => length + item.replacement.length + 1, 0)

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
