import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import { ApiError, apiFetch } from "src/apis/backend/client"
import { createSecureRandomUuid } from "src/libs/security/secureRandomUuid"
import {
  applyThumbnailTransformToUrl,
  DEFAULT_THUMBNAIL_FOCUS_X,
  DEFAULT_THUMBNAIL_FOCUS_Y,
  DEFAULT_THUMBNAIL_ZOOM,
} from "src/libs/thumbnailFocus"
import {
  isServerTempDraftPost,
  TEMP_DRAFT_BODY_PLACEHOLDER,
} from "./editorTempDraft"
import type {
  PostVisibility,
} from "./editorStudioState"
import type {
  ResolvedEditorMetaSnapshot,
} from "./editorStudioMetaModel"
import type {
  ApiEditorPostDto,
  ApiPostModifyRequest,
  ApiPostWriteRequest,
} from "src/apis/backend/posts/PostApiDtos"
import { normalizeCanonicalSummary } from "src/apis/backend/posts/PostApiMappers"

export const MARKDOWN_EDITOR_MERMAID_ENABLED = process.env.NEXT_PUBLIC_EDITOR_V2_MERMAID_ENABLED !== "false"
export const ADMIN_POSTS_WORKSPACE_ROUTE = "/admin/posts"
export const EDITOR_NEW_ROUTE_PATH = "/admin/editor/new"

export const toEditorPostRoute = (id: string | number) => `/admin/editor/${encodeURIComponent(String(id))}`

export { extractImageFileFromClipboard } from "src/components/markdown-editor/markdownEditorPasteDropModel"

export const normalizeEditorReturnRoute = (value: string) => {
  const normalized = value.trim()
  if (!normalized.startsWith("/") || normalized.startsWith("//") || normalized.startsWith("/\\")) return ""
  if (/[\r\n]/.test(normalized)) return ""
  if (/^\/(?:https?:|javascript:)/i.test(normalized)) return ""
  if (normalized.startsWith("/admin/editor")) return ""
  return normalized
}

export type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null

export type PostForEditor = ApiEditorPostDto & {
  id: number
  title: string
  content: string
  published: boolean
  listed: boolean
}

export type SummaryIntent =
  | { kind: "unchanged" }
  | { kind: "manual"; summary: string }
  | { kind: "auto" }

export type CanonicalSummaryState = {
  summary: string
  summarySource: NonNullable<ApiEditorPostDto["summarySource"]>
  intent: SummaryIntent
}

export const toCreateSummaryWriteFields = (
  intent: SummaryIntent,
): Pick<ApiPostWriteRequest, "summaryMode" | "summary"> => {
  if (intent.kind === "unchanged") {
    throw new Error("create summary intent must be AUTO or MANUAL")
  }
  if (intent.kind === "manual") return { summaryMode: "MANUAL", summary: intent.summary }
  return { summaryMode: "AUTO", summary: null }
}

export const toModifySummaryWriteFields = (
  intent: SummaryIntent,
): Pick<ApiPostModifyRequest, "summaryMode" | "summary"> => {
  if (intent.kind === "unchanged") return { summaryMode: null, summary: null }
  return toCreateSummaryWriteFields(intent)
}

const resolveCanonicalSummaryResult = (
  current: CanonicalSummaryState,
  response: unknown,
  intent: SummaryIntent,
): { ok: true; state: CanonicalSummaryState } | { ok: false; state: CanonicalSummaryState } => {
  if (response == null || typeof response !== "object") return { ok: false, state: current }
  const { summary, source } = response as { summary?: unknown; source?: unknown }
  try {
    const normalized = normalizeCanonicalSummary({ summary, summarySource: source })
    return {
      ok: true,
      state: {
        summary: normalized.summary,
        summarySource: normalized.summarySource,
        intent,
      },
    }
  } catch {
    return { ok: false, state: current }
  }
}

export const resolvePersistedSummaryResult = (current: CanonicalSummaryState, response: unknown) =>
  resolveCanonicalSummaryResult(current, response, { kind: "unchanged" })

const isSameCanonicalSummaryState = (left: CanonicalSummaryState, right: CanonicalSummaryState) =>
  left.summary === right.summary &&
  left.summarySource === right.summarySource &&
  left.intent.kind === right.intent.kind &&
  (left.intent.kind !== "manual" ||
    (right.intent.kind === "manual" && left.intent.summary === right.intent.summary))

export const resolveSummaryWriteCompletion = (
  request: CanonicalSummaryState,
  response: unknown,
  current: CanonicalSummaryState,
) => {
  const resolved = resolvePersistedSummaryResult(request, response)
  if (!resolved.ok) return resolved

  return {
    ...resolved,
    editorState: isSameCanonicalSummaryState(request, current) ? resolved.state : current,
  }
}

import type { RsData } from "src/types"
export type { RsData }

export type NoticeTone = "idle" | "loading" | "success" | "error"
export type NoticeState = {
  tone: NoticeTone
  text: string
}

const PROFILE_IMAGE_UPLOAD_RETRY_DELAY_MS = 700
const IMAGE_UPLOAD_CONFLICT_MAX_RETRIES = 3
const EDITOR_BODY_PLACEHOLDER = "내용을 입력하세요."

export const syncTitleTextareaHeight = (element: HTMLTextAreaElement | null) => {
  if (!element) return
  element.style.height = "0px"
  element.style.height = `${Math.max(element.scrollHeight, 44)}px`
}

const isTempDraftBodyPlaceholder = (value: string) => {
  const normalized = value.replace(/\r\n?/g, "\n").trim()
  return normalized === TEMP_DRAFT_BODY_PLACEHOLDER || normalized === EDITOR_BODY_PLACEHOLDER
}

