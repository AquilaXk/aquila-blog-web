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
type FoldStateDoc = {
  lines: number
  lineAt: (pos: number) => FoldDocLine
  line: (lineNo: number) => FoldDocLine
}
type FoldRange = { from: number; to: number }

const isSameOrHigherHeading = (text: string, level: number): boolean => {
  const match = /^\s{0,3}(#{1,6})\s+/.exec(text)
  return Boolean(match && match[1]!.length <= level)
}

const computeHeadingFoldRange = (doc: FoldStateDoc, line: FoldDocLine, level: number): FoldRange | null => {
  let endPos = line.to
  let activeFence = ""
  for (let lineNo = line.number + 1; lineNo <= doc.lines; lineNo += 1) {
    const nextLine = doc.line(lineNo)
    const fenceStep = stepFoldFence(activeFence, nextLine.text)
    activeFence = fenceStep.fence
    if (!fenceStep.isFenceLine && !activeFence && isSameOrHigherHeading(nextLine.text, level)) break
    endPos = nextLine.to
  }
  return endPos > line.to ? { from: line.to, to: endPos } : null
}

const computeFenceFoldRange = (doc: FoldStateDoc, line: FoldDocLine, fence: string): FoldRange | null => {
  const marker = fence[0]!
  for (let lineNo = line.number + 1; lineNo <= doc.lines; lineNo += 1) {
    const nextLine = doc.line(lineNo)
    const closeMatch = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(nextLine.text)
    if (closeMatch?.[1]?.startsWith(marker) && closeMatch[1].length >= fence.length) {
      return nextLine.to > line.to ? { from: line.to, to: nextLine.to } : null
    }
  }
  return null
}

export const computeMarkdownFoldRange = (
  state: { doc: FoldStateDoc },
  lineStart: number,
  _lineEnd?: number
): FoldRange | null => {
  const line = state.doc.lineAt(lineStart)
  const headingMatch = /^\s{0,3}(#{1,6})\s+/.exec(line.text)
  if (headingMatch?.[1]) return computeHeadingFoldRange(state.doc, line, headingMatch[1].length)
  const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line.text)
  if (fenceMatch?.[1]) return computeFenceFoldRange(state.doc, line, fenceMatch[1])
  return null
}
