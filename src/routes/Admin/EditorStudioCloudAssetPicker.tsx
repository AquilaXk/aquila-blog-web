/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/components/AssetDialog/BrowseStep/index.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - igordanchenko/yet-another-react-lightbox src/styles.scss (MIT License, Copyright (c) 2022 Igor Danchenko)
 */
/* eslint-disable @next/next/no-img-element */
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import {
  type CloudFile,
  type CloudMediaKind,
  getCloudFileContentUrl,
  getCloudFileDownloadUrl,
  listCloudFiles,
  promoteCloudFileToPostAsset,
} from "src/apis/backend/cloud"
import { escapeMarkdownLinkDestination } from "src/components/markdown-editor/markdownEditorUploadModel"
import { focusVisibleRing } from "src/design-system/focusRing"
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
import { SecondaryButton } from "./EditorStudioDedicatedEditorSurfaceParts"

const CLOUD_PICKER_MAX_ITEMS = 24
export const MAX_PICKER_FALLBACK_BYTES = 20 * 1024 * 1024

type PickerMediaFilter = "ALL" | CloudMediaKind

const PICKER_FILTER_OPTIONS: ReadonlyArray<{ value: PickerMediaFilter; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "PHOTO", label: "사진" },
  { value: "VIDEO", label: "동영상" },
  { value: "DOCUMENT", label: "문서" },
]

type EditorStudioCloudAssetPickerProps = {
  onUploadPostImage?: (file: File) => Promise<{ alt?: string; title?: string; url?: string; src?: string }>
  onUploadPostAttachment?: (file: File) => Promise<{ url?: string; name?: string }>
  onInsertMarkdownSnippet?: (snippet: string) => void
}

const isImageCloudAsset = (file: CloudFile): boolean => isImageCloudFile(file)

const sanitizeMarkdownLabel = (rawName: string | undefined): string =>
  (rawName || "attachment").replace(/[[\]\\]/g, "\\$&")

export const buildCloudAssetMarkdownSnippet = (file: CloudFile, promotedPublicAssetUrl?: string): string => {
  const safeLabel = sanitizeMarkdownLabel(file.originalFilename)
  const rawTargetUrl = promotedPublicAssetUrl?.trim() || ""
  if (!rawTargetUrl) return ""
  const targetUrl = escapeMarkdownLinkDestination(rawTargetUrl)
  return isImageCloudAsset(file) ? `![${safeLabel}](${targetUrl})` : `[${safeLabel}](${targetUrl})`
}

export const assertCloudPickerFallbackByteBudget = (
  declaredByteSize: number,
  contentLengthHeader?: string | null,
  maxBytes = MAX_PICKER_FALLBACK_BYTES
): void => {
  if (Number.isFinite(declaredByteSize) && declaredByteSize > maxBytes) {
    throw new Error("클라우드 파일 크기가 에디터 직접 변환 상한(20MB)을 초과했습니다.")
  }
  const parsedContentLength = Number(contentLengthHeader || 0)
  if (Number.isFinite(parsedContentLength) && parsedContentLength > maxBytes) {
    throw new Error("응답 크기가 에디터 직접 변환 상한(20MB)을 초과했습니다.")
  }
}

