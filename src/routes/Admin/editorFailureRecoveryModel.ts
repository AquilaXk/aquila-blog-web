import { ApiError, ApiNetworkError, ApiTimeoutError } from "src/apis/backend/client"
import type { SiteLanguage } from "src/libs/language"

export type EditorFailureAction = "write" | "modify" | "publish-temp"
export type EditorUploadFailureKind = "image" | "file" | "thumbnail"
export type EditorFailureType =
  | "version-conflict"
  | "offline"
  | "timeout"
  | "session-expired"
  | "too-large"
  | "rate-limited"
  | "server-error"
  | "unknown"

export type EditorFailureRecovery = {
  statusText: string
  result: {
    errorType: EditorFailureType
    message: string
    draftProtected: true
    canRetry: boolean
    nextActions: string[]
    status?: number
    fileName?: string
  }
}

type ResolveEditorFailureRecoveryParams = {
  action: EditorFailureAction
  isOnline?: boolean
  language?: SiteLanguage
}

type ResolveEditorUploadFailureRecoveryParams = {
  kind: EditorUploadFailureKind
  fileName: string
  isOnline?: boolean
  language?: SiteLanguage
}

const ACTION_LABELS: Record<SiteLanguage, Record<EditorFailureAction, string>> = {
  ko: {
    write: "작성",
    modify: "수정",
    "publish-temp": "새 글 작성",
  },
  en: {
    write: "Create",
    modify: "Update",
    "publish-temp": "Publish post",
  },
}

const UPLOAD_LABELS: Record<SiteLanguage, Record<EditorUploadFailureKind, string>> = {
  ko: {
    image: "이미지",
    file: "첨부 파일",
    thumbnail: "썸네일",
  },
  en: {
    image: "Image",
    file: "Attachment",
    thumbnail: "Cover",
  },
}

const PRESERVE_DRAFT_ACTION: Record<SiteLanguage, string> = {
  ko: "현재 내용을 로컬 임시저장으로 보존",
  en: "Keep current content in a local draft",
}

const RETRY_ACTION: Record<SiteLanguage, string> = {
  ko: "네트워크와 상태를 확인한 뒤 다시 시도",
  en: "Check your network and status, then try again",
}

const isBrowserOffline = (isOnline: boolean | undefined) => isOnline === false

const isFetchTransportError = (error: unknown) =>
  error instanceof ApiNetworkError ||
  (error instanceof TypeError &&
    /failed to fetch|networkerror|load failed|fetch/i.test(error.message))

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message.trim()
  return String(error || "").trim()
}

const getStatusFromMessage = (message: string) => {
  const statusMatch = message.match(/(?:^|[^\d])([45]\d{2})(?:[^\d]|$)/)
  if (!statusMatch) return undefined
  return Number(statusMatch[1])
}

const getStatus = (error: unknown) => {
  if (error instanceof ApiError) return error.status
  return getStatusFromMessage(getErrorMessage(error))
}

const classifyEditorFailure = (
  error: unknown,
  isOnline: boolean | undefined,
): { type: EditorFailureType; status?: number } => {
  if (isBrowserOffline(isOnline) || isFetchTransportError(error)) return { type: "offline" }
  if (error instanceof ApiTimeoutError) return { type: "timeout" }

  const status = getStatus(error)
  if (status === 409) return { type: "version-conflict", status }
  if (status === 401) return { type: "session-expired", status }
  if (status === 413) return { type: "too-large", status }
  if (status === 429) return { type: "rate-limited", status }
  if (typeof status === "number" && status >= 500) return { type: "server-error", status }

  return { type: "unknown", status }
}

const appendOriginalMessage = (message: string, originalMessage: string) => {
  if (!originalMessage || message.includes(originalMessage)) return message
  return `${message} ${originalMessage}`
}

const FAILURE_MESSAGES: Record<SiteLanguage, Record<Exclude<EditorFailureType, "unknown">, string>> = {
  ko: {
    "version-conflict": "서버 최신본과 충돌했습니다. 작성 내용은 유지됩니다.",
    offline: "오프라인 상태라 서버에 연결하지 못했습니다. 작성 내용은 유지됩니다.",
    timeout: "응답이 지연되고 있습니다. 작성 내용은 유지됩니다.",
    "session-expired": "로그인 세션이 만료되었습니다. 작성 내용은 유지됩니다.",
    "too-large": "요청 또는 업로드 용량이 너무 큽니다. 작성 내용은 유지됩니다.",
    "rate-limited": "요청이 많아 제한되었습니다. 잠시 후 다시 시도해주세요. 작성 내용은 유지됩니다.",
    "server-error": "서버 오류로 요청을 완료하지 못했습니다. 작성 내용은 유지됩니다.",
  },
  en: {
    "version-conflict": "Conflicts with the latest server version. Your draft is preserved.",
    offline: "Cannot reach the server while offline. Your draft is preserved.",
    timeout: "The server response timed out. Your draft is preserved.",
    "session-expired": "Your login session expired. Your draft is preserved.",
    "too-large": "The request or upload exceeds the size limit. Your draft is preserved.",
    "rate-limited": "Too many requests. Wait a moment and try again. Your draft is preserved.",
    "server-error": "A server error prevented completion. Your draft is preserved.",
  },
}

const UNKNOWN_FAILURE_FALLBACK: Record<SiteLanguage, string> = {
  ko: "요청을 완료하지 못했습니다. 작성 내용은 유지됩니다.",
  en: "The request could not be completed. Your draft is preserved.",
}

