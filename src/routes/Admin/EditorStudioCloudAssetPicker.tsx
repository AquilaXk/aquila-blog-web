/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/components/AssetDialog/BrowseStep/index.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 */
/* eslint-disable @next/next/no-img-element */
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import {
  type CloudFile,
  getCloudFileThumbnailUrl,
  listCloudFiles,
  promoteCloudFileToPostAsset,
} from "src/apis/backend/cloud"
import { escapeMarkdownLinkDestination } from "src/components/markdown-editor/markdownEditorUploadModel"
import { useLanguage, type SiteLanguage } from "src/libs/language"
import { formatFileSize } from "src/libs/utils"
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
import { CloudAssetPickerSection, PickerFilterChip } from "./EditorStudioCloudAssetPicker.styles"
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
              ? "Failed to create markdown image link."
              : "본문 이미지 링크를 생성하지 못했습니다."
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
                ? "Clipboard copy failed. Check browser permissions and try again."
                : "클립보드 복사에 실패했습니다. 브라우저의 복사 권한을 확인한 뒤 다시 시도해주세요."
            )
          }
        }
      } catch (error) {
        setActionErrorText(
          error instanceof Error && error.message.trim()
            ? error.message
            : language === "en"
              ? "Failed to insert Cloud photo into the post."
              : "클라우드 사진을 본문에 삽입하지 못했습니다."
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
              {t.pickerAllFolders}
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
                ? onInsertMarkdownSnippet
                  ? t.pickerInserted
                  : t.shareCopied
                : onInsertMarkdownSnippet
                  ? t.pickerInsertImage
                  : t.pickerCopyMarkdown
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
