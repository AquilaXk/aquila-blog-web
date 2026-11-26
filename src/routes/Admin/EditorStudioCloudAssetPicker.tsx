/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/components/AssetDialog/BrowseStep/index.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 */
/* eslint-disable @next/next/no-img-element */
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import {
  type CloudFile,
  getCloudFileThumbnailUrl,
  listCloudFiles,
  promoteCloudFileToPostAsset,
} from "src/apis/backend/cloud"
import { escapeMarkdownLinkDestination } from "src/components/markdown-editor/markdownEditorUploadModel"
import { focusVisibleRing } from "src/design-system/focusRing"
import { useLanguage, type SiteLanguage } from "src/libs/language"
import { formatFileSize } from "src/libs/utils"
import { adminBorderSubtle, adminCheckerboardBackground } from "src/routes/Admin/adminColorTokens"
import { AdminCloudMediaLightbox } from "./AdminCloudMediaLightbox"
import {
  appendCloudAssetVersionUrl,
  extractCloudFolders,
  getCloudKindBadge,
  isImageCloudFile,
  isSvgCloudFile,
  normalizeCloudFolderPathSearch,
} from "./AdminCloudWorkspaceModel"
import { StrapiCornersOutIcon, getStrapiAssetIcon } from "./adminStrapiIcons"
import { getCloudDictionary } from "./cloud/adminCloudI18n"
import { SecondaryButton } from "./EditorStudioDedicatedEditorSurfaceParts"

const CLOUD_PICKER_MAX_ITEMS = 24
export const MAX_POST_PROMOTABLE_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_POST_PROMOTABLE_DIMENSION = 4_096

const PROMOTABLE_RASTER_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"])
const PROMOTABLE_RASTER_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
])

type EditorStudioCloudAssetPickerProps = {
  onUploadPostImage?: (file: File) => Promise<{ alt?: string; title?: string; url?: string; src?: string }>
  onUploadPostAttachment?: (file: File) => Promise<{ url?: string; name?: string }>
  onInsertMarkdownSnippet?: (snippet: string) => void
}

export type CloudPostPromotionEligibility =
  | { promotable: true; reason: null }
  | { promotable: false; reason: string }

const extractLowerExtension = (filename: string): string => {
  const dot = filename.lastIndexOf(".")
  return dot >= 0 && dot < filename.length - 1 ? filename.slice(dot + 1).toLowerCase() : ""
}

export const getCloudFilePostPromotionEligibility = (
  file: Pick<CloudFile, "mediaKind" | "contentType" | "originalFilename" | "byteSize">,
  language: SiteLanguage = "ko"
): CloudPostPromotionEligibility => {
  const t = getCloudDictionary(language)
  if (isSvgCloudFile(file)) {
    return { promotable: false, reason: t.pickerReasonSvgUnsupported }
  }
  const ext = extractLowerExtension(file.originalFilename)
  const mime = (file.contentType || "").toLowerCase()
  const isPromotableRaster =
    file.mediaKind === "PHOTO" &&
    (PROMOTABLE_RASTER_EXTENSIONS.has(ext) || PROMOTABLE_RASTER_MIMES.has(mime))
  if (!isPromotableRaster) {
    return { promotable: false, reason: t.pickerReasonNotRaster }
  }
  if (file.byteSize > MAX_POST_PROMOTABLE_IMAGE_BYTES) {
    return { promotable: false, reason: t.pickerReasonOver8Mb }
  }
  return { promotable: true, reason: null }
}

const sanitizeMarkdownLabel = (rawName: string | undefined): string =>
  (rawName || "image").replace(/[[\]\\]/g, "\\$&")

export const buildCloudAssetMarkdownSnippet = (
  file: CloudFile,
  promotedPublicAssetUrl?: string
): string => {
  if (!getCloudFilePostPromotionEligibility(file).promotable) return ""
  const safeLabel = sanitizeMarkdownLabel(file.originalFilename)
  const rawTargetUrl = promotedPublicAssetUrl?.trim() || ""
  if (!rawTargetUrl) return ""
  const targetUrl = escapeMarkdownLinkDestination(rawTargetUrl)
  return `![${safeLabel}](${targetUrl})`
}

