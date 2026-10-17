import type { CloudFile } from "src/apis/backend/cloud"
import AppIcon from "src/components/icons/AppIcon"
import {
  CloudDeleteConfirmDialog,
  FileTableHead,
  FileThumbnail,
  PreviewDrawer,
} from "./AdminCloudPreviewDrawer"
import {
  CLOUD_FILTERS,
  formatCloudDate,
  formatCloudFileSize,
  getCloudFilenameParts,
  getCloudKindBadge,
  getCloudKindIconLabel,
  getCloudKindLabel,
  isCloudSearchPending,
  resolveCloudEmptyTitle,
  shouldShowCloudEmptyLoading,
} from "./AdminCloudWorkspaceModel"
import AdminCloudUploadQueue from "./AdminCloudUploadQueue"
import {
  ActionBar,
  ActionGroup,
  CloudContent,
  CloudMain,
  CloudSearchField,
  CloudTitleBar,
  CloudWorkspace,
  DetailHeader,
  DetailMetaList,
  DetailPanel,
  DetailPreviewBox,
  DetailScrim,
  DetailSummary,
  DetailTab,
  DetailTabs,
  EmptyTableState,
  FileIdentity,
  FileMetaLine,
  FileNameButton,
  FileNameStack,
  FileTable,
  FileTableScroll,
  FileTypeIcon,
  FilterGroup,
  GhostButton,
  IconButton,
  LoadingTableStatus,
  Notice,
  PrimaryButton,
  RowCheckbox,
  SearchDetail,
  SearchInput,
  SecondaryButton,
  SelectBoxCell,
  SkeletonRow,
  SkeletonRows,
  ToastViewport,
  UploadInput,
  UploadZone,
  ViewModeButton,
} from "./AdminCloudWorkspace.styles"
import { useAdminCloudWorkspaceActions } from "./useAdminCloudWorkspaceActions"

type CloudFileTableSectionProps = {
  activeUploadCount: number
  checkedFileIds: number[]
  emptyTitle: string
  files: CloudFile[]
  isFetching: boolean
  isFileListError: boolean
  onOpenUploadPicker: () => void
  onPreviewFile: (fileId: number) => void
  onRetryList: () => void
  onToggleChecked: (fileId: number) => void
  selectedFile: CloudFile | null
  shouldShowDetailPanel: boolean
  showEmptyLoading: boolean
}

const CloudFileTableSection = ({
  activeUploadCount,
  checkedFileIds,
  emptyTitle,
  files,
  isFetching,
  isFileListError,
  onOpenUploadPicker,
  onPreviewFile,
  onRetryList,
  onToggleChecked,
  selectedFile,
  shouldShowDetailPanel,
  showEmptyLoading,
}: CloudFileTableSectionProps) => {
  if (showEmptyLoading) {
    return (
      <FileTable role="table" aria-busy="true">
        <FileTableHead />
        <tbody>
          <tr data-loading-row="true">
            <td colSpan={4}>
              <LoadingTableStatus role="status" aria-label="파일 목록 로딩">
                <SkeletonRows aria-hidden="true">
                  <SkeletonRow data-admin-cloud-skeleton-row="true" />
                  <SkeletonRow data-admin-cloud-skeleton-row="true" />
                  <SkeletonRow data-admin-cloud-skeleton-row="true" />
                </SkeletonRows>
              </LoadingTableStatus>
            </td>
          </tr>
        </tbody>
      </FileTable>
    )
  }

  if (files.length === 0) {
    return (
      <EmptyTableState>
        <strong>{emptyTitle}</strong>
        {activeUploadCount > 0 ? null : isFileListError ? (
          <PrimaryButton type="button" aria-label="파일 목록 다시 시도" onClick={onRetryList}>
            다시 시도
          </PrimaryButton>
        ) : (
          <PrimaryButton type="button" aria-label="파일 업로드" onClick={onOpenUploadPicker}>
            ⤴ 올리기
          </PrimaryButton>
        )}
      </EmptyTableState>
    )
  }

  return (
    <FileTable role="table" aria-busy={isFetching ? "true" : "false"}>
      <FileTableHead />
      <tbody>
        {files.map((file) => {
          const checked = checkedFileIds.includes(file.id)
          const selected = shouldShowDetailPanel && selectedFile?.id === file.id
          const filenameParts = getCloudFilenameParts(file.originalFilename)
          return (
            <tr key={file.id} role="row" data-selected={selected ? "true" : "false"}>
              <SelectBoxCell>
                <RowCheckbox
                  type="checkbox"
                  aria-label={`${file.originalFilename} 선택`}
                  checked={checked}
                  onChange={() => onToggleChecked(file.id)}
                />
              </SelectBoxCell>
              <td>
                <FileIdentity>
                  <FileThumbnail file={file} selected={selected} />
                  <FileNameStack>
                    <FileNameButton
                      type="button"
                      title={file.originalFilename}
                      onClick={() => onPreviewFile(file.id)}
                    >
                      <strong>
                        <span data-filename-stem>{filenameParts.stem}</span>
                        <span data-filename-extension>{filenameParts.extension}</span>
                      </strong>
                    </FileNameButton>
                    <FileMetaLine>
                      <FileTypeIcon
                        aria-label={getCloudKindLabel(file.mediaKind)}
                        data-file-kind-badge="true"
                        data-selected={selected ? "true" : "false"}
                      >
                        {getCloudKindIconLabel(file)}
                      </FileTypeIcon>
                      <span>{getCloudKindLabel(file.mediaKind)}</span>
                    </FileMetaLine>
                  </FileNameStack>
                </FileIdentity>
              </td>
              <td>{formatCloudFileSize(file.byteSize)}</td>
              <td>{formatCloudDate(file.modifiedAt || file.createdAt)}</td>
            </tr>
          )
        })}
      </tbody>
    </FileTable>
  )
}

