// 클라우드 워크스페이스 일괄 삭제(100개 청크)·이동·이름 변경 변경 훅
import type { QueryClient } from "@tanstack/react-query"
import { type Dispatch, type SetStateAction, useCallback } from "react"
import {
  bulkDeleteCloudFiles,
  deleteCloudFile,
  updateCloudFile,
  type CloudFile,
} from "src/apis/backend/cloud"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import {
  CLOUD_FILTERS,
  extractCloudFolders,
  updateCachedCloudFilesForMutation,
  type CloudMediaFilter,
} from "../AdminCloudWorkspaceModel"
import { normalizeCloudFolderPath } from "./cloudFolderHelpers"

const CLOUD_QUERY_KEY = "admin-cloud-files"
const CLOUD_FACETS_QUERY_KEY = "admin-cloud-facets"
const BULK_DELETE_CHUNK_SIZE = 100
const BOUNDED_MUTATION_CONCURRENCY = 4

const isCloudMediaFilter = (value: unknown): value is CloudMediaFilter =>
  CLOUD_FILTERS.some((item) => item.value === value)

const getCachedCloudQueryFilters = (queryKey: readonly unknown[]) => ({
  filter: isCloudMediaFilter(queryKey[1]) ? queryKey[1] : ("ALL" as CloudMediaFilter),
  keyword: typeof queryKey[2] === "string" ? queryKey[2] : "",
  folderPath: typeof queryKey[3] === "string" ? queryKey[3] : "",
})

const runBoundedSettled = async <T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> => {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length)
  let nextIndex = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const currentIdx = nextIndex
      nextIndex += 1
      if (currentIdx >= items.length) break
      try {
        const value = await worker(items[currentIdx]!)
        results[currentIdx] = { status: "fulfilled", value }
      } catch (reason) {
        results[currentIdx] = { status: "rejected", reason }
      }
    }
  })
  await Promise.all(runners)
  return results
}

const resolveBulkDeleteFailureMessage = (
  deletedCount: number,
  failedCount: number,
  isEn: boolean,
  firstFailure?: PromiseRejectedResult
): string => {
  if (deletedCount > 0) {
    return isEn
      ? `Deleted ${deletedCount}, failed ${failedCount}`
      : `${deletedCount}개 삭제 완료, ${failedCount}개 실패`
  }
  if (firstFailure) return toUserFacingMessage(firstFailure.reason)
  return isEn ? `Failed to delete ${failedCount} file(s)` : `${failedCount}개 파일 삭제 실패`
}

