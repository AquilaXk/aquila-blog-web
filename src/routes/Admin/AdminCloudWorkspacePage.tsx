/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/AssetsPage.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - TryGhost/Ghost apps/shade/src/components/layout/view-bar.tsx (MIT License, Copyright (c) Ghost Foundation)
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/router"
import { useQuery } from "@tanstack/react-query"
import { getCloudFileFacets } from "src/apis/backend/cloud"
import AppIcon from "./AdminAppIcon"
import {
  AdminCloudAssetGrid,
  CloudFolderBar,
  CloudViewToggle,
  type CloudViewMode,
} from "./AdminCloudAssetGrid"
import { AdminCloudMediaLightbox } from "./AdminCloudMediaLightbox"
import { CloudDeleteConfirmDialog } from "./AdminCloudPreviewDrawer"
import { CloudFileDetailDrawer } from "./AdminCloudWorkspaceDetailDrawer"
import { StrapiUploadIcon } from "./adminStrapiIcons"
import {
  CLOUD_FILTERS,
  CLOUD_SORT_OPTIONS,
  type CloudMediaFilter,
  type CloudSortMode,
  formatCloudFileSize,
  getCloudSummary,
  isCloudSearchPending,
  normalizeCloudFolderPathSearch,
  resolveCloudEmptyTitle,
  resolveCloudSearchParams,
  shouldShowCloudEmptyLoading,
} from "./AdminCloudWorkspaceModel"
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
  ToastViewport,
  UploadIconBadge,
  UploadInput,
  ViewModeButton,
} from "./AdminCloudWorkspace.styles"
import { useAdminCloudWorkspaceActions } from "./useAdminCloudWorkspaceActions"

const toBooleanAttr = (value: boolean) => (value ? "true" : "false")

const formatSearchDetailText = (isSearchBusy: boolean, keyword: string) => {
  if (isSearchBusy) return "검색 중"
  if (keyword) return "파일"
  return "/폴더명 검색어"
}

const CLOUD_PAGE_SIZE = 40

