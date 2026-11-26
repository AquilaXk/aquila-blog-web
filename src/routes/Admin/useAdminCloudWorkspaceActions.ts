// 참조 구현: strapi/strapi (MIT), transloadit/uppy (MIT), supabase/supabase (Apache-2.0) — 클라우드 워크스페이스 상태·폴더/검색 분리
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  getCloudFileContentUrl,
  getCloudFileFacets,
  listCloudFiles,
  type CloudFile,
  type CloudMediaKind,
} from "src/apis/backend/cloud"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import { useDebouncedValue } from "src/hooks/useDebouncedValue"
import { useLanguage } from "src/libs/language"
import {
  doesCloudFileMatchFilters,
  extractCloudFolders,
  mergeCloudFiles,
  sortCloudFiles,
  type CloudMediaFilter,
  type CloudSortDirection,
  type CloudSortMode,
} from "./AdminCloudWorkspaceModel"
import {
  extractAllCloudFolders,
  extractDirectChildFolders,
  getDefaultSortDirection,
  loadCloudViewPreferences,
  normalizeCloudFolderPath,
  saveCloudViewPreferences,
  type CloudViewMode,
  type CloudViewPreferences,
} from "./cloud/cloudFolderHelpers"
import { useCloudWorkspaceMutations } from "./cloud/useCloudWorkspaceMutations"
import { computeShiftRangeSelection } from "./cloudUploadQueueModel"
import { useAdminCloudUploadQueue } from "./useAdminCloudUploadQueue"

const CLOUD_QUERY_KEY = "admin-cloud-files"
const CLOUD_FACETS_QUERY_KEY = "admin-cloud-facets"
const EMPTY_CLOUD_FILES: CloudFile[] = []
const EMPTY_CLOUD_FOLDERS: string[] = []

const CLOUD_UI_COMPOSING = 1
const CLOUD_UI_DETAIL_OPEN = 1 << 1
const CLOUD_UI_DELETE_PENDING = 1 << 2
const CLOUD_UI_MUTATION_PENDING = 1 << 3

