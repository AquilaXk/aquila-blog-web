/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/AssetsPage.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - supabase/supabase StorageExplorer & CustomExpiryModal & MoveItemsModal (Apache-2.0)
 * - TryGhost/Ghost apps/shade/src/components/layout/view-bar.tsx (MIT License, Copyright (c) Ghost Foundation)
 */
import { useRouter } from "next/router"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getCloudFileDownloadUrl,
  type CloudFile,
} from "src/apis/backend/cloud"
import { useLanguage } from "src/libs/language"
import AppIcon from "./AdminAppIcon"
import { AdminCloudAssetGrid, CloudViewToggle } from "./AdminCloudAssetGrid"
import AdminCloudUploadQueue, { CloudFileTableSection } from "./AdminCloudUploadQueue"
import {
  ActionBar,
  ActionGroup,
  CloudContent,
  CloudDropOverlay,
  CloudFacetStrip,
  CloudHeaderActions,
  CloudMain,
  CloudPaginationLabel,
  CloudSearchField,
  CloudTitleBar,
  CloudWorkspace,
  FileTableScroll,
  FilterGroup,
  GhostButton,
  Notice,
  PrimaryButton,
  RowCheckbox,
  SearchClearButton,
  SearchDetail,
  SearchInput,
  SearchTrailing,
  SecondaryButton,
  SelectAllLabel,
  SortSelect,
  UploadIconBadge,
  UploadInput,
  ViewModeButton,
} from "./AdminCloudWorkspace.styles"
import { CloudFileDetailDrawer } from "./AdminCloudWorkspaceDetailDrawer"
import {
  CLOUD_FILTERS,
  CLOUD_SORT_OPTIONS,
  type CloudSortMode,
  formatCloudFileSize,
  getCloudSummary,
  isCloudSearchPending,
  resolveCloudEmptyTitle,
  shouldShowCloudEmptyLoading,
} from "./AdminCloudWorkspaceModel"
import { StrapiUploadIcon } from "./adminStrapiIcons"
import {
  getCloudDictionary,
  getCloudKindLabelI18n,
  getCloudSortLabelI18n,
} from "./cloud/adminCloudI18n"
import { CloudFolderBreadcrumbBar } from "./cloud/CloudBreadcrumbBar"
import type { CloudContextMenuState } from "./cloud/CloudContextMenu"
import { CloudWorkspaceModalsAndOverlays } from "./cloud/CloudWorkspaceModalsAndOverlays"
import { useCloudWorkspaceUrlAndShortcuts } from "./cloud/useCloudWorkspaceUrlAndShortcuts"
import { useAdminCloudWorkspaceActions } from "./useAdminCloudWorkspaceActions"

const toBooleanAttr = (value: boolean) => (value ? "true" : "false")
const CLOUD_PAGE_SIZE = 40

