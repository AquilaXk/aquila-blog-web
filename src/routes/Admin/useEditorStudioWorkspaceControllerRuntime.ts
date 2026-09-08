import type { QueryClient } from "@tanstack/react-query"
import {
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react"
import { invalidatePublicPostReadCaches } from "src/apis/backend/posts"
import { revalidateSavedPost } from "./editorPostSaveRefresh"
import {
  isComposingKeyboardEvent,
  pretty,
  syncTitleTextareaHeight,
  type JsonValue,
  type NoticeState,
} from "./EditorStudioWorkspaceControllerRootModel"
import type { EditorMode, PublishActionType } from "./editorStudioState"
import type { MarkdownEditorFocusRequest } from "src/components/markdown-editor/MarkdownEditor"

type PublishNoticeTarget = "auto" | "page" | "modal"

const markdownEditorFocusRequestRef: { current: MarkdownEditorFocusRequest | null } = { current: null }

/** Bound from WriterEditorHost without threading through Root.tsx props. */
export const handleMarkdownEditorFocusRequestReady = (focus: MarkdownEditorFocusRequest | null) => {
  markdownEditorFocusRequestRef.current = focus
}

export const requestMarkdownEditorFocus = (selection?: { from: number; to: number }) => {
  markdownEditorFocusRequestRef.current?.(selection)
}

type UseEditorStudioWorkspaceControllerRuntimeArgs = {
  isPublishModalOpen: boolean
  loadingKey: string
  postId: string
  postTitle: string
  queryClient: QueryClient
  setEditorMode: Dispatch<SetStateAction<EditorMode>>
  setGlobalNotice: Dispatch<SetStateAction<NoticeState>>
  setIsTempDraftMode: Dispatch<SetStateAction<boolean>>
  setLoadingKey: Dispatch<SetStateAction<string>>
  setPostId: Dispatch<SetStateAction<string>>
  setPostTitle: Dispatch<SetStateAction<string>>
  setPostVersion: Dispatch<SetStateAction<number | null>>
  setPublishModalNotice: Dispatch<SetStateAction<NoticeState>>
  setPublishNotice: Dispatch<SetStateAction<NoticeState>>
  setResult: Dispatch<SetStateAction<string>>
}

export const useEditorStudioWorkspaceControllerRuntime = ({
  isPublishModalOpen,
  loadingKey,
  postId,
  postTitle,
  queryClient,
  setEditorMode,
  setGlobalNotice,
  setIsTempDraftMode,
  setLoadingKey,
  setPostId,
  setPostTitle,
  setPostVersion,
  setPublishModalNotice,
  setPublishNotice,
  setResult,
}: UseEditorStudioWorkspaceControllerRuntimeArgs) => {
  const titleFieldRef = useRef<HTMLTextAreaElement | null>(null)

  const refreshPublicPostReadViews = useCallback(async (affectedPostId?: string | number) => {
    const resolvedPostId =
      typeof affectedPostId === "number"
        ? affectedPostId
        : typeof affectedPostId === "string"
          ? affectedPostId.trim()
          : postId.trim()

    await invalidatePublicPostReadCaches(queryClient, resolvedPostId || undefined)
    if (!resolvedPostId) return

    await revalidateSavedPost(resolvedPostId)
  }, [postId, queryClient])

  const run = useCallback(async (key: string, fn: () => Promise<JsonValue>) => {
    try {
      setLoadingKey(key)
      setGlobalNotice({ tone: "loading", text: `작업 실행 중: ${key}` })
      const data = await fn()
      setResult(pretty(data))
      setGlobalNotice({ tone: "success", text: `작업 완료: ${key}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setResult(pretty({ error: message }))
      setGlobalNotice({ tone: "error", text: `작업 실패: ${message}` })
    } finally {
      setLoadingKey("")
    }
  }, [setGlobalNotice, setLoadingKey, setResult])

  const disabled = useCallback((key: string) => loadingKey.length > 0 && loadingKey !== key, [loadingKey])

  const handleTitleFieldRef = useCallback((node: HTMLTextAreaElement | null) => {
    titleFieldRef.current = node
    syncTitleTextareaHeight(node)
  }, [])

  const handleTitleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setPostTitle(event.target.value.replace(/\r\n?/g, "\n"))
    syncTitleTextareaHeight(event.target)
  }, [setPostTitle])

  const handleTitleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposingKeyboardEvent(event)) return
    if (event.key === "Enter") {
      event.preventDefault()
      markdownEditorFocusRequestRef.current?.()
    }
  }, [])

  useEffect(() => {
    syncTitleTextareaHeight(titleFieldRef.current)
  }, [postTitle])

  const handleSelectedPostIdChange = useCallback(
    (nextPostId: string) => {
      const normalizedPostId = nextPostId.trim()
      setPostId(normalizedPostId)
      if (normalizedPostId !== postId.trim()) {
        setEditorMode("create")
        setPostVersion(null)
        setIsTempDraftMode(false)
      }
    },
    [postId, setEditorMode, setIsTempDraftMode, setPostId, setPostVersion]
  )

  const publishModalHintByAction = useCallback((actionType: PublishActionType): string => {
    if (actionType === "create") return "작성 전 확인이 필요한 항목만 이곳에 표시됩니다."
    if (actionType === "modify") return "수정 전 확인이 필요한 항목만 이곳에 표시됩니다."
    return "새 글 작성 전 확인이 필요한 항목만 이곳에 표시됩니다."
  }, [])

  const setPublishStatus = useCallback(
    (next: NoticeState, target: PublishNoticeTarget = "auto") => {
      setGlobalNotice(next)
      if (target === "page") {
        setPublishNotice(next)
        return
      }

      if (target === "modal") {
        setPublishModalNotice(next)
        return
      }

      if (isPublishModalOpen) {
        setPublishModalNotice(next)
        return
      }

      setPublishNotice(next)
    },
    [isPublishModalOpen, setGlobalNotice, setPublishModalNotice, setPublishNotice]
  )

  return {
    disabled,
    handleSelectedPostIdChange,
    handleTitleChange,
    handleTitleFieldRef,
    handleTitleKeyDown,
    publishModalHintByAction,
    refreshPublicPostReadViews,
    run,
    setPublishStatus,
  }
}
