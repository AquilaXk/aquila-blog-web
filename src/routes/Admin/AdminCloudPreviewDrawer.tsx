/* eslint-disable @next/next/no-img-element */
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useEffect, useRef, useState } from "react"
import {
  getCloudFileContentUrl,
  issueCloudExternalPlaybackToken,
  type CloudFile,
} from "src/apis/backend/cloud"
import { PLAYBACK_SPEEDS, getCloudKindBadge } from "./AdminCloudWorkspaceModel"
import {
  ActionGroup,
  ConfirmBackdrop,
  ConfirmDialog,
  DocumentFallbackBox,
  EmptyState,
  FileThumbnailFrame,
  FilterGroup,
  GhostButton,
  InlineList,
  PdfCanvas,
  PhotoFallback,
  PhotoFrame,
  PlayerBar,
  PreviewHeader,
  PreviewStage,
  PrimaryButton,
  SecondaryButton,
  VideoFrame,
} from "./AdminCloudWorkspace.styles"

const PDF_STANDARD_FONT_DATA_URL = "/pdfjs/standard_fonts/"

const isPdfDocumentFile = (file: CloudFile) => file.contentType.toLowerCase() === "application/pdf"

export const resolveCloudErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return "요청 처리 중 오류가 발생했습니다."
}

type ExternalPlaybackPlayer = "iina" | "mpv"

type ExternalPlaybackCommandState = {
  status: "pending" | "success" | "error"
  message: string
}

const EXTERNAL_PLAYBACK_PLAYER_LABELS: Record<ExternalPlaybackPlayer, string> = {
  iina: "IINA",
  mpv: "mpv",
}

const quoteShellArg = (value: string) => `"${value.replace(/(["\\$`])/g, String.raw`\$1`)}"`

const buildExternalPlaybackCommand = (player: ExternalPlaybackPlayer, contentUrl: string) =>
  `${player} ${quoteShellArg(contentUrl)}`

const installPdfWorkerTerminationRejectionHandler = () => {
  const shouldIgnorePdfWorkerTermination = (error: unknown) => {
    if (error instanceof Error) return error.message.includes("Worker was terminated")
    if (typeof error === "string") return error.includes("Worker was terminated")

    return false
  }

  const handleCleanupRejection = (event: PromiseRejectionEvent) => {
    if (!shouldIgnorePdfWorkerTermination(event.reason)) return

    event.preventDefault()
  }

  const handleCleanupError = (event: ErrorEvent) => {
    if (!shouldIgnorePdfWorkerTermination(event.error) && !shouldIgnorePdfWorkerTermination(event.message)) return

    event.preventDefault()
  }

  window.addEventListener("unhandledrejection", handleCleanupRejection)
  window.addEventListener("error", handleCleanupError)
  return (delayMs = 0) => {
    window.setTimeout(() => {
      window.removeEventListener("unhandledrejection", handleCleanupRejection)
      window.removeEventListener("error", handleCleanupError)
    }, delayMs)
  }
}

const swallowPromiseRejection = (promise: Promise<unknown> | undefined) => {
  void promise?.catch(() => undefined)
}

const cleanupPdfDocumentAfterRender = async (
  pdfDocument: PDFDocumentProxy,
  loadingTask: PDFDocumentLoadingTask | null
) => {
  try {
    await pdfDocument.cleanup()
  } catch {
    undefined
  }
  swallowPromiseRejection(loadingTask?.destroy())
}

const ignorePdfPreviewTeardownRejection = (
  loadingTask: PDFDocumentLoadingTask | null,
  pdfDocument: PDFDocumentProxy | null,
  renderTask: RenderTask | null
) => {
  const renderSettled = renderTask?.promise.catch(() => undefined) ?? Promise.resolve()
  swallowPromiseRejection(loadingTask?.promise)

  if (pdfDocument) {
    void renderSettled.then(() => cleanupPdfDocumentAfterRender(pdfDocument, loadingTask))
    return
  }

  if (!loadingTask) return

  void renderSettled.finally(() => {
    swallowPromiseRejection(loadingTask.destroy())
  })
}

type PdfPreviewProps = {
  file: CloudFile
  contentUrl: string
}