const PickerCardThumbnail = ({
  file,
  onExpand,
  expandLabel,
}: {
  file: CloudFile
  onExpand: () => void
  expandLabel: string
}) => {
  const [failed, setFailed] = useState(false)
  const isImage = isImageCloudFile(file)
  const isSvg = isSvgCloudFile(file)
  const showImage = isImage && !isSvg && !failed
  const thumbUrl = appendCloudAssetVersionUrl(
    getCloudFileThumbnailUrl(file.id),
    file.modifiedAt || file.createdAt
  )
  const AssetIcon = getStrapiAssetIcon(file.contentType, file.originalFilename)

  return (
    <div className="assetThumb" data-fallback={showImage ? "false" : "true"} onDoubleClick={onExpand}>
      {showImage ? (
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          data-fit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="thumbFallback" aria-hidden="true">
          <AssetIcon width={28} height={28} />
        </span>
      )}
      <button
        type="button"
        className="thumbExpandBtn"
        aria-label={expandLabel}
        onClick={(e) => {
          e.stopPropagation()
          onExpand()
        }}
      >
        <StrapiCornersOutIcon width={14} height={14} />
      </button>
    </div>
  )
}

const CloudAssetPickerOpenBody = ({ onInsertMarkdownSnippet }: EditorStudioCloudAssetPickerProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const [searchKeyword, setSearchKeyword] = useState("")
  const [promotableOnly, setPromotableOnly] = useState(true)
  const [folderFilter, setFolderFilter] = useState("")
  const [promotingFileId, setPromotingFileId] = useState<number | null>(null)
  const [actionErrorText, setActionErrorText] = useState("")
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [previewFileId, setPreviewFileId] = useState<number | null>(null)

  const cloudFilesQuery = useQuery({
    queryKey: ["admin-cloud-files", "PHOTO", ""],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: () => listCloudFiles({ folderPath: "", mediaKind: "PHOTO" }),
  })

  const rawFiles = useMemo(
    () => (Array.isArray(cloudFilesQuery.data) ? cloudFilesQuery.data : []),
    [cloudFilesQuery.data]
  )
  const availableFolders = useMemo(
    () => extractCloudFolders(rawFiles, folderFilter),
    [folderFilter, rawFiles]
  )

  const filteredFiles = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase()
    const folder = normalizeCloudFolderPathSearch(folderFilter)
    return rawFiles
      .filter((file) => {
        if (promotableOnly && !getCloudFilePostPromotionEligibility(file, language).promotable) {
          return false
        }
        if (folder && normalizeCloudFolderPathSearch(file.folderPath) !== folder) return false
        return !q || file.originalFilename.toLowerCase().includes(q)
      })
      .slice(0, CLOUD_PICKER_MAX_ITEMS)
  }, [folderFilter, language, promotableOnly, rawFiles, searchKeyword])

  const previewFile = useMemo(
    () =>
      previewFileId !== null
        ? filteredFiles.find((item) => item.id === previewFileId) ?? null
        : null,
    [filteredFiles, previewFileId]
  )

  const queryErrorMessage =
    cloudFilesQuery.error instanceof Error && cloudFilesQuery.error.message.trim()
      ? cloudFilesQuery.error.message
      : cloudFilesQuery.isError
        ? t.emptyError
        : ""
  const errorText = actionErrorText || queryErrorMessage
  const isLoading = cloudFilesQuery.isFetching

  const handlePromoteAndInsert = useCallback(
    async (file: CloudFile) => {
      if (promotingFileId !== null) return
      const eligibility = getCloudFilePostPromotionEligibility(file, language)
      if (!eligibility.promotable) {
        setActionErrorText(eligibility.reason)
        return
      }
      setActionErrorText("")
      setPromotingFileId(file.id)

      try {
        const promotedRes = await promoteCloudFileToPostAsset(file.id)
        const snippet =
          promotedRes.markdown?.trim() || buildCloudAssetMarkdownSnippet(file, promotedRes.url)
        if (!snippet) {
          throw new Error(
            language === "en"
              ? "Failed to build public markdown image link."
              : "공개 본문 마크다운 링크를 생성하지 못했습니다."
          )
        }
        onInsertMarkdownSnippet?.(snippet)
        try {
          if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(snippet)
          }
          setCopiedId(file.id)
        } catch {
          if (onInsertMarkdownSnippet) {
            setCopiedId(file.id)
          } else {
            setActionErrorText(
              language === "en"
                ? "Clipboard copy failed."
                : "클립보드 복사에 실패했습니다. 수동으로 복사해주세요."
            )
          }
        }
      } catch (error) {
        setActionErrorText(
          error instanceof Error && error.message.trim()
            ? error.message
            : language === "en"
              ? "Failed to promote Cloud photo into a post image."
              : "클라우드 사진을 게시글 이미지로 승격하지 못했습니다."
        )
      } finally {
        setPromotingFileId(null)
      }
    },
    [language, onInsertMarkdownSnippet, promotingFileId]
  )

  return (
    <div className="pickerBody">
      <div className="pickerControls">
        <input
          type="search"
          className="pickerSearchInput"
          aria-label={t.searchLabel}
          placeholder={t.searchPlaceholder}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
        />
        <div className="pickerFilterRow">
          <div className="pickerFilterTabs" role="group" aria-label={t.pickerHeading}>
            <PickerFilterChip
              type="button"
              data-active={promotableOnly}
              aria-pressed={promotableOnly}
              onClick={() => setPromotableOnly(true)}
            >
              {t.pickerPromotableOnly}
            </PickerFilterChip>
            <PickerFilterChip
              type="button"
              data-active={!promotableOnly}
              aria-pressed={!promotableOnly}
              onClick={() => setPromotableOnly(false)}
            >
              {t.filterAll}
            </PickerFilterChip>
          </div>
          <SecondaryButton
            type="button"
            onClick={() => {
              setActionErrorText("")
              void cloudFilesQuery.refetch()
            }}
            disabled={isLoading || promotingFileId !== null}
          >
            {isLoading ? t.emptyLoading : language === "en" ? "Refresh" : "새로고침"}
          </SecondaryButton>
        </div>
        {availableFolders.length > 0 ? (
          <div className="pickerFolderRow" role="group" aria-label={t.folderBreadcrumbAria}>
            <PickerFilterChip
              type="button"
              data-active={!folderFilter}
              aria-pressed={!folderFilter}
              onClick={() => setFolderFilter("")}
            >
              {t.rootFolder}
            </PickerFilterChip>
            {availableFolders.map((folder) => (
              <PickerFilterChip
                key={folder}
                type="button"
                data-active={folderFilter === folder}
                aria-pressed={folderFilter === folder}
                onClick={() => setFolderFilter(folder)}
              >
                /{folder}
              </PickerFilterChip>
            ))}
          </div>
        ) : null}
      </div>

      {errorText ? (
        <p className="pickerError" role="alert">
          {errorText}
        </p>
      ) : null}
      {!isLoading && !errorText && filteredFiles.length === 0 ? (
        <p className="pickerEmpty">{t.pickerEmpty}</p>
      ) : null}

      {filteredFiles.length > 0 ? (
        <ul className="assetGrid">
          {filteredFiles.map((file) => {
            const eligibility = getCloudFilePostPromotionEligibility(file, language)
            const isPromoting = promotingFileId === file.id
            const isCopied = copiedId === file.id
            const folderText = normalizeCloudFolderPathSearch(file.folderPath)
            const actionLabel = isPromoting
              ? t.pickerInserting
              : isCopied
                ? t.shareCopied
                : onInsertMarkdownSnippet
                  ? t.pickerInsertImage
                  : t.shareCopyLink
            return (
              <li key={file.id} className="assetCard">
                <PickerCardThumbnail
                  file={file}
                  expandLabel={`${file.originalFilename} ${t.actionPreview}`}
                  onExpand={() => setPreviewFileId(file.id)}
                />
                <div className="assetMeta">
                  <strong title={file.originalFilename}>{file.originalFilename}</strong>
                  <span>
                    {getCloudKindBadge(file)} · {formatFileSize(file.byteSize, { fallback: "0 B" })}
                    {folderText ? ` · /${folderText}` : ""}
                  </span>
                  {!eligibility.promotable ? (
                    <span className="assetIneligibleReason" title={eligibility.reason}>
                      {eligibility.reason}
                    </span>
                  ) : null}
                </div>
                <SecondaryButton
                  type="button"
                  disabled={promotingFileId !== null || !eligibility.promotable}
                  title={eligibility.reason || undefined}
                  onClick={() => void handlePromoteAndInsert(file)}
                >
                  {actionLabel}
                </SecondaryButton>
              </li>
            )
          })}
        </ul>
      ) : null}

      <AdminCloudMediaLightbox
        open={previewFile !== null}
        file={previewFile}
        files={filteredFiles}
        onClose={() => setPreviewFileId(null)}
        onSelectFile={(nextId) => setPreviewFileId(nextId)}
      />
    </div>
  )
}

