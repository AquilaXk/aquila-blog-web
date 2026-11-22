// 참조 구현: strapi/strapi (MIT), transloadit/uppy (MIT), payloadcms/payload (MIT) — 미디어 워크스페이스 액션·O(1) 인덱싱·벌크 삭제
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import {
  bulkDeleteCloudFiles,
  deleteCloudFile,
  getCloudFileContentUrl,
  listCloudFiles,
  updateCloudFile,
  type CloudFile,
  type CloudMediaKind,
} from "src/apis/backend/cloud"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import { useDebouncedValue } from "src/hooks/useDebouncedValue"
import {
  CLOUD_FILTERS,
  applyCloudFolderFilter,
  doesCloudFileMatchSearchParams,
  extractCloudFolders,
  mergeCloudFiles,
  normalizeCloudFolderPathSearch,
  resolveCloudSearchParams,
  sortCloudFiles,
  updateCachedCloudFilesForMutation,
  type CloudMediaFilter,
  type CloudSortMode,
} from "./AdminCloudWorkspaceModel"
import { computeShiftRangeSelection } from "./cloudUploadQueueModel"
import { useAdminCloudUploadQueue } from "./useAdminCloudUploadQueue"

const CLOUD_QUERY_KEY = "admin-cloud-files"
const CLOUD_FACETS_QUERY_KEY = "admin-cloud-facets"
const EMPTY_CLOUD_FILES: CloudFile[] = []
const CLOUD_UI_COMPOSING = 1
const CLOUD_UI_DETAIL_OPEN = 1 << 1
const CLOUD_UI_DELETE_PENDING = 1 << 2

const resolveBulkDeleteFailureMessage = (
  deletedCount: number,
  failedCount: number,
  firstFailure?: PromiseRejectedResult
): string => {
  if (deletedCount > 0) return `${deletedCount}개 삭제 완료, ${failedCount}개 실패`
  if (firstFailure) return toUserFacingMessage(firstFailure.reason)
  return `${failedCount}개 파일 삭제 실패`
}

const mediaKindFromFilter = (filter: CloudMediaFilter): CloudMediaKind | undefined =>
  filter === "ALL" ? undefined : filter

const isCloudMediaFilter = (value: unknown): value is CloudMediaFilter =>
  CLOUD_FILTERS.some((item) => item.value === value)

const getCachedCloudQueryFilters = (queryKey: readonly unknown[]) => ({
  filter: isCloudMediaFilter(queryKey[1]) ? queryKey[1] : ("ALL" as CloudMediaFilter),
  keyword: typeof queryKey[2] === "string" ? queryKey[2] : "",
})

type DeleteConfirmState = {
  files: CloudFile[]
}

export type CloudToastState =
  | {
      tone: "success" | "error"
      text: string
    }
  | null

