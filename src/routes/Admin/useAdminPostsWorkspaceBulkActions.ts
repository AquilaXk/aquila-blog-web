// 참조 구현: payloadcms/payload (MIT) & TryGhost/Ghost (MIT) — 글 목록 벌크 다중 선택 및 원자적 일괄 작업 훅
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { invalidatePublicPostReadCaches } from "src/apis/backend/posts"
import {
  addItemsToSet,
  buildRowIndexMap,
  computeShiftSelectionRange,
  executeBulkPostAction,
  toggleItemInSet,
  type BulkActionKind,
} from "./adminPostsWorkspaceBulkModel"
import type { AdminPostListItem, WorkspaceConfirmState, WorkspaceToastState } from "./AdminPostsWorkspaceModel"
import { revalidateSavedPost } from "./editorPostSaveRefresh"

type UseAdminPostsWorkspaceBulkActionsParams = {
  rows: readonly AdminPostListItem[]
  refreshWorkspaceLists: () => Promise<void>
  showToast: (toast: WorkspaceToastState) => void
  setConfirmState: (confirm: WorkspaceConfirmState) => void
  resetDependencies?: readonly unknown[]
}

export const useAdminPostsWorkspaceBulkActions = ({
  rows,
  refreshWorkspaceLists,
  showToast,
  setConfirmState,
  resetDependencies,
}: UseAdminPostsWorkspaceBulkActionsParams) => {
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [isBulkPending, setIsBulkPending] = useState(false)
  const lastSelectedRowIndexRef = useRef<number | null>(null)

  const rowIds = useMemo(() => rows.map((r) => r.id), [rows])
  const rowIndexMap = useMemo(() => buildRowIndexMap(rowIds), [rowIds])

  const currentPageSelectedCount = useMemo(() => {
    let count = 0
    for (const id of rowIds) {
      if (selectedIds.has(id)) count += 1
    }
    return count
  }, [rowIds, selectedIds])

  const isAllSelected = rowIds.length > 0 && currentPageSelectedCount === rowIds.length
  const isIndeterminate = currentPageSelectedCount > 0 && currentPageSelectedCount < rowIds.length

  const handleToggleRowSelect = useCallback(
    (rowId: number, shiftKey: boolean) => {
      const clickedIndex = rowIndexMap.get(rowId) ?? -1
      if (clickedIndex === -1) return

      if (shiftKey && lastSelectedRowIndexRef.current !== null) {
        const rangeIds = computeShiftSelectionRange(lastSelectedRowIndexRef.current, clickedIndex, rowIds)
        setSelectedIds((prev) => addItemsToSet(prev, rangeIds))
      } else {
        setSelectedIds((prev) => toggleItemInSet(prev, rowId))
      }
      lastSelectedRowIndexRef.current = clickedIndex
    },
    [rowIds, rowIndexMap]
  )

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of rowIds) {
          next.delete(id)
        }
        return next
      })
    } else {
      setSelectedIds((prev) => addItemsToSet(prev, rowIds))
    }
  }, [isAllSelected, rowIds])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
    lastSelectedRowIndexRef.current = null
  }, [])

  // 페이지, 스코프, 필터, 검색어 등 변경 시 보이지 않는 이전 페이지 글 오삭제 방지를 위해 선택 자동 초기화
  useEffect(() => {
    if (resetDependencies && resetDependencies.length > 0) {
      handleClearSelection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDependencies ?? [])

  const executeBulk = useCallback(
    async (action: BulkActionKind, idsToProcess: number[]) => {
      if (idsToProcess.length === 0) return
      setIsBulkPending(true)
      try {
        const result = await executeBulkPostAction(action, idsToProcess)
        await invalidatePublicPostReadCaches(queryClient).catch(() => undefined)
        const revalidatedIds = result.ids && result.ids.length > 0 ? result.ids : idsToProcess
        await Promise.all(
          revalidatedIds.map((id) => revalidateSavedPost(id).catch(() => undefined))
        )
        await refreshWorkspaceLists()
        handleClearSelection()
        showToast({
          tone: "success",
          text: `${result.processedCount}개의 글에 일괄 작업을 적용했습니다.`,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        showToast({ tone: "error", text: `일괄 작업 실패: ${message}` })
      } finally {
        setIsBulkPending(false)
      }
    },
    [handleClearSelection, queryClient, refreshWorkspaceLists, showToast]
  )

  const handleBulkAction = useCallback(
    async (action: BulkActionKind) => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) return

      if (action === "HARD_DELETE") {
        setConfirmState({
          kind: "bulkHardDelete",
          rowId: ids[0]!,
          rowTitle: `${ids.length}개의 글`,
          headline: "선택한 글을 모두 영구삭제할까요?",
          description: `선택한 ${ids.length}개의 글은 영구삭제 후 복구할 수 없습니다.`,
          confirmLabel: `선택한 ${ids.length}개 영구삭제`,
          tone: "danger",
        })
        return
      }

      await executeBulk(action, ids)
    },
    [executeBulk, selectedIds, setConfirmState]
  )

  const handleConfirmBulkHardDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    await executeBulk("HARD_DELETE", ids)
  }, [executeBulk, selectedIds])

  return {
    selectedIds,
    isAllSelected,
    isIndeterminate,
    isBulkPending,
    handleToggleRowSelect,
    handleToggleSelectAll,
    handleClearSelection,
    handleBulkAction,
    handleConfirmBulkHardDelete,
  }
}
