/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/components/UploadAssetDialog/UploadProgressDialog.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - transloadit/uppy packages/@uppy/status-bar/src/StatusBar.tsx (MIT License, Copyright (c) Transloadit Ltd)
 */
/* eslint-disable @next/next/no-img-element */
import styled from "@emotion/styled"
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
  useState,
} from "react"
import { getCloudFileContentUrl, type CloudFile } from "src/apis/backend/cloud"
import {
  adminControlText,
  adminFloatingShadow,
  adminGold,
  adminStatusDangerSolid,
  adminStatusDangerSolidHover,
  adminStatusDangerText,
  adminStatusSuccessText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTextMuted,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
import {
  ConfirmBackdrop as BaseConfirmBackdrop,
  ConfirmDialog as BaseConfirmDialog,
  EmptyTableState,
  FileIdentity,
  FileMetaLine,
  FileNameButton,
  FileNameStack,
  FileTable,
  FileThumbnailFrame,
  FileTypeIcon,
  GhostButton,
  LoadingTableStatus,
  PrimaryButton,
  QueueHeader,
  QueueItem as BaseQueueItem,
  QueueList,
  QueuePanel as BaseQueuePanel,
  RowCheckbox,
  SecondaryButton,
  SelectBoxCell,
  SkeletonRow,
  SkeletonRows,
} from "./AdminCloudWorkspace.styles"
import {
  appendCloudAssetVersionUrl,
  formatCloudDate,
  formatCloudFileSize,
  getCloudKindIconLabel,
  getCloudKindLabel,
  getUploadStatusLabel,
  isImageCloudFile,
  isSvgCloudFile,
  isUploadActive,
  normalizeCloudFolderPathSearch,
  type UploadQueueItem,
} from "./AdminCloudWorkspaceModel"
import {
  StrapiCheckIcon,
  StrapiCrossIcon,
  StrapiUploadIcon,
  getStrapiAssetIcon,
} from "./adminStrapiIcons"
import {
  type AggregateQueueProgress,
  computeAggregateQueueProgress,
} from "./cloudUploadQueueModel"

type AdminCloudUploadQueueProps = {
  uploadQueue: UploadQueueItem[]
  activeUploadCount: number
  completedUploadCount: number
  aggregateProgress?: AggregateQueueProgress
  onCancelUpload: (item: UploadQueueItem) => void
  onRetryUpload: (item: UploadQueueItem) => void
  onClearFinishedUploads: () => void
}

const AdminCloudUploadQueue = ({
  uploadQueue,
  activeUploadCount,
  completedUploadCount,
  aggregateProgress,
  onCancelUpload,
  onRetryUpload,
  onClearFinishedUploads,
}: AdminCloudUploadQueueProps) => {
  const computedAggregate = useMemo(
    () => aggregateProgress ?? computeAggregateQueueProgress(uploadQueue),
    [aggregateProgress, uploadQueue]
  )

  if (uploadQueue.length === 0) return null

  const allCompleted = completedUploadCount === uploadQueue.length
  const failedOrCancelledCount = uploadQueue.filter(
    (item) => item.status === "failed" || item.status === "cancelled"
  ).length
  const title =
    activeUploadCount > 0
      ? `항목 ${activeUploadCount}개 업로드 중`
      : allCompleted
        ? `항목 ${completedUploadCount}개 업로드 완료`
        : `항목 ${failedOrCancelledCount}개 업로드 실패/취소`
  const StatusTone = activeUploadCount > 0 ? "active" : allCompleted ? "done" : "failed"

  return (
    <ElevatedQueuePanel aria-label="업로드 중인 파일">
      <QueueHeader>
        <QueueTitleGroup>
          <QueueStatusIcon data-tone={StatusTone} aria-hidden="true">
            {activeUploadCount > 0 ? (
              <StrapiUploadIcon width={18} height={18} />
            ) : allCompleted ? (
              <StrapiCheckIcon width={18} height={18} />
            ) : (
              <StrapiCrossIcon width={18} height={18} />
            )}
          </QueueStatusIcon>
          <div>
            <h2>{title}</h2>
            <p>
              진행 중 {activeUploadCount}개 · 완료 {completedUploadCount}개
            </p>
          </div>
        </QueueTitleGroup>
        <GhostButton
          type="button"
          aria-label="종료된 업로드 항목 지우기"
          disabled={uploadQueue.every((item) => isUploadActive(item.status))}
          onClick={onClearFinishedUploads}
        >
          <StrapiCrossIcon width={16} height={16} />
        </GhostButton>
      </QueueHeader>
      {activeUploadCount > 0 ? (
        <AggregateProgressBox
          role="progressbar"
          aria-label="전체 업로드 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={computedAggregate.percent}
        >
          <AggregateProgressMeta>
            <span>전체 업로드 진행률</span>
            <strong>{computedAggregate.percent}%</strong>
          </AggregateProgressMeta>
          <ProgressTrack style={{ "--progress": `${computedAggregate.percent}%` } as CSSProperties}>
            <span />
          </ProgressTrack>
        </AggregateProgressBox>
      ) : null}
      <QueueList>
        {uploadQueue.map((item) => (
          <SafeQueueItem key={item.id}>
            <div title={item.name}>
              <strong>{item.name}</strong>
              <p>
                {formatCloudFileSize(item.byteSize)} · {item.message}
              </p>
            </div>
            <StatusPill data-status={item.status}>{getUploadStatusLabel(item.status)}</StatusPill>
            {isUploadActive(item.status) ? (
              <GhostButton type="button" aria-label={`${item.name} 업로드 취소`} onClick={() => onCancelUpload(item)}>
                취소
              </GhostButton>
            ) : null}
            {item.status === "failed" ? (
              <GhostButton type="button" aria-label={`${item.name} 업로드 다시 시도`} onClick={() => onRetryUpload(item)}>
                다시 시도
              </GhostButton>
            ) : null}
            <ProgressTrack style={{ "--progress": `${item.progress}%` } as CSSProperties}>
              <span />
            </ProgressTrack>
          </SafeQueueItem>
        ))}
      </QueueList>
    </ElevatedQueuePanel>
  )
}

export const FileThumbnail = ({ file, selected }: { file: CloudFile; selected: boolean }) => {
  const [imageLoadFailed, setImageLoadFailed] = useState(false)

  useEffect(() => {
    setImageLoadFailed(false)
  }, [file.id, file.modifiedAt])

  const showPhotoThumbnail = isImageCloudFile(file) && !imageLoadFailed
  const isSvg = isSvgCloudFile(file)
  const AssetIcon = getStrapiAssetIcon(file.contentType, file.originalFilename)
  const versionedUrl = appendCloudAssetVersionUrl(
    getCloudFileContentUrl(file.id),
    file.modifiedAt || file.createdAt
  )

  return (
    <FileThumbnailFrame
      aria-hidden="true"
      data-kind={file.mediaKind}
      data-selected={selected ? "true" : "false"}
      data-fallback={showPhotoThumbnail ? "false" : "true"}
    >
      {showPhotoThumbnail ? (
        <img
          src={versionedUrl}
          alt=""
          loading="lazy"
          decoding="async"
          data-fit={isSvg ? "contain" : "cover"}
          onError={() => setImageLoadFailed(true)}
        />
      ) : (
        <AssetIcon width={18} height={18} />
      )}
    </FileThumbnailFrame>
  )
}

export const FileTableHead = () => (
  <thead>
    <tr>
      <th aria-label="선택" />
      <th>이름</th>
      <th>크기</th>
      <th>수정한 날짜</th>
    </tr>
  </thead>
)

export type CloudFileTableSectionProps = {
  activeUploadCount: number
  checkedFileIds: number[]
  emptyTitle: string
  files: CloudFile[]
  isFetching: boolean
  isFileListError: boolean
  onExpandFile?: (fileId: number) => void
  onOpenUploadPicker: () => void
  onPreviewFile: (fileId: number) => void
  onRetryList: () => void
  onToggleChecked: (fileId: number, shiftKey?: boolean) => void
  selectedFile: CloudFile | null
  shouldShowDetailPanel: boolean
  showEmptyLoading: boolean
}

export const CloudFileTableSection = ({
  activeUploadCount,
  checkedFileIds,
  emptyTitle,
  files,
  isFetching,
  isFileListError,
  onExpandFile,
  onOpenUploadPicker,
  onPreviewFile,
  onRetryList,
  onToggleChecked,
  selectedFile,
  shouldShowDetailPanel,
  showEmptyLoading,
}: CloudFileTableSectionProps) => {
  const checkedFileIdSet = useMemo(() => new Set(checkedFileIds), [checkedFileIds])
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
        파일 목록 다시 시도
      </PrimaryButton>
    ) : (
      <PrimaryButton type="button" aria-label="파일 업로드" onClick={onOpenUploadPicker}>
        + 파일 업로드
      </PrimaryButton>
    )

    return (
      <EmptyTableState>
        <strong>{emptyTitle}</strong>
        {activeUploadCount > 0 ? null : retryOrUploadButton}
      </EmptyTableState>
    )
  }

  return (
    <FileTable role="table" aria-busy={isFetching ? "true" : "false"}>
      <FileTableHead />
      <tbody>
        {files.map((file) => {
          const checked = checkedFileIdSet.has(file.id)
          const selected = shouldShowDetailPanel && selectedFile?.id === file.id
          const folderLabel = normalizeCloudFolderPathSearch(file.folderPath)
          return (
            <tr
              key={file.id}
              role="row"
              data-selected={selected ? "true" : "false"}
              onDoubleClick={() => onExpandFile?.(file.id)}
            >
              <SelectBoxCell>
                <RowCheckbox
                  type="checkbox"
                  aria-label={`${file.originalFilename} 선택`}
                  checked={checked}
                  onClick={(event) => onToggleChecked(file.id, event.shiftKey)}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onChange={() => {}}
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
                      <strong>{file.originalFilename}</strong>
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
                      {folderLabel ? <span data-folder-badge="true">/{folderLabel}</span> : null}
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

export const CloudDeleteConfirmDialog = ({
  files,
  isDeletePending,
  deleteDialogRef,
  deleteCancelButtonRef,
  onClose,
  onConfirm,
  onKeyDown,
}: {
  files: CloudFile[]
  isDeletePending: boolean
  deleteDialogRef: RefObject<HTMLDivElement | null>
  deleteCancelButtonRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onConfirm: () => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
}) => (
  <ConfirmBackdrop role="presentation" onClick={onClose}>
    <ConfirmDialog
      ref={deleteDialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-delete-confirm-title"
      aria-describedby="cloud-delete-confirm-description"
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <strong id="cloud-delete-confirm-title">파일 삭제</strong>
      <p id="cloud-delete-confirm-description">
        <span>{files.length === 1 ? files[0].originalFilename : `${files.length}개 파일`}</span>{" "}
        삭제한 파일은 관리자 클라우드 목록에서 제거됩니다.
      </p>
      <div>
        <SecondaryButton
          ref={deleteCancelButtonRef}
          type="button"
          disabled={isDeletePending}
          onClick={onClose}
        >
          취소
        </SecondaryButton>
        <DangerConfirmButton type="button" disabled={isDeletePending} onClick={onConfirm}>
          삭제
        </DangerConfirmButton>
      </div>
    </ConfirmDialog>
  </ConfirmBackdrop>
)

const ConfirmBackdrop = styled(BaseConfirmBackdrop)`
  overflow: hidden;
  overscroll-behavior: contain;
`

const ConfirmDialog = styled(BaseConfirmDialog)`
  overflow: auto;
  overscroll-behavior: contain;
  border-radius: 10px;
  box-shadow: ${adminFloatingShadow};
`

const DangerConfirmButton = styled(PrimaryButton)`
  background: ${adminStatusDangerSolid};
  border-color: ${adminStatusDangerSolid};
  color: ${adminControlText};

  &:hover:not(:disabled) {
    background: ${adminStatusDangerSolidHover};
    border-color: ${adminStatusDangerSolidHover};
    color: ${adminControlText};
  }
`

const ElevatedQueuePanel = styled(BaseQueuePanel)`
  box-shadow: ${adminFloatingShadow};
`

const QueueTitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
`

const QueueStatusIcon = styled.span`
  width: 30px;
  height: 30px;
  border-radius: 6px;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  &[data-tone="done"] {
    color: ${adminStatusSuccessText};
  }
  &[data-tone="failed"] {
    color: ${adminStatusDangerText};
  }
`

const SafeQueueItem = styled(BaseQueueItem)`
  > div:first-of-type {
    min-width: 0;
    overflow: hidden;
  }
`

const AggregateProgressBox = styled.div`
  display: grid;
  gap: 0.32rem;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceMuted};
`

const AggregateProgressMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${adminTextSecondary};
  font-variant-numeric: tabular-nums;
`

const StatusPill = styled.span`
  justify-self: end;
  min-width: 3.55rem;
  max-width: 5.6rem;
  border-radius: 4px;
  padding: 0.22rem 0.45rem;
  background: ${adminSurface};
  color: ${adminGold};
  font-size: 0.7rem;
  font-weight: 750;
  text-align: center;
  white-space: nowrap;

  &[data-status="failed"] {
    color: ${adminStatusDangerText};
  }
  &[data-status="cancelled"] {
    color: ${adminTextMuted};
  }
  &[data-status="done"] {
    color: ${adminStatusSuccessText};
  }
`

const ProgressTrack = styled.div`
  grid-column: 1 / -1;
  height: 0.28rem;
  overflow: hidden;
  border-radius: 999px;
  background: ${adminSurfaceRaised};

  span {
    display: block;
    height: 100%;
    width: var(--progress, 0%);
    border-radius: inherit;
    background: ${adminTeal};
    transition: width 180ms ease;
  }
`

export default AdminCloudUploadQueue
