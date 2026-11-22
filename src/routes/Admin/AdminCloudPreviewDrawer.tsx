/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetDetails/AssetPreview.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 */
/* eslint-disable @next/next/no-img-element */
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import { type MutableRefObject, useEffect, useRef, useState } from "react"
import { getCloudFileContentUrl, getCloudFileDownloadUrl, type CloudFile } from "src/apis/backend/cloud"
import {
  MAX_INLINE_TEXT_SNIPPET_BYTES,
  getCloudDocumentSubtype,
  readBoundedCloudTextPreview,
  readStreamBytesWithGuard,
  splitBoundedLines,
  type BoundedTextPreviewResult,
} from "./AdminCloudMediaLightbox"
import {
  AssetCodeSnippetFrame,
  AssetPreviewActionsOverlay,
  AssetPreviewAudio,
  AssetPreviewContainer,
  AssetPreviewIconFallback,
  AssetPreviewImage,
  AssetPreviewOverlayIconButton,
  AssetPreviewVideo,
  YarlBottomBar,
  YarlDarkPill,
  YarlFallbackDownloadLink,
  YarlMediaCard,
  YarlPageReadout,
  YarlPdfSheet,
} from "./AdminCloudMediaLightbox.styles"
import * as W from "./AdminCloudWorkspace.styles"
import {
  MAX_SVG_MARKUP_BYTES,
  PLAYBACK_SPEEDS,
  appendCloudAssetVersionUrl,
  isImageCloudFile,
  isSvgCloudFile,
  parseSvgDimensionsFromMarkup,
  type CloudAssetDimensions,
} from "./AdminCloudWorkspaceModel"
import {
  StrapiCornersOutIcon,
  StrapiFileCodeIcon,
  StrapiImageIcon,
  YarlErrorIcon,
  getStrapiAssetIcon,
} from "./adminStrapiIcons"

const MAX_SVG_PREVIEW_LINES = 1500
const MAX_INLINE_TEXT_LINES = 36
const PDF_STANDARD_FONT_DATA_URL = "/pdfjs/standard_fonts/"

export type BoundedSvgPreviewResult =
  | { status: "ready"; svgText: string; lines: string[]; dimensions: CloudAssetDimensions | null }
  | { status: "binary" }
  | { status: "too_large"; message: string }
  | { status: "error"; message: string }

export const readBoundedCloudSvgPreview = async (
  url: string,
  declaredByteSize: number,
  signal?: AbortSignal
): Promise<BoundedSvgPreviewResult> => {
  const svgLimitMsg = "SVG 원문 미리보기 상한(256KB)을 초과했습니다."
  if (Number.isFinite(declaredByteSize) && declaredByteSize > MAX_SVG_MARKUP_BYTES) {
    return { status: "too_large", message: svgLimitMsg }
  }
  const response = await fetch(url, { credentials: "include", signal })
  if (!response.ok) {
    return { status: "error", message: `SVG 원문을 불러오지 못했습니다. (HTTP ${response.status})` }
  }
  const contentLength = Number(response.headers.get("content-length") || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_SVG_MARKUP_BYTES) {
    await response.body?.cancel().catch(() => undefined)
    return { status: "too_large", message: svgLimitMsg }
  }

  const streamRes = await readStreamBytesWithGuard(response, MAX_SVG_MARKUP_BYTES, "reject", true)
  if (streamRes.kind === "binary") return { status: "binary" }
  if (streamRes.kind === "too_large") return { status: "too_large", message: svgLimitMsg }

  const svgText = new TextDecoder("utf-8", { fatal: false }).decode(streamRes.bytes)
  if (svgText.length > MAX_SVG_MARKUP_BYTES || svgText.indexOf("\0") !== -1) {
    return { status: "too_large", message: svgLimitMsg }
  }
  const dimensions = parseSvgDimensionsFromMarkup(svgText)
  const { lines } = splitBoundedLines(svgText, MAX_SVG_PREVIEW_LINES)
  return { status: "ready", svgText, lines, dimensions }
}

