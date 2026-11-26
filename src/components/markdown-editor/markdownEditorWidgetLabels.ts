import type { SiteLanguage } from "src/libs/language"
import type { ParsedStandaloneMarkdownImage } from "../../libs/markdown/renderingImageModel"

type ImageAlignValue = NonNullable<ParsedStandaloneMarkdownImage["align"]>

export const getCardBlockLabels = (lang: SiteLanguage) =>
  lang === "en"
    ? {
        bookmarkOpen: "Open bookmark link",
        embedOpen: "Open embed link",
        fileOpen: "Open attached file",
        embedPreviewTitle: "Embed preview",
      }
    : {
        bookmarkOpen: "북마크 링크 열기",
        embedOpen: "임베드 링크 열기",
        fileOpen: "첨부 파일 열기",
        embedPreviewTitle: "임베드 미리보기",
      }

export const getBlockWidgetLabels = (lang: SiteLanguage) =>
  lang === "en"
    ? {
        calloutFallback: "Callout",
        toggleAria: "Toggle expand/collapse",
        toggleTitleFallback: "Toggle block",
        toggleEmptyBody: "Click to enter content...",
      }
    : {
        calloutFallback: "콜아웃",
        toggleAria: "토글 접기/펼치기",
        toggleTitleFallback: "토글 블록",
        toggleEmptyBody: "내용을 입력하려면 클릭하세요...",
      }

export const getImageControlLabels = (lang: SiteLanguage) => ({
  resizeAria: lang === "en" ? "Resize image width" : "이미지 너비 조절",
  resizeTitle: lang === "en" ? "Drag to resize width" : "드래그해 너비 조절",
  presetWidthAria: (preset: number) =>
    lang === "en" ? `Set width ${preset}px` : `이미지 너비 ${preset}px`,
  fullWidthAria: lang === "en" ? "Set width 100%" : "이미지 너비 100%",
  alignAria: (value: ImageAlignValue) => {
    if (lang === "en") return `Align image ${value}`
    if (value === "left") return "왼쪽 정렬"
    if (value === "center") return "가운데 정렬"
    return "오른쪽 정렬"
  },
  captionPlaceholder: lang === "en" ? "Caption / alt" : "캡션 / 대체 텍스트",
  captionAria: lang === "en" ? "Image caption" : "이미지 캡션",
})

export const getCodeChromeLabels = (lang: SiteLanguage) =>
  lang === "en"
    ? {
        languageAria: "Code language",
        copyText: "Copy",
        copiedText: "Copied",
        copyAria: "Copy code",
      }
    : {
        languageAria: "코드 언어",
        copyText: "복사",
        copiedText: "복사됨",
        copyAria: "코드 복사",
      }

export const getTableLabels = (lang: SiteLanguage) =>
  lang === "en"
    ? {
        imeProxyAria: "Table cell input proxy",
        cellEditorAria: "Edit table cell",
        toolbarAria: "Table quick edit toolbar",
        headerRowShort: "Header row",
        headerRowAria: "Toggle header row highlight",
        headerColShort: "Header col",
        headerColAria: "Toggle header column highlight",
        fitWidthShort: "Fit width",
        fitWidthAria: "Toggle page width table",
        alignLeftAria: "Align table column left",
        alignCenterAria: "Align table column center",
        alignRightAria: "Align table column right",
        insertRowAboveAria: "Insert row above",
        insertRowBelowAria: "Insert row below",
        moveRowUpAria: "Move row up",
        moveRowDownAria: "Move row down",
        duplicateRowAria: "Duplicate row",
        clearRowAria: "Clear row contents",
        deleteRowAria: "Delete row",
        insertColLeftAria: "Insert column left",
        insertColRightAria: "Insert column right",
        moveColLeftAria: "Move column left",
        moveColRightAria: "Move column right",
        duplicateColAria: "Duplicate column",
        clearColAria: "Clear column contents",
        deleteColAria: "Delete column",
        editSourceAria: "Edit table Markdown source",
        deleteTableAria: "Delete table",
        selectColAria: (col: number) => `Select and move column ${col + 1}`,
        selectHeaderRowAria: "Select header row",
        selectRowAria: (rowIdx: number) => `Select and move row ${rowIdx + 1}`,
        addColAria: "Add new column on the right",
        addRowAria: "Add new row below",
        addRowButtonLabel: "Add row",
        addCornerAria: "Add row and column",
        colResizerAria: (colIndex: number) => `Resize column ${colIndex + 1} width`,
      }
    : {
        imeProxyAria: "표 셀 입력 대리자",
        cellEditorAria: "표 셀 편집",
        toolbarAria: "표 빠른 편집 도구",
        headerRowShort: "제목행",
        headerRowAria: "표 제목 행 강조 전환",
        headerColShort: "제목열",
        headerColAria: "표 제목 열 강조 전환",
        fitWidthShort: "너비맞춤",
        fitWidthAria: "표 페이지 너비 맞춤 전환",
        alignLeftAria: "표 열 왼쪽 정렬",
        alignCenterAria: "표 열 가운데 정렬",
        alignRightAria: "표 열 오른쪽 정렬",
        insertRowAboveAria: "표 위에 행 추가",
        insertRowBelowAria: "표 아래에 행 추가",
        moveRowUpAria: "표 행 위로 이동",
        moveRowDownAria: "표 행 아래로 이동",
        duplicateRowAria: "표 행 복제",
        clearRowAria: "표 행 내용 비우기",
        deleteRowAria: "표 행 삭제",
        insertColLeftAria: "표 왼쪽에 열 추가",
        insertColRightAria: "표 오른쪽에 열 추가",
        moveColLeftAria: "표 열 왼쪽으로 이동",
        moveColRightAria: "표 열 오른쪽으로 이동",
        duplicateColAria: "표 열 복제",
        clearColAria: "표 열 내용 비우기",
        deleteColAria: "표 열 삭제",
        editSourceAria: "표 마크다운 원본 편집",
        deleteTableAria: "표 삭제",
        selectColAria: (col: number) => `${col + 1}열 선택 및 이동`,
        selectHeaderRowAria: "제목 행 선택",
        selectRowAria: (rowIdx: number) => `${rowIdx + 1}행 선택 및 이동`,
        addColAria: "표 오른쪽에 새 열 추가",
        addRowAria: "표 아래에 새 행 추가",
        addRowButtonLabel: "새 행 추가",
        addCornerAria: "표 행과 열 동시 추가",
        colResizerAria: (colIndex: number) => `${colIndex + 1}열 너비 조절`,
      }
