export type EditorMode = "create" | "edit"

export type PublishActionType = "create" | "modify" | "temp"

import type { PostVisibility } from "src/types"
export type { PostVisibility }

type LoadingKey = "" | "writePost" | "modifyPost" | "publishTempPost" | string

export type VisibilityFlags = {
  published: boolean
  listed: boolean
}

export const toVisibility = (published: boolean, listed: boolean): PostVisibility => {
  if (!published) return "PRIVATE"
  if (!listed) return "PUBLIC_UNLISTED"
  return "PUBLIC_LISTED"
}

export const toFlags = (visibility: PostVisibility): VisibilityFlags => {
  if (visibility === "PRIVATE") return { published: false, listed: false }
  if (visibility === "PUBLIC_UNLISTED") return { published: true, listed: false }
  return { published: true, listed: true }
}

export const derivePublishActionViewModel = ({
  publishActionType,
  editorMode,
  loadingKey,
  hasEditorMinimumFields,
  hasPlaceholderIssue,
  isTempDraftMode,
  isMarkdownUploading = false,
}: {
  publishActionType: PublishActionType
  editorMode: EditorMode
  loadingKey: LoadingKey
  hasEditorMinimumFields: boolean
  hasPlaceholderIssue: boolean
  isTempDraftMode: boolean
  isMarkdownUploading?: boolean
}) => {
  const publishActionTriggerDisabled =
    loadingKey === "writePost" ||
    loadingKey === "modifyPost" ||
    loadingKey === "publishTempPost" ||
    loadingKey === "postTemp" ||
    isMarkdownUploading

  return {
    publishActionTitle:
      publishActionType === "create"
        ? "발행 설정"
        : publishActionType === "modify"
          ? "수정 설정"
          : "새 글 작성",
    publishActionButtonText:
      publishActionType === "create"
        ? loadingKey === "writePost"
          ? "발행 중..."
          : "발행하기"
        : publishActionType === "modify"
          ? loadingKey === "modifyPost"
            ? "반영 중..."
            : "변경 반영"
          : loadingKey === "publishTempPost"
            ? "작성 중..."
            : "새 글 작성",
    publishActionButtonDisabled:
      isPublishActionDisabled({
        publishActionType,
        editorMode,
        loadingKey,
        hasEditorMinimumFields,
        hasPlaceholderIssue,
      }) || isMarkdownUploading,
    publishActionTriggerDisabled,
    mobilePrimaryActionLabel:
      editorMode === "create"
        ? "발행 설정 열기"
        : isTempDraftMode
          ? "새 글 작성"
          : "수정 설정 열기",
    mobilePrimaryActionDisabled: publishActionTriggerDisabled,
  }
}

export type EditorPersistenceStateParams = {
  editorMode: EditorMode
  hasSelectedManagedPost: boolean
  hasEditorDraftContent: boolean
  editorStateFingerprint: string
  serverBaselineFingerprint: string
  localDraftFingerprint: string
  localDraftSavedAt: string
  loadingKey: LoadingKey
  publishNoticeTone?: "idle" | "loading" | "success" | "error"
}

export const deriveEditorPersistenceState = ({
  editorMode,
  hasSelectedManagedPost,
  hasEditorDraftContent,
  editorStateFingerprint,
  serverBaselineFingerprint,
  localDraftFingerprint,
  localDraftSavedAt,
  loadingKey,
  publishNoticeTone = "idle",
}: EditorPersistenceStateParams) => {
  const isSaving =
    loadingKey === "writePost" || loadingKey === "modifyPost" || loadingKey === "publishTempPost"
  const isPersistedEditBaseline =
    editorMode === "edit" &&
    hasSelectedManagedPost &&
    editorStateFingerprint === serverBaselineFingerprint
  const isAutoSavedCreateDraft =
    editorMode === "create" &&
    editorStateFingerprint === localDraftFingerprint &&
    Boolean(localDraftSavedAt)

  const text = isSaving
    ? "저장 중"
    : hasEditorDraftContent
      ? isPersistedEditBaseline
        ? "저장됨"
        : isAutoSavedCreateDraft
          ? "자동 저장됨"
          : "저장되지 않은 변경"
      : ""

  const tone =
    isSaving
      ? "loading"
      : text === "저장됨" || text === "자동 저장됨" || publishNoticeTone === "success"
        ? "success"
        : "idle"

  return {
    text,
    tone,
    isPersistedEditBaseline,
    isAutoSavedCreateDraft,
  }
}

export const isPublishActionDisabled = ({
  publishActionType,
  editorMode,
  loadingKey,
  hasEditorMinimumFields,
  hasPlaceholderIssue,
}: {
  publishActionType: PublishActionType
  editorMode: EditorMode
  loadingKey: LoadingKey
  hasEditorMinimumFields: boolean
  hasPlaceholderIssue: boolean
}) => {
  if (!hasEditorMinimumFields || hasPlaceholderIssue) return true

  if (publishActionType === "create") {
    return editorMode !== "create" || loadingKey === "writePost"
  }

  if (publishActionType === "modify") {
    return editorMode !== "edit" || loadingKey === "modifyPost"
  }

  return editorMode !== "edit" || loadingKey === "publishTempPost"
}