const installPdfWorkerTerminationGuard = () => {
  const isTerminated = (err: unknown) =>
    (err instanceof Error && err.message.includes("Worker was terminated")) ||
    (typeof err === "string" && err.includes("Worker was terminated"))
  const onRej = (e: PromiseRejectionEvent) => { if (isTerminated(e.reason)) e.preventDefault() }
  const onErr = (e: ErrorEvent) => { if (isTerminated(e.error) || isTerminated(e.message)) e.preventDefault() }
  window.addEventListener("unhandledrejection", onRej)
  window.addEventListener("error", onErr)
  return (delayMs = 0) => {
    window.setTimeout(() => {
      window.removeEventListener("unhandledrejection", onRej)
      window.removeEventListener("error", onErr)
    }, delayMs)
  }
}

export const useCloudPdfDocument = (file: CloudFile | null, contentUrl: string, enabled: boolean) => {
  const renderTaskRef = useRef<RenderTask | null>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!enabled || !file) return
    let cancelled = false
    let loadingTask: PDFDocumentLoadingTask | null = null
    let pdfDocument: PDFDocumentProxy | null = null
    setPageCount(0)
    setPdfDoc(null)
    setLoadError(false)
    const releaseGuard = installPdfWorkerTerminationGuard()
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
        loadingTask = pdfjs.getDocument({ url: contentUrl, standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL, withCredentials: true })
        void loadingTask.promise.catch(() => undefined)
        const pdf = await loadingTask.promise
        pdfDocument = pdf
        if (!cancelled) {
          setPageCount(pdf.numPages)
          setPdfDoc(pdf)
        }
      } catch {
        if (!cancelled) setLoadError(true)
      }
    })()
    return () => {
      cancelled = true
      const activeRender = renderTaskRef.current
      activeRender?.cancel()
      renderTaskRef.current = null
      const settled = activeRender?.promise.catch(() => undefined) ?? Promise.resolve()
      void loadingTask?.promise.catch(() => undefined)
      if (pdfDocument) {
        void settled.then(async () => {
          await pdfDocument?.cleanup().catch(() => undefined)
          void loadingTask?.destroy().catch(() => undefined)
        })
      } else if (loadingTask) {
        void settled.finally(() => void loadingTask?.destroy().catch(() => undefined))
      }
      releaseGuard(10000)
    }
  }, [contentUrl, enabled, file])

  return { pdfDoc, pageCount, loadError, renderTaskRef }
}

export const renderCloudPdfPageToCanvas = async (
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  canvas: HTMLCanvasElement,
  renderTaskRef: MutableRefObject<RenderTask | null>,
  isCancelled: () => boolean
): Promise<RenderTask | null> => {
  const safePage = Math.min(Math.max(1, pageNumber), pdfDoc.numPages)
  const page = await pdfDoc.getPage(safePage)
  if (isCancelled()) return null
  const context = canvas.getContext("2d")
  if (!context) return null
  const viewport = page.getViewport({ scale })
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  canvas.style.width = "100%"
  canvas.style.height = "auto"
  const task = page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  })
  renderTaskRef.current = task
  void task.promise.catch(() => undefined)
  await task.promise
  return task
}

export const resolveCloudErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return "요청 처리 중 오류가 발생했습니다."
}

export const LightboxPdfStage = ({
  file,
  contentUrl,
  pdfZoom,
  currentPage,
  onChangePage,
}: {
  file: CloudFile
  contentUrl: string
  pdfZoom: number
  currentPage: number
  onChangePage: (next: number) => void
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { pdfDoc, pageCount, loadError, renderTaskRef } = useCloudPdfDocument(file, contentUrl, true)
  const [renderFailed, setRenderFailed] = useState(false)

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    let cancelled = false
    let activeTask: RenderTask | null = null
    setRenderFailed(false)
    void renderCloudPdfPageToCanvas(pdfDoc, currentPage, 1.5 * pdfZoom, canvasRef.current, renderTaskRef, () => cancelled)
      .then((t) => { activeTask = t })
      .catch(() => { if (!cancelled) setRenderFailed(true) })
    return () => {
      cancelled = true
      activeTask?.cancel()
      if (renderTaskRef.current === activeTask) renderTaskRef.current = null
    }
  }, [currentPage, pdfDoc, pdfZoom, renderTaskRef])

  if (loadError || renderFailed) {
    return (
      <YarlMediaCard role="alert" onClick={(e) => e.stopPropagation()}>
        <YarlErrorIcon width={40} height={40} />
        <strong>PDF 문서를 렌더링하지 못했습니다</strong>
        <span>{file.originalFilename}</span>
        <YarlFallbackDownloadLink href={getCloudFileDownloadUrl(file.id)} download={file.originalFilename}>
          원본 파일 다운로드
        </YarlFallbackDownloadLink>
      </YarlMediaCard>
    )
  }
  return (
    <YarlPdfSheet $widthRem={57.5 * pdfZoom} onClick={(e) => e.stopPropagation()}>
      <canvas ref={canvasRef} aria-label={`${file.originalFilename} PDF 문서 미리보기`} />
      <YarlBottomBar role="group" aria-label="PDF 페이지 이동">
        <YarlDarkPill type="button" disabled={currentPage <= 1} onClick={() => onChangePage(Math.max(1, currentPage - 1))}>
          이전 페이지
        </YarlDarkPill>
        <YarlPageReadout>{currentPage} / {pageCount || 1}쪽</YarlPageReadout>
        <YarlDarkPill type="button" disabled={pageCount <= 1 || currentPage >= pageCount} onClick={() => onChangePage(Math.min(pageCount || 1, currentPage + 1))}>
          다음 페이지
        </YarlDarkPill>
      </YarlBottomBar>
    </YarlPdfSheet>
  )
}

