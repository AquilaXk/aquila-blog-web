/**
 * 참조 구현:
 * - strapi/strapi (MIT) — 클라우드 목록 테이블 · 양방향 컬럼 정렬 · 삭제 확인 다이얼로그
 */
/* eslint-disable @next/next/no-img-element */
import styled from "@emotion/styled"
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  getCloudFileContentUrl,
  getCloudFileThumbnailUrl,
  type CloudFile,
} from "src/apis/backend/cloud"
import { useLanguage } from "src/libs/language"
import {
  adminControlText,
  adminFloatingShadow,
  adminStatusDangerSolid,
  adminStatusDangerSolidHover,
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
  LoadingTableStatus,
  PrimaryButton,
  RowCheckbox,
  SecondaryButton,
  SelectBoxCell,
  SkeletonRow,
  SkeletonRows,
} from "../AdminCloudWorkspace.styles"
import {
  appendCloudAssetVersionUrl,
  formatCloudDate,
  formatCloudFileSize,
  getCloudKindIconLabel,
  getCloudKindLabel,
  isImageCloudFile,
  isSvgCloudFile,
  normalizeCloudFolderPathSearch,
  splitCloudFilenameParts,
  type CloudSortDirection,
  type CloudSortMode,
} from "../AdminCloudWorkspaceModel"
import { getStrapiAssetIcon } from "../adminStrapiIcons"
import {
  CardKebabButton,
  CloudCheckboxHitLabel,
  SortableHeaderButton,
  TruncatedFilename,
} from "./AdminCloudOverlay.styles"
import { getCloudDictionary } from "./adminCloudI18n"

