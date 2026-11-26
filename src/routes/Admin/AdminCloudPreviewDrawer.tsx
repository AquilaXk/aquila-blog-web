/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetDetails/AssetPreview.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 */
/* eslint-disable @next/next/no-img-element */
import type { RenderTask } from "pdfjs-dist"
import { useEffect, useRef, useState } from "react"
import { getCloudFileContentUrl, type CloudFile } from "src/apis/backend/cloud"
import { useLanguage } from "src/libs/language"
import {
  AssetCodeSnippetFrame,
  AssetPreviewActionsOverlay,
  AssetPreviewAudio,
  AssetPreviewContainer,
  AssetPreviewIconFallback,
  AssetPreviewImage,
  AssetPreviewOverlayIconButton,
  AssetPreviewVideo,
} from "./AdminCloudMediaLightbox.styles"
import * as W from "./AdminCloudWorkspace.styles"
import {
  PLAYBACK_SPEEDS,
  appendCloudAssetVersionUrl,
  isImageCloudFile,
  isSvgCloudFile,
  type CloudAssetDimensions,
} from "./AdminCloudWorkspaceModel"
import {
  StrapiCornersOutIcon,
  StrapiFileCodeIcon,
  StrapiImageIcon,
  getStrapiAssetIcon,
} from "./adminStrapiIcons"
import {
  MAX_INLINE_TEXT_LINES,
  MAX_INLINE_TEXT_SNIPPET_BYTES,
  getCloudDocumentSubtype,
  readBoundedCloudSvgPreview,
  readBoundedCloudTextPreview,
  renderCloudPdfPageToCanvas,
  resolveCloudErrorMessage,
  useCloudPdfDocument,
  type BoundedSvgPreviewResult,
  type BoundedTextPreviewResult,
} from "./cloud/cloudPreviewHelpers"

