import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorListCommand = "unordered" | "ordered" | "task"

export type ListMarkerMatch =
  | { kind: "unordered" | "task" | "quote"; indent: string; marker: string; content: string }
  | { kind: "ordered"; indent: string; marker: string; content: string; number: number }

export const matchListMarkerLine = (line: string): ListMarkerMatch | null => {
  const task = /^(?<indent>\s*)(?<marker>[-*+] \[[ xX]\] )(?<content>.*)$/.exec(line)
  if (task?.groups) {
    return {
      kind: "task",
      indent: task.groups.indent ?? "",
      marker: "- [ ] ",
      content: task.groups.content ?? "",
    }
  }

  const unordered = /^(?<indent>\s*)(?<marker>[-*+] )(?<content>.*)$/.exec(line)
  if (unordered?.groups) {
    return {
      kind: "unordered",
      indent: unordered.groups.indent ?? "",
      marker: unordered.groups.marker ?? "- ",
      content: unordered.groups.content ?? "",
    }
  }

  const ordered = /^(?<indent>\s*)(?<marker>(?<number>\d+)\. )(?<content>.*)$/.exec(line)
  if (ordered?.groups) {
    return {
      kind: "ordered",
      indent: ordered.groups.indent ?? "",
      marker: ordered.groups.marker ?? "1. ",
      content: ordered.groups.content ?? "",
      number: Number.parseInt(ordered.groups.number ?? "1", 10) || 1,
    }
  }

  const quote = /^(?<indent>\s*)(?<marker>> )(?<content>.*)$/.exec(line)
  if (quote?.groups) {
    return {
      kind: "quote",
      indent: quote.groups.indent ?? "",
      marker: "> ",
      content: quote.groups.content ?? "",
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

const fenceLine = /^(?:(?: {0,3}> ?)+)?(?:[ \t]*(?:[-*+](?: \[[ xX]\])? |\d+\. )[ \t]*)?( {0,3})(`{3,}|~{3,})(.*)$/

const logicalLines = (value: string): LogicalLine[] => {
  const lines = value.split("\n")
  let offset = 0
  let inFence = false
  let openMarker = ""
  let openLength = 0

  return lines.map((text, index) => {
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
    const line = { start: offset, end: offset + text.length, text, intersectsFence }
    offset = line.end + (index < lines.length - 1 ? 1 : 0)
    return line
  })
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