const PreviewActionsOverlay = ({
  isSvg = false,
  svgViewMode = "render",
  onToggleSvgViewMode,
  onRequestExpand,
}: {
  isSvg?: boolean
  svgViewMode?: "render" | "code"
  onToggleSvgViewMode?: () => void
  onRequestExpand?: () => void
}) => {
  if (!isSvg && !onRequestExpand) return null
  return (
    <AssetPreviewActionsOverlay>
      {isSvg && onToggleSvgViewMode ? (
        <AssetPreviewOverlayIconButton
          type="button"
          aria-label={svgViewMode === "render" ? "SVG 코드 보기" : "SVG 렌더링 보기"}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSvgViewMode()
          }}
        >
          {svgViewMode === "render" ? <StrapiFileCodeIcon width={16} height={16} /> : <StrapiImageIcon width={16} height={16} />}
        </AssetPreviewOverlayIconButton>
      ) : null}
      {onRequestExpand ? (
        <AssetPreviewOverlayIconButton
          type="button"
          aria-label="전체화면 미리보기"
          onClick={(e) => {
            e.stopPropagation()
            onRequestExpand()
          }}
        >
          <StrapiCornersOutIcon width={16} height={16} />
        </AssetPreviewOverlayIconButton>
      ) : null}
    </AssetPreviewActionsOverlay>
  )
}

const PdfPreview = ({
  file,
  contentUrl,
  onRequestExpand,
}: {
  file: CloudFile
  contentUrl: string
  onRequestExpand?: () => void
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { pdfDoc, pageCount, loadError, renderTaskRef } = useCloudPdfDocument(file, contentUrl, true)
  const [currentPage, setCurrentPage] = useState(1)
  const [renderState, setRenderState] = useState<string | null>(null)

  useEffect(() => {
    setCurrentPage(1)
    setRenderState(null)
  }, [contentUrl, file.id])

  useEffect(() => {
    if (loadError) setRenderState("미리보기를 불러오지 못했습니다")
  }, [loadError])

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    let cancelled = false
    let activeTask: RenderTask | null = null
    setRenderState(null)
    void renderCloudPdfPageToCanvas(pdfDoc, currentPage, 1.1, canvasRef.current, renderTaskRef, () => cancelled)
      .then((t) => {
        activeTask = t
        if (!cancelled) setRenderState("미리보기 완료")
      })
      .catch(() => {
        if (!cancelled) setRenderState("미리보기를 불러오지 못했습니다")
      })
    return () => {
      cancelled = true
      activeTask?.cancel()
      if (renderTaskRef.current === activeTask) renderTaskRef.current = null
    }
  }, [pdfDoc, currentPage, renderTaskRef])

  return (
    <>
      <AssetPreviewContainer data-surface="muted">
        <W.PdfCanvas ref={canvasRef} aria-label={`${file.originalFilename} PDF 미리보기`} />
        <PreviewActionsOverlay onRequestExpand={onRequestExpand} />
      </AssetPreviewContainer>
      <W.PreviewInlineStatusList aria-label="PDF 문서 제어">
        {renderState ? <span>{renderState}</span> : null}
        <span>{currentPage} / {pageCount || 1}쪽</span>
        {pageCount > 1 ? (
          <>
            <W.GhostButton type="button" aria-label="이전 페이지" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
              이전 페이지
            </W.GhostButton>
            <W.GhostButton type="button" aria-label="다음 페이지" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}>
              다음 페이지
            </W.GhostButton>
          </>
        ) : null}
      </W.PreviewInlineStatusList>
    </>
  )
}