const PdfPreview = ({ file, contentUrl }: PdfPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [renderState, setRenderState] = useState("미리보기 준비")

  useEffect(() => {
    if (file.mediaKind !== "DOCUMENT") return
    let cancelled = false
    let loadingTask: PDFDocumentLoadingTask | null = null
    let pdfDocument: PDFDocumentProxy | null = null
    setCurrentPage(1)
    setPageCount(0)
    setPdfDoc(null)
    setRenderState("미리보기 준비")
    const releasePdfWorkerTerminationHandler = installPdfWorkerTerminationRejectionHandler()

    const loadDocument = async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
        loadingTask = pdfjs.getDocument({
          url: contentUrl,
          standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL,
          withCredentials: true,
        })
        swallowPromiseRejection(loadingTask.promise)
        const pdf = await loadingTask.promise
        pdfDocument = pdf
        if (cancelled) return
        setPageCount(pdf.numPages)
        setPdfDoc(pdf)
      } catch {
        if (!cancelled) setRenderState("미리보기를 불러오지 못했습니다")
      }
    }

    void loadDocument()

    return () => {
      cancelled = true
      try {
        renderTaskRef.current?.cancel()
      } catch {
        undefined
      }
      ignorePdfPreviewTeardownRejection(loadingTask, pdfDocument, renderTaskRef.current)
      renderTaskRef.current = null
      releasePdfWorkerTerminationHandler(10000)
    }
  }, [contentUrl, file.id, file.mediaKind])

  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false
    let renderTask: RenderTask | null = null

    const renderPage = async () => {
      try {
        setRenderState("미리보기 준비")
        const page = await pdfDoc.getPage(currentPage)
        if (cancelled) return
        const viewport = page.getViewport({ scale: 1.1 })
        const canvas = canvasRef.current
        const context = canvas?.getContext("2d")
        if (!canvas || !context) return

        const outputScale = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = "100%"
        canvas.style.height = "auto"
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        })
        renderTaskRef.current = renderTask
        swallowPromiseRejection(renderTask.promise)
        await renderTask.promise
        if (!cancelled) setRenderState("미리보기 완료")
      } catch {
        if (!cancelled) setRenderState("미리보기를 불러오지 못했습니다")
      }
    }

    void renderPage()

    return () => {
      cancelled = true
      try {
        renderTask?.cancel()
      } catch {
        undefined
      }
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null
      }
    }
  }, [pdfDoc, currentPage])

  return (
    <PreviewStage>
      <PreviewHeader>
        <h3>문서 뷰어</h3>
      </PreviewHeader>
      <PdfCanvas ref={canvasRef} aria-label={`${file.originalFilename} PDF 미리보기`} />
      <InlineList aria-label="PDF 문서 제어">
        <span>{renderState}</span>
        <span>
          {currentPage} / {pageCount || 1}쪽
        </span>
        {pageCount > 1 ? (
          <>
            <GhostButton
              type="button"
              aria-label="이전 페이지"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              이전 페이지
            </GhostButton>
            <GhostButton
              type="button"
              aria-label="다음 페이지"
              disabled={currentPage >= pageCount}
              onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
            >
              다음 페이지
            </GhostButton>
          </>
        ) : null}
      </InlineList>
    </PreviewStage>
  )
}

type DocumentFallbackPreviewProps = {
  file: CloudFile
  contentUrl: string
}

const DocumentFallbackPreview = ({ file, contentUrl }: DocumentFallbackPreviewProps) => (
  <PreviewStage>
    <PreviewHeader>
      <h3>문서 파일</h3>
    </PreviewHeader>
    <DocumentFallbackBox>
      <strong>{getCloudKindBadge(file)} 파일</strong>
      <p>{file.originalFilename}</p>
      <a href={contentUrl} download={file.originalFilename}>
        다운로드
      </a>
    </DocumentFallbackBox>
  </PreviewStage>
)

type PhotoPreviewProps = {
  file: CloudFile
  contentUrl: string
}

const PhotoPreview = ({ file, contentUrl }: PhotoPreviewProps) => {
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    setImageState("loading")
  }, [contentUrl])

  return (
    <PreviewStage>
      <PreviewHeader>
        <h3>사진 보기</h3>
      </PreviewHeader>
      <PhotoFrame
        aria-label={`${file.originalFilename} 사진 미리보기`}
        aria-busy={imageState === "loading" ? "true" : "false"}
      >
        {imageState === "error" ? <PhotoFallback role="alert">이미지를 불러올 수 없습니다.</PhotoFallback> : null}
        <img
          src={contentUrl}
          alt={file.originalFilename}
          decoding="async"
          loading="eager"
          hidden={imageState === "error"}
          onLoad={() => setImageState("ready")}
          onError={() => setImageState("error")}
        />
      </PhotoFrame>
    </PreviewStage>
  )
}

type VideoPreviewProps = {
  file: CloudFile
  contentUrl: string
}

const copyCommandWithClipboardOrPrompt = async (
  command: string,
  playerLabel: string,
  isStaleRequest: () => boolean,
  onState: (state: ExternalPlaybackCommandState) => void
) => {
  const showManualCopyPrompt = () => {
    if (isStaleRequest() || typeof window === "undefined") return false
    window.prompt("명령을 복사하세요.", command)
    if (!isStaleRequest()) {
      onState({ status: "success", message: `${playerLabel} 명령을 표시했습니다. 6시간 동안 유효합니다.` })
    }
    return true
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      if (isStaleRequest()) return
      await navigator.clipboard.writeText(command)
      if (!isStaleRequest()) {
        onState({ status: "success", message: `${playerLabel} 명령을 복사했습니다. 6시간 동안 유효합니다.` })
      }
      return
    } catch (error) {
      if (showManualCopyPrompt()) return
      throw error
    }
  }

  if (!showManualCopyPrompt()) {
    throw new Error("clipboard를 사용할 수 없습니다.")
  }
}

