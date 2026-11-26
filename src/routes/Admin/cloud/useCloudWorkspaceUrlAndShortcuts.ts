// 클라우드 URL 쿼리(?folder=&kw=&kind=&sort=&dir=) 동기화 및 클립보드 붙여넣기·단축키(F2/Delete) 훅
import type { NextRouter } from "next/router"
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react"
import type { CloudFile } from "src/apis/backend/cloud"
import {
  type CloudMediaFilter,
  type CloudSortDirection,
  type CloudSortMode,
  isCloudSearchPending,
} from "../AdminCloudWorkspaceModel"
import {
  buildCloudWorkspaceUrlQuery,
  getDefaultSortDirection,
  normalizeCloudFolderPath,
  parseCloudWorkspaceUrlQuery,
} from "./cloudFolderHelpers"

const readComparableRouterQuery = (query: NextRouter["query"]) => ({
  folder: normalizeCloudFolderPath(typeof query.folder === "string" ? query.folder : ""),
  kw: typeof query.kw === "string" ? query.kw : "",
  kind: typeof query.kind === "string" ? query.kind : "",
  sort: typeof query.sort === "string" ? query.sort : "",
  dir: typeof query.dir === "string" ? query.dir : "",
})

const buildComparableQueryKey = (query: {
  folder: string
  kw: string
  kind: string
  sort: string
  dir: string
}) => JSON.stringify([query.folder, query.kw, query.kind, query.sort, query.dir])

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable
}

