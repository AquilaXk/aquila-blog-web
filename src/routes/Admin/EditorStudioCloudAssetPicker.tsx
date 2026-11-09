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

const buildCloudAssetMarkdownSnippet = (file: CloudFile): string => {
  const safeLabel = (file.originalFilename || "attachment").replace(/[[\]\\]/g, "\\$&")
  if (file.mediaKind === "PHOTO") {
    return `![${safeLabel}](${getCloudFileContentUrl(file.id)})`
  }
  return `[${safeLabel}](${getCloudFileDownloadUrl(file.id)})`
}

export const EditorStudioCloudAssetPicker = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
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

  const handleCopySnippet = useCallback(async (file: CloudFile) => {
    const snippet = buildCloudAssetMarkdownSnippet(file)
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet)
        setCopiedId(file.id)
      }
    } catch {
      setErrorText("클립보드 복사에 실패했습니다. 수동으로 마크다운 링크를 복사해 주세요.")
    }
  }, [])

  return (
    <CloudAssetPickerSection aria-label="개인 클라우드 자산 빠른 삽입">
      <div className="pickerHeader">
        <span>클라우드 자산</span>
        <SecondaryButton type="button" onClick={handleToggle}>
          {isOpen ? "목록 접기" : "클라우드 파일 불러오기"}
        </SecondaryButton>
      </div>
      <small>개인 클라우드에 올린 최근 파일의 마크다운 링크를 복사해 본문에 붙여넣을 수 있습니다.</small>
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
              {files.map((file) => (
                <li key={file.id} className="assetItem">
                  <div className="assetMeta">
                    <strong title={file.originalFilename}>{file.originalFilename}</strong>
                    <span>{file.mediaKind === "PHOTO" ? "이미지" : "첨부파일"}</span>
                  </div>
                  <SecondaryButton type="button" onClick={() => void handleCopySnippet(file)}>
                    {copiedId === file.id ? "복사됨" : "마크다운 복사"}
                  </SecondaryButton>
                </li>
              ))}
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
