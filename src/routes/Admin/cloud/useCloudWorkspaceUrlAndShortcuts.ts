// 클라우드 URL 쿼리(?folder=&kw=&kind=&sort=&dir=) 동기화 및 클립보드 붙여넣기·단축키(F2/Delete) 훅
import type { NextRouter } from "next/router"
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react"
import type { CloudFile } from "src/apis/backend/cloud"
import {
  type CloudMediaFilter,
  type CloudSortDirection,
  type CloudSortMode,
  isCloudSearchPending,
} from "../AdminCloudWorkspaceModel"
import {
  buildCloudWorkspaceUrlQuery,
  normalizeCloudFolderPath,
  parseCloudWorkspaceUrlQuery,
} from "./cloudFolderHelpers"

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
  setSortMode: (next: CloudSortMode, dir?: CloudSortDirection) => void
  setPage: Dispatch<SetStateAction<number>>
  resetSelectionAnchor: () => void
  queueUploadFiles: (files: File[]) => Promise<void>
  onOpenRename: (file: CloudFile) => void
  handleDeleteSelected: () => void
  handleRequestDeleteFile: (file: CloudFile) => void
}) => {
  const hasHydratedQueryRef = useRef(false)

  useEffect(() => {
    if (!router.isReady || hasHydratedQueryRef.current) return
    hasHydratedQueryRef.current = true
    const parsed = parseCloudWorkspaceUrlQuery(router.query)
    if (parsed.folderPath !== undefined) onSelectFolder(parsed.folderPath)
    if (parsed.keyword !== undefined) setKeyword(parsed.keyword)
    if (parsed.mediaFilter !== undefined) setFilter(parsed.mediaFilter)
    if (parsed.sortMode !== undefined) setSortMode(parsed.sortMode, parsed.sortDirection)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  useEffect(() => {
    if (!router.isReady || !hasHydratedQueryRef.current) return
    if (isCloudSearchPending(keyword, debouncedKeyword)) return

    const nextQuery = buildCloudWorkspaceUrlQuery({
      folderPath: activeFolderPath,
      keyword: debouncedKeyword,
      mediaFilter: filter,
      sortMode,
      sortDirection,
    })

    const curFolder = normalizeCloudFolderPath(
      typeof router.query.folder === "string" ? router.query.folder : ""
    )
    const curKw = typeof router.query.kw === "string" ? router.query.kw : ""
    const curKind = typeof router.query.kind === "string" ? router.query.kind : ""
    const curSort = typeof router.query.sort === "string" ? router.query.sort : ""
    const curDir = typeof router.query.dir === "string" ? router.query.dir : ""

    if (
      curFolder === (nextQuery.folder || "") &&
      curKw === (nextQuery.kw || "") &&
      curKind === (nextQuery.kind || "") &&
      curSort === (nextQuery.sort || "") &&
      curDir === (nextQuery.dir || "")
    ) {
      return
    }
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolderPath, debouncedKeyword, filter, keyword, router.isReady, sortDirection, sortMode])

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
