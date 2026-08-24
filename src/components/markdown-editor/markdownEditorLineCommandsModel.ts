import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorLineCommand = "move-up" | "move-down" | "duplicate" | "delete"

type LogicalLine = {
  start: number
  end: number
}

const logicalLines = (value: string): LogicalLine[] => {
  const lines: LogicalLine[] = []
  let start = 0

  for (let index = 0; index <= value.length; index += 1) {
    if (index === value.length || value[index] === "\n") {
      lines.push({ start, end: index })
      start = index + 1
    }
  }

  return lines
}

const lineIndexAt = (lines: LogicalLine[], offset: number) => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    if (offset <= line.end || index === lines.length - 1) return index
  }
  return lines.length - 1
}

const selectedLineRange = (value: string, selectionStart: number, selectionEnd: number) => {
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
  const start = lineIndexAt(lines, selectionStart)
  const end = selectionStart === selectionEnd ? start : lineIndexAt(lines, selectionEnd - 1)
  return { lines, start, end }
}

const planMove = (
  value: string,
  lines: LogicalLine[],
  start: number,
  end: number,
  selectionStart: number,
  selectionEnd: number,
  direction: "up" | "down"
): PlannedTextMutation | null => {
  const adjacent = direction === "up" ? start - 1 : end + 1
  if (adjacent < 0 || adjacent >= lines.length) return null

  const first = direction === "up" ? adjacent : start
  const last = direction === "up" ? end : adjacent
  const rangeStart = lines[first]!.start
  const rangeEnd = lines[last]!.end
  const before = value.slice(lines[start]!.start, lines[end]!.end)
  const after = value.slice(lines[adjacent]!.start, lines[adjacent]!.end)
  const replacement = direction === "up" ? `${before}\n${after}` : `${after}\n${before}`
  const movedBlockStart = rangeStart + (direction === "up" ? 0 : after.length + 1)
  const blockStart = lines[start]!.start
  const relativeSelectionStart = Math.min(selectionStart - blockStart, before.length)
  const relativeSelectionEnd = Math.min(selectionEnd - blockStart, before.length)

  return {
    rangeStart,
    rangeEnd,
    replacement,
    selectionStart: movedBlockStart + relativeSelectionStart,
    selectionEnd: movedBlockStart + relativeSelectionEnd,
  }
}

const planDuplicate = (
  value: string,
  lines: LogicalLine[],
  start: number,
  end: number,
  selectionStart: number,
  selectionEnd: number
): PlannedTextMutation => {
  const rangeStart = lines[start]!.start
  const rangeEnd = lines[end]!.end
  const block = value.slice(rangeStart, rangeEnd)
  const copiedBlockStart = rangeEnd + 1
  const relativeSelectionStart = Math.min(selectionStart - rangeStart, block.length)
  const relativeSelectionEnd = Math.min(selectionEnd - rangeStart, block.length)

  return {
    rangeStart,
    rangeEnd,
    replacement: `${block}\n${block}`,
    selectionStart: copiedBlockStart + relativeSelectionStart,
    selectionEnd: copiedBlockStart + relativeSelectionEnd,
  }
}

const planDelete = (value: string, lines: LogicalLine[], start: number, end: number): PlannedTextMutation => {
  const hasFollowingLine = end < lines.length - 1
  const rangeStart = hasFollowingLine ? lines[start]!.start : start > 0 ? lines[start]!.start - 1 : 0
  const rangeEnd = hasFollowingLine ? lines[end]!.end + 1 : lines[end]!.end
  return { rangeStart, rangeEnd, replacement: "", selectionStart: rangeStart, selectionEnd: rangeStart }
}

export const planMarkdownEditorLineCommand = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  command: MarkdownEditorLineCommand
): PlannedTextMutation | null => {
  const selection = selectedLineRange(value, selectionStart, selectionEnd)
  if (!selection) return null

  const { lines, start, end } = selection
  if (command === "move-up") return planMove(value, lines, start, end, selectionStart, selectionEnd, "up")
  if (command === "move-down") return planMove(value, lines, start, end, selectionStart, selectionEnd, "down")
  if (command === "duplicate") return planDuplicate(value, lines, start, end, selectionStart, selectionEnd)
  return planDelete(value, lines, start, end)
}