const AdminCloudWorkspacePage = () => {
  const {
    activeUploadCount,
    allVisibleChecked,
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
    handleDeleteDialogKeyDown,
    handleDeleteSelected,
    handlePreviewFile,
    handleRetryUpload,
    handleToggleAllChecked,
    handleToggleChecked,
    handleUploadDragOver,
    handleUploadDrop,
    handleUploadSelect,
    isDetailDrawerMode,
    isDeletePending,
    keyword,
    notice,
    selectedFile,
    setFilter,
    setIsComposing,
    setIsDetailPanelOpen,
    setKeyword,
    setSelectedFileId,
    setToast,
    shouldShowDetailPanel,
    toast,
    uploadInputRef,
    uploadQueue,
  } = useAdminCloudWorkspaceActions()

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

  return (
    <CloudMain>
      <CloudWorkspace
        data-detail-open={shouldShowDetailPanel ? "true" : "false"}
        data-detail-mode={detailMode}
      >
        <CloudContent>
          <CloudTitleBar>
            <div>
              <span>Storage</span>
              <h1>미디어 라이브러리</h1>
              <p>글 이미지, 첨부 파일과 업로드 lifecycle을 관리합니다.</p>
            </div>
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
              <SearchDetail aria-busy={isSearchBusy ? "true" : "false"}>
                {isSearchBusy ? "검색 중" : "파일"}
              </SearchDetail>
            </CloudSearchField>
          </CloudTitleBar>

          <UploadZone
            type="button"
            aria-label="파일을 끌어놓거나 클릭해 업로드"
            onClick={() => uploadInputRef.current?.click()}
            onDragOver={handleUploadDragOver}
            onDrop={handleUploadDrop}
          >
            <AppIcon name="cloud" />
            <strong>파일을 끌어놓거나 클릭해 업로드</strong>
            <span>사진 50MB · 문서 100MB · 동영상 5GB 이하</span>
          </UploadZone>

          <ActionBar>
            <ActionGroup>
              <IconButton
                type="button"
                aria-label={allVisibleChecked ? "전체 선택 해제" : "전체 선택"}
                data-active={allVisibleChecked ? "true" : "false"}
                onClick={handleToggleAllChecked}
              >
                ✓
              </IconButton>
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
                ⤴ 올리기
              </PrimaryButton>
              <SecondaryButton type="button" disabled={checkedFileIds.length === 0} onClick={handleDeleteSelected}>
                선택 삭제
              </SecondaryButton>
            </ActionGroup>

            <ActionGroup data-align="end">
              {notice ? <Notice>{notice}</Notice> : null}
              <FilterGroup aria-label="파일 종류 필터">
                {CLOUD_FILTERS.map((item) => (
                  <GhostButton
                    key={item.value}
                    type="button"
                    data-active={filter === item.value ? "true" : "false"}
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                  </GhostButton>
                ))}
              </FilterGroup>
              <ViewModeButton
                type="button"
                aria-label="상세 패널 보기"
                data-active={shouldShowDetailPanel ? "true" : "false"}
                onClick={() => {
                  setIsDetailPanelOpen((current) => !current)
                  setSelectedFileId((current) => current ?? files[0]?.id ?? null)
                }}
              >
                ⓘ 정보
              </ViewModeButton>
            </ActionGroup>
          </ActionBar>

          <AdminCloudUploadQueue
            uploadQueue={uploadQueue}
            activeUploadCount={activeUploadCount}
            completedUploadCount={completedUploadCount}
            onCancelUpload={handleCancelUpload}
            onRetryUpload={handleRetryUpload}
            onClearFinishedUploads={handleClearFinishedUploads}
          />

          <FileTableScroll>
            <CloudFileTableSection
              activeUploadCount={activeUploadCount}
              checkedFileIds={checkedFileIds}
              emptyTitle={emptyTitle}
              files={files}
              isFetching={filesQuery.isFetching}
              isFileListError={isFileListError}
              onOpenUploadPicker={() => uploadInputRef.current?.click()}
              onPreviewFile={handlePreviewFile}
              onRetryList={() => void filesQuery.refetch()}
              onToggleChecked={handleToggleChecked}
              selectedFile={selectedFile}
              shouldShowDetailPanel={shouldShowDetailPanel}
              showEmptyLoading={showEmptyLoading}
            />
          </FileTableScroll>
        </CloudContent>

        {shouldShowDetailPanel && selectedFile ? (
          <>
            <DetailScrim
              type="button"
              aria-label="상세 패널 닫기"
              data-mode={detailMode}
              onClick={() => setIsDetailPanelOpen(false)}
            />
            <DetailPanel aria-label="클라우드 상세정보" data-mode={detailMode}>
              <DetailHeader>
                <h2>파일 정보</h2>
                <IconButton
                  type="button"
                  aria-label="상세 패널 닫기"
                  onClick={() => {
                    setIsDetailPanelOpen(false)
                  }}
                >
                  ×
                </IconButton>
              </DetailHeader>
              <DetailTabs>
                <DetailTab type="button" data-active="true">
                  상세정보
                </DetailTab>
              </DetailTabs>
              <DetailPreviewBox>
                <PreviewDrawer file={selectedFile} />
              </DetailPreviewBox>
              <DetailSummary>
                <FileThumbnail file={selectedFile} selected />
                <div>
                  <strong>{selectedFile.originalFilename}</strong>
                  <p>
                    {getCloudKindBadge(selectedFile)} · {getCloudKindLabel(selectedFile.mediaKind)} ·{" "}
                    {formatCloudFileSize(selectedFile.byteSize)}
                  </p>
                </div>
              </DetailSummary>
              <DetailMetaList>
                <dt>
                  <span aria-hidden="true">
                    <AppIcon name="file" />
                  </span>
                  종류
                </dt>
                <dd>
                  {getCloudKindBadge(selectedFile)} · {getCloudKindLabel(selectedFile.mediaKind)}
                </dd>
                <dt>
                  <span aria-hidden="true">
                    <AppIcon name="folder" />
                  </span>
                  위치
                </dt>
                <dd>{selectedFile.folderPath || "/"}</dd>
                <dt>
                  <span aria-hidden="true">
                    <AppIcon name="clock" />
                  </span>
                  올린 날짜
                </dt>
                <dd>{formatCloudDate(selectedFile.createdAt)}</dd>
                <dt>
                  <span aria-hidden="true">
                    <AppIcon name="edit" />
                  </span>
                  수정한 날짜
                </dt>
                <dd>{formatCloudDate(selectedFile.modifiedAt || selectedFile.createdAt)}</dd>
                <dt>
                  <span aria-hidden="true">
                    <AppIcon name="package" />
                  </span>
                  크기
                </dt>
                <dd>{formatCloudFileSize(selectedFile.byteSize)}</dd>
                <dt>
                  <span aria-hidden="true">
                    <AppIcon name="lock" />
                  </span>
                  권한
                </dt>
                <dd>계정 소유주만 볼 수 있음</dd>
              </DetailMetaList>
            </DetailPanel>
          </>
        ) : null}
      </CloudWorkspace>
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
