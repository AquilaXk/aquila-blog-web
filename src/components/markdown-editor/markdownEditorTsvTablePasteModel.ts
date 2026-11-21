// 참조 구현: github/paste-markdown (MIT) — src/paste-markdown-table.ts
// 스프레드시트 탭 구분 텍스트(TSV)를 GFM 마크다운 표로 자동 변환하는 스마트 붙여넣기 모델
import { isOffsetInsideCodeOrMathContext } from "./markdownEditorSlashContextScanner"

export const TSV_TABLE_MAX_INPUT_BYTES = 65_536 // 64KB 상한
export const TSV_TABLE_MAX_CELLS = 2_000 // 최대 2,000셀 상한

const escapeMarkdownTableCell = (cell: string): string => {
  return cell.trim().replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>")
}

export const convertTsvToMarkdownTable = (rawText: string): string | null => {
  if (!rawText || rawText.length > TSV_TABLE_MAX_INPUT_BYTES) {
    return null
  }

  // 1. 단일 패스 또는 정규화된 행 분리
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const rawRows = normalized.split("\n")

  // 끝부분 빈 줄 정리
  while (rawRows.length > 0 && rawRows[rawRows.length - 1]!.trim() === "") {
    rawRows.pop()
  }

  // 최소 2행 이상이어야 표로 인정
  if (rawRows.length < 2) {
    return null
  }

  // 2. 모든 비어있지 않은 행에 탭(\t)이 최소 하나 이상 포함되어 있는지 검사
  let maxCols = 0
  let totalCells = 0
  const parsedRows: string[][] = []

  for (let r = 0; r < rawRows.length; r += 1) {
    const rowText = rawRows[r]!
    if (rowText.trim() === "") continue

    if (!rowText.includes("\t")) {
      return null // 모든 행이 TSV 규격에 맞지 않으면 Fail-Closed로 일반 텍스트 처리
    }

    const cells = rowText.split("\t")
    totalCells += cells.length
    if (totalCells > TSV_TABLE_MAX_CELLS) {
      return null // 셀 개수 상한 초과 시 Fail-Closed
    }

    if (cells.length > maxCols) {
      maxCols = cells.length
    }
    parsedRows.push(cells)
  }

  if (parsedRows.length < 2 || maxCols < 2) {
    return null
  }

  // 3. GFM 마크다운 표 생성
  const lines: string[] = []

  // 헤더 행
  const headerCells = parsedRows[0]!
  const formattedHeader = Array.from({ length: maxCols }, (_, idx) => {
    const cell = headerCells[idx] ?? ""
    return escapeMarkdownTableCell(cell)
  })
  lines.push(`| ${formattedHeader.join(" | ")} |`)

  // 구분선 행 (| --- | --- | ...)
  const separator = Array.from({ length: maxCols }, () => "---")
  lines.push(`| ${separator.join(" | ")} |`)

  // 데이터 행
  for (let r = 1; r < parsedRows.length; r += 1) {
    const rowCells = parsedRows[r]!
    const formattedRow = Array.from({ length: maxCols }, (_, idx) => {
      const cell = rowCells[idx] ?? ""
      return escapeMarkdownTableCell(cell)
    })
    lines.push(`| ${formattedRow.join(" | ")} |`)
  }

  return lines.join("\n") + "\n"
}

export const resolveSmartPasteText = (
  pastedText: string,
  docContent: string,
  cursorOffset: number
): { text: string; isTable: boolean } => {
  // 코드블록 또는 수식 내부인 경우 표 변환 건너뜀
  if (isOffsetInsideCodeOrMathContext(docContent, cursorOffset)) {
    return { text: pastedText, isTable: false }
  }

  const tableMarkdown = convertTsvToMarkdownTable(pastedText)
  if (tableMarkdown !== null) {
    return { text: tableMarkdown, isTable: true }
  }

  return { text: pastedText, isTable: false }
}
