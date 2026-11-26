/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetsGrid.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/ViewToggle.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 */
/* eslint-disable @next/next/no-img-element */
import styled from "@emotion/styled"
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  getCloudFileContentUrl,
  getCloudFileThumbnailUrl,
  type CloudFile,
} from "src/apis/backend/cloud"
import { useLanguage } from "src/libs/language"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminCardShadow,
  adminCheckerboardBackground,
  adminGoldTintFocus,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
import * as W from "./AdminCloudWorkspace.styles"
import {
  appendCloudAssetVersionUrl,
  formatCloudDate,
  formatCloudFileSize,
  getCloudKindLabel,
  isImageCloudFile,
  isSvgCloudFile,
  splitCloudFilenameParts,
} from "./AdminCloudWorkspaceModel"
import {
  StrapiGridFourIcon,
  StrapiListBulletsIcon,
  getStrapiAssetIcon,
} from "./adminStrapiIcons"
import { CardKebabButton, TruncatedFilename } from "./cloud/AdminCloudOverlay.styles"
import { getCloudDictionary } from "./cloud/adminCloudI18n"

export type CloudViewMode = "grid" | "list"

const toBooleanAttr = (value: boolean) => (value ? "true" : "false")

export const CloudViewToggle = ({
  viewMode,
  onChange,
}: {
  viewMode: CloudViewMode
  onChange: (next: CloudViewMode) => void
}) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  return (
    <W.ViewToggleTrack
      role="group"
      aria-label={language === "en" ? "Switch view mode" : "보기 방식 전환"}
    >
      <W.ViewToggleSegment
        type="button"
        aria-label={t.viewGrid}
        aria-pressed={viewMode === "grid"}
        data-state={viewMode === "grid" ? "on" : "off"}
        onClick={() => onChange("grid")}
      >
        <StrapiGridFourIcon width={16} height={16} />
      </W.ViewToggleSegment>
      <W.ViewToggleSegment
        type="button"
        aria-label={t.viewList}
        aria-pressed={viewMode === "list"}
        data-state={viewMode === "list" ? "on" : "off"}
        onClick={() => onChange("list")}
      >
        <StrapiListBulletsIcon width={16} height={16} />
      </W.ViewToggleSegment>
    </W.ViewToggleTrack>
  )
}

type AssetCardItemProps = {
  checked: boolean
  file: CloudFile
  onExpandFile?: (fileId: number) => void
  onOpenContextMenu?: (file: CloudFile, x: number, y: number) => void
  onPreviewFile: (fileId: number) => void
  onToggleChecked: (fileId: number, shiftKey?: boolean) => void
  selected: boolean
}