const InlineTextPreview = ({
  file,
  contentUrl,
  onRequestExpand,
}: {
  file: CloudFile
  contentUrl: string
  onRequestExpand?: () => void
}) => {
  const [snippet, setSnippet] = useState<BoundedTextPreviewResult | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setSnippet(null)
    void readBoundedCloudTextPreview(contentUrl, file.byteSize, MAX_INLINE_TEXT_SNIPPET_BYTES, controller.signal, MAX_INLINE_TEXT_LINES)
      .then((res) => { if (!controller.signal.aborted) setSnippet(res) })
      .catch(() => { if (!controller.signal.aborted) setSnippet({ status: "error", message: "텍스트 미리보기를 불러오지 못했습니다." }) })
    return () => controller.abort()
  }, [contentUrl, file.byteSize, file.id])

  return (
    <AssetPreviewContainer data-flush="true">
      <PreviewActionsOverlay onRequestExpand={onRequestExpand} />
      <AssetCodeSnippetFrame>
        {snippet?.status === "ready" ? (
          <div className="body">
            {snippet.lines.map((line, index) => (
              <div key={index} className="line">
                <span className="ln">{index + 1}</span>
                <code>{line || " "}</code>
              </div>
            ))}
            {snippet.truncated ? (
              <div className="truncatedNote">상위 스니펫만 표시 중 · 전체화면으로 최대 256KB 확인</div>
            ) : null}
          </div>
        ) : (
          <div className="status">
            {snippet?.status === "error"
              ? snippet.message
              : snippet?.status === "binary"
                ? "바이너리 파일은 다운로드 후 확인할 수 있습니다."
                : "코드 스니펫 불러오는 중..."}
          </div>
        )}
      </AssetCodeSnippetFrame>
    </AssetPreviewContainer>
  )
}

const ImageOrSvgPreview = ({
  file,
  contentUrl,
  onRequestExpand,
  onDimensionsChange,
}: {
  file: CloudFile
  contentUrl: string
  onRequestExpand?: () => void
  onDimensionsChange?: (dims: CloudAssetDimensions | null) => void
}) => {
  const isSvg = isSvgCloudFile(file)
  const versionedUrl = appendCloudAssetVersionUrl(contentUrl, file.modifiedAt || file.createdAt)
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading")
  const [svgViewMode, setSvgViewMode] = useState<"render" | "code">("render")
  const [svgResult, setSvgResult] = useState<BoundedSvgPreviewResult | null>(null)

  useEffect(() => {
    setImageState("loading")
    setSvgViewMode("render")
    setSvgResult(null)
  }, [file.id, versionedUrl])

  useEffect(() => {
    if (!isSvg) return
    const controller = new AbortController()
    void readBoundedCloudSvgPreview(versionedUrl, file.byteSize, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        setSvgResult(res)
        if (res.status === "ready" && res.dimensions) onDimensionsChange?.(res.dimensions)
      })
      .catch(() => {
        if (!controller.signal.aborted) setSvgResult({ status: "error", message: "SVG 원문을 불러오지 못했습니다." })
      })
    return () => controller.abort()
  }, [file.byteSize, file.id, isSvg, onDimensionsChange, versionedUrl])

  return (
    <AssetPreviewContainer
      aria-label={`${file.originalFilename} 사진 미리보기`}
      aria-busy={imageState === "loading" && svgViewMode === "render" ? "true" : "false"}
      data-svg={isSvg && svgViewMode === "render" ? "true" : undefined}
      data-flush={isSvg && svgViewMode === "code" ? "true" : undefined}
    >
      <PreviewActionsOverlay
        isSvg={isSvg}
        svgViewMode={svgViewMode}
        onToggleSvgViewMode={() => setSvgViewMode((m) => (m === "render" ? "code" : "render"))}
        onRequestExpand={onRequestExpand}
      />
      {isSvg && svgViewMode === "code" ? (
        <AssetCodeSnippetFrame>
          {svgResult?.status === "ready" ? (
            <div className="body">
              {svgResult.lines.map((line, idx) => (
                <div key={idx} className="line">
                  <span className="ln">{idx + 1}</span>
                  <code>{line || " "}</code>
                </div>
              ))}
            </div>
          ) : (
            <div className="status">
              {svgResult?.status === "too_large" || svgResult?.status === "error"
                ? svgResult.message
                : svgResult?.status === "binary"
                  ? "이진 데이터가 포함된 파일입니다."
                  : "SVG 원문을 불러오는 중..."}
            </div>
          )}
        </AssetCodeSnippetFrame>
      ) : (
        <>
          {imageState === "error" ? <W.PhotoFallback role="alert">이미지를 불러올 수 없습니다.</W.PhotoFallback> : null}
          <AssetPreviewImage
            src={versionedUrl}
            alt={file.originalFilename}
            decoding="async"
            loading="eager"
            hidden={imageState === "error"}
            onLoad={(e) => {
              setImageState("ready")
              if (!isSvg) {
                const { naturalWidth, naturalHeight } = e.currentTarget
                if (naturalWidth > 0 && naturalHeight > 0) {
                  onDimensionsChange?.({ width: naturalWidth, height: naturalHeight })
                }
              }
            }}
            onError={() => setImageState("error")}
          />
        </>
      )}
    </AssetPreviewContainer>
  )
}

