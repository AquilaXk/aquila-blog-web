export type EditorMode = "create" | "edit"

export type PublishActionType = "create" | "modify" | "temp"

import type { SiteLanguage } from "src/libs/language"
import type { PostVisibility } from "src/types"
import { adminT } from "./adminI18n"
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
  language = "ko",
}: {
  publishActionType: PublishActionType
  editorMode: EditorMode
  loadingKey: LoadingKey
  hasEditorMinimumFields: boolean
  hasPlaceholderIssue: boolean
  isTempDraftMode: boolean
  isMarkdownUploading?: boolean
  language?: SiteLanguage
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
        ? adminT("editorActionPublishSettings", language)
        : publishActionType === "modify"
          ? adminT("editorActionModifySettings", language)
          : adminT("editorActionNewPost", language),
    publishActionButtonText:
      publishActionType === "create"
        ? loadingKey === "writePost"
          ? adminT("editorActionPublishing", language)
          : adminT("editorActionPublish", language)
        : publishActionType === "modify"
          ? loadingKey === "modifyPost"
            ? adminT("editorActionUpdating", language)
            : adminT("editorActionUpdate", language)
          : loadingKey === "publishTempPost"
            ? adminT("editorActionCreating", language)
            : adminT("editorActionNewPost", language),
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
        ? adminT("editorActionOpenPublish", language)
        : isTempDraftMode
          ? adminT("editorActionNewPost", language)
          : adminT("editorActionOpenModify", language),
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
  language?: SiteLanguage
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
  language = "ko",
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
    ? adminT("editorStatusSaving", language)
    : hasEditorDraftContent
      ? isPersistedEditBaseline
        ? adminT("editorStatusSaved", language)
        : isAutoSavedCreateDraft
          ? adminT("editorStatusAutoSaved", language)
          : adminT("editorStatusUnsaved", language)
      : ""

  const isSavedState = isPersistedEditBaseline || isAutoSavedCreateDraft
  const tone =
    isSaving
      ? "loading"
      : (!isSaving && hasEditorDraftContent && isSavedState) || publishNoticeTone === "success"
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
