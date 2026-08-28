import { useCallback } from "react"
import { apiFetch } from "src/apis/backend/client"

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null

type RunStudioCommand = (key: string, fn: () => Promise<JsonValue>) => Promise<void>

type UseEditorStudioUtilityCommandsParams = {
  postId: string
  run: RunStudioCommand
}

export const useEditorStudioUtilityCommands = ({
  postId,
  run,
}: UseEditorStudioUtilityCommandsParams) => {
  const handleReadPostCount = useCallback(() => {
    void run("admPostCount", () => apiFetch("/post/api/v1/adm/posts/count"))
  }, [run])

  const handleReadSystemHealth = useCallback(() => {
    void run("systemHealth", () => apiFetch("/system/api/v1/adm/health"))
  }, [run])

  const handleHitPost = useCallback(() => {
    void run("hitPost", () => apiFetch(`/post/api/v1/posts/${postId}/hit`, { method: "POST" }))
  }, [postId, run])

  return {
    handleHitPost,
    handleReadPostCount,
    handleReadSystemHealth,
  }
}