export const readBoundedResponseBlob = async (
  response: Response,
  maxBytes = MAX_PICKER_FALLBACK_BYTES,
  declaredByteSize = 0
): Promise<Blob> => {
  assertCloudPickerFallbackByteBudget(declaredByteSize, response.headers.get("content-length"), maxBytes)
  const contentType = response.headers.get("content-type") || ""
  const reader = response.body?.getReader()
  if (!reader) {
    const fallbackBlob = await response.blob()
    if (fallbackBlob.size > maxBytes) {
      throw new Error("내려받은 파일 크기가 에디터 직접 변환 상한(20MB)을 초과했습니다.")
    }
    return fallbackBlob
  }

  const chunks: Uint8Array[] = []
  let receivedBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      receivedBytes += value.byteLength
      if (receivedBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new Error("내려받는 중 에디터 직접 변환 상한(20MB)을 초과해 중단했습니다.")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return new Blob(chunks as BlobPart[], { type: contentType })
}

const resolvePublicUrlForCloudFile = async (
  file: CloudFile,
  isImageAsset: boolean,
  onUploadPostImage: EditorStudioCloudAssetPickerProps["onUploadPostImage"],
  onUploadPostAttachment: EditorStudioCloudAssetPickerProps["onUploadPostAttachment"]
): Promise<string> => {
  if (isImageAsset) {
    try {
      const promotedRes = await promoteCloudFileToPostAsset(file.id)
      if (promotedRes.url?.trim()) return promotedRes.url.trim()
    } catch {
      // 승격 실패 시 바이트 예산 가드 폴백 업로드 수행
    }
  }

  assertCloudPickerFallbackByteBudget(file.byteSize, null)
  const sourceUrl = isImageAsset ? getCloudFileContentUrl(file.id) : getCloudFileDownloadUrl(file.id)
  const abortController = new AbortController()
  const timeoutId = window.setTimeout(() => abortController.abort(), 30_000)
  let response: Response
  try {
    response = await fetch(sourceUrl, { credentials: "include", signal: abortController.signal })
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error(`${isImageAsset ? "클라우드 이미지" : "클라우드 파일"}를 내려받지 못했습니다. (HTTP ${response.status})`)
  }
  const blob = await readBoundedResponseBlob(response, MAX_PICKER_FALLBACK_BYTES, file.byteSize)
  const fallbackName = file.originalFilename || (isImageAsset ? `cloud-image-${file.id}.png` : `cloud-file-${file.id}`)
  const mime = blob.type || file.contentType || (isImageAsset ? "image/png" : "application/octet-stream")
  const uploadFile = new File([blob], fallbackName, { type: mime })

  if (isImageAsset && onUploadPostImage) {
    const uploaded = await onUploadPostImage(uploadFile)
    return (uploaded.src || uploaded.url || "").trim()
  }
  if (!isImageAsset && onUploadPostAttachment) {
    const uploaded = await onUploadPostAttachment(uploadFile)
    return (uploaded.url || "").trim()
  }
  return ""
}

const PickerCardThumbnail = ({ file, onExpand }: { file: CloudFile; onExpand: () => void }) => {
  const [failed, setFailed] = useState(false)
  const isImage = isImageCloudAsset(file)
  const isSvg = isSvgCloudFile(file)
  const showImage = isImage && !failed
  const contentUrl = appendCloudAssetVersionUrl(
    getCloudFileContentUrl(file.id),
    file.modifiedAt || file.createdAt
  )
  const AssetIcon = getStrapiAssetIcon(file.contentType, file.originalFilename)

  return (
    <div className="assetThumb" data-fallback={showImage ? "false" : "true"} onDoubleClick={onExpand}>
      {showImage ? (
        <img
          src={contentUrl}
          alt=""
          loading="lazy"
          decoding="async"
          data-fit={isSvg ? "contain" : "cover"}
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
        aria-label={`${file.originalFilename} 크게 보기`}
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

const CloudAssetPickerOpenBody = ({
  onUploadPostImage,
  onUploadPostAttachment,
  onInsertMarkdownSnippet,
}: EditorStudioCloudAssetPickerProps) => {
  const [searchKeyword, setSearchKeyword] = useState("")
  const [mediaFilter, setMediaFilter] = useState<PickerMediaFilter>("ALL")
  const [folderFilter, setFolderFilter] = useState("")
  const [promotingFileId, setPromotingFileId] = useState<number | null>(null)
  const [actionErrorText, setActionErrorText] = useState("")
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [previewFileId, setPreviewFileId] = useState<number | null>(null)

  const cloudFilesQuery = useQuery({
    queryKey: ["admin-cloud-files", mediaFilter, ""],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: () => listCloudFiles({ folderPath: "", mediaKind: mediaFilter === "ALL" ? undefined : mediaFilter }),
  })

  const rawFiles = useMemo(() => (Array.isArray(cloudFilesQuery.data) ? cloudFilesQuery.data : []), [cloudFilesQuery.data])
  const availableFolders = useMemo(() => extractCloudFolders(rawFiles, folderFilter), [folderFilter, rawFiles])

  const filteredFiles = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase()
    const folder = normalizeCloudFolderPathSearch(folderFilter)
    return rawFiles
      .filter((file) => {
        if (folder && normalizeCloudFolderPathSearch(file.folderPath) !== folder) return false
        return !q || file.originalFilename.toLowerCase().includes(q)
      })
      .slice(0, CLOUD_PICKER_MAX_ITEMS)
  }, [folderFilter, rawFiles, searchKeyword])

  const previewFile = useMemo(
    () => (previewFileId !== null ? filteredFiles.find((item) => item.id === previewFileId) ?? null : null),
    [filteredFiles, previewFileId]
  )

  const queryErrorMessage =
    cloudFilesQuery.error instanceof Error && cloudFilesQuery.error.message.trim()
      ? cloudFilesQuery.error.message
      : cloudFilesQuery.isError
        ? "클라우드 파일 목록을 불러오지 못했습니다."
        : ""
  const errorText = actionErrorText || queryErrorMessage
  const isLoading = cloudFilesQuery.isFetching

  const handleInsertOrCopySnippet = useCallback(
    async (file: CloudFile) => {
      if (promotingFileId !== null) return
      setActionErrorText("")
      const isImageAsset = isImageCloudAsset(file)
      if (isImageAsset && !onUploadPostImage) {
        setActionErrorText("공개 본문 이미지 업로드 경로가 연결되지 않아 클라우드 이미지를 삽입할 수 없습니다.")
        return
      }
      if (!isImageAsset && !onUploadPostAttachment) {
        setActionErrorText("공개 첨부 파일 업로드 경로가 연결되지 않아 클라우드 파일을 삽입할 수 없습니다.")
        return
      }

      setPromotingFileId(file.id)
      let promotedPublicAssetUrl = ""
      try {
        promotedPublicAssetUrl = await resolvePublicUrlForCloudFile(file, isImageAsset, onUploadPostImage, onUploadPostAttachment)
        if (!promotedPublicAssetUrl) throw new Error("공개 포스트 자산 URL을 발급받지 못했습니다.")
      } catch (error) {
        setActionErrorText(error instanceof Error && error.message.trim() ? error.message : "클라우드 자산을 공개 본문 자산으로 변환하지 못했습니다.")
        setPromotingFileId(null)
        return
      }
      setPromotingFileId(null)

      const snippet = buildCloudAssetMarkdownSnippet(file, promotedPublicAssetUrl)
      if (!snippet) {
        setActionErrorText("공개 본문 마크다운 링크를 생성하지 못했습니다.")
        return
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
          return
        }
        setActionErrorText("클립보드 복사에 실패했습니다. 수동으로 마크다운 링크를 복사해 주세요.")
      }
    },
    [onInsertMarkdownSnippet, onUploadPostAttachment, onUploadPostImage, promotingFileId]
  )

  return (
    <div className="pickerBody">
      <div className="pickerControls">
        <input
          type="search"
          className="pickerSearchInput"
          aria-label="클라우드 자산 검색"
          placeholder="파일명 검색..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
        />
        <div className="pickerFilterRow">
          <div className="pickerFilterTabs" role="group" aria-label="클라우드 자산 종류 필터">
            {PICKER_FILTER_OPTIONS.map((opt) => (
              <PickerFilterChip key={opt.value} type="button" data-active={mediaFilter === opt.value} aria-pressed={mediaFilter === opt.value} onClick={() => setMediaFilter(opt.value)}>
                {opt.label}
              </PickerFilterChip>
            ))}
          </div>
          <SecondaryButton
            type="button"
            onClick={() => {
              setActionErrorText("")
              void cloudFilesQuery.refetch()
            }}
            disabled={isLoading || promotingFileId !== null}
          >
            {isLoading ? "불러오는 중..." : "새로고침"}
          </SecondaryButton>
        </div>
        {availableFolders.length > 0 ? (
          <div className="pickerFolderRow" role="group" aria-label="클라우드 자산 폴더 필터">
            <PickerFilterChip type="button" data-active={!folderFilter} aria-pressed={!folderFilter} onClick={() => setFolderFilter("")}>
              전체 폴더
            </PickerFilterChip>
            {availableFolders.map((folder) => (
              <PickerFilterChip key={folder} type="button" data-active={folderFilter === folder} aria-pressed={folderFilter === folder} onClick={() => setFolderFilter(folder)}>
                /{folder}
              </PickerFilterChip>
            ))}
          </div>
        ) : null}
      </div>

      {errorText ? <p className="pickerError" role="alert">{errorText}</p> : null}
      {!isLoading && !errorText && filteredFiles.length === 0 ? (
        <p className="pickerEmpty">
          {searchKeyword.trim() || folderFilter ? "검색 조건에 맞는 클라우드 파일이 없습니다." : "최근 클라우드 파일이 없습니다."}
        </p>
      ) : null}

      {filteredFiles.length > 0 ? (
        <ul className="assetGrid">
          {filteredFiles.map((file) => {
            const isPromoting = promotingFileId === file.id
            const isCopied = copiedId === file.id
            const folderText = normalizeCloudFolderPathSearch(file.folderPath)
            const actionLabel = isPromoting
              ? "업로드 중..."
              : isCopied
                ? onInsertMarkdownSnippet ? "삽입·복사됨" : "복사됨"
                : onInsertMarkdownSnippet ? "본문 삽입" : "마크다운 복사"
            return (
              <li key={file.id} className="assetCard">
                <PickerCardThumbnail file={file} onExpand={() => setPreviewFileId(file.id)} />
                <div className="assetMeta">
                  <strong title={file.originalFilename}>{file.originalFilename}</strong>
                  <span>
                    {getCloudKindBadge(file)} · {formatFileSize(file.byteSize, { fallback: "0 B" })}
                    {folderText ? ` · /${folderText}` : ""}
                  </span>
                </div>
                <SecondaryButton type="button" disabled={promotingFileId !== null} onClick={() => void handleInsertOrCopySnippet(file)}>
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
  const [isOpen, setIsOpen] = useState(false)
  return (
    <CloudAssetPickerSection aria-label="개인 클라우드 자산 빠른 삽입">
      <div className="pickerHeader">
        <span>클라우드 자산</span>
        <SecondaryButton type="button" onClick={() => setIsOpen((prev) => !prev)}>
          {isOpen ? "목록 접기" : "클라우드 파일 불러오기"}
        </SecondaryButton>
      </div>
      <small>개인 클라우드 자산을 공개 본문 이미지·첨부파일로 승격해 삽입하거나 마크다운 링크를 복사합니다.</small>
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
  background: ${({ theme, "data-active": active }) => (active ? theme.colors.gray12 : theme.colors.gray3)};
  color: ${({ theme, "data-active": active }) => (active ? theme.colors.gray1 : theme.colors.gray11)};
  ${focusVisibleRing}
  &:hover {
    background: ${({ theme, "data-active": active }) => (active ? theme.colors.gray12 : theme.colors.gray4)};
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
    img[data-fit="contain"] {
      object-fit: contain;
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
      svg {
        width: 0.85rem;
        height: 0.85rem;
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
  }
`