export const EditorStudioCloudAssetPicker = (props: EditorStudioCloudAssetPickerProps = {}) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const [isOpen, setIsOpen] = useState(false)
  return (
    <CloudAssetPickerSection aria-label={t.pickerHeading}>
      <div className="pickerHeader">
        <span>{t.pickerHeading}</span>
        <SecondaryButton type="button" onClick={() => setIsOpen((prev) => !prev)}>
          {isOpen ? t.pickerToggleClose : t.pickerToggleOpen}
        </SecondaryButton>
      </div>
      <small>{t.pickerSubtitle}</small>
      {isOpen ? <CloudAssetPickerOpenBody {...props} /> : null}
    </CloudAssetPickerSection>
  )
}

const PickerFilterChip = styled.button<{ "data-active"?: boolean }>`
  min-height: 28px;
  padding: 0 0.56rem;
  border-radius: 6px;
  font-size: 0.73rem;
  font-weight: 650;
  cursor: pointer;
  border: 0;
  background: ${({ theme, "data-active": active }) =>
    active ? theme.colors.gray12 : theme.colors.gray3};
  color: ${({ theme, "data-active": active }) =>
    active ? theme.colors.gray1 : theme.colors.gray11};
  ${focusVisibleRing}
  &:hover {
    background: ${({ theme, "data-active": active }) =>
      active ? theme.colors.gray12 : theme.colors.gray4};
  }
  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`