const AssetCardItem = ({
  checked,
  file,
  onExpandFile,
  onOpenContextMenu,
  onPreviewFile,
  onToggleChecked,
  selected,
}: AssetCardItemProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const [mediaLoadFailed, setMediaLoadFailed] = useState(false)
  useEffect(() => setMediaLoadFailed(false), [file.id, file.modifiedAt])

  const isImage = isImageCloudFile(file)
  const isSvg = isSvgCloudFile(file)
  const versionedUrl = appendCloudAssetVersionUrl(
    isSvg ? getCloudFileContentUrl(file.id) : getCloudFileThumbnailUrl(file.id),
    file.modifiedAt || file.createdAt
  )
  const DocIcon = getStrapiAssetIcon(file.contentType, file.originalFilename)
  const TypeIcon = DocIcon
  const { stem, extension } = splitCloudFilenameParts(file.originalFilename)

  const handleCardClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.shiftKey) onToggleChecked(file.id, true)
    else if (event.metaKey || event.ctrlKey) onToggleChecked(file.id, false)
    else onPreviewFile(file.id)
  }

  const handleCardDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!event.shiftKey && !event.metaKey && !event.ctrlKey) onExpandFile?.(file.id)
  }

  const handleCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === "Enter") {
      event.preventDefault()
      onPreviewFile(file.id)
    } else if (event.key === " ") {
      event.preventDefault()
      onToggleChecked(file.id, event.shiftKey)
    }
  }

  const handleContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (!onOpenContextMenu) return
    event.preventDefault()
    event.stopPropagation()
    onOpenContextMenu(file, event.clientX, event.clientY)
  }

  return (
    <StyledCard
      role="listitem"
      tabIndex={0}
      data-selected={toBooleanAttr(selected)}
      data-checked={toBooleanAttr(checked)}
      data-highlighted={toBooleanAttr(selected || checked)}
      onClick={handleCardClick}
      onDoubleClick={handleCardDoubleClick}
      onKeyDown={handleCardKeyDown}
      onContextMenu={handleContextMenu}
      onDragStart={(e) => e.preventDefault()}
    >
      <StyledCardHeader>
        <W.AssetGridCardCheckboxOverlay
          data-checked={toBooleanAttr(checked)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <W.RowCheckbox
            type="checkbox"
            aria-label={
              language === "en" ? `Select ${file.originalFilename}` : `${file.originalFilename} 선택`
            }
            checked={checked}
            onClick={(e) => {
              e.stopPropagation()
              onToggleChecked(file.id, e.shiftKey)
            }}
            onChange={() => {}}
          />
        </W.AssetGridCardCheckboxOverlay>

        <PreviewContainer data-svg={toBooleanAttr(isSvg)}>
          {isImage && !mediaLoadFailed ? (
            <StyledImage
              src={versionedUrl}
              alt={file.originalFilename}
              loading="lazy"
              decoding="async"
              draggable={false}
              data-fit={isSvg ? "contain" : "cover"}
              onDragStart={(e) => e.preventDefault()}
              onError={() => setMediaLoadFailed(true)}
            />
          ) : (
            <IconPreview aria-hidden="true">
              <DocIcon width={36} height={36} />
            </IconPreview>
          )}
        </PreviewContainer>
      </StyledCardHeader>

      <CardBody>
        <CardFooter>
          <FileTypeIcon aria-hidden="true">
            <TypeIcon width={16} height={16} />
          </FileTypeIcon>
          <AssetCardNameButton
            type="button"
            title={file.originalFilename}
            onClick={(e) => {
              e.stopPropagation()
              onPreviewFile(file.id)
            }}
          >
            <TruncatedFilename>
              <strong className="stem">{stem}</strong>
              {extension ? <span className="ext">{extension}</span> : null}
            </TruncatedFilename>
          </AssetCardNameButton>
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
        </CardFooter>
        <CardMetaText>
          {formatCloudFileSize(file.byteSize)} · {getCloudKindLabel(file.mediaKind, language)} ·{" "}
          {formatCloudDate(file.modifiedAt || file.createdAt, language)}
        </CardMetaText>
      </CardBody>
    </StyledCard>
  )
}