export const useCloudWorkspaceMutations = ({
  isEn,
  queryClient,
  optimisticFiles,
  selectedFileId,
  setOptimisticFiles,
  setCheckedFileIds,
  setSelectedFileId,
  setKnownFolders,
  setCreatedFolders,
  setIsMutationPending,
  setToast,
}: {
  isEn: boolean
  queryClient: QueryClient
  optimisticFiles: CloudFile[]
  selectedFileId: number | null
  setOptimisticFiles: Dispatch<SetStateAction<CloudFile[]>>
  setCheckedFileIds: Dispatch<SetStateAction<number[]>>
  setSelectedFileId: Dispatch<SetStateAction<number | null>>
  setKnownFolders: Dispatch<SetStateAction<string[]>>
  setCreatedFolders: Dispatch<SetStateAction<string[]>>
  setIsMutationPending: (v: boolean) => void
  setToast: Dispatch<SetStateAction<{ tone: "success" | "error"; text: string } | null>>
}) => {
  const removeDeletedFilesFromCloudCaches = useCallback(
    (deletedIds: Set<number>) => {
      const remainingFiles: CloudFile[] = optimisticFiles.filter((file) => !deletedIds.has(file.id))
      queryClient
        .getQueriesData<CloudFile[]>({ queryKey: [CLOUD_QUERY_KEY] })
        .forEach(([queryKey, current]) => {
          if (!Array.isArray(current)) return
          const nextFiles = current.filter((file) => !deletedIds.has(file.id))
          queryClient.setQueryData(queryKey, nextFiles)
          remainingFiles.push(...nextFiles)
        })
      setKnownFolders(extractCloudFolders(remainingFiles))
    },
    [optimisticFiles, queryClient, setKnownFolders]
  )

  const handleUpdateFile = useCallback(
    async (
      fileId: number,
      payload: { originalFilename: string; folderPath: string }
    ): Promise<boolean> => {
      try {
        const normalizedTarget = normalizeCloudFolderPath(payload.folderPath)
        const updated = await updateCloudFile(fileId, {
          originalFilename: payload.originalFilename,
          folderPath: normalizedTarget,
        })
        const nextOptimistic = optimisticFiles.map((item) => (item.id === fileId ? updated : item))
        setOptimisticFiles(nextOptimistic)
        const remainingFiles: CloudFile[] = [...nextOptimistic, updated]
        queryClient
          .getQueriesData<CloudFile[]>({ queryKey: [CLOUD_QUERY_KEY] })
          .forEach(([queryKey, current]) => {
            if (!Array.isArray(current)) return
            const cached = getCachedCloudQueryFilters(queryKey)
            const nextFiles = updateCachedCloudFilesForMutation(
              current,
              updated,
              cached.filter,
              cached.keyword,
              cached.folderPath
            )
            queryClient.setQueryData(queryKey, nextFiles)
            remainingFiles.push(...nextFiles)
          })
        setKnownFolders(extractCloudFolders(remainingFiles))
        void queryClient.invalidateQueries({ queryKey: [CLOUD_QUERY_KEY] })
        void queryClient.invalidateQueries({ queryKey: [CLOUD_FACETS_QUERY_KEY] })
        setToast({
          tone: "success",
          text: isEn ? "Updated file details." : "파일 정보를 수정했습니다.",
        })
        return true
      } catch (error) {
        setToast({ tone: "error", text: toUserFacingMessage(error) })
        return false
      }
    },
    [isEn, optimisticFiles, queryClient, setKnownFolders, setOptimisticFiles, setToast]
  )

  const handleMoveFiles = useCallback(
    async (targetFiles: CloudFile[], targetFolderPath: string): Promise<boolean> => {
      if (targetFiles.length === 0) return true
      const normalizedTarget = normalizeCloudFolderPath(targetFolderPath)
      setIsMutationPending(true)
      try {
        if (normalizedTarget) {
          setCreatedFolders((prev) =>
            prev.includes(normalizedTarget) ? prev : [...prev, normalizedTarget]
          )
        }
        const results = await runBoundedSettled(
          targetFiles,
          BOUNDED_MUTATION_CONCURRENCY,
          (file) => updateCloudFile(file.id, { folderPath: normalizedTarget })
        )
        const updatedFiles: CloudFile[] = []
        let failedCount = 0
        results.forEach((res) => {
          if (res.status === "fulfilled") updatedFiles.push(res.value)
          else failedCount += 1
        })

        if (updatedFiles.length > 0) {
          const updatedMap = new Map(updatedFiles.map((f) => [f.id, f]))
          setOptimisticFiles((curr) => curr.map((item) => updatedMap.get(item.id) ?? item))
          queryClient
            .getQueriesData<CloudFile[]>({ queryKey: [CLOUD_QUERY_KEY] })
            .forEach(([queryKey, current]) => {
              if (!Array.isArray(current)) return
              const cached = getCachedCloudQueryFilters(queryKey)
              let nextFiles = current
              updatedFiles.forEach((u) => {
                nextFiles = updateCachedCloudFilesForMutation(
                  nextFiles,
                  u,
                  cached.filter,
                  cached.keyword,
                  cached.folderPath
                )
              })
              queryClient.setQueryData(queryKey, nextFiles)
            })
          setCheckedFileIds((curr) => curr.filter((id) => !updatedMap.has(id)))
          void queryClient.invalidateQueries({ queryKey: [CLOUD_QUERY_KEY] })
          void queryClient.invalidateQueries({ queryKey: [CLOUD_FACETS_QUERY_KEY] })
        }

        if (failedCount > 0) {
          setToast({
            tone: "error",
            text: isEn
              ? `Moved ${updatedFiles.length}, failed ${failedCount}`
              : `${updatedFiles.length}개 이동 완료, ${failedCount}개 실패`,
          })
          return false
        }
        setToast({
          tone: "success",
          text: isEn
            ? `Moved ${updatedFiles.length} file(s).`
            : `${updatedFiles.length}개 파일을 이동했습니다.`,
        })
        return true
      } finally {
        setIsMutationPending(false)
      }
    },
    [
      isEn,
      queryClient,
      setCheckedFileIds,
      setCreatedFolders,
      setIsMutationPending,
      setOptimisticFiles,
      setToast,
    ]
  )

  const performSingleDelete = useCallback(
    async (file: CloudFile) => {
      try {
        await deleteCloudFile(file.id)
        const deletedIds = new Set([file.id])
        setToast({
          tone: "success",
          text: isEn ? `Deleted ${file.originalFilename}` : `${file.originalFilename} 삭제 완료`,
        })
        setOptimisticFiles((current) => current.filter((item) => item.id !== file.id))
        setCheckedFileIds((current) => current.filter((id) => id !== file.id))
        removeDeletedFilesFromCloudCaches(deletedIds)
        if (selectedFileId === file.id) setSelectedFileId(null)
      } catch (error) {
        setToast({ tone: "error", text: toUserFacingMessage(error) })
      } finally {
        await queryClient.invalidateQueries({ queryKey: [CLOUD_QUERY_KEY] })
        void queryClient.invalidateQueries({ queryKey: [CLOUD_FACETS_QUERY_KEY] })
      }
    },
    [
      isEn,
      queryClient,
      removeDeletedFilesFromCloudCaches,
      selectedFileId,
      setCheckedFileIds,
      setOptimisticFiles,
      setSelectedFileId,
      setToast,
    ]
  )

  const performBulkDelete = useCallback(
    async (targets: CloudFile[]) => {
      const ids = targets.map((f) => f.id)
      const applyDeletedState = (deletedIds: Set<number>) => {
        if (deletedIds.size === 0) return
        setOptimisticFiles((current) => current.filter((file) => !deletedIds.has(file.id)))
        setCheckedFileIds((current) => current.filter((id) => !deletedIds.has(id)))
        removeDeletedFilesFromCloudCaches(deletedIds)
        if (selectedFileId && deletedIds.has(selectedFileId)) setSelectedFileId(null)
      }

      const totalDeletedIds = new Set<number>()
      let firstFailure: PromiseRejectedResult | undefined
      let firstError: unknown

      try {
        for (let offset = 0; offset < ids.length; offset += BULK_DELETE_CHUNK_SIZE) {
          const chunk = ids.slice(offset, offset + BULK_DELETE_CHUNK_SIZE)
          try {
            const response = await bulkDeleteCloudFiles(chunk)
            const deletedList = Array.isArray(response.deletedIds) ? response.deletedIds : []
            deletedList.forEach((id) => totalDeletedIds.add(id))
          } catch (chunkError) {
            firstError ??= chunkError
            const results = await runBoundedSettled(chunk, BOUNDED_MUTATION_CONCURRENCY, (id) =>
              deleteCloudFile(id)
            )
            results.forEach((res, i) => {
              if (res.status === "fulfilled") totalDeletedIds.add(chunk[i]!)
              else firstFailure ??= res
            })
          }
        }

        applyDeletedState(totalDeletedIds)
        const failedCount = Math.max(0, targets.length - totalDeletedIds.size)
        if (failedCount > 0) {
          setToast({
            tone: "error",
            text: resolveBulkDeleteFailureMessage(
              totalDeletedIds.size,
              failedCount,
              isEn,
              firstFailure
            ),
          })
        } else {
          setToast({
            tone: "success",
            text: isEn
              ? `Deleted ${totalDeletedIds.size} file(s).`
              : `${totalDeletedIds.size}개 파일 삭제 완료`,
          })
        }
      } catch (error) {
        setToast({ tone: "error", text: toUserFacingMessage(firstError ?? error) })
      } finally {
        await queryClient.invalidateQueries({ queryKey: [CLOUD_QUERY_KEY] })
        void queryClient.invalidateQueries({ queryKey: [CLOUD_FACETS_QUERY_KEY] })
      }
    },
    [
      isEn,
      queryClient,
      removeDeletedFilesFromCloudCaches,
      selectedFileId,
      setCheckedFileIds,
      setOptimisticFiles,
      setSelectedFileId,
      setToast,
    ]
  )

  return {
    handleUpdateFile,
    handleMoveFiles,
    performSingleDelete,
    performBulkDelete,
  }
}