export const PreviewDrawer = ({
  file,
  onRequestExpandPhoto,
  onRequestExpand,
  onDimensionsChange,
  videoPlaybackSpeed = 1,
}: {
  file: CloudFile | null
  hideHeader?: boolean
  onRequestExpandPhoto?: () => void
  onRequestExpand?: () => void
  onDimensionsChange?: (dims: CloudAssetDimensions | null) => void
  videoPlaybackSpeed?: (typeof PLAYBACK_SPEEDS)[number]
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = videoPlaybackSpeed
  }, [file?.id, videoPlaybackSpeed])

  if (!file) {
    return (
      <W.EmptyState>
        <strong>파일 선택</strong>
      </W.EmptyState>
    )
  }

  const contentUrl = getCloudFileContentUrl(file.id)
  const handleExpand = onRequestExpand ?? onRequestExpandPhoto
  const isImage = isImageCloudFile(file)
  const docSubtype = !isImage && file.mediaKind !== "VIDEO" ? getCloudDocumentSubtype(file) : "document"
  const DocIcon = getStrapiAssetIcon(file.contentType, file.originalFilename)

  return (
    <W.PreviewStage>
      {isImage ? (
        <ImageOrSvgPreview
          file={file}
          contentUrl={contentUrl}
          onRequestExpand={handleExpand}
          onDimensionsChange={onDimensionsChange}
        />
      ) : file.mediaKind === "VIDEO" ? (
        <AssetPreviewContainer data-surface="muted">
          <AssetPreviewVideo ref={videoRef} src={contentUrl} controls preload="metadata" playsInline title={file.originalFilename}>
            <track kind="captions" />
          </AssetPreviewVideo>
          <PreviewActionsOverlay onRequestExpand={handleExpand} />
        </AssetPreviewContainer>
      ) : docSubtype === "pdf" ? (
        <PdfPreview file={file} contentUrl={contentUrl} onRequestExpand={handleExpand} />
      ) : docSubtype === "audio" ? (
        <AssetPreviewContainer data-surface="muted">
          <AssetPreviewAudio src={contentUrl} controls preload="metadata" aria-label={`${file.originalFilename} 오디오 재생`} />
          <PreviewActionsOverlay onRequestExpand={handleExpand} />
        </AssetPreviewContainer>
      ) : docSubtype === "code" ? (
        <InlineTextPreview file={file} contentUrl={contentUrl} onRequestExpand={handleExpand} />
      ) : (
        <AssetPreviewContainer data-surface="muted">
          <AssetPreviewIconFallback>
            <DocIcon width={24} height={24} />
            <span>미리보기를 지원하지 않는 형식입니다</span>
          </AssetPreviewIconFallback>
          <PreviewActionsOverlay onRequestExpand={handleExpand} />
        </AssetPreviewContainer>
      )}
    </W.PreviewStage>
  )
}

export { CloudDeleteConfirmDialog, FileTableHead, FileThumbnail } from "./AdminCloudUploadQueue"