const mediaKindFromFilter = (filter: CloudMediaFilter): CloudMediaKind | undefined =>
  filter === "ALL" ? undefined : filter

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
  const { language } = useLanguage()
  const isEn = language === "en"
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState<CloudMediaFilter>("ALL")
  const [sortMode, setSortModeState] = useState<CloudSortMode>("LATEST")
  const [sortDirection, setSortDirectionState] = useState<CloudSortDirection>("desc")
  const [viewMode, setViewModeState] = useState<CloudViewMode>("grid")
  const [activeFolderPath, setActiveFolderPathState] = useState("")
  const [keyword, setKeyword] = useState("")
  const [cloudUiMask, setCloudUiMask] = useState(0)

  const prefsLoadedRef = useRef(false)
  const latestPrefsRef = useRef<CloudViewPreferences>({
    viewMode: "grid",
    sortMode: "LATEST",
    sortDirection: "desc",
  })
  const initialDesktopSyncDoneRef = useRef(false)

  const isComposing = (cloudUiMask & CLOUD_UI_COMPOSING) !== 0
  const isDetailPanelOpen = (cloudUiMask & CLOUD_UI_DETAIL_OPEN) !== 0
  const isDeletePending = (cloudUiMask & CLOUD_UI_DELETE_PENDING) !== 0
  const isMutationPending = (cloudUiMask & CLOUD_UI_MUTATION_PENDING) !== 0

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
    (v: boolean) =>
      setCloudUiMask((m) => (v ? m | CLOUD_UI_DELETE_PENDING : m & ~CLOUD_UI_DELETE_PENDING)),
    []
  )
  const setIsMutationPending = useCallback(
    (v: boolean) =>
      setCloudUiMask((m) => (v ? m | CLOUD_UI_MUTATION_PENDING : m & ~CLOUD_UI_MUTATION_PENDING)),
    []
  )

  useEffect(() => {
    if (prefsLoadedRef.current) return
    prefsLoadedRef.current = true
    const saved = loadCloudViewPreferences()
    latestPrefsRef.current = saved
    setViewModeState(saved.viewMode)
    setSortModeState(saved.sortMode)
    setSortDirectionState(saved.sortDirection)
  }, [])

  const updateSavedPreferences = useCallback(
    (next: { viewMode?: CloudViewMode; sortMode?: CloudSortMode; sortDirection?: CloudSortDirection }) => {
      const merged: CloudViewPreferences = {
        viewMode: next.viewMode ?? latestPrefsRef.current.viewMode,
        sortMode: next.sortMode ?? latestPrefsRef.current.sortMode,
        sortDirection: next.sortDirection ?? latestPrefsRef.current.sortDirection,
      }
      latestPrefsRef.current = merged
      saveCloudViewPreferences(merged)
    },
    []
  )

  const setViewMode = useCallback(
    (next: CloudViewMode) => {
      setViewModeState(next)
      updateSavedPreferences({ viewMode: next })
    },
    [updateSavedPreferences]
  )

  const setSortMode = useCallback(
    (next: CloudSortMode, explicitDirection?: CloudSortDirection, options?: { persist?: boolean }) => {
      const dir = explicitDirection ?? getDefaultSortDirection(next)
      setSortModeState(next)
      setSortDirectionState(dir)
      if (options?.persist !== false) {
        updateSavedPreferences({ sortMode: next, sortDirection: dir })
      }
    },
    [updateSavedPreferences]
  )

  const handleSortColumn = useCallback(
    (column: "NAME" | "SIZE" | "LATEST") => {
      if (column === "LATEST") {
        const currentlyDesc = sortMode === "LATEST" && sortDirection === "desc"
        setSortMode(currentlyDesc ? "OLDEST" : "LATEST", currentlyDesc ? "asc" : "desc")
        return
      }
      if (sortMode === column) {
        setSortMode(column, sortDirection === "asc" ? "desc" : "asc")
        return
      }
      setSortMode(column, getDefaultSortDirection(column))
    },
    [setSortMode, sortDirection, sortMode]
  )

  const debouncedKeyword = useDebouncedValue(keyword, isComposing)
  const normalizedFolderPath = normalizeCloudFolderPath(activeFolderPath)
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [checkedFileIds, setCheckedFileIds] = useState<number[]>([])
  const [notice, setNotice] = useState("")
  const [toast, setToast] = useState<CloudToastState>(null)
  const [optimisticFiles, setOptimisticFiles] = useState<CloudFile[]>([])
  const [knownFolders, setKnownFolders] = useState<string[]>([])
  const [createdFolders, setCreatedFolders] = useState<string[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
  const lastCheckedRowIndexRef = useRef<number | null>(null)

  const filesQuery = useQuery({
    queryKey: [CLOUD_QUERY_KEY, filter, debouncedKeyword.trim(), normalizedFolderPath],
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    queryFn: () =>
      listCloudFiles({
        folderPath: normalizedFolderPath,
        keyword: debouncedKeyword.trim(),
        mediaKind: mediaKindFromFilter(filter),
      }),
  })

  const facetsQuery = useQuery({
    queryKey: [CLOUD_FACETS_QUERY_KEY],
    queryFn: ({ signal }) => getCloudFileFacets(signal),
    staleTime: 30_000,
  })
  const facetFolders = facetsQuery.data?.folders ?? EMPTY_CLOUD_FOLDERS

  const serverFiles = filesQuery.data ?? EMPTY_CLOUD_FILES
  const visibleOptimisticFiles = useMemo(
    () =>
      optimisticFiles.filter((file) =>
        doesCloudFileMatchFilters(file, filter, debouncedKeyword, normalizedFolderPath)
      ),
    [debouncedKeyword, filter, normalizedFolderPath, optimisticFiles]
  )

  const files = useMemo(
    () => sortCloudFiles(mergeCloudFiles(visibleOptimisticFiles, serverFiles), sortMode, sortDirection),
    [serverFiles, sortDirection, sortMode, visibleOptimisticFiles]
  )
  const hadNoFilesRef = useRef(true)
  hadNoFilesRef.current = serverFiles.length === 0 && optimisticFiles.length === 0

  const filesById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files])
  const fileIds = useMemo(() => files.map((file) => file.id), [files])
  const fileIdIndexMap = useMemo(() => new Map(files.map((file, i) => [file.id, i])), [files])
  const checkedFileIdSet = useMemo(() => new Set(checkedFileIds), [checkedFileIds])
  const fileIdSet = useMemo(() => new Set(fileIds), [fileIds])

  const allFolders = useMemo(
    () => extractAllCloudFolders(files, [...knownFolders, ...createdFolders, ...facetFolders], normalizedFolderPath),
    [createdFolders, facetFolders, files, knownFolders, normalizedFolderPath]
  )
  const childFolders = useMemo(
    () => extractDirectChildFolders(allFolders, normalizedFolderPath),
    [allFolders, normalizedFolderPath]
  )

  const selectedFile = useMemo(
    () => (selectedFileId ? filesById.get(selectedFileId) ?? null : null),
    [filesById, selectedFileId]
  )
  const [isNarrowViewport, setIsNarrowViewport] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mediaQuery = window.matchMedia("(max-width: 1279px)")
    const syncDrawerMode = () => {
      setIsNarrowViewport(mediaQuery.matches)
      if (!initialDesktopSyncDoneRef.current) {
        initialDesktopSyncDoneRef.current = true
        setIsDetailPanelOpen(!mediaQuery.matches)
      }
    }
    syncDrawerMode()
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncDrawerMode)
      return () => mediaQuery.removeEventListener("change", syncDrawerMode)
    }
    mediaQuery.addListener(syncDrawerMode)
    return () => mediaQuery.removeListener(syncDrawerMode)
  }, [setIsDetailPanelOpen])

  const isDetailDrawerMode = isNarrowViewport
  const shouldShowDetailPanel = isDetailDrawerMode
    ? isDetailPanelOpen && selectedFile !== null
    : isDetailPanelOpen
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

  const {
    uploadQueue,
    uploadInputRef,
    activeUploadCount,
    completedUploadCount,
    aggregateProgress,
    isDragActive,
    queueUploadFiles,
    handleUploadSelect,
    handleUploadDragOver,
    handleUploadDragLeave,
    handleUploadDrop,
    handleCancelUpload,
    handleClearFinishedUploads,
    handleRetryUpload,
  } = useAdminCloudUploadQueue({
    activeFolderPath: normalizedFolderPath,
    onUploadSuccess: (displayUploaded) => {
      const shouldAutoOpenOnFirstEmptyUpload = hadNoFilesRef.current
      hadNoFilesRef.current = false
      setOptimisticFiles((current) => mergeCloudFiles([displayUploaded], current))
      setSelectedFileId((current) => current ?? displayUploaded.id)
      if (shouldAutoOpenOnFirstEmptyUpload) {
        setIsDetailPanelOpen(true)
      }
    },
    onNotice: setNotice,
    onToast: setToast,
  })

  const {
    handleUpdateFile,
    handleMoveFiles,
    performSingleDelete,
    performBulkDelete,
  } = useCloudWorkspaceMutations({
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
  })

  useEffect(() => {
    const isUnfiltered = filter === "ALL" && !debouncedKeyword.trim() && !normalizedFolderPath
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
  }, [
    debouncedKeyword,
    filesQuery.isPlaceholderData,
    filesQuery.isSuccess,
    filter,
    normalizedFolderPath,
    optimisticFiles,
    serverFiles,
  ])

  useEffect(() => {
    if (selectedFileId && !fileIdSet.has(selectedFileId)) setSelectedFileId(null)
  }, [fileIdSet, selectedFileId])

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
    if (!isDetailDrawerMode || !shouldShowDetailPanel || deleteConfirm) return
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return
      event.preventDefault()
      setIsDetailPanelOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [deleteConfirm, isDetailDrawerMode, setIsDetailPanelOpen, shouldShowDetailPanel])

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
    setSelectedFileId(fileId)
    setIsDetailPanelOpen(true)
  }

  const handleSelectFolder = useCallback((folderPath: string) => {
    setActiveFolderPathState(normalizeCloudFolderPath(folderPath))
  }, [])

  const handleCreateFolder = useCallback((folderPath: string) => {
    const normalized = normalizeCloudFolderPath(folderPath)
    if (!normalized) return
    setCreatedFolders((current) =>
      current.includes(normalized)
        ? current
        : [...current, normalized].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }))
    )
    setActiveFolderPathState(normalized)
  }, [])

  const handleCopyFileLink = async (file: CloudFile): Promise<void> => {
    const linkUrl =
      typeof window !== "undefined"
        ? new URL(getCloudFileContentUrl(file.id), window.location.origin).toString()
        : getCloudFileContentUrl(file.id)
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setToast({
        tone: "error",
        text: isEn
          ? "Clipboard permission is unavailable."
          : "클립보드 접근 권한이 없어 파일 링크를 복사하지 못했습니다.",
      })
      return
    }
    try {
      await navigator.clipboard.writeText(linkUrl)
      setToast({
        tone: "success",
        text: isEn ? "Copied admin internal path." : "관리자 내부 경로를 복사했습니다.",
      })
    } catch {
      setToast({
        tone: "error",
        text: isEn
          ? "Clipboard write denied by browser."
          : "클립보드 복사가 거부되었습니다. 브라우저 권한을 확인해주세요.",
      })
    }
  }

  const handleRequestDeleteFile = (file: CloudFile) => setDeleteConfirm({ files: [file] })

  const handleDeleteSelected = () => {
    const targets = checkedFileIds.flatMap((id) => {
      const found = filesById.get(id)
      return found ? [found] : []
    })
    if (targets.length > 0) setDeleteConfirm({ files: targets })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm || isDeletePending) return
    setIsDeletePending(true)
    try {
      if (deleteConfirm.files.length === 1) await performSingleDelete(deleteConfirm.files[0]!)
      else await performBulkDelete(deleteConfirm.files)
      setDeleteConfirm(null)
    } finally {
      setIsDeletePending(false)
    }
  }

  return {
    activeFolderPath: normalizedFolderPath,
    activeUploadCount,
    aggregateProgress,
    allFolders,
    allVisibleChecked,
    checkedFileIds,
    childFolders,
    closeDeleteConfirm,
    completedUploadCount,
    debouncedKeyword,
    deleteCancelButtonRef,
    deleteConfirm,
    deleteDialogRef,
    facetsQuery,
    files,
    filesById,
    filesQuery,
    filter,
    handleCancelUpload,
    handleClearFinishedUploads,
    handleConfirmDelete,
    handleCopyFileLink,
    handleCreateFolder,
    handleDeleteDialogKeyDown,
    handleDeleteSelected,
    handleMoveFiles,
    handlePreviewFile,
    handleRequestDeleteFile,
    handleRetryUpload,
    handleSelectFolder,
    handleSortColumn,
    handleToggleAllChecked,
    handleToggleChecked,
    handleUpdateFile,
    handleUploadDragLeave,
    handleUploadDragOver,
    handleUploadDrop,
    handleUploadSelect,
    isDeletePending,
    isDetailDrawerMode,
    isDragActive,
    isMutationPending,
    keyword,
    notice,
    queueUploadFiles,
    resetSelectionAnchor,
    selectedFile,
    setCheckedFileIds,
    setFilter,
    setIsComposing,
    setIsDetailPanelOpen,
    setKeyword,
    setSelectedFileId,
    setSortMode,
    setToast,
    setViewMode,
    shouldShowDetailPanel,
    sortDirection,
    sortMode,
    toast,
    uploadInputRef,
    uploadQueue,
    viewMode,
  }
}
