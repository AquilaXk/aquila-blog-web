import styled from "@emotion/styled"
import { useCallback, useState } from "react"
import {
  type CloudFile,
  getCloudFileContentUrl,
  getCloudFileDownloadUrl,
  listCloudFiles,
} from "src/apis/backend/cloud"
import { SecondaryButton } from "./EditorStudioDedicatedEditorSurfaceParts"

const CLOUD_PICKER_MAX_ITEMS = 12

type EditorStudioCloudAssetPickerProps = {
  onUploadPostImage?: (
    file: File
  ) => Promise<{ alt?: string; title?: string; url?: string; src?: string }>
  onInsertMarkdownSnippet?: (snippet: string) => void
}

const isImageCloudAsset = (file: CloudFile): boolean =>
  file.mediaKind === "PHOTO" || Boolean(file.contentType?.toLowerCase().startsWith("image/"))

const sanitizeMarkdownLabel = (rawName: string | undefined): string =>
  (rawName || "attachment").replace(/[[\]\\]/g, "\\$&")

export const buildCloudAssetMarkdownSnippet = (
  file: CloudFile,
  promotedPublicImageUrl?: string
): string => {
  const safeLabel = sanitizeMarkdownLabel(file.originalFilename)
  if (isImageCloudAsset(file)) {
    const targetUrl = promotedPublicImageUrl?.trim() || getCloudFileContentUrl(file.id)
    return `![${safeLabel}](${targetUrl})`
  }
  return `[${safeLabel}](${getCloudFileDownloadUrl(file.id)})`
}

export const EditorStudioCloudAssetPicker = ({
  onUploadPostImage,
  onInsertMarkdownSnippet,
}: EditorStudioCloudAssetPickerProps = {}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [promotingFileId, setPromotingFileId] = useState<number | null>(null)
  const [errorText, setErrorText] = useState("")
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [files, setFiles] = useState<CloudFile[]>([])

  const loadRecentCloudAssets = useCallback(async () => {
    setIsLoading(true)
    setErrorText("")
    try {
      const response = await listCloudFiles({ folderPath: "" })
      setFiles((Array.isArray(response) ? response : []).slice(0, CLOUD_PICKER_MAX_ITEMS))
    } catch (error) {
      setErrorText(
        error instanceof Error && error.message.trim()
          ? error.message
          : "클라우드 파일 목록을 불러오지 못했습니다."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (next && files.length === 0 && !isLoading) {
        void loadRecentCloudAssets()
      }
      return next
    })
  }, [files.length, isLoading, loadRecentCloudAssets])

  const handleInsertOrCopySnippet = useCallback(
    async (file: CloudFile) => {
      setErrorText("")
      let promotedPublicImageUrl: string | undefined

      if (isImageCloudAsset(file) && onUploadPostImage) {
        setPromotingFileId(file.id)
        try {
          const response = await fetch(getCloudFileContentUrl(file.id), {
            credentials: "include",
          })
          if (!response.ok) {
            throw new Error(`클라우드 이미지를 내려받지 못했습니다. (HTTP ${response.status})`)
          }
          const blob = await response.blob()
          const uploadFile = new File(
            [blob],
            file.originalFilename || `cloud-image-${file.id}.png`,
            { type: blob.type || file.contentType || "image/png" }
          )
          const uploaded = await onUploadPostImage(uploadFile)
          const resolvedUrl = (uploaded.src || uploaded.url || "").trim()
          if (!resolvedUrl) {
            throw new Error("공개 포스트 이미지 URL을 발급받지 못했습니다.")
          }
          promotedPublicImageUrl = resolvedUrl
        } catch (error) {
          setErrorText(
            error instanceof Error && error.message.trim()
              ? error.message
              : "클라우드 이미지를 공개 본문 이미지로 변환하지 못했습니다."
          )
          setPromotingFileId(null)
          return
        }
        setPromotingFileId(null)
      }

      const snippet = buildCloudAssetMarkdownSnippet(file, promotedPublicImageUrl)
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
        setErrorText("클립보드 복사에 실패했습니다. 수동으로 마크다운 링크를 복사해 주세요.")
      }
    },
    [onInsertMarkdownSnippet, onUploadPostImage]
  )

  return (
    <CloudAssetPickerSection aria-label="개인 클라우드 자산 빠른 삽입">
      <div className="pickerHeader">
        <span>클라우드 자산</span>
        <SecondaryButton type="button" onClick={handleToggle}>
          {isOpen ? "목록 접기" : "클라우드 파일 불러오기"}
        </SecondaryButton>
      </div>
      <small>개인 클라우드 이미지를 공개 본문 이미지로 승격해 삽입하거나 마크다운 링크를 복사합니다.</small>
      {isOpen ? (
        <div className="pickerBody">
          <div className="pickerToolbar">
            <SecondaryButton type="button" onClick={() => void loadRecentCloudAssets()} disabled={isLoading}>
              {isLoading ? "불러오는 중..." : "새로고침"}
            </SecondaryButton>
          </div>
          {errorText ? <p className="pickerError" role="alert">{errorText}</p> : null}
          {!isLoading && !errorText && files.length === 0 ? (
            <p className="pickerEmpty">최근 클라우드 파일이 없습니다.</p>
          ) : null}
          {files.length > 0 ? (
            <ul className="assetList">
              {files.map((file) => {
                const isPromoting = promotingFileId === file.id
                const isCopied = copiedId === file.id
                return (
                  <li key={file.id} className="assetItem">
                    <div className="assetMeta">
                      <strong title={file.originalFilename}>{file.originalFilename}</strong>
                      <span>{isImageCloudAsset(file) ? "이미지" : "첨부파일"}</span>
                    </div>
                    <SecondaryButton
                      type="button"
                      disabled={isPromoting}
                      onClick={() => void handleInsertOrCopySnippet(file)}
                    >
                      {isPromoting
                        ? "업로드 중..."
                        : isCopied
                          ? onInsertMarkdownSnippet
                            ? "삽입·복사됨"
                            : "복사됨"
                          : onInsertMarkdownSnippet
                            ? "본문 삽입"
                            : "마크다운 복사"}
                    </SecondaryButton>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </CloudAssetPickerSection>
  )
}

const CloudAssetPickerSection = styled.section`
  display: grid;
  gap: 0.4rem;
  padding-top: 0.5rem;
  border-top: 1px solid ${({ theme }) => theme.colors.gray4};

  .pickerHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .pickerBody {
    display: grid;
    gap: 0.45rem;
    padding: 0.55rem;
    border-radius: 6px;
    border: 1px solid ${({ theme }) => theme.colors.gray5};
    background: ${({ theme }) => theme.colors.gray2};
  }

  .pickerToolbar {
    display: flex;
    justify-content: flex-end;
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

  .assetList {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.35rem;
    max-height: 13rem;
    overflow-y: auto;
  }

  .assetItem {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.35rem 0.45rem;
    border-radius: 4px;
    border: 1px solid ${({ theme }) => theme.colors.gray4};
    background: ${({ theme }) => theme.colors.gray1};
  }

  .assetMeta {
    min-width: 0;
    display: grid;
    gap: 0.1rem;

    strong {
      font-size: 0.75rem;
      font-weight: 700;
      color: ${({ theme }) => theme.colors.gray12};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      font-size: 0.68rem;
      color: ${({ theme }) => theme.colors.gray10};
    }
  }
`
