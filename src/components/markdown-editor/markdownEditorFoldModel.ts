const stepFoldFence = (fence: string, text: string): { fence: string; isFenceLine: boolean } => {
  let cursor = 0
  while (cursor < 3 && (text[cursor] === " " || text[cursor] === "\t")) cursor += 1
  const marker = text[cursor]
  if (marker !== "`" && marker !== "~") return { fence, isFenceLine: false }
  const runStart = cursor
  while (text[cursor] === marker) cursor += 1
  const fenceRun = text.slice(runStart, cursor)
  if (fenceRun.length < 3) return { fence, isFenceLine: false }
  if (!fence) return { fence: fenceRun, isFenceLine: true }
  const closes =
    fenceRun.startsWith(fence[0]!) && fenceRun.length >= fence.length && !text.slice(cursor).trim()
  return { fence: closes ? "" : fence, isFenceLine: true }
}

type FoldDocLine = { number: number; from: number; to: number; text: string }

export const computeMarkdownFoldRange = (
  state: {
    doc: {
      lines: number
      lineAt: (pos: number) => FoldDocLine
      line: (lineNo: number) => FoldDocLine
    }
  },
  lineStart: number,
  _lineEnd?: number
): { from: number; to: number } | null => {
  const line = state.doc.lineAt(lineStart)
  const headingMatch = /^\s{0,3}(#{1,6})\s+/.exec(line.text)
  if (headingMatch) {
    const level = headingMatch[1].length
    let endPos = line.to
    let activeFence = ""
    for (let lineNo = line.number + 1; lineNo <= state.doc.lines; lineNo += 1) {
      const nextLine = state.doc.line(lineNo)
      const fenceStep = stepFoldFence(activeFence, nextLine.text)
      activeFence = fenceStep.fence
      if (!fenceStep.isFenceLine && !activeFence) {
        const nextHeading = /^\s{0,3}(#{1,6})\s+/.exec(nextLine.text)
        if (nextHeading && nextHeading[1].length <= level) break
      }
      endPos = nextLine.to
    }
    return endPos > line.to ? { from: line.to, to: endPos } : null
  }

  const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line.text)
  if (fenceMatch) {
    const fence = fenceMatch[1]
    const marker = fence[0]
    for (let lineNo = line.number + 1; lineNo <= state.doc.lines; lineNo += 1) {
      const nextLine = state.doc.line(lineNo)
      const closeMatch = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(nextLine.text)
      if (closeMatch && closeMatch[1][0] === marker && closeMatch[1].length >= fence.length) {
        return nextLine.to > line.to ? { from: line.to, to: nextLine.to } : null
      }
    }
  }

  return null
}