const CloudAssetPickerSection = styled.section`
  display: grid;
  gap: 0.5rem;
  padding: 16px 0;
  margin: 0;
  border: 0;
  border-bottom: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;

  .pickerHeader,
  .pickerFilterRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.45rem;
    flex-wrap: wrap;
  }
  .pickerBody {
    display: grid;
    gap: 0.55rem;
    padding-top: 0.45rem;
    border-top: 1px solid ${adminBorderSubtle};
  }
  .pickerControls {
    display: grid;
    gap: 0.42rem;
  }
  .pickerSearchInput {
    width: 100%;
    min-height: 34px;
    padding: 0 0.65rem;
    border-radius: 6px;
    border: 1px solid transparent;
    background: ${({ theme }) => theme.colors.gray3};
    color: ${({ theme }) => theme.colors.gray12};
    font-size: 0.78rem;
    box-sizing: border-box;
    ${focusVisibleRing}
    &:focus-visible {
      background: ${({ theme }) => theme.colors.gray1};
      border-color: ${({ theme }) => theme.colors.gray8};
    }
    @media (pointer: coarse) {
      min-height: 44px;
      font-size: 1rem;
    }
  }
  .pickerFilterTabs,
  .pickerFolderRow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.28rem;
  }
  .pickerError {
    margin: 0;
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.red11};
  }
  .pickerEmpty {
    margin: 0;
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.gray10};
  }
  .assetGrid {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    max-height: 18rem;
    overflow-y: auto;
    @media (max-width: 460px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .assetCard {
    display: grid;
    gap: 0.36rem;
    padding: 0.42rem;
    border-radius: 8px;
    background: ${({ theme }) => theme.colors.gray2};
  }
  .assetThumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    border-radius: 6px;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: ${adminCheckerboardBackground};
    color: ${({ theme }) => theme.colors.gray10};
    &[data-fallback="true"] {
      background: ${({ theme }) => theme.colors.gray3};
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .thumbFallback {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thumbExpandBtn {
      position: absolute;
      top: 0.32rem;
      right: 0.32rem;
      width: 26px;
      height: 26px;
      display: inline-grid;
      place-items: center;
      border: 0;
      border-radius: 6px;
      background: ${({ theme }) => theme.colors.gray1};
      color: ${({ theme }) => theme.colors.gray12};
      cursor: pointer;
      opacity: 0.86;
      ${focusVisibleRing}
      &:hover {
        opacity: 1;
      }
      @media (pointer: coarse) {
        width: 44px;
        height: 44px;
      }
    }
  }
  .assetMeta {
    min-width: 0;
    display: grid;
    gap: 0.08rem;
    strong,
    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    strong {
      font-size: 0.74rem;
      font-weight: 700;
      color: ${({ theme }) => theme.colors.gray12};
    }
    span {
      font-size: 0.68rem;
      color: ${({ theme }) => theme.colors.gray10};
    }
    .assetIneligibleReason {
      color: ${({ theme }) => theme.colors.red11};
      font-weight: 600;
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
      word-break: keep-all;
      line-height: 1.3;
    }
  }
`
