// 참조 구현: payloadcms/payload packages/ui/src/elements/ListSelection/ (MIT) & TryGhost/Ghost apps/admin/src/posts/list/posts-list-screen.tsx (MIT)
import { apiFetch } from "src/apis/backend/client"

export type BulkActionKind =
  | "PUBLISH_LISTED"
  | "PUBLISH_UNLISTED"
  | "UNPUBLISH_PRIVATE"
  | "DELETE"
  | "RESTORE"
  | "HARD_DELETE"

export const BULK_ACTION_MAX_LIMIT = 50
export const BULK_ACTION_LIMIT_EXCEEDED_MESSAGE = `한 번에 최대 ${BULK_ACTION_MAX_LIMIT}개의 글만 일괄 처리할 수 있습니다.`

export const isBulkSelectionOverLimit = (selectedCount: number): boolean =>
  selectedCount > BULK_ACTION_MAX_LIMIT

export type BulkActionPayload = {
  ids: number[]
  action: BulkActionKind
}

export type BulkActionResult = {
  processedCount: number
  ids?: number[]
  failedCount?: number
}

type BulkActionApiEnvelope =
  | BulkActionResult
  | {
      resultCode?: string
      msg?: string
      data?: BulkActionResult | null
    }

export const unwrapBulkActionResponse = (
  payload: BulkActionApiEnvelope | null | undefined,
  fallbackCount = 0
): BulkActionResult => {
  if (!payload || typeof payload !== "object") {
    return { processedCount: fallbackCount }
  }
  if ("data" in payload && payload.data && typeof payload.data === "object") {
    const count = payload.data.processedCount
    return {
      processedCount: typeof count === "number" && Number.isFinite(count) ? count : fallbackCount,
      ids: Array.isArray(payload.data.ids) ? payload.data.ids : undefined,
      failedCount: payload.data.failedCount,
    }
  }
  if ("processedCount" in payload && typeof payload.processedCount === "number" && Number.isFinite(payload.processedCount)) {
    return payload
  }
  return { processedCount: fallbackCount }
}

export const executeBulkPostAction = async (
  action: BulkActionKind,
  ids: readonly number[]
): Promise<BulkActionResult> => {
  const uniqueIds = Array.from(new Set(ids))
  if (uniqueIds.length === 0) {
    return { processedCount: 0 }
  }
  if (uniqueIds.length > BULK_ACTION_MAX_LIMIT) {
    throw new RangeError(
      `${BULK_ACTION_LIMIT_EXCEEDED_MESSAGE} (선택된 항목: ${uniqueIds.length}개)`
    )
  }

  const rawResponse = await apiFetch<BulkActionApiEnvelope>("/post/api/v1/adm/posts/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ids: uniqueIds,
      action,
    }),
  })

  return unwrapBulkActionResponse(rawResponse, uniqueIds.length)
}

export const buildRowIndexMap = (rowIds: readonly number[]): Map<number, number> => {
  const map = new Map<number, number>()
  for (let i = 0; i < rowIds.length; i += 1) {
    map.set(rowIds[i]!, i)
  }
  return map
}

export const computeShiftSelectionRange = (
  fromIndex: number,
  toIndex: number,
  rowIds: readonly number[]
): number[] => {
  if (rowIds.length === 0) return []
  const start = Math.max(0, Math.min(fromIndex, toIndex))
  const end = Math.min(rowIds.length - 1, Math.max(fromIndex, toIndex))
  const selected: number[] = []
  for (let i = start; i <= end; i += 1) {
    selected.push(rowIds[i]!)
  }
  return selected
}

export const toggleItemInSet = (set: ReadonlySet<number>, id: number): Set<number> => {
  const next = new Set(set)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
}

export const addItemsToSet = (set: ReadonlySet<number>, ids: readonly number[]): Set<number> => {
  const next = new Set(set)
  for (const id of ids) {
    next.add(id)
  }
  return next
}
