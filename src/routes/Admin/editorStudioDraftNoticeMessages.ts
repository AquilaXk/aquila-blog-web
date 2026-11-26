import type { SiteLanguage } from "src/libs/language"

export type EditorDraftStaticNoticeKey =
  | "reloadLatestLoading"
  | "reloadLatestDone"
  | "revisionRestored"
  | "prepareNewPost"
  | "newPostReady"
  | "tempDraftLoaded"
  | "localSaveFailed"
  | "localReadFailed"
  | "localNotFound"
  | "localClearFailed"
  | "localCleared"
  | "localConflictPreserveFailed"
  | "localListReadFailed"
  | "localCandidateDiscardFailed"
  | "localListReadFailedKeepPost"

const STATIC_NOTICES: Record<EditorDraftStaticNoticeKey, { ko: string; en: string }> = {
  reloadLatestLoading: {
    ko: "현재 작성 내용을 임시글로 보관하고 서버 최신본을 불러오는 중입니다...",
    en: "Keeping current edits in a local draft and loading the latest server version...",
  },
  reloadLatestDone: {
    ko: "현재 작성 내용을 브라우저 임시글로 보관하고 서버 최신본을 불러왔습니다. 임시글 복구 카드에서 비교하거나 복구해 다시 저장할 수 있습니다.",
    en: "Saved current edits to a browser draft and loaded the latest server version. Compare or restore it from the draft recovery card.",
  },
  revisionRestored: {
    ko: "선택한 리비전으로 원고를 복원했습니다.",
    en: "Restored manuscript from the selected revision.",
  },
  prepareNewPost: {
    ko: "새 글을 준비하고 있습니다...",
    en: "Preparing a new post...",
  },
  newPostReady: {
    ko: "새 글을 시작할 수 있습니다.",
    en: "Ready to start a new post.",
  },
  tempDraftLoaded: {
    ko: "저장된 임시 저장본을 불러왔습니다.",
    en: "Loaded your saved server draft.",
  },
  localSaveFailed: {
    ko: "브라우저 임시저장에 실패했습니다. 현재 원고를 복사하거나 서버에 저장한 뒤 페이지를 닫아주세요.",
    en: "Failed to save browser draft. Copy your manuscript or save to the server before closing.",
  },
  localReadFailed: {
    ko: "브라우저 임시글을 읽지 못했습니다. 현재 원고와 선택한 초안은 유지됩니다.",
    en: "Failed to read browser draft. Your manuscript and selection are preserved.",
  },
  localNotFound: {
    ko: "저장된 브라우저 임시글이 없습니다.",
    en: "No saved browser draft found.",
  },
  localClearFailed: {
    ko: "브라우저 임시저장을 삭제하지 못했습니다. 현재 원고는 유지됩니다.",
    en: "Failed to clear browser draft. Your manuscript is preserved.",
  },
  localCleared: {
    ko: "브라우저 임시저장을 삭제했습니다.",
    en: "Cleared browser draft.",
  },
  localConflictPreserveFailed: {
    ko: "브라우저 임시저장에 실패해 서버 최신본을 불러오지 않았습니다. 현재 원고를 복사한 뒤 다시 시도해주세요.",
    en: "Could not back up locally, so the server latest version was not loaded. Copy your manuscript and retry.",
  },
  localListReadFailed: {
    ko: "브라우저 임시글 목록을 읽지 못했습니다. 현재 선택과 원고는 유지됩니다.",
    en: "Failed to read browser draft list. Your selection and manuscript are preserved.",
  },
  localCandidateDiscardFailed: {
    ko: "선택한 브라우저 임시글을 삭제하지 못했습니다. 초안과 원고는 유지됩니다.",
    en: "Failed to delete selected browser draft. Your draft and manuscript are preserved.",
  },
  localListReadFailedKeepPost: {
    ko: "브라우저 임시글 목록을 읽지 못했습니다. 현재 원고는 유지됩니다.",
    en: "Failed to read browser draft list. Your manuscript is preserved.",
  },
}

export const editorDraftNotice = (language: SiteLanguage, key: EditorDraftStaticNoticeKey): string =>
  STATIC_NOTICES[key][language]

export const editorDraftReloadLatestFailed = (language: SiteLanguage, detail: string): string =>
  language === "en"
    ? `Failed to reload latest server post: ${detail} Your current edits and local draft are preserved.`
    : `서버 최신본 다시 불러오기 실패: ${detail} 현재 작성 내용과 브라우저 임시저장은 유지됩니다.`

export const editorDraftLoadNewPostFailed = (language: SiteLanguage, detail: string): string =>
  language === "en" ? `Failed to prepare new post: ${detail}` : `새 글 불러오기 실패: ${detail}`

export const editorDraftLocalSaveDone = (language: SiteLanguage, slotLabel: string): string =>
  language === "en" ? `Saved browser draft (${slotLabel})` : `브라우저 임시저장 완료 (${slotLabel})`

export const editorDraftLocalRestored = (language: SiteLanguage, slotLabel: string): string =>
  language === "en"
    ? `Restored browser draft (${slotLabel}).`
    : `브라우저 임시글을 불러왔습니다 (${slotLabel}).`