export { resolveCloudErrorMessage }
export { CloudDeleteConfirmDialog, FileTableHead, FileThumbnail } from "./AdminCloudUploadQueue"

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
  const { language } = useLanguage()
  const isEn = language === "en"
  if (!isSvg && !onRequestExpand) return null
  return (
    <AssetPreviewActionsOverlay>
      {isSvg && onToggleSvgViewMode ? (
        <AssetPreviewOverlayIconButton
          type="button"
          aria-label={
            svgViewMode === "render"
              ? isEn
                ? "View SVG source"
                : "SVG 코드 보기"
              : isEn
                ? "View SVG render"
                : "SVG 렌더링 보기"
          }
          onClick={(e) => {
            e.stopPropagation()
            onToggleSvgViewMode()
          }}
        >
          {svgViewMode === "render" ? (
            <StrapiFileCodeIcon width={16} height={16} />
          ) : (
            <StrapiImageIcon width={16} height={16} />
          )}
        </AssetPreviewOverlayIconButton>
      ) : null}
      {onRequestExpand ? (
        <AssetPreviewOverlayIconButton
          type="button"
          aria-label={isEn ? "Fullscreen preview" : "전체화면 미리보기"}
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
  const { language } = useLanguage()
  const isEn = language === "en"
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { pdfDoc, pageCount, loadError, renderTaskRef } = useCloudPdfDocument(file, contentUrl, true)
  const [currentPage, setCurrentPage] = useState(1)
  const [renderStatus, setRenderStatus] = useState<"idle" | "done" | "error">("idle")

  useEffect(() => {
    setCurrentPage(1)
    setRenderStatus("idle")
  }, [contentUrl, file.id])

  useEffect(() => {
    if (loadError) setRenderStatus("error")
  }, [loadError])

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    let cancelled = false
    let activeTask: RenderTask | null = null
    setRenderStatus("idle")
    void renderCloudPdfPageToCanvas(
      pdfDoc,
      currentPage,
      1.1,
      canvasRef.current,
      renderTaskRef,
      () => cancelled
    )
      .then((t) => {
        activeTask = t
        if (!cancelled) setRenderStatus("done")
      })
      .catch(() => {
        if (!cancelled) setRenderStatus("error")
      })
    return () => {
      cancelled = true
      activeTask?.cancel()
      if (renderTaskRef.current === activeTask) renderTaskRef.current = null
    }
  }, [pdfDoc, currentPage, renderTaskRef])

  const renderStateText =
    renderStatus === "done"
      ? isEn
        ? "Preview ready"
        : "미리보기 완료"
      : renderStatus === "error"
        ? isEn
          ? "Preview unavailable"
          : "미리보기를 불러오지 못했습니다"
        : null

  return (
    <>
      <AssetPreviewContainer data-surface="muted">
        <W.PdfCanvas
          ref={canvasRef}
          aria-label={isEn ? `${file.originalFilename} PDF preview` : `${file.originalFilename} PDF 미리보기`}
        />
        <PreviewActionsOverlay onRequestExpand={onRequestExpand} />
      </AssetPreviewContainer>
      <W.PreviewInlineStatusList aria-label={isEn ? "PDF document controls" : "PDF 문서 제어"}>
        {renderStateText ? <span>{renderStateText}</span> : null}
        <span>{isEn ? `${currentPage} / ${pageCount || 1}` : `${currentPage} / ${pageCount || 1}쪽`}</span>
        {pageCount > 1 ? (
          <>
            <W.GhostButton
              type="button"
              aria-label={isEn ? "Prev page" : "이전 페이지"}
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              {isEn ? "Prev page" : "이전 페이지"}
            </W.GhostButton>
            <W.GhostButton
              type="button"
              aria-label={isEn ? "Next page" : "다음 페이지"}
              disabled={currentPage >= pageCount}
              onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
            >
              {isEn ? "Next page" : "다음 페이지"}
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
  const { language } = useLanguage()
  const isEn = language === "en"
  const [snippet, setSnippet] = useState<BoundedTextPreviewResult | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setSnippet(null)
    void readBoundedCloudTextPreview(
      contentUrl,
      file.byteSize,
      MAX_INLINE_TEXT_SNIPPET_BYTES,
      controller.signal,
      MAX_INLINE_TEXT_LINES,
      language
    )
      .then((res) => {
        if (!controller.signal.aborted) setSnippet(res)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSnippet({
            status: "error",
            message: isEn ? "Failed to load text preview." : "텍스트 미리보기를 불러오지 못했습니다.",
          })
        }
      })
    return () => controller.abort()
  }, [contentUrl, file.byteSize, file.id, isEn, language])

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
              <div className="truncatedNote">
                {isEn
                  ? "Showing preview · open fullscreen for up to 256KB"
                  : "앞부분만 미리 표시 중 · 전체화면에서 최대 256KB 확인"}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="status">
            {snippet?.status === "error"
              ? snippet.message
              : snippet?.status === "binary"
                ? isEn
                  ? "Download this file to view its contents."
                  : "이 파일은 다운로드 후 확인할 수 있습니다."
                : isEn
                  ? "Loading preview..."
                  : "내용을 불러오는 중..."}
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
  const { language } = useLanguage()
  const isEn = language === "en"
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
    void readBoundedCloudSvgPreview(versionedUrl, file.byteSize, controller.signal, language)
      .then((res) => {
        if (controller.signal.aborted) return
        setSvgResult(res)
        if (res.status === "ready" && res.dimensions) onDimensionsChange?.(res.dimensions)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSvgResult({
            status: "error",
            message: isEn ? "Failed to load SVG source." : "SVG 원문을 불러오지 못했습니다.",
          })
        }
      })
    return () => controller.abort()
  }, [file.byteSize, file.id, isEn, isSvg, language, onDimensionsChange, versionedUrl])

  return (
    <AssetPreviewContainer
      aria-label={isEn ? `${file.originalFilename} photo preview` : `${file.originalFilename} 사진 미리보기`}
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
                  ? isEn
                    ? "File cannot be previewed."
                    : "미리보기할 수 없는 파일입니다."
                  : isEn
                    ? "Loading SVG source..."
                    : "SVG 원문을 불러오는 중..."}
            </div>
          )}
        </AssetCodeSnippetFrame>
      ) : (
        <>
          {imageState === "error" ? (
            <W.PhotoFallback role="alert">
              {isEn ? "Failed to load image." : "이미지를 불러올 수 없습니다."}
            </W.PhotoFallback>
          ) : null}
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
  const { language } = useLanguage()
  const isEn = language === "en"
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = videoPlaybackSpeed
  }, [file?.id, videoPlaybackSpeed])

  if (!file) {
    return (
      <W.EmptyState>
        <strong>{isEn ? "Select a file" : "파일 선택"}</strong>
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
          <AssetPreviewVideo
            ref={videoRef}
            src={contentUrl}
            controls
            preload="metadata"
            playsInline
            title={file.originalFilename}
          >
            <track kind="captions" />
          </AssetPreviewVideo>
          <PreviewActionsOverlay onRequestExpand={handleExpand} />
        </AssetPreviewContainer>
      ) : docSubtype === "pdf" ? (
        <PdfPreview file={file} contentUrl={contentUrl} onRequestExpand={handleExpand} />
      ) : docSubtype === "audio" ? (
        <AssetPreviewContainer data-surface="muted">
          <AssetPreviewAudio
            src={contentUrl}
            controls
            preload="metadata"
            aria-label={isEn ? `${file.originalFilename} audio preview` : `${file.originalFilename} 오디오 재생`}
          />
          <PreviewActionsOverlay onRequestExpand={handleExpand} />
        </AssetPreviewContainer>
      ) : docSubtype === "code" ? (
        <InlineTextPreview file={file} contentUrl={contentUrl} onRequestExpand={handleExpand} />
      ) : (
        <AssetPreviewContainer data-surface="muted">
          <AssetPreviewIconFallback>
            <DocIcon width={24} height={24} />
            <span>
              {isEn
                ? "Inline preview not available for this format"
                : "미리보기를 지원하지 않는 형식입니다"}
            </span>
          </AssetPreviewIconFallback>
          <PreviewActionsOverlay onRequestExpand={handleExpand} />
        </AssetPreviewContainer>
      )}
    </W.PreviewStage>
  )
}
