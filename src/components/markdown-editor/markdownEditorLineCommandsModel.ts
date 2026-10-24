import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorLineCommand = "move-up" | "move-down" | "duplicate" | "delete"

type SelectedBlockOffsets = {
  blockStart: number
  blockEnd: number
}

const resolveSelectedBlockOffsets = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): SelectedBlockOffsets | null => {
  if (
    !Number.isInteger(selectionStart) ||
    !Number.isInteger(selectionEnd) ||
    selectionStart < 0 ||
    selectionEnd < selectionStart ||
    selectionEnd > value.length
  ) {
    return null
  }

  const blockStart =
    selectionStart === 0 ? 0 : value.lastIndexOf("\n", selectionStart - 1) + 1
  const endProbe = selectionStart === selectionEnd ? selectionStart : selectionEnd - 1
  const nextBreak = value.indexOf("\n", endProbe)
  const blockEnd = nextBreak === -1 ? value.length : nextBreak
  return { blockStart, blockEnd }
}

const planMove = (
  value: string,
  blockStart: number,
  blockEnd: number,
  selectionStart: number,
  selectionEnd: number,
  direction: "up" | "down"
): PlannedTextMutation | null => {
  if (direction === "up" && blockStart === 0) return null
  if (direction === "down" && blockEnd === value.length) return null

  let adjStart = 0
  let adjEnd = 0
  if (direction === "up") {
    adjEnd = blockStart - 1
    adjStart = adjEnd === 0 ? 0 : value.lastIndexOf("\n", adjEnd - 1) + 1
  } else {
    adjStart = blockEnd + 1
    const nextBreak = value.indexOf("\n", adjStart)
    adjEnd = nextBreak === -1 ? value.length : nextBreak
  }

  const rangeStart = direction === "up" ? adjStart : blockStart
  const rangeEnd = direction === "up" ? blockEnd : adjEnd
  const before = value.slice(blockStart, blockEnd)
  const after = value.slice(adjStart, adjEnd)
  const replacement = direction === "up" ? `${before}\n${after}` : `${after}\n${before}`
  const movedBlockStart = rangeStart + (direction === "up" ? 0 : after.length + 1)
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
  blockStart: number,
  blockEnd: number,
  selectionStart: number,
  selectionEnd: number
): PlannedTextMutation => {
  const block = value.slice(blockStart, blockEnd)
  const copiedBlockStart = blockEnd + 1
  const relativeSelectionStart = Math.min(selectionStart - blockStart, block.length)
  const relativeSelectionEnd = Math.min(selectionEnd - blockStart, block.length)

  return {
    rangeStart: blockStart,
    rangeEnd: blockEnd,
    replacement: `${block}\n${block}`,
    selectionStart: copiedBlockStart + relativeSelectionStart,
    selectionEnd: copiedBlockStart + relativeSelectionEnd,
  }
}

const planDelete = (value: string, blockStart: number, blockEnd: number): PlannedTextMutation => {
  const hasFollowingLine = blockEnd < value.length
  let rangeStart = blockStart
  if (!hasFollowingLine) {
    rangeStart = blockStart > 0 ? blockStart - 1 : 0
  }
  const rangeEnd = hasFollowingLine ? blockEnd + 1 : blockEnd
  return { rangeStart, rangeEnd, replacement: "", selectionStart: rangeStart, selectionEnd: rangeStart }
}

export const planMarkdownEditorLineCommand = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  command: MarkdownEditorLineCommand
): PlannedTextMutation | null => {
  const selection = resolveSelectedBlockOffsets(value, selectionStart, selectionEnd)
  if (!selection) return null

  const { blockStart, blockEnd } = selection
  if (command === "move-up") return planMove(value, blockStart, blockEnd, selectionStart, selectionEnd, "up")
  if (command === "move-down") return planMove(value, blockStart, blockEnd, selectionStart, selectionEnd, "down")
  if (command === "duplicate") return planDuplicate(value, blockStart, blockEnd, selectionStart, selectionEnd)
  return planDelete(value, blockStart, blockEnd)
}
