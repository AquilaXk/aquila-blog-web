import type { SiteLanguage } from "src/libs/language"

const KO_BLOCK_CHROME_LABELS = {
  blockMenuAria: "블록 작업 메뉴",
  turnIntoSection: "블록 전환",
  textColorSection: "글자 색상",
  lineActionSection: "블록 작업",
  turnIntoParagraph: "일반 문단으로 전환",
  turnIntoHeading1: "제목 1로 블록 전환",
  turnIntoHeading2: "제목 2로 블록 전환",
  turnIntoHeading3: "제목 3으로 블록 전환",
  turnIntoUnordered: "글머리 목록으로 블록 전환",
  turnIntoOrdered: "번호 목록으로 블록 전환",
  turnIntoTask: "할 일 목록으로 블록 전환",
  turnIntoQuote: "인용구로 블록 전환",
  lineDuplicate: "현재 줄 복제",
  lineMoveUp: "현재 줄 위로 이동",
  lineMoveDown: "현재 줄 아래로 이동",
  lineDelete: "현재 줄 삭제",
  selParagraph: "선택 영역 일반 문단",
  selHeading1: "선택 영역 제목 1",
  selHeading2: "선택 영역 제목 2",
  selHeading3: "선택 영역 제목 3",
  selQuote: "선택 영역 인용구",
  selTask: "선택 영역 할 일",
  selBold: "선택 영역 굵게",
  selItalic: "선택 영역 기울임",
  selStrikethrough: "선택 영역 취소선",
  selInlineCode: "선택 영역 인라인 코드",
  selHighlight: "선택 영역 하이라이트",
  selLink: "선택 영역 링크",
  gutterPlus: "현재 줄에 블록 삽입",
  gutterHandle: "현재 줄 블록 메뉴",
  selectionToolbar: "선택 텍스트 빠른 서식",
  selTextColor: "선택 영역 글자 색상",
  selTextColorPalette: "선택 영역 글자 색상 팔레트",
} as const

const EN_BLOCK_CHROME_LABELS: Record<keyof typeof KO_BLOCK_CHROME_LABELS, string> = {
  blockMenuAria: "Block actions menu",
  turnIntoSection: "Turn into",
  textColorSection: "Text color",
  lineActionSection: "Block actions",
  turnIntoParagraph: "Turn into paragraph",
  turnIntoHeading1: "Turn into Heading 1",
  turnIntoHeading2: "Turn into Heading 2",
  turnIntoHeading3: "Turn into Heading 3",
  turnIntoUnordered: "Turn into bullet list",
  turnIntoOrdered: "Turn into numbered list",
  turnIntoTask: "Turn into to-do list",
  turnIntoQuote: "Turn into quote",
  lineDuplicate: "Duplicate line",
  lineMoveUp: "Move line up",
  lineMoveDown: "Move line down",
  lineDelete: "Delete line",
  selParagraph: "Selection paragraph",
  selHeading1: "Selection Heading 1",
  selHeading2: "Selection Heading 2",
  selHeading3: "Selection Heading 3",
  selQuote: "Selection quote",
  selTask: "Selection to-do",
  selBold: "Bold selection",
  selItalic: "Italic selection",
  selStrikethrough: "Strikethrough selection",
  selInlineCode: "Inline code selection",
  selHighlight: "Highlight selection",
  selLink: "Link selection",
  gutterPlus: "Insert block on current line",
  gutterHandle: "Current line block menu",
  selectionToolbar: "Selection quick formatting",
  selTextColor: "Selection text color",
  selTextColorPalette: "Selection text color palette",
}

const SWATCH_LABELS: Record<string, { ko: string; en: string }> = {
  default: { ko: "글자 기본색", en: "Default text color" },
  sky: { ko: "글자 파란색", en: "Blue text color" },
  emerald: { ko: "글자 초록색", en: "Green text color" },
  amber: { ko: "글자 주황색", en: "Orange text color" },
  violet: { ko: "글자 보라색", en: "Purple text color" },
  rose: { ko: "글자 빨간색", en: "Red text color" },
}

export type BlockChromeLabels = typeof KO_BLOCK_CHROME_LABELS

export const getBlockChromeLabels = (language: SiteLanguage): Record<keyof BlockChromeLabels, string> =>
  language === "en" ? EN_BLOCK_CHROME_LABELS : KO_BLOCK_CHROME_LABELS

export const getColorSwatchLabel = (
  language: SiteLanguage,
  token: string,
  fallbackKo: string,
  forSelection = false
): string => {
  const entry = SWATCH_LABELS[token]
  if (language === "en") {
    const base = entry?.en ?? "Text color"
    return forSelection ? `Selection ${base.toLowerCase()}` : base
  }
  const base = entry?.ko ?? fallbackKo
  return forSelection ? `선택 영역 ${base}` : base
}