const triggerFileDownload = (file: CloudFile) => {
  if (typeof document === "undefined") return
  const link = document.createElement("a")
  link.href = getCloudFileDownloadUrl(file.id)
  link.download = file.originalFilename
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const AdminCloudWorkspacePage = () => {
  const router = useRouter()
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const isEn = language === "en"

  const {
    activeFolderPath,
    activeUploadCount,
    aggregateProgress,
    allFolders,
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
  } = useAdminCloudWorkspaceActions()

  const [page, setPage] = useState(1)
  const [lightboxFileId, setLightboxFileId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<CloudContextMenuState>(null)
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false)
  const [moveTargets, setMoveTargets] = useState<CloudFile[] | null>(null)
  const [renameTarget, setRenameTarget] = useState<CloudFile | null>(null)
  const [shareTarget, setShareTarget] = useState<CloudFile | null>(null)

  const totalPages = Math.max(1, Math.ceil(files.length / CLOUD_PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const slicedFiles = useMemo(
    () => files.slice((clampedPage - 1) * CLOUD_PAGE_SIZE, clampedPage * CLOUD_PAGE_SIZE),
    [clampedPage, files]
  )
  const slicedFileIds = useMemo(() => slicedFiles.map((file) => file.id), [slicedFiles])
  const checkedSet = useMemo(() => new Set(checkedFileIds), [checkedFileIds])
  const allSliceChecked =
    slicedFileIds.length > 0 && slicedFileIds.every((id) => checkedSet.has(id))
  const lightboxFile = useMemo(
    () => (lightboxFileId !== null ? files.find((item) => item.id === lightboxFileId) ?? null : null),
    [files, lightboxFileId]
  )

  useEffect(() => {
    if (lightboxFileId !== null && !lightboxFile) setLightboxFileId(null)
  }, [lightboxFile, lightboxFileId])

  const anyOverlayModalOpen =
    Boolean(deleteConfirm) ||
    newFolderModalOpen ||
    moveTargets !== null ||
    renameTarget !== null ||
    shareTarget !== null ||
    lightboxFile !== null

  useCloudWorkspaceUrlAndShortcuts({
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
    onSelectFolder: handleSelectFolder,
    setKeyword,
    setFilter,
    setSortMode,
    setPage,
    resetSelectionAnchor,
    queueUploadFiles,
    onOpenRename: setRenameTarget,
    handleDeleteSelected,
    handleRequestDeleteFile,
  })

  const facets = facetsQuery.data

  const summary = useMemo(() => getCloudSummary(files), [files])
  const isFileListError = filesQuery.isError
  const isSearchPending = isCloudSearchPending(keyword, debouncedKeyword)
  const isSearchBusy = filesQuery.isFetching || isSearchPending
  const detailMode = isDetailDrawerMode ? "drawer" : "inline"
  const emptyTitle = resolveCloudEmptyTitle({
    activeUploadCount,
    debouncedKeyword,
    filter,
    isError: isFileListError,
    isFetching: filesQuery.isFetching,
    isLoading: filesQuery.isLoading,
    keyword,
    language,
  })
  const showEmptyLoading = shouldShowCloudEmptyLoading({
    filesCount: files.length,
    isLoading: filesQuery.isLoading,
    isSearchPending,
  })

  const hasValidFacets = facets != null && typeof facets.allCount === "number"
  const totalCount = hasValidFacets ? facets.allCount : summary.totalCount
  const totalSizeText = hasValidFacets ? formatCloudFileSize(facets.allBytes) : summary.totalSize
  const photoCount = hasValidFacets ? facets.photoCount : summary.photoCount
  const videoCount = hasValidFacets ? facets.videoCount : summary.videoCount
  const documentCount = hasValidFacets ? facets.documentCount : summary.documentCount

  const handleOpenBulkMove = useCallback(() => {
    const targets = checkedFileIds.flatMap((id) => {
      const f = filesById.get(id)
      return f ? [f] : []
    })
    if (targets.length > 0) setMoveTargets(targets)
  }, [checkedFileIds, filesById])

  const handleBulkDownload = useCallback(() => {
    const targets = checkedFileIds.flatMap((id) => {
      const f = filesById.get(id)
      return f ? [f] : []
    })
    targets.slice(0, 10).forEach((file) => triggerFileDownload(file))
  }, [checkedFileIds, filesById])

  return (
    <CloudMain>
      <CloudWorkspace
        data-detail-open={toBooleanAttr(shouldShowDetailPanel)}
        data-detail-mode={detailMode}
      >
        <CloudContent
          data-drag-active={toBooleanAttr(isDragActive)}
          onDragOver={handleUploadDragOver}
          onDragLeave={handleUploadDragLeave}
          onDrop={handleUploadDrop}
        >
          <CloudTitleBar>
            <div>
              <h1>{t.pageTitle}</h1>
              <CloudFacetStrip aria-label={isEn ? "Storage summary" : "스토리지 용량 요약"}>
                {isEn
                  ? `${totalCount} total · ${totalSizeText} · Photos ${photoCount} · Videos ${videoCount} · Docs ${documentCount}`
                  : `전체 ${totalCount}개 · ${totalSizeText} · 사진 ${photoCount} · 동영상 ${videoCount} · 문서 ${documentCount}`}
              </CloudFacetStrip>
            </div>
            <CloudHeaderActions>
              <UploadInput
                ref={uploadInputRef}
                aria-label={isEn ? "Cloud file upload" : "클라우드 파일 업로드"}
                type="file"
                multiple
                onChange={handleUploadSelect}
              />
              <PrimaryButton
                type="button"
                aria-label={activeUploadCount > 0 ? t.uploadingButton : t.uploadButton}
                onClick={() => uploadInputRef.current?.click()}
              >
                {t.uploadButton}
              </PrimaryButton>
            </CloudHeaderActions>
          </CloudTitleBar>

          {isDragActive ? (
            <CloudDropOverlay aria-hidden="true">
              <UploadIconBadge>
                <StrapiUploadIcon width={22} height={22} />
              </UploadIconBadge>
              <strong>{t.dropOverlayTitle}</strong>
              <span>{t.capacityLimitHint}</span>
            </CloudDropOverlay>
          ) : null}

          <ActionBar data-slot="view-bar">
            <ActionGroup data-slot="view-bar-nav">
              <SelectAllLabel>
                <RowCheckbox
                  type="checkbox"
                  aria-label={allSliceChecked ? t.bulkClearSelection : t.selectAll}
                  checked={allSliceChecked}
                  disabled={slicedFileIds.length === 0}
                  onChange={() => handleToggleAllChecked(slicedFileIds)}
                />
                <span>
                  {checkedFileIds.length > 0
                    ? t.bulkSelectedCount(checkedFileIds.length)
                    : isEn
                      ? "Select all"
                      : "전체 선택"}
                </span>
              </SelectAllLabel>
              <FilterGroup aria-label={isEn ? "File kind filter" : "파일 종류 필터"}>
                {CLOUD_FILTERS.map((item) => (
                  <GhostButton
                    key={item.value}
                    type="button"
                    data-active={toBooleanAttr(filter === item.value)}
                    onClick={() => setFilter(item.value)}
                  >
                    {getCloudKindLabelI18n(item.value, language)}
                  </GhostButton>
                ))}
              </FilterGroup>
              <CloudSearchField>
                <AppIcon name="search" />
                <SearchInput
                  aria-label={t.searchLabel}
                  placeholder={t.searchPlaceholder}
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                />
                <SearchTrailing>
                  {keyword ? (
                    <SearchClearButton
                      type="button"
                      aria-label={t.clearSearch}
                      onClick={() => setKeyword("")}
                    >
                      {isEn ? "Clear" : "지우기"}
                    </SearchClearButton>
                  ) : null}
                  <SearchDetail aria-busy={toBooleanAttr(isSearchBusy)}>
                    {isSearchBusy ? (isEn ? "Searching..." : "검색 중…") : ""}
                  </SearchDetail>
                </SearchTrailing>
              </CloudSearchField>
            </ActionGroup>

            <ActionGroup data-align="end" data-slot="view-bar-actions">
              {notice ? <Notice>{notice}</Notice> : null}
              <SortSelect
                aria-label={isEn ? "Sort files" : "파일 정렬"}
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as CloudSortMode)}
              >
                {CLOUD_SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {getCloudSortLabelI18n(option.key, language)}
                  </option>
                ))}
              </SortSelect>
              <CloudViewToggle viewMode={viewMode} onChange={setViewMode} />
              <ViewModeButton
                type="button"
                aria-label={isEn ? "Toggle details panel" : "상세 패널 보기"}
                data-active={toBooleanAttr(shouldShowDetailPanel)}
                onClick={() => {
                  const firstFileId = slicedFiles[0]?.id ?? files[0]?.id ?? null
                  setIsDetailPanelOpen((current) => !current)
                  setSelectedFileId((current) => current ?? firstFileId)
                }}
              >
                <AppIcon name="info" />
                {isEn ? "Info" : "정보"}
              </ViewModeButton>
            </ActionGroup>
          </ActionBar>

          <CloudFolderBreadcrumbBar
            activeFolderPath={activeFolderPath}
            childFolders={childFolders}
            onSelectFolder={handleSelectFolder}
            onOpenNewFolder={() => setNewFolderModalOpen(true)}
          />

          <AdminCloudUploadQueue
            uploadQueue={uploadQueue}
            activeUploadCount={activeUploadCount}
            completedUploadCount={completedUploadCount}
            aggregateProgress={aggregateProgress}
            onCancelUpload={handleCancelUpload}
            onRetryUpload={handleRetryUpload}
            onClearFinishedUploads={handleClearFinishedUploads}
          />

          {viewMode === "grid" ? (
            <AdminCloudAssetGrid
              activeFolderPath={activeFolderPath}
              activeUploadCount={activeUploadCount}
              checkedFileIds={checkedFileIds}
              emptyTitle={emptyTitle}
              files={slicedFiles}
              isFetching={filesQuery.isFetching}
              isFileListError={isFileListError}
              onExpandFile={(fileId) => setLightboxFileId(fileId)}
              onOpenContextMenu={(file, x, y) => setContextMenu({ file, x, y })}
              onOpenUploadPicker={() => uploadInputRef.current?.click()}
              onPreviewFile={handlePreviewFile}
              onRetryList={() => void filesQuery.refetch()}
              onToggleChecked={(fileId, shiftKey) =>
                handleToggleChecked(fileId, shiftKey, slicedFileIds)
              }
              selectedFile={selectedFile}
              shouldShowDetailPanel={shouldShowDetailPanel}
              showEmptyLoading={showEmptyLoading}
            />
          ) : (
            <FileTableScroll>
              <CloudFileTableSection
                activeFolderPath={activeFolderPath}
                activeUploadCount={activeUploadCount}
                checkedFileIds={checkedFileIds}
                emptyTitle={emptyTitle}
                files={slicedFiles}
                isFetching={filesQuery.isFetching}
                isFileListError={isFileListError}
                sortMode={sortMode}
                sortDirection={sortDirection}
                onSortColumn={handleSortColumn}
                onExpandFile={(fileId) => setLightboxFileId(fileId)}
                onOpenContextMenu={(file, x, y) => setContextMenu({ file, x, y })}
                onOpenUploadPicker={() => uploadInputRef.current?.click()}
                onPreviewFile={handlePreviewFile}
                onRetryList={() => void filesQuery.refetch()}
                onToggleChecked={(fileId, shiftKey) =>
                  handleToggleChecked(fileId, shiftKey, slicedFileIds)
                }
                selectedFile={selectedFile}
                shouldShowDetailPanel={shouldShowDetailPanel}
                showEmptyLoading={showEmptyLoading}
              />
            </FileTableScroll>
          )}

          {totalPages > 1 ? (
            <ActionBar
              data-pagination="true"
              aria-label={isEn ? "Cloud pagination" : "클라우드 파일 페이지 이동"}
            >
              <CloudPaginationLabel>
                {isEn
                  ? `Page ${clampedPage} / ${totalPages} (${files.length} total)`
                  : `${clampedPage} / ${totalPages} 페이지 (총 ${files.length}개)`}
              </CloudPaginationLabel>
              <ActionGroup>
                <SecondaryButton
                  type="button"
                  disabled={clampedPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {isEn ? "Previous" : "이전"}
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={clampedPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {isEn ? "Next" : "다음"}
                </SecondaryButton>
              </ActionGroup>
            </ActionBar>
          ) : null}
        </CloudContent>

        {shouldShowDetailPanel ? (
          <CloudFileDetailDrawer
            detailMode={detailMode}
            isDeleteConfirmOpen={anyOverlayModalOpen}
            isLightboxOpen={lightboxFile !== null}
            onClose={() => setIsDetailPanelOpen(false)}
            onCopyFileLink={handleCopyFileLink}
            onOpenLightbox={(fileId) => setLightboxFileId(fileId)}
            onOpenShareModal={(file) => setShareTarget(file)}
            onRequestDeleteFile={handleRequestDeleteFile}
            onUpdateFile={handleUpdateFile}
            selectedFile={selectedFile}
            onToast={setToast}
          />
        ) : null}
      </CloudWorkspace>

      <CloudWorkspaceModalsAndOverlays
        checkedCount={checkedFileIds.length}
        isBusy={isDeletePending || isMutationPending}
        activeFolderPath={activeFolderPath}
        allFolders={allFolders}
        files={files}
        contextMenu={contextMenu}
        newFolderModalOpen={newFolderModalOpen}
        moveTargets={moveTargets}
        renameTarget={renameTarget}
        shareTarget={shareTarget}
        lightboxFile={lightboxFile}
        toast={toast}
        deleteConfirm={deleteConfirm}
        isDeletePending={isDeletePending}
        deleteDialogRef={deleteDialogRef}
        deleteCancelButtonRef={deleteCancelButtonRef}
        onCloseContextMenu={() => setContextMenu(null)}
        onCloseNewFolder={() => setNewFolderModalOpen(false)}
        onCloseMove={() => setMoveTargets(null)}
        onCloseRename={() => setRenameTarget(null)}
        onCloseShare={() => setShareTarget(null)}
        onCloseLightbox={() => setLightboxFileId(null)}
        onCloseDelete={closeDeleteConfirm}
        onClearToast={() => setToast(null)}
        onOpenBulkMove={handleOpenBulkMove}
        onBulkDownload={handleBulkDownload}
        onBulkDelete={handleDeleteSelected}
        onClearSelection={() => setCheckedFileIds([])}
        onOpenLightbox={(fileId) => setLightboxFileId(fileId)}
        onSelectFile={setSelectedFileId}
        onOpenRename={(file) => setRenameTarget(file)}
        onOpenMove={(targets) => setMoveTargets(targets)}
        onOpenShare={(file) => setShareTarget(file)}
        onDownloadFile={triggerFileDownload}
        onRequestDeleteFile={handleRequestDeleteFile}
        onCreateFolder={handleCreateFolder}
        onMoveFiles={handleMoveFiles}
        onUpdateFile={handleUpdateFile}
        onCopyFileLink={handleCopyFileLink}
        onConfirmDelete={() => void handleConfirmDelete()}
        onDeleteDialogKeyDown={handleDeleteDialogKeyDown}
        onToast={setToast}
      />
    </CloudMain>
  )
}

export default AdminCloudWorkspacePage