// 업로드 취소 컨트롤러 추적: uploadControllersRef는 useAdminCloudUploadQueue에서 안전하게 소유 및 관리됨
export const useAdminCloudWorkspaceActions = () => {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<CloudMediaFilter>("ALL")
  const [sortMode, setSortMode] = useState<CloudSortMode>("LATEST")
  const [keyword, setKeyword] = useState("")
  const [cloudUiMask, setCloudUiMask] = useState(0)

  const isComposing = (cloudUiMask & CLOUD_UI_COMPOSING) !== 0
  const isDetailPanelOpen = (cloudUiMask & CLOUD_UI_DETAIL_OPEN) !== 0
  const isDeletePending = (cloudUiMask & CLOUD_UI_DELETE_PENDING) !== 0

  const setIsComposing = useCallback(
    (v: boolean) => setCloudUiMask((m) => (v ? m | CLOUD_UI_COMPOSING : m & ~CLOUD_UI_COMPOSING)),
    []
  )
  const setIsDetailPanelOpen = useCallback(
    (v: boolean | ((current: boolean) => boolean)) =>
      setCloudUiMask((m) => {
        const enabled = typeof v === "function" ? v((m & CLOUD_UI_DETAIL_OPEN) !== 0) : v
        return enabled ? m | CLOUD_UI_DETAIL_OPEN : m & ~CLOUD_UI_DETAIL_OPEN
      }),
    []
  )
  const setIsDeletePending = useCallback(
    (v: boolean) => setCloudUiMask((m) => (v ? m | CLOUD_UI_DELETE_PENDING : m & ~CLOUD_UI_DELETE_PENDING)),
    []
  )

  const debouncedKeyword = useDebouncedValue(keyword, isComposing)
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [checkedFileIds, setCheckedFileIds] = useState<number[]>([])
  const [notice, setNotice] = useState("")
  const [toast, setToast] = useState<CloudToastState>(null)
  const [optimisticFiles, setOptimisticFiles] = useState<CloudFile[]>([])
  const [knownFolders, setKnownFolders] = useState<string[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
  const lastCheckedRowIndexRef = useRef<number | null>(null)

  const filesQuery = useQuery({
    queryKey: [CLOUD_QUERY_KEY, filter, debouncedKeyword],
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const searchParams = resolveCloudSearchParams(debouncedKeyword)
      return listCloudFiles({
        folderPath: searchParams.folderPath,
        keyword: searchParams.keyword,
        mediaKind: mediaKindFromFilter(filter),
      })
    },
  })

  const serverFiles = filesQuery.data ?? EMPTY_CLOUD_FILES
  const visibleOptimisticFiles = useMemo(() => {
    const searchParams = resolveCloudSearchParams(debouncedKeyword)
    const normalizedKeyword = (searchParams.keyword ?? "").toLowerCase()
    return optimisticFiles.filter((file) =>
      doesCloudFileMatchSearchParams(file, filter, searchParams, normalizedKeyword)
    )
  }, [debouncedKeyword, filter, optimisticFiles])

  const files = useMemo(
    () => sortCloudFiles(mergeCloudFiles(visibleOptimisticFiles, serverFiles), sortMode),
    [serverFiles, sortMode, visibleOptimisticFiles]
  )

  // O(1) 빠른 조회를 위한 맵 및 셋
  const filesById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files])
  const fileIds = useMemo(() => files.map((file) => file.id), [files])
  const fileIdIndexMap = useMemo(() => new Map(files.map((file, i) => [file.id, i])), [files])
  const checkedFileIdSet = useMemo(() => new Set(checkedFileIds), [checkedFileIds])
  const fileIdSet = useMemo(() => new Set(fileIds), [fileIds])

  const parsedSearch = useMemo(() => resolveCloudSearchParams(keyword), [keyword])
  const activeFolderPath = parsedSearch.folderPath || ""
  const availableFolders = useMemo(() => {
    const combined = new Set([...knownFolders, ...extractCloudFolders(files)])
    return Array.from(combined).sort((a, b) => a.localeCompare(b, "ko", { numeric: true }))
  }, [files, knownFolders])

  const selectedFile = (selectedFileId ? filesById.get(selectedFileId) : null) || files[0] || null
  const [isNarrowViewport, setIsNarrowViewport] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mediaQuery = window.matchMedia("(max-width: 1279px)")
    const syncDrawerMode = () => setIsNarrowViewport(mediaQuery.matches)
    syncDrawerMode()
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncDrawerMode)
      return () => mediaQuery.removeEventListener("change", syncDrawerMode)
    }
    mediaQuery.addListener(syncDrawerMode)
    return () => mediaQuery.removeListener(syncDrawerMode)
  }, [])

  const isDetailDrawerMode = isNarrowViewport || files.length > 8
  const shouldShowDetailPanel = isDetailPanelOpen && selectedFile !== null
  const allVisibleChecked = files.length > 0 && files.every((file) => checkedFileIdSet.has(file.id))

  const deleteDialogRef = useRef<HTMLDivElement | null>(null)
  const deleteCancelButtonRef = useRef<HTMLButtonElement | null>(null)

  const closeDeleteConfirm = useCallback(() => {
    if (isDeletePending) return
    setDeleteConfirm(null)
  }, [isDeletePending])

  const { handleKeyDown: handleDeleteDialogKeyDown } = useModalFocusTrap({
    open: Boolean(deleteConfirm),
    onClose: closeDeleteConfirm,
    containerRef: deleteDialogRef,
    initialFocusRef: deleteCancelButtonRef,
    lockScroll: true,
  })

  // 업로드 큐 훅 연결
  const {
    uploadQueue,
    uploadInputRef,
    activeUploadCount,
    completedUploadCount,
    aggregateProgress,
    isDragActive,
    handleUploadSelect,
    handleUploadDragOver,
    handleUploadDragLeave,
    handleUploadDrop,
    handleCancelUpload,
    handleClearFinishedUploads,
    handleRetryUpload,
  } = useAdminCloudUploadQueue({
    activeFolderPath,
    onUploadSuccess: (displayUploaded) => {
      setOptimisticFiles((current) => mergeCloudFiles([displayUploaded], current))
      setIsDetailPanelOpen(true)
      setSelectedFileId(displayUploaded.id)
    },
    onNotice: setNotice,
    onToast: setToast,
  })

  useEffect(() => {
    const isUnfiltered = filter === "ALL" && !debouncedKeyword.trim()
    if (isUnfiltered && (!filesQuery.isSuccess || filesQuery.isPlaceholderData)) return
    const discovered = extractCloudFolders(mergeCloudFiles(optimisticFiles, serverFiles))
    if (!isUnfiltered && discovered.length === 0) return
    setKnownFolders((current) => {
      const next = isUnfiltered
        ? discovered
        : Array.from(new Set([...current, ...discovered])).sort((a, b) =>
            a.localeCompare(b, "ko", { numeric: true })
          )
      return next.length === current.length && next.every((item, index) => item === current[index])
        ? current
        : next
    })
  }, [debouncedKeyword, filesQuery.isPlaceholderData, filesQuery.isSuccess, filter, optimisticFiles, serverFiles])

  useEffect(() => {
    if (selectedFileId && fileIdSet.has(selectedFileId)) return
    setSelectedFileId(files[0]?.id ?? null)
  }, [fileIdSet, files, selectedFileId])

  useEffect(() => {
    setCheckedFileIds((current) => current.filter((id) => fileIdSet.has(id)))
  }, [fileIdSet])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => {
      setToast((current) => (current === toast ? null : current))
    }, 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!shouldShowDetailPanel || deleteConfirm) return
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return
      event.preventDefault()
      setIsDetailPanelOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [deleteConfirm, setIsDetailPanelOpen, shouldShowDetailPanel])

  const resetSelectionAnchor = useCallback(() => {
    lastCheckedRowIndexRef.current = null
  }, [])

  const handleToggleAllChecked = (visibleIds?: readonly number[]) => {
    const scopeIds = visibleIds && visibleIds.length > 0 ? visibleIds : fileIds
    const allScopeChecked = scopeIds.length > 0 && scopeIds.every((id) => checkedFileIdSet.has(id))
    if (allScopeChecked) {
      const scopeSet = new Set(scopeIds)
      setCheckedFileIds((current) => current.filter((id) => !scopeSet.has(id)))
    } else {
      setCheckedFileIds((current) => Array.from(new Set([...current, ...scopeIds])))
    }
    lastCheckedRowIndexRef.current = null
  }

  // Shift+Click 다중 범위 선택 지원 (현재 페이지 가시 슬라이스 기준)
  const handleToggleChecked = (fileId: number, shiftKey = false, visibleIds?: readonly number[]) => {
    const scopeIds = visibleIds ?? fileIds
    const currentIndex = visibleIds ? scopeIds.indexOf(fileId) : (fileIdIndexMap.get(fileId) ?? -1)
    if (currentIndex === -1) return

    const anchorIndex = lastCheckedRowIndexRef.current
    if (shiftKey && anchorIndex !== null && anchorIndex >= 0 && anchorIndex < scopeIds.length) {
      const rangeIds = computeShiftRangeSelection(anchorIndex, currentIndex, scopeIds)
      setCheckedFileIds((current) => Array.from(new Set([...current, ...rangeIds])))
    } else {
      setCheckedFileIds((current) =>
        current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId]
      )
    }
    lastCheckedRowIndexRef.current = currentIndex
  }

  const handlePreviewFile = (fileId: number) => {
    setIsDetailPanelOpen(true)
    setSelectedFileId(fileId)
  }

  const handleUpdateFile = async (
    fileId: number,
    payload: { originalFilename: string; folderPath: string }
  ): Promise<boolean> => {
    try {
      const updated = await updateCloudFile(fileId, payload)
      const nextOptimistic = optimisticFiles.map((item) => (item.id === fileId ? updated : item))
      setOptimisticFiles(nextOptimistic)
      const remainingFiles: CloudFile[] = [...nextOptimistic, updated]
      queryClient.getQueriesData<CloudFile[]>({ queryKey: [CLOUD_QUERY_KEY] }).forEach(([queryKey, current]) => {
        if (!Array.isArray(current)) return
        const { filter: cachedFilter, keyword: cachedKeyword } = getCachedCloudQueryFilters(queryKey)
        const nextFiles = updateCachedCloudFilesForMutation(current, updated, cachedFilter, cachedKeyword)
        queryClient.setQueryData(queryKey, nextFiles)
        remainingFiles.push(...nextFiles)
      })
      setKnownFolders(extractCloudFolders(remainingFiles))
      const updatedFolder = normalizeCloudFolderPathSearch(updated.folderPath)
      if (activeFolderPath && activeFolderPath !== updatedFolder) {
        setKeyword((current) => applyCloudFolderFilter(current, updatedFolder))
      }
      void queryClient.invalidateQueries({ queryKey: [CLOUD_QUERY_KEY] })
      setToast({ tone: "success", text: "파일 정보를 수정했습니다." })
      return true
    } catch (error) {
      setToast({ tone: "error", text: toUserFacingMessage(error) })
      return false
    }
  }

  const handleCopyFileLink = async (file: CloudFile): Promise<void> => {
    const linkUrl =
      typeof window !== "undefined"
        ? new URL(getCloudFileContentUrl(file.id), window.location.origin).toString()
        : getCloudFileContentUrl(file.id)
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setToast({ tone: "error", text: "클립보드 접근 권한이 없어 파일 링크를 복사하지 못했습니다." })
      return
    }
    try {
      await navigator.clipboard.writeText(linkUrl)
      setToast({ tone: "success", text: "파일 링크를 복사했습니다." })
    } catch {
      setToast({ tone: "error", text: "클립보드 복사가 거부되었습니다. 브라우저 권한을 확인해주세요." })
    }
  }

  const removeDeletedFilesFromCloudCaches = (deletedIds: Set<number>) => {
    const remainingFiles: CloudFile[] = optimisticFiles.filter((file) => !deletedIds.has(file.id))
    queryClient.getQueriesData<CloudFile[]>({ queryKey: [CLOUD_QUERY_KEY] }).forEach(([queryKey, current]) => {
      if (!Array.isArray(current)) return
      const nextFiles = current.filter((file) => !deletedIds.has(file.id))
      queryClient.setQueryData(queryKey, nextFiles)
      remainingFiles.push(...nextFiles)
    })
    const nextFolders = extractCloudFolders(remainingFiles)
    setKnownFolders(nextFolders)
    if (activeFolderPath && !nextFolders.includes(activeFolderPath)) {
      setKeyword((current) => applyCloudFolderFilter(current, ""))
    }
  }

  const performSingleDelete = async (file: CloudFile) => {
    try {
      await deleteCloudFile(file.id)
      const deletedIds = new Set([file.id])
      setToast({ tone: "success", text: `${file.originalFilename} 삭제 완료` })
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
  }

  // 단일 배치 API로 일괄 삭제 (미지원·라우트 폴백 시 개별 병렬 삭제 및 부분 실패 집계)
  const performBulkDelete = async (targets: CloudFile[]) => {
    const ids = targets.map((f) => f.id)
    const applyDeletedState = (deletedIds: Set<number>) => {
      if (deletedIds.size === 0) return
      setOptimisticFiles((current) => current.filter((file) => !deletedIds.has(file.id)))
      setCheckedFileIds((current) => current.filter((id) => !deletedIds.has(id)))
      removeDeletedFilesFromCloudCaches(deletedIds)
      if (selectedFileId && deletedIds.has(selectedFileId)) setSelectedFileId(null)
    }

    try {
      const response = await bulkDeleteCloudFiles(ids)
      const deletedList = Array.isArray(response.deletedIds) ? response.deletedIds : []
      const deletedIds = new Set<number>(deletedList)
      const failedCount = Math.max(0, targets.length - deletedIds.size)
      applyDeletedState(deletedIds)
      if (failedCount > 0) {
        setToast({
          tone: "error",
          text: resolveBulkDeleteFailureMessage(deletedIds.size, failedCount),
        })
      } else {
        setToast({ tone: "success", text: `${deletedIds.size}개 파일 삭제 완료` })
      }
    } catch (error) {
      try {
        const results = await Promise.allSettled(ids.map((id) => deleteCloudFile(id)))
        const deletedIds = new Set(
          results.flatMap((res, i) => (res.status === "fulfilled" ? [ids[i]] : []))
        )
        const failedCount = targets.length - deletedIds.size
        const firstFailure = results.find(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        )
        applyDeletedState(deletedIds)
        if (failedCount > 0) {
          setToast({
            tone: "error",
            text: resolveBulkDeleteFailureMessage(deletedIds.size, failedCount, firstFailure),
          })
        } else {
          setToast({ tone: "success", text: `${deletedIds.size}개 파일 삭제 완료` })
        }
      } catch {
        setToast({ tone: "error", text: toUserFacingMessage(error) })
      }
    } finally {
      await queryClient.invalidateQueries({ queryKey: [CLOUD_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [CLOUD_FACETS_QUERY_KEY] })
    }
  }

  const handleSelectFolder = (folderPath: string) => {
    setKeyword((current) => applyCloudFolderFilter(current, folderPath))
  }

  const handleRequestDeleteFile = (file: CloudFile) => {
    setDeleteConfirm({ files: [file] })
  }

  const handleDeleteSelected = () => {
    const targets = checkedFileIds.flatMap((id) => {
      const found = filesById.get(id)
      return found ? [found] : []
    })
    if (targets.length === 0) return
    setDeleteConfirm({ files: targets })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm || isDeletePending) return
    setIsDeletePending(true)
    try {
      if (deleteConfirm.files.length === 1) {
        await performSingleDelete(deleteConfirm.files[0])
      } else {
        await performBulkDelete(deleteConfirm.files)
      }
      setDeleteConfirm(null)
    } finally {
      setIsDeletePending(false)
    }
  }

  return {
    activeFolderPath,
    activeUploadCount,
    aggregateProgress,
    allVisibleChecked,
    availableFolders,
    checkedFileIds,
    closeDeleteConfirm,
    completedUploadCount,
    debouncedKeyword,
    deleteCancelButtonRef,
    deleteConfirm,
    deleteDialogRef,
    files,
    filesQuery,
    filter,
    handleCancelUpload,
    handleClearFinishedUploads,
    handleConfirmDelete,
    handleCopyFileLink,
    handleDeleteDialogKeyDown,
    handleDeleteSelected,
    handlePreviewFile,
    handleRequestDeleteFile,
    handleRetryUpload,
    handleSelectFolder,
    handleToggleAllChecked,
    handleToggleChecked,
    handleUpdateFile,
    handleUploadDragLeave,
    handleUploadDragOver,
    handleUploadDrop,
    handleUploadSelect,
    isDetailDrawerMode,
    isDeletePending,
    isDragActive,
    keyword,
    notice,
    resetSelectionAnchor,
    selectedFile,
    setFilter,
    setIsComposing,
    setIsDetailPanelOpen,
    setKeyword,
    setSelectedFileId,
    setSortMode,
    setToast,
    shouldShowDetailPanel,
    sortMode,
    toast,
    uploadInputRef,
    uploadQueue,
  }
}
