/**
 * 참조 구현:
 * - payloadcms/payload packages/ui/src/elements/DocumentDiff/ (MIT License, Copyright (c) Payload CMS)
 *   리비전 복원 전 현재 원고와의 Fail-Closed 바운드 줄 단위 Diff 모델.
 */
import { parseEditorMeta } from "./editorStudioMetaModel"

export const MAX_DIFF_LINES = 800
export const MAX_INPUT_CHARS = 200_000

export type RevisionDiffLineKind = "equal" | "removed" | "added"

export type RevisionDiffLine = {
  kind: RevisionDiffLineKind
  text: string
  revisionLineNumber: number | null
  currentLineNumber: number | null
}

export type PostRevisionDiffResult = {
  truncated: boolean
  hasChanges: boolean
  changedTitle: boolean
  addedTags: string[]
  removedTags: string[]
  addedLines: number
  removedLines: number
  revisionLineCount: number
  currentLineCount: number
  lines: RevisionDiffLine[]
}

const normalizeLineEndings = (value: string): string => value.replace(/\r\n?/g, "\n")

const splitDiffLines = (value: string): string[] => {
  if (!value) return []
  return value.split("\n")
}

const normalizeTagList = (tags: readonly string[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags) {
    const trimmed = tag.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

const computeTagDiff = (
  revisionTags: readonly string[],
  currentTags: readonly string[]
): { addedTags: string[]; removedTags: string[] } => {
  const prevSet = new Set(revisionTags)
  const nextSet = new Set(currentTags)
  const addedTags = currentTags.filter((tag) => !prevSet.has(tag))
  const removedTags = revisionTags.filter((tag) => !nextSet.has(tag))
  return { addedTags, removedTags }
}

const computeLcsCoreDiff = (
  revSlice: readonly string[],
  curSlice: readonly string[],
  revBaseOffset: number,
  curBaseOffset: number
): { hunks: RevisionDiffLine[]; addedLines: number; removedLines: number } => {
  const m = revSlice.length
  const n = curSlice.length
  const cols = n + 1
  const dp = new Uint32Array((m + 1) * cols)

  for (let i = m - 1; i >= 0; i -= 1) {
    const rowBase = i * cols
    const nextRowBase = (i + 1) * cols
    const revLine = revSlice[i]!
    for (let j = n - 1; j >= 0; j -= 1) {
      if (revLine === curSlice[j]!) {
        dp[rowBase + j] = dp[nextRowBase + j + 1]! + 1
      } else {
        const down = dp[nextRowBase + j]!
        const right = dp[rowBase + j + 1]!
        dp[rowBase + j] = down >= right ? down : right
      }
    }
  }

  const hunks: RevisionDiffLine[] = []
  let i = 0
  let j = 0
  let addedLines = 0
  let removedLines = 0

  while (i < m && j < n) {
    const revLine = revSlice[i]!
    const curLine = curSlice[j]!
    if (revLine === curLine) {
      hunks.push({
        kind: "equal",
        text: curLine,
        revisionLineNumber: revBaseOffset + i + 1,
        currentLineNumber: curBaseOffset + j + 1,
      })
      i += 1
      j += 1
    } else if (dp[(i + 1) * cols + j]! >= dp[i * cols + j + 1]!) {
      hunks.push({
        kind: "removed",
        text: revLine,
        revisionLineNumber: revBaseOffset + i + 1,
        currentLineNumber: null,
      })
      removedLines += 1
      i += 1
    } else {
      hunks.push({
        kind: "added",
        text: curLine,
        revisionLineNumber: null,
        currentLineNumber: curBaseOffset + j + 1,
      })
      addedLines += 1
      j += 1
    }
  }

  while (i < m) {
    hunks.push({
      kind: "removed",
      text: revSlice[i]!,
      revisionLineNumber: revBaseOffset + i + 1,
      currentLineNumber: null,
    })
    removedLines += 1
    i += 1
  }

  while (j < n) {
    hunks.push({
      kind: "added",
      text: curSlice[j]!,
      revisionLineNumber: null,
      currentLineNumber: curBaseOffset + j + 1,
    })
    addedLines += 1
    j += 1
  }

  return { hunks, addedLines, removedLines }
}

export const computePostRevisionDiff = ({
  revisionTitle,
  revisionContent,
  currentTitle,
  currentTags,
  currentContent,
}: {
  revisionTitle: string
  revisionContent: string
  currentTitle: string
  currentTags: readonly string[]
  currentContent: string
}): PostRevisionDiffResult => {
  const normalizedRevisionTitle = revisionTitle.trim()
  const normalizedCurrentTitle = currentTitle.trim()
  const changedTitle = normalizedRevisionTitle !== normalizedCurrentTitle

  if (revisionContent.length > MAX_INPUT_CHARS * 2 || currentContent.length > MAX_INPUT_CHARS * 2) {
    return {
      truncated: true,
      hasChanges: changedTitle || revisionContent !== currentContent,
      changedTitle,
      addedTags: [],
      removedTags: [],
      addedLines: 0,
      removedLines: 0,
      revisionLineCount: 0,
      currentLineCount: 0,
      lines: [],
    }
  }

  const parsedRevisionMeta = parseEditorMeta(normalizeLineEndings(revisionContent))
  const parsedCurrentMeta = parseEditorMeta(normalizeLineEndings(currentContent))

  const normalizedRevisionTags = normalizeTagList(parsedRevisionMeta.tags)
  const normalizedCurrentTags = normalizeTagList(
    currentTags.length > 0 ? currentTags : parsedCurrentMeta.tags
  )
  const { addedTags, removedTags } = computeTagDiff(
    normalizedRevisionTags,
    normalizedCurrentTags
  )

  const revBody = parsedRevisionMeta.body.trimEnd()
  const curBody = parsedCurrentMeta.body.trimEnd()

  if (revBody.length > MAX_INPUT_CHARS || curBody.length > MAX_INPUT_CHARS) {
    return {
      truncated: true,
      hasChanges:
        changedTitle || addedTags.length > 0 || removedTags.length > 0 || revBody !== curBody,
      changedTitle,
      addedTags,
      removedTags,
      addedLines: 0,
      removedLines: 0,
      revisionLineCount: revBody ? revBody.split("\n").length : 0,
      currentLineCount: curBody ? curBody.split("\n").length : 0,
      lines: [],
    }
  }

  const revLines = splitDiffLines(revBody)
  const curLines = splitDiffLines(curBody)

  if (revLines.length > MAX_DIFF_LINES || curLines.length > MAX_DIFF_LINES) {
    return {
      truncated: true,
      hasChanges:
        changedTitle || addedTags.length > 0 || removedTags.length > 0 || revBody !== curBody,
      changedTitle,
      addedTags,
      removedTags,
      addedLines: 0,
      removedLines: 0,
      revisionLineCount: revLines.length,
      currentLineCount: curLines.length,
      lines: [],
    }
  }

  let prefixLen = 0
  const minLen = Math.min(revLines.length, curLines.length)
  while (prefixLen < minLen && revLines[prefixLen] === curLines[prefixLen]) {
    prefixLen += 1
  }

  let suffixLen = 0
  const maxSuffix = minLen - prefixLen
  while (
    suffixLen < maxSuffix &&
    revLines[revLines.length - 1 - suffixLen] === curLines[curLines.length - 1 - suffixLen]
  ) {
    suffixLen += 1
  }

  const lines: RevisionDiffLine[] = []
  for (let idx = 0; idx < prefixLen; idx += 1) {
    lines.push({
      kind: "equal",
      text: curLines[idx]!,
      revisionLineNumber: idx + 1,
      currentLineNumber: idx + 1,
    })
  }

  const revMiddle = revLines.slice(prefixLen, revLines.length - suffixLen)
  const curMiddle = curLines.slice(prefixLen, curLines.length - suffixLen)
  const { hunks, addedLines, removedLines } = computeLcsCoreDiff(
    revMiddle,
    curMiddle,
    prefixLen,
    prefixLen
  )
  for (const hunk of hunks) {
    lines.push(hunk)
  }

  const revSuffixStart = revLines.length - suffixLen
  const curSuffixStart = curLines.length - suffixLen
  for (let offset = 0; offset < suffixLen; offset += 1) {
    lines.push({
      kind: "equal",
      text: curLines[curSuffixStart + offset]!,
      revisionLineNumber: revSuffixStart + offset + 1,
      currentLineNumber: curSuffixStart + offset + 1,
    })
  }

  const hasChanges =
    changedTitle ||
    addedTags.length > 0 ||
    removedTags.length > 0 ||
    addedLines > 0 ||
    removedLines > 0

  return {
    truncated: false,
    hasChanges,
    changedTitle,
    addedTags,
    removedTags,
    addedLines,
    removedLines,
    revisionLineCount: revLines.length,
    currentLineCount: curLines.length,
    lines,
  }
}
