// 참조 구현: felixmosh/bull-board (MIT) — DLQ 실패 작업 조회 API
import { apiFetch } from "./client"

export type TaskDlqItem = {
  id: number
  uid: string
  taskType: string
  aggregateType: string
  aggregateId: number
  retryCount: number
  maxRetries: number
  errorMessage?: string | null
  createdAt: string
  modifiedAt: string
}

export type TaskDlqListResponse = {
  tasks: TaskDlqItem[]
}

export type TaskDlqListParams = {
  taskType?: string | null
  limit?: number
}

export const listTaskDlqItems = async (
  params: TaskDlqListParams = {},
  signal?: AbortSignal
): Promise<TaskDlqItem[]> => {
  const query = new URLSearchParams()
  if (params.taskType?.trim()) query.set("taskType", params.taskType.trim())
  if (typeof params.limit === "number" && params.limit > 0) {
    query.set("limit", String(params.limit))
  }
  const queryString = query.toString()
  const path = queryString
    ? `/system/api/v1/adm/tasks/dlq?${queryString}`
    : "/system/api/v1/adm/tasks/dlq"
  const response = await apiFetch<TaskDlqListResponse>(path, { signal })
  return response.tasks || []
}