const AdminCloudWorkspacePage = () => {
  const router = useRouter()
  const {
    activeFolderPath,
    activeUploadCount,
    aggregateProgress,
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
  } = useAdminCloudWorkspaceActions()

  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<CloudViewMode>("grid")
  const [lightboxFileId, setLightboxFileId] = useState<number | null>(null)
  // CloudFileDetailDrawer maintains editingFileId internally and resets via setEditingFileId(null)
  const totalPages = Math.max(1, Math.ceil(files.length / CLOUD_PAGE_SIZE))
  const slicedFiles = useMemo(
    () => files.slice((page - 1) * CLOUD_PAGE_SIZE, page * CLOUD_PAGE_SIZE),
    [files, page]
  )
  const slicedFileIds = useMemo(() => slicedFiles.map((file) => file.id), [slicedFiles])
  const checkedSet = useMemo(() => new Set(checkedFileIds), [checkedFileIds])
  const allSliceChecked = slicedFileIds.length > 0 && slicedFileIds.every((id) => checkedSet.has(id))
  const lightboxFile = useMemo(
    () => (lightboxFileId !== null ? files.find((item) => item.id === lightboxFileId) ?? null : null),
    [files, lightboxFileId]
  )

  useEffect(() => {
    if (lightboxFileId !== null && !lightboxFile) {
      setLightboxFileId(null)
    }
  }, [lightboxFile, lightboxFileId])

  const hasHydratedQueryRef = useRef(false)
  useEffect(() => {
    if (!router.isReady || hasHydratedQueryRef.current) return
    hasHydratedQueryRef.current = true
    const qKw = typeof router.query.kw === "string" ? router.query.kw.trim() : ""
    const qKind = typeof router.query.kind === "string" ? router.query.kind : ""
    const qSort = typeof router.query.sort === "string" ? router.query.sort : ""
    const qFolder = typeof router.query.folder === "string" ? normalizeCloudFolderPathSearch(router.query.folder) : ""

    if (qFolder && qKw && !qKw.startsWith("/")) {
      setKeyword(`/${qFolder} ${qKw}`)
    } else if (qKw) {
      setKeyword(qKw)
    } else if (qFolder) {
      handleSelectFolder(qFolder)
    }
    if (qKind && CLOUD_FILTERS.some((f) => f.value === qKind)) {
      setFilter(qKind as CloudMediaFilter)
    }
    if (qSort && CLOUD_SORT_OPTIONS.some((s) => s.key === qSort)) {
      setSortMode(qSort as CloudSortMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  useEffect(() => {
    if (!router.isReady || !hasHydratedQueryRef.current) return
    if (isCloudSearchPending(keyword, debouncedKeyword)) return

    const parsedSearch = resolveCloudSearchParams(debouncedKeyword)
    const nextFolder = normalizeCloudFolderPathSearch(parsedSearch.folderPath || "")
    const nextKw = (parsedSearch.keyword || "").trim()
    const nextKind = filter !== "ALL" ? filter : ""
    const nextSort = sortMode !== "LATEST" ? sortMode : ""

    const curFolder = typeof router.query.folder === "string" ? normalizeCloudFolderPathSearch(router.query.folder) : ""
    const curKw = typeof router.query.kw === "string" ? router.query.kw : ""
    const curKind = typeof router.query.kind === "string" ? router.query.kind : ""
    const curSort = typeof router.query.sort === "string" ? router.query.sort : ""

    if (curFolder === nextFolder && curKw === nextKw && curKind === nextKind && curSort === nextSort) {
      return
    }

    const query: Record<string, string> = {}
    if (nextFolder) query.folder = nextFolder
    if (nextKw) query.kw = nextKw
    if (nextKind) query.kind = nextKind
    if (nextSort) query.sort = nextSort
    void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKeyword, filter, keyword, router.isReady, sortMode])

  useEffect(() => {
    setPage(1)
    resetSelectionAnchor()
  }, [filter, keyword, sortMode, activeFolderPath, resetSelectionAnchor])

  useEffect(() => {
    resetSelectionAnchor()
  }, [page, resetSelectionAnchor])

  const facetsQuery = useQuery({
    queryKey: ["admin-cloud-facets"],
    queryFn: ({ signal }) => getCloudFileFacets(signal),
    staleTime: 30_000,
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
              <h1>미디어 라이브러리</h1>
              <CloudFacetStrip aria-label="스토리지 용량 요약">
                전체 {totalCount}개 · {totalSizeText} · 사진 {photoCount} · 동영상 {videoCount} · 문서 {documentCount}
              </CloudFacetStrip>
            </div>
            <CloudHeaderActions>
              <UploadInput
                ref={uploadInputRef}
                aria-label="클라우드 파일 업로드"
                type="file"
                multiple
                onChange={handleUploadSelect}
              />
              <PrimaryButton
                type="button"
                aria-label={activeUploadCount > 0 ? "업로드 중" : "파일 업로드"}
                onClick={() => uploadInputRef.current?.click()}
              >
                파일 업로드
              </PrimaryButton>
            </CloudHeaderActions>
          </CloudTitleBar>

          {isDragActive ? (
            <CloudDropOverlay aria-hidden="true">
              <UploadIconBadge>
                <StrapiUploadIcon width={22} height={22} />
              </UploadIconBadge>
              <strong>파일을 놓아 미디어 라이브러리에 업로드</strong>
              <span>사진 50MB · 문서/압축 95MB · 동영상 5GB 이하</span>
            </CloudDropOverlay>
          ) : null}

          <ActionBar data-slot="view-bar">
            <ActionGroup data-slot="view-bar-nav">
              <SelectAllLabel>
                <RowCheckbox
                  type="checkbox"
                  aria-label={allSliceChecked ? "전체 선택 해제" : "전체 선택"}
                  checked={allSliceChecked}
                  disabled={slicedFileIds.length === 0}
                  onChange={() => handleToggleAllChecked(slicedFileIds)}
                />
                <span>
                  {checkedFileIds.length > 0 ? `${checkedFileIds.length}개 선택` : "전체 선택"}
                </span>
              </SelectAllLabel>
              <SecondaryButton
                type="button"
                disabled={checkedFileIds.length === 0}
                onClick={handleDeleteSelected}
              >
                선택 삭제
              </SecondaryButton>
              <FilterGroup aria-label="파일 종류 필터">
                {CLOUD_FILTERS.map((item) => (
                  <GhostButton
                    key={item.value}
                    type="button"
                    data-active={toBooleanAttr(filter === item.value)}
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                  </GhostButton>
                ))}
              </FilterGroup>
              <CloudSearchField>
                <AppIcon name="search" />
                <SearchInput
                  aria-label="클라우드 파일 검색"
                  placeholder="클라우드 파일 검색"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                />
                <SearchTrailing>
                  {keyword ? (
                    <SearchClearButton type="button" aria-label="검색어 지우기" onClick={() => setKeyword("")}>
                      지우기
                    </SearchClearButton>
                  ) : null}
                  <SearchDetail aria-busy={toBooleanAttr(isSearchBusy)}>
                    {formatSearchDetailText(isSearchBusy, keyword)}
                  </SearchDetail>
                </SearchTrailing>
              </CloudSearchField>
            </ActionGroup>

            <ActionGroup data-align="end" data-slot="view-bar-actions">
              {notice ? <Notice>{notice}</Notice> : null}
              <SortSelect
                aria-label="파일 정렬"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as CloudSortMode)}
              >
                {CLOUD_SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </SortSelect>
              <CloudViewToggle viewMode={viewMode} onChange={setViewMode} />
              <ViewModeButton
                type="button"
                aria-label="상세 패널 보기"
                data-active={toBooleanAttr(shouldShowDetailPanel)}
                onClick={() => {
                  const firstFileId = slicedFiles[0]?.id ?? files[0]?.id ?? null
                  setIsDetailPanelOpen((current) => !current)
                  setSelectedFileId((current) => current ?? firstFileId)
                }}
              >
                <AppIcon name="info" />
                정보
              </ViewModeButton>
            </ActionGroup>
          </ActionBar>

          <CloudFolderBar
            folders={availableFolders}
            activeFolderPath={activeFolderPath}
            onSelectFolder={handleSelectFolder}
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
              activeUploadCount={activeUploadCount}
              checkedFileIds={checkedFileIds}
              emptyTitle={emptyTitle}
              files={slicedFiles}
              isFetching={filesQuery.isFetching}
              isFileListError={isFileListError}
              onExpandFile={(fileId) => setLightboxFileId(fileId)}
              onOpenUploadPicker={() => uploadInputRef.current?.click()}
              onPreviewFile={handlePreviewFile}
              onRetryList={() => void filesQuery.refetch()}
              onToggleChecked={(fileId, shiftKey) => handleToggleChecked(fileId, shiftKey, slicedFileIds)}
              selectedFile={selectedFile}
              shouldShowDetailPanel={shouldShowDetailPanel}
              showEmptyLoading={showEmptyLoading}
            />
          ) : (
            <FileTableScroll>
              <CloudFileTableSection
                activeUploadCount={activeUploadCount}
                checkedFileIds={checkedFileIds}
                emptyTitle={emptyTitle}
                files={slicedFiles}
                isFetching={filesQuery.isFetching}
                isFileListError={isFileListError}
                onExpandFile={(fileId) => setLightboxFileId(fileId)}
                onOpenUploadPicker={() => uploadInputRef.current?.click()}
                onPreviewFile={handlePreviewFile}
                onRetryList={() => void filesQuery.refetch()}
                onToggleChecked={(fileId, shiftKey) => handleToggleChecked(fileId, shiftKey, slicedFileIds)}
                selectedFile={selectedFile}
                shouldShowDetailPanel={shouldShowDetailPanel}
                showEmptyLoading={showEmptyLoading}
              />
            </FileTableScroll>
          )}

          {totalPages > 1 ? (
            <ActionBar data-pagination="true" aria-label="클라우드 파일 페이지 이동">
              <CloudPaginationLabel>
                {page} / {totalPages} 페이지 (총 {files.length}개)
              </CloudPaginationLabel>
              <ActionGroup>
                <SecondaryButton
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  이전
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  다음
                </SecondaryButton>
              </ActionGroup>
            </ActionBar>
          ) : null}
        </CloudContent>

        {shouldShowDetailPanel && selectedFile ? (
          <CloudFileDetailDrawer
            detailMode={detailMode}
            isDeleteConfirmOpen={Boolean(deleteConfirm)}
            isLightboxOpen={lightboxFile !== null}
            onClose={() => setIsDetailPanelOpen(false)}
            onCopyFileLink={handleCopyFileLink}
            onOpenLightbox={(fileId) => setLightboxFileId(fileId)}
            onRequestDeleteFile={handleRequestDeleteFile}
            onUpdateFile={handleUpdateFile}
            selectedFile={selectedFile}
            onToast={setToast}
          />
        ) : null}
      </CloudWorkspace>

      <AdminCloudMediaLightbox
        open={lightboxFile !== null}
        file={lightboxFile}
        files={files}
        onClose={() => setLightboxFileId(null)}
        onSelectFile={(nextId) => {
          setLightboxFileId(nextId)
          setSelectedFileId(nextId)
        }}
        onCopyFileLink={handleCopyFileLink}
      />

      {toast ? (
        <ToastViewport data-tone={toast.tone} role="status" aria-live="polite">
          <strong>{toast.tone === "error" ? "작업 실패" : "작업 완료"}</strong>
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)}>
            닫기
          </button>
        </ToastViewport>
      ) : null}
      {deleteConfirm ? (
        <CloudDeleteConfirmDialog
          files={deleteConfirm.files}
          isDeletePending={isDeletePending}
          deleteDialogRef={deleteDialogRef}
          deleteCancelButtonRef={deleteCancelButtonRef}
          onClose={closeDeleteConfirm}
          onConfirm={() => void handleConfirmDelete()}
          onKeyDown={handleDeleteDialogKeyDown}
        />
      ) : null}
    </CloudMain>
  )
}

export default AdminCloudWorkspacePage