const buildMessage = (type: EditorFailureType, originalMessage: string, language: SiteLanguage) =>
  type === "unknown" ? originalMessage || UNKNOWN_FAILURE_FALLBACK[language] : FAILURE_MESSAGES[language][type]

const buildDetailedMessage = (type: EditorFailureType, originalMessage: string, language: SiteLanguage) =>
  appendOriginalMessage(buildMessage(type, originalMessage, language), originalMessage)

const NEXT_ACTIONS_BY_LANGUAGE: Record<SiteLanguage, Record<EditorFailureType, readonly string[]>> = {
  ko: {
    "version-conflict": [
      PRESERVE_DRAFT_ACTION.ko,
      "서버 최신본을 다시 불러와 차이를 비교",
      "필요한 내용을 수동 병합한 뒤 다시 저장",
    ],
    "session-expired": [PRESERVE_DRAFT_ACTION.ko, "새 탭에서 다시 로그인한 뒤 이 탭으로 돌아와 저장"],
    "too-large": [PRESERVE_DRAFT_ACTION.ko, "이미지와 첨부 파일 용량을 줄인 뒤 다시 시도"],
    "rate-limited": [PRESERVE_DRAFT_ACTION.ko, "잠시 후 같은 버튼으로 다시 시도"],
    "server-error": [PRESERVE_DRAFT_ACTION.ko, RETRY_ACTION.ko],
    offline: [PRESERVE_DRAFT_ACTION.ko, "연결이 복구되면 같은 버튼으로 다시 시도"],
    timeout: [PRESERVE_DRAFT_ACTION.ko, "중복 저장 여부를 확인한 뒤 같은 버튼으로 다시 시도"],
    unknown: [PRESERVE_DRAFT_ACTION.ko, RETRY_ACTION.ko],
  },
  en: {
    "version-conflict": [
      PRESERVE_DRAFT_ACTION.en,
      "Reload the latest server post and compare changes",
      "Merge any needed edits and save again",
    ],
    "session-expired": [PRESERVE_DRAFT_ACTION.en, "Sign in again in a new tab, then return here to save"],
    "too-large": [PRESERVE_DRAFT_ACTION.en, "Reduce image or attachment file sizes and try again"],
    "rate-limited": [PRESERVE_DRAFT_ACTION.en, "Try the same button again in a moment"],
    "server-error": [PRESERVE_DRAFT_ACTION.en, RETRY_ACTION.en],
    offline: [PRESERVE_DRAFT_ACTION.en, "Retry with the same button once connected"],
    timeout: [PRESERVE_DRAFT_ACTION.en, "Check whether it saved before retrying with the same button"],
    unknown: [PRESERVE_DRAFT_ACTION.en, RETRY_ACTION.en],
  },
}

const buildNextActions = (type: EditorFailureType, language: SiteLanguage): string[] => [
  ...NEXT_ACTIONS_BY_LANGUAGE[language][type],
]

const canRetryFailure = (type: EditorFailureType) => type !== "unknown"

const appendRequestIdDetail = (statusText: string, error: unknown, language: SiteLanguage) => {
  if (!(error instanceof ApiError) || !error.requestId) return statusText
  return language === "en" ? `${statusText} (Request ID: ${error.requestId})` : `${statusText} (요청 ID: ${error.requestId})`
}

export const resolveEditorFailureRecovery = (
  error: unknown,
  { action, isOnline, language = "ko" }: ResolveEditorFailureRecoveryParams,
): EditorFailureRecovery => {
  const { type, status } = classifyEditorFailure(error, isOnline)
  const actionLabel = ACTION_LABELS[language][action]
  const message = buildDetailedMessage(type, getErrorMessage(error), language)
  const nextActions = buildNextActions(type, language)
  const summaryPrefix =
    language === "en"
      ? `${actionLabel} failed: ${message} ${nextActions.join(" · ")}`
      : `${actionLabel} 실패: ${message} ${nextActions.join(" · ")}`

  return {
    statusText: appendRequestIdDetail(summaryPrefix, error, language),
    result: {
      errorType: type,
      message,
      draftProtected: true,
      canRetry: canRetryFailure(type),
      nextActions,
      ...(typeof status === "number" ? { status } : {}),
    },
  }
}

export const resolveEditorUploadFailureRecovery = (
  error: unknown,
  { kind, fileName, isOnline, language = "ko" }: ResolveEditorUploadFailureRecoveryParams,
): EditorFailureRecovery => {
  const { type, status } = classifyEditorFailure(error, isOnline)
  const uploadLabel = UPLOAD_LABELS[language][kind]
  const message = buildDetailedMessage(type, getErrorMessage(error), language)
  const nextActions = buildNextActions(type, language)
  const summaryPrefix =
    language === "en"
      ? `${uploadLabel} upload failed for "${fileName}". ${message} ${nextActions.join(" · ")} You can try again.`
      : `${uploadLabel} 업로드 실패: "${fileName}" 파일별 실패 상태입니다. ${message} ${nextActions.join(" · ")} 다시 시도할 수 있습니다.`

  return {
    statusText: appendRequestIdDetail(summaryPrefix, error, language),
    result: {
      errorType: type,
      message,
      draftProtected: true,
      canRetry: canRetryFailure(type),
      nextActions,
      fileName,
      ...(typeof status === "number" ? { status } : {}),
    },
  }
}