export const useCloudWorkspaceUrlAndShortcuts = ({
  router,
  activeFolderPath,
  keyword,
  debouncedKeyword,
  filter,
  sortMode,
  sortDirection,
  anyOverlayModalOpen,
  checkedFileIds,
  filesById,
  selectedFile,
  clampedPage,
  onSelectFolder,
  setKeyword,
  setFilter,
  setSortMode,
  setPage,
  resetSelectionAnchor,
  queueUploadFiles,
  onOpenRename,
  handleDeleteSelected,
  handleRequestDeleteFile,
}: {
  router: NextRouter
  activeFolderPath: string
  keyword: string
  debouncedKeyword: string
  filter: CloudMediaFilter
  sortMode: CloudSortMode
  sortDirection: CloudSortDirection
  anyOverlayModalOpen: boolean
  checkedFileIds: number[]
  filesById: Map<number, CloudFile>
  selectedFile: CloudFile | null
  clampedPage: number
  onSelectFolder: (folderPath: string) => void
  setKeyword: Dispatch<SetStateAction<string>>
  setFilter: Dispatch<SetStateAction<CloudMediaFilter>>
  setSortMode: (next: CloudSortMode, dir?: CloudSortDirection, options?: { persist?: boolean }) => void
  setPage: Dispatch<SetStateAction<number>>
  resetSelectionAnchor: () => void
  queueUploadFiles: (files: File[]) => Promise<void>
  onOpenRename: (file: CloudFile) => void
  handleDeleteSelected: () => void
  handleRequestDeleteFile: (file: CloudFile) => void
}) => {
  const lastRouterQueryKeyRef = useRef<string | null>(null)
  const pendingReplaceKeysRef = useRef<string[]>([])
  const skipReplaceCommitRef = useRef(false)
  const [isUrlQueryHydrated, setIsUrlQueryHydrated] = useState(false)

  const currentComparableQuery = readComparableRouterQuery(router.query)
  const currentRouterQueryKey = buildComparableQueryKey(currentComparableQuery)

  useEffect(() => {
    if (!router.isReady) return

    if (lastRouterQueryKeyRef.current === null) {
      lastRouterQueryKeyRef.current = currentRouterQueryKey
      const parsed = parseCloudWorkspaceUrlQuery(router.query)
      if (parsed.folderPath !== undefined) onSelectFolder(parsed.folderPath)
      if (parsed.keyword !== undefined) setKeyword(parsed.keyword)
      if (parsed.mediaFilter !== undefined) setFilter(parsed.mediaFilter)
      if (parsed.sortMode !== undefined) {
        setSortMode(parsed.sortMode, parsed.sortDirection, { persist: false })
      } else if (parsed.sortDirection !== undefined) {
        setSortMode("LATEST", parsed.sortDirection, { persist: false })
      }
      setIsUrlQueryHydrated(true)
      return
    }

    if (lastRouterQueryKeyRef.current === currentRouterQueryKey) return
    lastRouterQueryKeyRef.current = currentRouterQueryKey

    const pendingIndex = pendingReplaceKeysRef.current.indexOf(currentRouterQueryKey)
    if (pendingIndex !== -1) {
      pendingReplaceKeysRef.current.splice(0, pendingIndex + 1)
      return
    }

    pendingReplaceKeysRef.current = []
    skipReplaceCommitRef.current = true
    const parsed = parseCloudWorkspaceUrlQuery(router.query)
    onSelectFolder(parsed.folderPath ?? "")
    setKeyword(parsed.keyword ?? "")
    setFilter(parsed.mediaFilter ?? "ALL")
    const nextSortMode = parsed.sortMode ?? "LATEST"
    setSortMode(nextSortMode, parsed.sortDirection ?? getDefaultSortDirection(nextSortMode), {
      persist: false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRouterQueryKey, router.isReady])

  useEffect(() => {
    if (!router.isReady || !isUrlQueryHydrated) return
    if (skipReplaceCommitRef.current) {
      skipReplaceCommitRef.current = false
      return
    }
    if (isCloudSearchPending(keyword, debouncedKeyword)) return

    const nextQuery = buildCloudWorkspaceUrlQuery({
      folderPath: activeFolderPath,
      keyword: debouncedKeyword,
      mediaFilter: filter,
      sortMode,
      sortDirection,
    })

    const nextComparableKey = buildComparableQueryKey({
      folder: nextQuery.folder || "",
      kw: nextQuery.kw || "",
      kind: nextQuery.kind || "",
      sort: nextQuery.sort || "",
      dir: nextQuery.dir || "",
    })

    if (currentRouterQueryKey === nextComparableKey) {
      return
    }
    pendingReplaceKeysRef.current = [
      ...pendingReplaceKeysRef.current.slice(-7),
      nextComparableKey,
    ]
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeFolderPath,
    currentRouterQueryKey,
    debouncedKeyword,
    filter,
    isUrlQueryHydrated,
    keyword,
    router.isReady,
    sortDirection,
    sortMode,
  ])

  useEffect(() => {
    setPage(1)
    resetSelectionAnchor()
  }, [filter, keyword, sortMode, sortDirection, activeFolderPath, resetSelectionAnchor, setPage])

  useEffect(() => {
    resetSelectionAnchor()
  }, [clampedPage, resetSelectionAnchor])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handlePaste = (event: ClipboardEvent) => {
      if (anyOverlayModalOpen || isEditableElement(event.target)) return
      const pastedFiles = Array.from(event.clipboardData?.files || [])
      if (pastedFiles.length === 0) return
      event.preventDefault()
      void queueUploadFiles(pastedFiles)
    }
    const handleShortcut = (event: KeyboardEvent) => {
      if (anyOverlayModalOpen || isEditableElement(event.target) || event.metaKey || event.ctrlKey) {
        return
      }
      if (event.key === "F2") {
        const target =
          checkedFileIds.length === 1
            ? filesById.get(checkedFileIds[0]!) ?? null
            : selectedFile
        if (!target) return
        event.preventDefault()
        onOpenRename(target)
      } else if (event.key === "Delete") {
        if (checkedFileIds.length > 0) {
          event.preventDefault()
          handleDeleteSelected()
        } else if (selectedFile) {
          event.preventDefault()
          handleRequestDeleteFile(selectedFile)
        }
      }
    }
    window.addEventListener("paste", handlePaste)
    window.addEventListener("keydown", handleShortcut)
    return () => {
      window.removeEventListener("paste", handlePaste)
      window.removeEventListener("keydown", handleShortcut)
    }
  }, [
    anyOverlayModalOpen,
    checkedFileIds,
    filesById,
    handleDeleteSelected,
    handleRequestDeleteFile,
    onOpenRename,
    queueUploadFiles,
    selectedFile,
  ])
}
