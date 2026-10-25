import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  deleteCloudFile,
  getCloudFileContentUrl,
  listCloudFiles,
  updateCloudFile,
  uploadCloudFile,
  type CloudFile,
  type CloudMediaKind,
} from "src/apis/backend/cloud"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import { useDebouncedValue } from "src/hooks/useDebouncedValue"
import { resolveCloudErrorMessage } from "./AdminCloudPreviewDrawer"
import {
  CLOUD_FILTERS,
  applyCloudFolderFilter,
  applyUploadQueueFailure,
  applyUploadQueueProgress,
  applyUploadQueueSuccess,
  createUploadQueueItem,
  doesCloudFileMatchFilters,
  doesCloudFileMatchSearchParams,
  extractCloudFolders,
  isAbortLikeError,
  isUploadActive,
  mergeCloudFiles,
  normalizeCloudFolderPathSearch,
  preferClientFilenameForUploadedFile,
  resolveCloudSearchParams,
  sortCloudFiles,
  updateCachedCloudFilesForMutation,
  type CloudMediaFilter,
  type CloudSortMode,
  type UploadQueueItem,
} from "./AdminCloudWorkspaceModel"

const CLOUD_QUERY_KEY = "admin-cloud-files"
const EMPTY_CLOUD_FILES: CloudFile[] = []

const mediaKindFromFilter = (filter: CloudMediaFilter): CloudMediaKind | undefined =>
  filter === "ALL" ? undefined : filter

const isCloudMediaFilter = (value: unknown): value is CloudMediaFilter =>
  CLOUD_FILTERS.some((item) => item.value === value)

const getCachedCloudQueryFilters = (queryKey: readonly unknown[]) => ({
  filter: isCloudMediaFilter(queryKey[1]) ? queryKey[1] : ("ALL" as CloudMediaFilter),
  keyword: typeof queryKey[2] === "string" ? queryKey[2] : "",
})

const resolveBulkDeleteFailureMessage = (
  deletedCount: number,
  failedCount: number,
  firstFailure: PromiseRejectedResult | undefined
): string => {
  if (deletedCount > 0) return `${deletedCount}개 삭제 완료, ${failedCount}개 실패`
  if (firstFailure) return toUserFacingMessage(firstFailure.reason)
  return `${failedCount}개 파일 삭제 실패`
}

type DeleteConfirmState = {
  files: CloudFile[]
}

export type CloudToastState =
  | {
      tone: "success" | "error"
      text: string
    }
  | null