const VideoPreview = ({ file, contentUrl }: VideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isMountedRef = useRef(false)
  const activeFileIdRef = useRef<number | null>(file.id)
  activeFileIdRef.current = file.id
  const [speed, setSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1)
  const [commandState, setCommandState] = useState<ExternalPlaybackCommandState | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.playbackRate = speed
  }, [speed, contentUrl])

  useEffect(() => {
    isMountedRef.current = true
    activeFileIdRef.current = file.id
    setCommandState(null)
    return () => {
      isMountedRef.current = false
      activeFileIdRef.current = null
    }
  }, [file.id])

  const copyExternalPlaybackCommand = async (player: ExternalPlaybackPlayer) => {
    const requestedFileId = file.id
    const playerLabel = EXTERNAL_PLAYBACK_PLAYER_LABELS[player]
    setCommandState({ status: "pending", message: `${playerLabel} 명령 발급 중` })
    const isStaleRequest = () => !isMountedRef.current || activeFileIdRef.current !== requestedFileId

    try {
      const token = await issueCloudExternalPlaybackToken(requestedFileId)
      if (isStaleRequest()) return
      const command = buildExternalPlaybackCommand(player, token.contentUrl)
      await copyCommandWithClipboardOrPrompt(command, playerLabel, isStaleRequest, setCommandState)
    } catch (error) {
      if (isStaleRequest()) return
      setCommandState({ status: "error", message: `${playerLabel} 명령 복사 실패: ${resolveCloudErrorMessage(error)}` })
    }
  }

  const isCommandPending = commandState?.status === "pending"

  return (
    <PreviewStage>
      <PreviewHeader>
        <h3>클라우드 동영상</h3>
      </PreviewHeader>
      <VideoFrame>
        <video ref={videoRef} src={contentUrl} controls preload="metadata" playsInline>
          <track kind="captions" />
        </video>
        <PlayerBar aria-label="클라우드 동영상 재생 제어">
          <FilterGroup aria-label="동영상 재생 속도">
            {PLAYBACK_SPEEDS.map((candidate) => (
              <GhostButton
                key={candidate}
                type="button"
                data-active={speed === candidate ? "true" : "false"}
                onClick={() => setSpeed(candidate)}
              >
                {candidate}x
              </GhostButton>
            ))}
          </FilterGroup>
          <ActionGroup aria-label="외부 플레이어 명령 복사">
            <SecondaryButton
              type="button"
              disabled={isCommandPending}
              onClick={() => void copyExternalPlaybackCommand("iina")}
            >
              IINA 명령 복사
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={isCommandPending}
              onClick={() => void copyExternalPlaybackCommand("mpv")}
            >
              mpv 명령 복사
            </SecondaryButton>
          </ActionGroup>
          {commandState ? (
            <InlineList role="status" aria-live="polite" data-tone={commandState.status}>
              <span>{commandState.message}</span>
            </InlineList>
          ) : null}
        </PlayerBar>
      </VideoFrame>
    </PreviewStage>
  )
}

type PreviewDrawerProps = {
  file: CloudFile | null
}

export const PreviewDrawer = ({ file }: PreviewDrawerProps) => {
  if (!file) {
    return (
      <EmptyState>
        <strong>파일 선택</strong>
      </EmptyState>
    )
  }

  const contentUrl = getCloudFileContentUrl(file.id)
  if (file.mediaKind === "DOCUMENT" && isPdfDocumentFile(file)) return <PdfPreview file={file} contentUrl={contentUrl} />
  if (file.mediaKind === "DOCUMENT") return <DocumentFallbackPreview file={file} contentUrl={contentUrl} />
  if (file.mediaKind === "PHOTO") return <PhotoPreview file={file} contentUrl={contentUrl} />
  return <VideoPreview file={file} contentUrl={contentUrl} />
}

type FileThumbnailProps = {
  file: CloudFile
  selected: boolean
}

export const FileThumbnail = ({ file, selected }: FileThumbnailProps) => {
  const kindMark = file.mediaKind === "PHOTO" ? "사진" : file.mediaKind === "VIDEO" ? "영상" : "문서"

  return (
    <FileThumbnailFrame
      aria-hidden="true"
      data-kind={file.mediaKind}
      data-selected={selected ? "true" : "false"}
    >
      {kindMark}
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

type CloudDeleteConfirmDialogProps = {
  files: CloudFile[]
  isDeletePending: boolean
  deleteDialogRef: RefObject<HTMLDivElement | null>
  deleteCancelButtonRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onConfirm: () => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
}

export const CloudDeleteConfirmDialog = ({
  files,
  isDeletePending,
  deleteDialogRef,
  deleteCancelButtonRef,
  onClose,
  onConfirm,
  onKeyDown,
}: CloudDeleteConfirmDialogProps) => (
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
        <PrimaryButton type="button" disabled={isDeletePending} onClick={onConfirm}>
          삭제
        </PrimaryButton>
      </div>
    </ConfirmDialog>
  </ConfirmBackdrop>
)