export const FileThumbnail = ({ file, selected }: { file: CloudFile; selected: boolean }) => {
  const [imageLoadFailed, setImageLoadFailed] = useState(false)

  useEffect(() => {
    setImageLoadFailed(false)
  }, [file.id, file.modifiedAt])

  const showPhotoThumbnail = isImageCloudFile(file) && !imageLoadFailed
  const isSvg = isSvgCloudFile(file)
  const AssetIcon = getStrapiAssetIcon(file.contentType, file.originalFilename)
  const versionedUrl = appendCloudAssetVersionUrl(
    isSvg ? getCloudFileContentUrl(file.id) : getCloudFileThumbnailUrl(file.id),
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

export type SortableColumnKey = "NAME" | "SIZE" | "LATEST"

const getAriaSortForColumn = (
  column: SortableColumnKey,
  sortMode?: CloudSortMode,
  sortDirection?: CloudSortDirection
): "ascending" | "descending" | "none" => {
  if (!sortMode) return "none"
  if (column === "LATEST") {
    if (sortMode === "LATEST") return sortDirection === "asc" ? "ascending" : "descending"
    if (sortMode === "OLDEST") return sortDirection === "desc" ? "descending" : "ascending"
    return "none"
  }
  if (sortMode !== column) return "none"
  return sortDirection === "asc" ? "ascending" : "descending"
}

export const FileTableHead = ({
  sortMode,
  sortDirection,
  onSortColumn,
}: {
  sortMode?: CloudSortMode
  sortDirection?: CloudSortDirection
  onSortColumn?: (column: SortableColumnKey) => void
}) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const renderSortIndicator = (column: SortableColumnKey) => {
    const state = getAriaSortForColumn(column, sortMode, sortDirection)
    if (state === "ascending") return "↑"
    if (state === "descending") return "↓"
    return ""
  }

  return (
    <thead>
      <tr>
        <th aria-label={language === "en" ? "Select" : "선택"} />
        <th aria-sort={getAriaSortForColumn("NAME", sortMode, sortDirection)}>
          {onSortColumn ? (
            <SortableHeaderButton
              type="button"
              data-active={sortMode === "NAME" ? "true" : "false"}
              onClick={() => onSortColumn("NAME")}
            >
              <span>{t.colName}</span>
              <span aria-hidden="true">{renderSortIndicator("NAME")}</span>
            </SortableHeaderButton>
          ) : (
            t.colName
          )}
        </th>
        <th aria-sort={getAriaSortForColumn("SIZE", sortMode, sortDirection)}>
          {onSortColumn ? (
            <SortableHeaderButton
              type="button"
              data-active={sortMode === "SIZE" ? "true" : "false"}
              onClick={() => onSortColumn("SIZE")}
            >
              <span>{t.colSize}</span>
              <span aria-hidden="true">{renderSortIndicator("SIZE")}</span>
            </SortableHeaderButton>
          ) : (
            t.colSize
          )}
        </th>
        <th aria-sort={getAriaSortForColumn("LATEST", sortMode, sortDirection)}>
          {onSortColumn ? (
            <SortableHeaderButton
              type="button"
              data-active={sortMode === "LATEST" || sortMode === "OLDEST" ? "true" : "false"}
              onClick={() => onSortColumn("LATEST")}
            >
              <span>{t.colModified}</span>
              <span aria-hidden="true">{renderSortIndicator("LATEST")}</span>
            </SortableHeaderButton>
          ) : (
            t.colModified
          )}
        </th>
      </tr>
    </thead>
  )
}

export type CloudFileTableSectionProps = {
  activeFolderPath?: string
  activeUploadCount: number
  checkedFileIds: number[]
  emptyTitle: string
  files: CloudFile[]
  isFetching: boolean
  isFileListError: boolean
  sortMode?: CloudSortMode
  sortDirection?: CloudSortDirection
  onSortColumn?: (column: SortableColumnKey) => void
  onExpandFile?: (fileId: number) => void
  onOpenContextMenu?: (file: CloudFile, x: number, y: number) => void
  onOpenUploadPicker: () => void
  onPreviewFile: (fileId: number) => void
  onRetryList: () => void
  onToggleChecked: (fileId: number, shiftKey?: boolean) => void
  selectedFile: CloudFile | null
  shouldShowDetailPanel: boolean
  showEmptyLoading: boolean
}

export const CloudFileTableSection = ({
  activeFolderPath = "",
  activeUploadCount,
  checkedFileIds,
  emptyTitle,
  files,
  isFetching,
  isFileListError,
  sortMode,
  sortDirection,
  onSortColumn,
  onExpandFile,
  onOpenContextMenu,
  onOpenUploadPicker,
  onPreviewFile,
  onRetryList,
  onToggleChecked,
  selectedFile,
  shouldShowDetailPanel,
  showEmptyLoading,
}: CloudFileTableSectionProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const isEn = language === "en"
  const checkedFileIdSet = useMemo(() => new Set(checkedFileIds), [checkedFileIds])
  const lastShiftKeyRef = useRef(false)

  if (showEmptyLoading) {
    return (
      <FileTable role="table" aria-busy="true">
        <FileTableHead sortMode={sortMode} sortDirection={sortDirection} onSortColumn={onSortColumn} />
        <tbody>
          <tr data-loading-row="true">
            <td colSpan={4}>
              <LoadingTableStatus
                role="status"
                aria-label={isEn ? "Loading file list" : "파일 목록 로딩"}
              >
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
      <PrimaryButton
        type="button"
        aria-label={isEn ? "Retry loading files" : "파일 목록 다시 시도"}
        onClick={onRetryList}
      >
        {isEn ? "Retry loading files" : "파일 목록 다시 시도"}
      </PrimaryButton>
    ) : (
      <PrimaryButton type="button" aria-label={t.uploadButton} onClick={onOpenUploadPicker}>
        + {t.uploadButton}
      </PrimaryButton>
    )

    return (
      <EmptyTableState>
        <strong>{emptyTitle}</strong>
        {!isFileListError && activeFolderPath && activeUploadCount === 0 ? (
          <p>{t.emptyFolderUploadHint}</p>
        ) : null}
        {activeUploadCount > 0 ? null : retryOrUploadButton}
      </EmptyTableState>
    )
  }

  return (
    <FileTable role="table" aria-busy={isFetching ? "true" : "false"}>
      <FileTableHead sortMode={sortMode} sortDirection={sortDirection} onSortColumn={onSortColumn} />
      <tbody>
        {files.map((file) => {
          const checked = checkedFileIdSet.has(file.id)
          const selected = shouldShowDetailPanel && selectedFile?.id === file.id
          const folderLabel = normalizeCloudFolderPathSearch(file.folderPath)
          const { stem, extension } = splitCloudFilenameParts(file.originalFilename)
          return (
            <tr
              key={file.id}
              role="row"
              data-selected={selected ? "true" : "false"}
              onDoubleClick={() => onExpandFile?.(file.id)}
              onContextMenu={(event) => {
                if (!onOpenContextMenu) return
                event.preventDefault()
                event.stopPropagation()
                onOpenContextMenu(file, event.clientX, event.clientY)
              }}
            >
              <SelectBoxCell>
                <CloudCheckboxHitLabel
                  onPointerDown={(event) => {
                    lastShiftKeyRef.current = event.shiftKey
                  }}
                  onDoubleClick={(event) => event.stopPropagation()}
                >
                  <RowCheckbox
                    type="checkbox"
                    aria-label={isEn ? `Select ${file.originalFilename}` : `${file.originalFilename} 선택`}
                    checked={checked}
                    onKeyDown={(event) => {
                      lastShiftKeyRef.current = event.shiftKey
                    }}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onChange={() => {
                      onToggleChecked(file.id, lastShiftKeyRef.current)
                      lastShiftKeyRef.current = false
                    }}
                  />
                </CloudCheckboxHitLabel>
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
                      <TruncatedFilename>
                        <strong className="stem">{stem}</strong>
                        {extension ? <span className="ext">{extension}</span> : null}
                      </TruncatedFilename>
                    </FileNameButton>
                    <FileMetaLine>
                      <FileTypeIcon
                        aria-label={getCloudKindLabel(file.mediaKind, language)}
                        data-file-kind-badge="true"
                        data-selected={selected ? "true" : "false"}
                      >
                        {getCloudKindIconLabel(file)}
                      </FileTypeIcon>
                      <span>{getCloudKindLabel(file.mediaKind, language)}</span>
                      {folderLabel ? <span data-folder-badge="true">/{folderLabel}</span> : null}
                    </FileMetaLine>
                  </FileNameStack>
                </FileIdentity>
              </td>
              <td>{formatCloudFileSize(file.byteSize)}</td>
              <td>
                <DateActionCell>
                  <span>{formatCloudDate(file.modifiedAt || file.createdAt, language)}</span>
                  {onOpenContextMenu ? (
                    <CardKebabButton
                      type="button"
                      aria-label={`${file.originalFilename} ${t.actionMore}`}
                      aria-haspopup="menu"
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        onOpenContextMenu(file, rect.right - 180, rect.bottom + 4)
                      }}
                    >
                      ⋯
                    </CardKebabButton>
                  ) : null}
                </DateActionCell>
              </td>
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
}) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  return (
    <BaseConfirmBackdrop role="presentation" onClick={onClose}>
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
        <strong id="cloud-delete-confirm-title">{isEn ? "Delete files" : "파일 삭제"}</strong>
        <p id="cloud-delete-confirm-description">
          <span>
            {files.length === 1
              ? files[0]?.originalFilename
              : isEn
                ? `${files.length} files`
                : `${files.length}개 파일`}
          </span>{" "}
          {isEn
            ? "Deleted files will be permanently removed from your Cloud storage."
            : "삭제한 파일은 관리자 클라우드 목록에서 제거됩니다."}
        </p>
        <div>
          <SecondaryButton
            ref={deleteCancelButtonRef}
            type="button"
            disabled={isDeletePending}
            onClick={onClose}
          >
            {isEn ? "Cancel" : "취소"}
          </SecondaryButton>
          <DangerConfirmButton type="button" disabled={isDeletePending} onClick={onConfirm}>
            {isEn ? "Delete" : "삭제"}
          </DangerConfirmButton>
        </div>
      </ConfirmDialog>
    </BaseConfirmBackdrop>
  )
}

const DateActionCell = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  min-width: 0;
`

const ConfirmDialog = styled(BaseConfirmDialog)`
  box-shadow: ${adminFloatingShadow};
`

const DangerConfirmButton = styled(PrimaryButton)`
  border-color: ${adminStatusDangerSolid};
  background: ${adminStatusDangerSolid};
  color: ${adminControlText};
  &:hover:not(:disabled) {
    border-color: ${adminStatusDangerSolidHover};
    background: ${adminStatusDangerSolidHover};
  }
`