export type AdminCloudAssetGridProps = {
  activeFolderPath?: string
  activeUploadCount: number
  checkedFileIds: readonly number[]
  emptyTitle: string
  files: readonly CloudFile[]
  isFetching: boolean
  isFileListError: boolean
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

export const AdminCloudAssetGrid = ({
  activeFolderPath = "",
  activeUploadCount,
  checkedFileIds,
  emptyTitle,
  files,
  isFetching,
  isFileListError,
  onExpandFile,
  onOpenContextMenu,
  onOpenUploadPicker,
  onPreviewFile,
  onRetryList,
  onToggleChecked,
  selectedFile,
  shouldShowDetailPanel,
  showEmptyLoading,
}: AdminCloudAssetGridProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const isEn = language === "en"
  const checkedSet = useMemo(() => new Set(checkedFileIds), [checkedFileIds])

  if (showEmptyLoading) {
    return (
      <div
        role="status"
        aria-label={isEn ? "Loading file list" : "파일 목록 로딩"}
        aria-busy="true"
        style={{ width: "100%", minHeight: "14rem" }}
      >
        <W.AssetItemsGrid aria-hidden="true">
          {[0, 1, 2].map((slot) => (
            <W.SkeletonAssetCard key={slot} data-admin-cloud-skeleton-row="true">
              <div className="thumb" />
              <W.SkeletonRows>
                <W.SkeletonRow />
                <W.SkeletonRow />
              </W.SkeletonRows>
            </W.SkeletonAssetCard>
          ))}
        </W.AssetItemsGrid>
      </div>
    )
  }

  if (files.length === 0) {
    const retryOrUpload = isFileListError ? (
      <W.PrimaryButton
        type="button"
        aria-label={isEn ? "Retry loading files" : "파일 목록 다시 시도"}
        onClick={onRetryList}
      >
        {isEn ? "Retry loading files" : "파일 목록 다시 시도"}
      </W.PrimaryButton>
    ) : (
      <W.PrimaryButton type="button" aria-label={t.uploadButton} onClick={onOpenUploadPicker}>
        + {t.uploadButton}
      </W.PrimaryButton>
    )
    return (
      <W.EmptyTableState>
        <strong>{emptyTitle}</strong>
        {!isFileListError && activeFolderPath && activeUploadCount === 0 ? (
          <p>{t.emptyFolderUploadHint}</p>
        ) : null}
        {activeUploadCount > 0 ? null : retryOrUpload}
      </W.EmptyTableState>
    )
  }

  return (
    <W.AssetItemsGrid role="list" data-testid="assets-grid" aria-busy={toBooleanAttr(isFetching)}>
      {files.map((file) => (
        <AssetCardItem
          key={file.id}
          file={file}
          checked={checkedSet.has(file.id)}
          selected={shouldShowDetailPanel && selectedFile?.id === file.id}
          onExpandFile={onExpandFile}
          onOpenContextMenu={onOpenContextMenu}
          onPreviewFile={onPreviewFile}
          onToggleChecked={onToggleChecked}
        />
      ))}
    </W.AssetItemsGrid>
  )
}

const StyledCard = styled.article`
  display: flex;
  flex-direction: column;
  border: 1px solid ${adminBorder};
  border-radius: 8px;
  overflow: hidden;
  isolation: isolate;
  background: ${adminSurface};
  box-shadow: ${adminCardShadow};
  cursor: pointer;
  user-select: none;
  transition: border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease;

  &:hover,
  &:focus-within {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceRaised};
    ${W.AssetGridCardCheckboxOverlay} {
      opacity: 1;
    }
  }
  &[data-highlighted="true"] {
    border-color: ${adminTeal};
    background: ${adminSurfaceRaised};
    box-shadow: 0 0 0 1px ${adminTeal};
  }
  &:focus-visible {
    outline: 2px solid ${adminTeal};
    outline-offset: 2px;
  }
`

const StyledCardHeader = styled.div`
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid ${adminBorderSubtle};
`

const PreviewContainer = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: ${adminSurfaceRaised};

  &[data-svg="true"] {
    background: ${adminCheckerboardBackground};
  }
`

const StyledImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  &[data-fit="contain"] {
    object-fit: contain;
    padding: 0.75rem;
    box-sizing: border-box;
  }
`

const IconPreview = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${adminSurfaceMuted};
  color: ${adminTextMuted};
`

const CardBody = styled.div`
  display: grid;
  gap: 0.25rem;
  padding: 0.62rem 0.72rem;
  min-width: 0;
`

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 0.42rem;
  min-width: 0;
  width: 100%;
`

const CardMetaText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${adminTextMuted};
  font-size: 0.72rem;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
`

const FileTypeIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${adminTextSecondary};
`

const AssetCardNameButton = styled.button`
  display: inline-flex;
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-align: left;
  color: ${adminTextPrimary};
  font-size: 0.8125rem;
  font-weight: 600;
  strong.stem {
    font-weight: 600;
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px ${adminGoldTintFocus};
    border-radius: 4px;
  }
`

export default AdminCloudAssetGrid