export const useAdminCloudWorkspaceActions = () => {
  const queryClient = useQueryClient()
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const uploadControllersRef = useRef<Map<string, AbortController>>(new Map())
  const [filter, setFilter] = useState<CloudMediaFilter>("ALL")
  const [sortMode, setSortMode] = useState<CloudSortMode>("LATEST")
  const [keyword, setKeyword] = useState("")
  const [isComposing, setIsComposing] = useState(false)
  const debouncedKeyword = useDebouncedValue(keyword, isComposing)
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [checkedFileIds, setCheckedFileIds] = useState<number[]>([])
  const [notice, setNotice] = useState("")
  const [toast, setToast] = useState<CloudToastState>(null)
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const [optimisticFiles, setOptimisticFiles] = useState<CloudFile[]>([])
  const [knownFolders, setKnownFolders] = useState<string[]>([])
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
  const [isDeletePending, setIsDeletePending] = useState(false)

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
  const parsedSearch = useMemo(() => resolveCloudSearchParams(keyword), [keyword])
  const activeFolderPath = parsedSearch.folderPath || ""
  const availableFolders = useMemo(() => {
    const combined = new Set([...knownFolders, ...extractCloudFolders(files)])
    return Array.from(combined).sort((a, b) => a.localeCompare(b, "ko", { numeric: true }))
  }, [files, knownFolders])
  const selectedFile = files.find((file) => file.id === selectedFileId) || files[0] || null
  const isDetailDrawerMode = files.length > 8
  const shouldShowDetailPanel = isDetailPanelOpen && selectedFile !== null
  const activeUploadCount = uploadQueue.filter((item) => isUploadActive(item.status)).length
  const completedUploadCount = uploadQueue.filter((item) => item.status === "done").length
  const checkedFileIdSet = useMemo(() => new Set(checkedFileIds), [checkedFileIds])
  const fileIdSet = useMemo(() => new Set(files.map((file) => file.id)), [files])
  const allVisibleChecked = files.length > 0 && files.every((file) => checkedFileIdSet.has(file.id))
  const deleteDialogRef = useRef<HTMLDivElement | null>(null)
  const deleteCancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

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
      if (event.key !== "Escape") return
      event.preventDefault()
      setIsDetailPanelOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [deleteConfirm, shouldShowDetailPanel])

  useEffect(() => {
    if (!deleteConfirm) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusFrame = window.requestAnimationFrame(() => {
      deleteCancelButtonRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(focusFrame)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [deleteConfirm])

  useEffect(() => {
    if (!deleteConfirm) return

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || isDeletePending) return
      event.preventDefault()
      setDeleteConfirm(null)
    }

    document.addEventListener("keydown", handleDocumentKeyDown)
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown)
    }
  }, [deleteConfirm, isDeletePending])

  useEffect(() => {
    const hasActiveUpload = uploadQueue.some((item) => item.status === "uploading")
    const nextUpload = uploadQueue.find((item) => item.status === "queued")
    if (hasActiveUpload || !nextUpload) return

    const controller = new AbortController()
    uploadControllersRef.current.set(nextUpload.id, controller)
    setUploadQueue((current) =>
      current.map((item) =>
        item.id === nextUpload.id
          ? { ...item, status: "uploading", progress: 36, message: "서버로 업로드 중" }
          : item
      )
    )

    const updateCachedFileQueries = (displayUploaded: CloudFile) => {
      queryClient.getQueriesData<CloudFile[]>({ queryKey: [CLOUD_QUERY_KEY] }).forEach(([queryKey, current]) => {
        if (!Array.isArray(current)) return
        const cachedFilters = getCachedCloudQueryFilters(queryKey)
        if (!doesCloudFileMatchFilters(displayUploaded, cachedFilters.filter, cachedFilters.keyword)) return
        queryClient.setQueryData(queryKey, mergeCloudFiles([displayUploaded], current))
      })
    }

    const run = async () => {
      try {
        const uploaded = await uploadCloudFile(nextUpload.file, nextUpload.folderPath, controller.signal, {
          onProgress: ({ progress, message }) => {
            setUploadQueue((current) => applyUploadQueueProgress(current, nextUpload.id, progress, message))
          },
        })
        if (controller.signal.aborted) throw new DOMException("Upload aborted", "AbortError")
        const displayUploaded = preferClientFilenameForUploadedFile(uploaded, nextUpload.name)

        setOptimisticFiles((current) => mergeCloudFiles([displayUploaded], current))
        updateCachedFileQueries(displayUploaded)
        setIsDetailPanelOpen(true)
        setSelectedFileId(displayUploaded.id)
        setNotice((current) =>
          current.includes(nextUpload.name) && /업로드 (실패|취소)/.test(current) ? "" : current
        )
        setUploadQueue((current) => applyUploadQueueSuccess(current, nextUpload.id, displayUploaded.id))
        void queryClient.invalidateQueries({ queryKey: [CLOUD_QUERY_KEY] })
      } catch (error) {
        const aborted = controller.signal.aborted || isAbortLikeError(error)
        const failureMessage = aborted ? "사용자가 취소함" : resolveCloudErrorMessage(error)
        setNotice(aborted ? `${nextUpload.name} 업로드 취소` : `${nextUpload.name} 업로드 실패: ${failureMessage}`)
        setUploadQueue((current) => applyUploadQueueFailure(current, nextUpload.id, aborted, failureMessage))
      } finally {
        uploadControllersRef.current.delete(nextUpload.id)
      }
    }

    void run()
  }, [queryClient, uploadQueue])

  const queueUploadFiles = (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return
    const activeFolderPath =
      resolveCloudSearchParams(keyword).folderPath ||
      resolveCloudSearchParams(debouncedKeyword).folderPath ||
      ""

    setUploadQueue((current) => [
      ...current,
      ...selectedFiles.map((file) => createUploadQueueItem(file, activeFolderPath)),
    ])
  }

  const handleUploadSelect = (event: ChangeEvent<HTMLInputElement>) => {
    queueUploadFiles(Array.from(event.currentTarget.files || []))
    event.currentTarget.value = ""
  }

  const handleUploadDragOver = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsDragActive(true)
  }

  const handleUploadDragLeave = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault()
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
    setIsDragActive(false)
  }

  const handleUploadDrop = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsDragActive(false)
    queueUploadFiles(Array.from(event.dataTransfer.files || []))
  }

  const handleCancelUpload = (item: UploadQueueItem) => {
    if (!isUploadActive(item.status)) return
    uploadControllersRef.current.get(item.id)?.abort()
    setUploadQueue((current) =>
      current.map((queueItem) =>
        queueItem.id === item.id
          ? { ...queueItem, status: "cancelled", progress: 0, message: "사용자가 취소함" }
          : queueItem
      )
    )
  }

  const handleClearFinishedUploads = () => {
    setUploadQueue((current) => current.filter((item) => isUploadActive(item.status)))
  }

  const handleRetryUpload = (item: UploadQueueItem) => {
    if (item.status !== "failed") return
    setUploadQueue((current) =>
      current.map((queueItem) =>
        queueItem.id === item.id
          ? {
              ...queueItem,
              status: "queued",
              progress: 0,
              message: "업로드 대기 중",
              retryCount: (queueItem.retryCount ?? 0) + 1,
            }
          : queueItem
      )
    )
  }

  const handleToggleAllChecked = () => {
    setCheckedFileIds(allVisibleChecked ? [] : files.map((file) => file.id))
  }

  const handleToggleChecked = (fileId: number) => {
    setCheckedFileIds((current) =>
      current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId]
    )
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
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(linkUrl)
        setToast({ tone: "success", text: "파일 링크를 복사했습니다." })
        return
      } catch {
        if (typeof window !== "undefined" && typeof window.prompt === "function") {
          window.prompt("파일 링크를 복사하세요.", linkUrl)
          setToast({ tone: "success", text: "파일 링크를 복사했습니다." })
          return
        }
      }
    }
    if (typeof window !== "undefined" && typeof window.prompt === "function") {
      window.prompt("파일 링크를 복사하세요.", linkUrl)
      setToast({ tone: "success", text: "파일 링크를 복사했습니다." })
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

  const closeDeleteConfirm = () => {
    if (isDeletePending) return
    setDeleteConfirm(null)
  }

  const handleDeleteDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      closeDeleteConfirm()
      return
    }
    if (event.key !== "Tab") return

    const dialog = deleteDialogRef.current
    if (!dialog) return
    const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled)"))
    if (focusableElements.length === 0) {
      event.preventDefault()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)
    if (!lastElement) return
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }
    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
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
    }
  }

  const performBulkDelete = async (targets: CloudFile[]) => {
    const results = await Promise.allSettled(
      targets.map(async (file) => {
        await deleteCloudFile(file.id)
        return file
      })
    )
    const deletedFiles = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    const deletedIds = new Set(deletedFiles.map((file) => file.id))
    const failedCount = targets.length - deletedIds.size
    const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === "rejected")

    if (deletedIds.size > 0) {
      setOptimisticFiles((current) => current.filter((file) => !deletedIds.has(file.id)))
      setCheckedFileIds((current) => current.filter((id) => !deletedIds.has(id)))
      removeDeletedFilesFromCloudCaches(deletedIds)
      if (selectedFileId && deletedIds.has(selectedFileId)) setSelectedFileId(null)
    }

    if (failedCount > 0) {
      const failureText = resolveBulkDeleteFailureMessage(deletedIds.size, failedCount, firstFailure)
      setToast({ tone: "error", text: failureText })
    } else {
      setToast({ tone: "success", text: `${deletedIds.size}개 파일 삭제 완료` })
    }
    await queryClient.invalidateQueries({ queryKey: [CLOUD_QUERY_KEY] })
  }

  const handleSelectFolder = (folderPath: string) => {
    setKeyword((current) => applyCloudFolderFilter(current, folderPath))
  }

  const handleRequestDeleteFile = (file: CloudFile) => {
    setDeleteConfirm({ files: [file] })
  }

  const handleDeleteSelected = () => {
    const targets = files.filter((file) => checkedFileIds.includes(file.id))
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
