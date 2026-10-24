import { useState } from "react"
import { getCloudFileDownloadUrl, type CloudFile } from "src/apis/backend/cloud"
import AppIcon from "src/components/icons/AppIcon"
import { CloudDeleteConfirmDialog, FileTableHead, FileThumbnail, PreviewDrawer } from "./AdminCloudPreviewDrawer"
import {
  CLOUD_FILTERS, CLOUD_SORT_OPTIONS, type CloudSortMode, formatCloudDate, formatCloudFileSize,
  getCloudFilenameParts, getCloudKindBadge, getCloudKindIconLabel, getCloudKindLabel, getCloudSummary,
  isCloudSearchPending, normalizeCloudFolderPathSearch, resolveCloudEmptyTitle, shouldShowCloudEmptyLoading,
} from "./AdminCloudWorkspaceModel"
import AdminCloudUploadQueue from "./AdminCloudUploadQueue"
import {
  ActionBar, ActionGroup, CloudContent, CloudMain, CloudSearchField, CloudTitleBar, CloudWorkspace,
  DetailActionLink, DetailEditField, DetailEditForm, DetailEditInput, DetailHeader, DetailMetaList,
  DetailPanel, DetailPreviewBox, DetailScrim, DetailSummary, EmptyTableState, FileIdentity,
  FileMetaLine, FileNameButton, FileNameStack, FileTable, FileTableScroll, FileTypeIcon, FilterGroup,
  GhostButton, IconButton, LoadingTableStatus, Notice, PrimaryButton, RowCheckbox, SearchClearButton,
  SearchDetail, SearchInput, SecondaryButton, SelectBoxCell, SkeletonRow, SkeletonRows, SortSelect,
  ToastViewport, UploadInput, UploadZone, ViewModeButton,
} from "./AdminCloudWorkspace.styles"
import { useAdminCloudWorkspaceActions } from "./useAdminCloudWorkspaceActions"

const toBooleanAttr = (value: boolean) => (value ? "true" : "false")