export const isBlankServerTempDraft = (
  post: Pick<PostForEditor, "title" | "published" | "listed" | "tempDraft">,
  snapshot: ResolvedEditorMetaSnapshot
) => isServerTempDraftPost(post) && isTempDraftBodyPlaceholder(snapshot.body)

export const buildEmptyEditorMetaSnapshot = (): ResolvedEditorMetaSnapshot => ({
  body: "",
  tags: [],
  category: "",
  thumbnailUrl: "",
  thumbnailFocusX: DEFAULT_THUMBNAIL_FOCUS_X,
  thumbnailFocusY: DEFAULT_THUMBNAIL_FOCUS_Y,
  thumbnailZoom: DEFAULT_THUMBNAIL_ZOOM,
})

export const PUBLISH_VISIBILITY_OPTIONS: Array<{
  value: PostVisibility
  label: string
  description: string
}> = [
  {
    value: "PUBLIC_LISTED",
    label: "전체 공개",
    description: "메인 목록과 검색에 노출됩니다.",
  },
  {
    value: "PUBLIC_UNLISTED",
    label: "링크 공개",
    description: "URL을 아는 사람만 볼 수 있습니다.",
  },
  {
    value: "PRIVATE",
    label: "비공개",
    description: "관리자만 확인합니다.",
  },
]

export const pretty = (value: unknown) => JSON.stringify(value, null, 2)

export const isComposingKeyboardEvent = (
  event: ReactKeyboardEvent<HTMLElement>
) => {
  const nativeEvent = event.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number }
  return nativeEvent.isComposing === true || nativeEvent.keyCode === 229
}

export const generateIdempotencyKey = () => createSecureRandomUuid()

const EDITOR_RUNTIME_GUARD_SAMPLE_LIMIT = 240

type RuntimeGuardWindow = Window & {
  __AQ_RUNTIME_GUARD_ENABLED__?: boolean
  __AQ_RUNTIME_GUARD__?: {
    editorCommitSamples?: number[]
  }
}

export const recordEditorCommitDurationForRuntimeGuard = (actualDuration: number) => {
  if (typeof window === "undefined" || !Number.isFinite(actualDuration) || actualDuration <= 0) return
  const runtimeWindow = window as RuntimeGuardWindow
  if (!runtimeWindow.__AQ_RUNTIME_GUARD_ENABLED__) return

  const store = (runtimeWindow.__AQ_RUNTIME_GUARD__ ??= {})
  const nextSamples = [...(store.editorCommitSamples ?? []), actualDuration]
  if (nextSamples.length > EDITOR_RUNTIME_GUARD_SAMPLE_LIMIT) {
    nextSamples.splice(0, nextSamples.length - EDITOR_RUNTIME_GUARD_SAMPLE_LIMIT)
  }
  store.editorCommitSamples = nextSamples
}

const waitFor = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })

const computeConflictRetryDelay = (attempt: number): number =>
  PROFILE_IMAGE_UPLOAD_RETRY_DELAY_MS * Math.max(1, attempt + 1)

const TEMP_POST_CONFLICT_MAX_RETRIES = 2

const throwResponseAsApiError = async (response: Response): Promise<never> => {
  const body = await response.text().catch(() => "")
  throw new ApiError(response.status, response.url, body)
}

export const requestTempPostWithConflictRetry = async (
  resolveExistingTempPost: () => Promise<PostForEditor | null>,
  maxRetries: number = TEMP_POST_CONFLICT_MAX_RETRIES
): Promise<RsData<PostForEditor>> => {
  let lastConflictError: ApiError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await apiFetch<RsData<PostForEditor>>("/post/api/v1/posts/temp", {
        method: "POST",
      })
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) {
        throw error
      }

      lastConflictError = error
      if (attempt < maxRetries) {
        await waitFor(computeConflictRetryDelay(attempt))
        continue
      }
    }
  }

  const recoveredTempPost = await resolveExistingTempPost()
  if (recoveredTempPost) {
    return {
      resultCode: "200-1",
      msg: "기존 임시저장 글을 불러옵니다.",
      data: recoveredTempPost,
    }
  }

  throw lastConflictError ?? new ApiError(409, "/post/api/v1/posts/temp", "")
}

export const uploadWithConflictRetry = async (
  requestUpload: () => Promise<Response>,
  maxRetries: number = IMAGE_UPLOAD_CONFLICT_MAX_RETRIES
): Promise<Response> => {
  let lastConflictError: ApiError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await requestUpload()
    if (response.status !== 409) {
      if (!response.ok) {
        await throwResponseAsApiError(response)
      }
      return response
    }

    const body = await response.text().catch(() => "")
    lastConflictError = new ApiError(409, response.url, body)
    if (attempt >= maxRetries) {
      throw lastConflictError
    }

    await waitFor(computeConflictRetryDelay(attempt))
  }

  throw lastConflictError ?? new ApiError(409, "", "")
}

export const buildEffectiveThumbnailUrl = ({
  postThumbnailFocusX,
  postThumbnailFocusY,
  postThumbnailZoom,
  resolvedPreviewThumbnail,
}: {
  postThumbnailFocusX: number
  postThumbnailFocusY: number
  postThumbnailZoom: number
  resolvedPreviewThumbnail: string
}) => {
  const normalizedThumbnail = resolvedPreviewThumbnail.trim()
  if (!normalizedThumbnail) return ""
  return applyThumbnailTransformToUrl(normalizedThumbnail, {
    focusX: postThumbnailFocusX,
    focusY: postThumbnailFocusY,
    zoom: postThumbnailZoom,
  })
}