const formatSearchDetailText = (isSearchBusy: boolean, keyword: string) => {
  if (isSearchBusy) return "검색 중"
  if (keyword) return "파일"
  return "/폴더명 검색어"
}

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
    const retryOrUploadButton = isFileListError ? (
      <PrimaryButton type="button" aria-label="파일 목록 다시 시도" onClick={onRetryList}>
        다시 시도
      </PrimaryButton>
    ) : (
      <PrimaryButton type="button" aria-label="파일 업로드" onClick={onOpenUploadPicker}>
        ⤴ 올리기
      </PrimaryButton>
    )
    const emptyAction = activeUploadCount > 0 ? null : retryOrUploadButton

    return (
      <EmptyTableState>
        <strong>{emptyTitle}</strong>
        {emptyAction}
      </EmptyTableState>
    )
  }

  return (
    <FileTable role="table" aria-busy={toBooleanAttr(isFetching)}>
      <FileTableHead />
      <tbody>
        {files.map((file) => {
          const checked = checkedFileIds.includes(file.id)
          const selected = shouldShowDetailPanel && selectedFile?.id === file.id
          const filenameParts = getCloudFilenameParts(file.originalFilename)
          const folderLabel = normalizeCloudFolderPathSearch(file.folderPath)
          return (
            <tr key={file.id} role="row" data-selected={toBooleanAttr(selected)}>
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
                        data-selected={toBooleanAttr(selected)}
                      >
                        {getCloudKindIconLabel(file)}
                      </FileTypeIcon>
                      <span>{getCloudKindLabel(file.mediaKind)}</span>
                      {folderLabel ? <span>/{folderLabel}</span> : null}
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

type CloudFileDetailDrawerProps = {
  detailMode: "drawer" | "inline"
  onClose: () => void
  onCopyFileLink: (file: CloudFile) => Promise<void>
  onUpdateFile: (fileId: number, payload: { originalFilename: string; folderPath: string }) => Promise<boolean>
  selectedFile: CloudFile
}

const CloudFileDetailDrawer = ({
  detailMode,
  onClose,
  onCopyFileLink,
  onUpdateFile,
  selectedFile,
}: CloudFileDetailDrawerProps) => {
  const [editingFileId, setEditingFileId] = useState<number | null>(null)
  const [draftFilename, setDraftFilename] = useState("")
  const [draftFolderPath, setDraftFolderPath] = useState("")
  const [isUpdatePending, setIsUpdatePending] = useState(false)

  const normalizedFolderPath = normalizeCloudFolderPathSearch(selectedFile.folderPath || "")
  const locationLabel = normalizedFolderPath ? `/${normalizedFolderPath}` : "/"

  return (
    <>
      <DetailScrim
        type="button"
        aria-label="상세 패널 닫기"
        data-mode={detailMode}
        onClick={onClose}
      />
      <DetailPanel aria-label="클라우드 상세정보" data-mode={detailMode}>
        <DetailHeader>
          <h2>파일 정보</h2>
          <IconButton type="button" aria-label="상세 패널 닫기" onClick={onClose}>
            ×
          </IconButton>
        </DetailHeader>
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
        <ActionGroup>
          <DetailActionLink
            href={getCloudFileDownloadUrl(selectedFile.id)}
            download={selectedFile.originalFilename}
          >
            다운로드
          </DetailActionLink>
          <SecondaryButton type="button" onClick={() => void onCopyFileLink(selectedFile)}>
            링크 복사
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={() => {
              setEditingFileId(selectedFile.id)
              setDraftFilename(selectedFile.originalFilename)
              setDraftFolderPath(normalizedFolderPath)
            }}
          >
            정보 수정
          </SecondaryButton>
        </ActionGroup>
        {editingFileId === selectedFile.id ? (
          <DetailEditForm
            onSubmit={(event) => {
              event.preventDefault()
              setIsUpdatePending(true)
              void onUpdateFile(selectedFile.id, {
                originalFilename: draftFilename,
                folderPath: draftFolderPath,
              })
                .then((updated) => {
                  if (updated) setEditingFileId(null)
                })
                .finally(() => setIsUpdatePending(false))
            }}
          >
            <DetailEditField>
              <span>파일 이름</span>
              <DetailEditInput
                aria-label="파일 이름 수정"
                value={draftFilename}
                onChange={(event) => setDraftFilename(event.target.value)}
              />
            </DetailEditField>
            <DetailEditField>
              <span>폴더 경로</span>
              <DetailEditInput
                aria-label="폴더 경로 수정"
                placeholder="예: ops/reports"
                value={draftFolderPath}
                onChange={(event) => setDraftFolderPath(event.target.value)}
              />
            </DetailEditField>
            <ActionGroup>
              <PrimaryButton type="submit" disabled={isUpdatePending}>
                저장
              </PrimaryButton>
              <SecondaryButton type="button" disabled={isUpdatePending} onClick={() => setEditingFileId(null)}>
                취소
              </SecondaryButton>
            </ActionGroup>
          </DetailEditForm>
        ) : null}
        <DetailMetaList>
          <dt><span aria-hidden="true"><AppIcon name="file" /></span>종류</dt>
          <dd>{getCloudKindBadge(selectedFile)} · {getCloudKindLabel(selectedFile.mediaKind)}</dd>
          <dt><span aria-hidden="true"><AppIcon name="folder" /></span>위치</dt>
          <dd>{locationLabel}</dd>
          <dt><span aria-hidden="true"><AppIcon name="clock" /></span>올린 날짜</dt>
          <dd>{formatCloudDate(selectedFile.createdAt)}</dd>
          <dt><span aria-hidden="true"><AppIcon name="edit" /></span>수정한 날짜</dt>
          <dd>{formatCloudDate(selectedFile.modifiedAt || selectedFile.createdAt)}</dd>
          <dt><span aria-hidden="true"><AppIcon name="package" /></span>크기</dt>
          <dd>{formatCloudFileSize(selectedFile.byteSize)}</dd>
          <dt><span aria-hidden="true"><AppIcon name="lock" /></span>권한</dt>
          <dd>계정 소유주만 볼 수 있음</dd>
        </DetailMetaList>
      </DetailPanel>
    </>
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
    handleCopyFileLink,
    handleDeleteDialogKeyDown,
    handleDeleteSelected,
    handlePreviewFile,
    handleRetryUpload,
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
  } = useAdminCloudWorkspaceActions()

  const summary = getCloudSummary(files)
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
              <span>Storage</span>
              <h1>미디어 라이브러리</h1>
              <p>
                글 이미지와 첨부 미디어 파일을 관리합니다.
                {files.length > 0 ? ` 총 ${summary.totalCount}개 · ${summary.totalSize}` : ""}
              </p>
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
              {keyword ? (
                <SearchClearButton type="button" aria-label="검색어 지우기" onClick={() => setKeyword("")}>
                  지우기
                </SearchClearButton>
              ) : null}
              <SearchDetail aria-busy={toBooleanAttr(isSearchBusy)}>
                {formatSearchDetailText(isSearchBusy, keyword)}
              </SearchDetail>
            </CloudSearchField>
          </CloudTitleBar>

          <UploadZone
            type="button"
            aria-label="파일을 끌어놓거나 클릭해 업로드"
            data-drag-active={toBooleanAttr(isDragActive)}
            onClick={() => uploadInputRef.current?.click()}
            onDragOver={handleUploadDragOver}
            onDragLeave={handleUploadDragLeave}
            onDrop={handleUploadDrop}
          >
            <AppIcon name="cloud" />
            <strong>파일을 끌어놓거나 클릭해 업로드</strong>
            <span>사진 50MB · 문서/압축 95MB · 동영상 5GB 이하</span>
          </UploadZone>

          <ActionBar>
            <ActionGroup>
              <IconButton
                type="button"
                aria-label={allVisibleChecked ? "전체 선택 해제" : "전체 선택"}
                data-active={toBooleanAttr(allVisibleChecked)}
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
                    data-active={toBooleanAttr(filter === item.value)}
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                  </GhostButton>
                ))}
              </FilterGroup>
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
              <ViewModeButton
                type="button"
                aria-label="상세 패널 보기"
                data-active={toBooleanAttr(shouldShowDetailPanel)}
                onClick={() => {
                  const firstFileId = files[0]?.id ?? null
                  setIsDetailPanelOpen((current) => !current)
                  setSelectedFileId((current) => current ?? firstFileId)
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
          <CloudFileDetailDrawer
            detailMode={detailMode}
            onClose={() => setIsDetailPanelOpen(false)}
            onCopyFileLink={handleCopyFileLink}
            onUpdateFile={handleUpdateFile}
            selectedFile={selectedFile}
          />
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
