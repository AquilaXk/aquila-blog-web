/**
 * 참조 구현:
 * - igordanchenko/yet-another-react-lightbox src/styles.scss · src/plugins/counter/counter.scss ·
 *   src/components/Icons.tsx · src/modules/Toolbar.tsx · src/modules/Navigation.tsx ·
 *   src/plugins/zoom/ZoomButton.tsx · src/plugins/download/DownloadButton.tsx ·
 *   src/plugins/fullscreen/FullscreenButton.tsx (MIT License, Copyright (c) 2022 Igor Danchenko)
 */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getCloudFileContentUrl, getCloudFileDownloadUrl, type CloudFile } from "src/apis/backend/cloud"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import * as S from "./AdminCloudMediaLightbox.styles"
import {
  LightboxPdfStage,
  readBoundedCloudSvgPreview,
  type BoundedSvgPreviewResult,
} from "./AdminCloudPreviewDrawer"
import {
  PLAYBACK_SPEEDS,
  appendCloudAssetVersionUrl,
  formatCloudFileSize,
  getCloudKindBadge,
  isImageCloudFile,
  isSvgCloudFile,
  type CloudAssetDimensions,
} from "./AdminCloudWorkspaceModel"
import {
  StrapiFileCodeIcon,
  StrapiGridFourIcon,
  StrapiHeadphonesIcon,
  StrapiImageIcon,
  YarlCloseIcon,
  YarlDownloadIcon,
  YarlEnterFullscreenIcon,
  YarlErrorIcon,
  YarlExitFullscreenIcon,
  YarlNextIcon,
  YarlPreviousIcon,
  YarlZoomInIcon,
  YarlZoomOutIcon,
  getStrapiAssetIcon,
} from "./adminStrapiIcons"

export const MAX_TEXT_PREVIEW_BYTES = 256 * 1024
export const MAX_INLINE_TEXT_SNIPPET_BYTES = 16 * 1024
const MAX_TEXT_PREVIEW_LINES = 2500
const IMAGE_ZOOM_MIN = 0.5
const IMAGE_ZOOM_MAX = 3
const IMAGE_ZOOM_STEP = 0.5
const PDF_ZOOM_MIN = 0.5
const PDF_ZOOM_MAX = 2.5
const PDF_ZOOM_STEP = 0.25

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "flac", "aac", "opus", "weba"])
const TEXT_EXTENSIONS = new Set([
  "md", "markdown", "mdx", "json", "jsonl", "txt", "csv", "tsv", "yml", "yaml", "xml", "log", "ini",
  "toml", "conf", "sql", "sh", "bash", "zsh", "py", "ts", "tsx", "js", "jsx", "mjs", "cjs", "kt",
  "java", "go", "rs", "c", "cpp", "h", "css", "scss", "html",
])
const ARCHIVE_EXTENSIONS = new Set(["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "zst"])
const TEXT_MIMES = new Set([
  "application/json", "application/ld+json", "application/xml", "application/yaml",
  "application/x-yaml", "application/javascript", "application/typescript", "application/sql",
])

export type CloudDocumentSubtype = "pdf" | "audio" | "code" | "archive" | "document"

const extractLowerExt = (filename: string): string => {
  const dotIdx = filename.lastIndexOf(".")
  return dotIdx < 0 || dotIdx === filename.length - 1 ? "" : filename.slice(dotIdx + 1).trim().toLowerCase()
}

export const isPdfCloudFile = (file: CloudFile): boolean =>
  file.contentType.toLowerCase() === "application/pdf" || extractLowerExt(file.originalFilename) === "pdf"

export const isAudioCloudFile = (file: CloudFile): boolean =>
  file.contentType.toLowerCase().startsWith("audio/") || AUDIO_EXTENSIONS.has(extractLowerExt(file.originalFilename))

export const isTextPreviewableCloudFile = (file: CloudFile): boolean => {
  if (isImageCloudFile(file) || file.mediaKind === "VIDEO" || isPdfCloudFile(file) || isAudioCloudFile(file)) {
    return false
  }
  const mime = file.contentType.toLowerCase()
  return mime.startsWith("text/") || TEXT_MIMES.has(mime) || TEXT_EXTENSIONS.has(extractLowerExt(file.originalFilename))
}

export const getCloudDocumentSubtype = (file: CloudFile): CloudDocumentSubtype => {
  if (isPdfCloudFile(file)) return "pdf"
  if (isAudioCloudFile(file)) return "audio"
  if (isTextPreviewableCloudFile(file)) return "code"
  const ext = extractLowerExt(file.originalFilename)
  const mime = file.contentType.toLowerCase()
  return ARCHIVE_EXTENSIONS.has(ext) || mime.includes("zip") || mime.includes("compressed") || mime.includes("tar")
    ? "archive"
    : "document"
}

export type BoundedTextPreviewResult =
  | { status: "ready"; lines: string[]; bytesRead: number; truncated: boolean }
  | { status: "binary" }
  | { status: "error"; message: string }

const hasNullByteInSlice = (bytes: Uint8Array, limit = bytes.byteLength): boolean => {
  const end = bytes.byteLength < limit ? bytes.byteLength : limit
  for (let i = 0; i < end; i += 1) {
    if (bytes[i] === 0) return true
  }
  return false
}

const trimIncompleteUtf8Tail = (bytes: Uint8Array): Uint8Array => {
  let idx = bytes.byteLength - 1
  let cont = 0
  while (idx >= 0 && cont < 3 && (bytes[idx] & 0xc0) === 0x80) {
    cont += 1
    idx -= 1
  }
  if (idx < 0 || bytes[idx] < 0x80) return bytes
  const lead = bytes[idx]
  const need = (lead & 0xe0) === 0xc0 ? 2 : (lead & 0xf0) === 0xe0 ? 3 : (lead & 0xf8) === 0xf0 ? 4 : 1
  return cont + 1 < need ? bytes.subarray(0, idx) : bytes
}

export const splitBoundedLines = (text: string, maxLines: number): { lines: string[]; lineTruncated: boolean } => {
  const lines: string[] = []
  let cursor = 0
  while (cursor <= text.length && lines.length < maxLines) {
    const nl = text.indexOf("\n", cursor)
    if (nl === -1) {
      const tail = text.slice(cursor)
      lines.push(tail.endsWith("\r") ? tail.slice(0, -1) : tail)
      return { lines, lineTruncated: false }
    }
    const raw = text.slice(cursor, nl)
    lines.push(raw.endsWith("\r") ? raw.slice(0, -1) : raw)
    cursor = nl + 1
  }
  return { lines, lineTruncated: cursor <= text.length }
}

export type StreamReadOutcome =
  | { kind: "ok"; bytes: Uint8Array; overflowed: boolean }
  | { kind: "binary" }
  | { kind: "too_large" }

export const readStreamBytesWithGuard = async (
  response: Response,
  maxBytes: number,
  mode: "truncate" | "reject",
  fullNullScan: boolean
): Promise<StreamReadOutcome> => {
  const reader = response.body?.getReader()
  if (!reader) {
    const rawBuf = new Uint8Array(await response.arrayBuffer())
    if (hasNullByteInSlice(rawBuf, fullNullScan ? rawBuf.byteLength : 512)) return { kind: "binary" }
    if (rawBuf.byteLength > maxBytes) {
      return mode === "reject"
        ? { kind: "too_large" }
        : { kind: "ok", bytes: rawBuf.subarray(0, maxBytes), overflowed: true }
    }
    return { kind: "ok", bytes: rawBuf, overflowed: false }
  }

  const chunks: Uint8Array[] = []
  let receivedBytes = 0
  let sampled = false
  let overflowed = false
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      if (fullNullScan || !sampled) {
        sampled = true
        if (hasNullByteInSlice(value, fullNullScan ? value.byteLength : 512)) {
          await reader.cancel().catch(() => undefined)
          return { kind: "binary" }
        }
      }
      if (receivedBytes + value.byteLength > maxBytes) {
        if (mode === "reject") {
          await reader.cancel().catch(() => undefined)
          return { kind: "too_large" }
        }
        const remain = maxBytes - receivedBytes
        if (remain > 0) chunks.push(value.subarray(0, remain))
        receivedBytes = maxBytes
        overflowed = true
        await reader.cancel().catch(() => undefined)
        break
      }
      chunks.push(value)
      receivedBytes += value.byteLength
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { kind: "ok", bytes: merged, overflowed }
}

export const readBoundedCloudTextPreview = async (
  url: string,
  declaredByteSize: number,
  maxBytes = MAX_TEXT_PREVIEW_BYTES,
  signal?: AbortSignal,
  maxLines = MAX_TEXT_PREVIEW_LINES
): Promise<BoundedTextPreviewResult> => {
  const response = await fetch(url, { credentials: "include", signal })
  if (!response.ok) return { status: "error", message: `미리보기를 불러오지 못했습니다. (HTTP ${response.status})` }

  const streamRes = await readStreamBytesWithGuard(response, maxBytes, "truncate", false)
  if (streamRes.kind === "binary") return { status: "binary" }
  if (streamRes.kind === "too_large") return { status: "error", message: "파일 크기 상한을 초과했습니다." }

  const truncated = streamRes.overflowed || (Number.isFinite(declaredByteSize) && declaredByteSize > maxBytes)
  const safeBytes = truncated ? trimIncompleteUtf8Tail(streamRes.bytes) : streamRes.bytes
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(safeBytes)
  const { lines, lineTruncated } = splitBoundedLines(decoded, maxLines)
  return { status: "ready", lines, bytesRead: safeBytes.byteLength, truncated: truncated || lineTruncated }
}

export { readBoundedCloudSvgPreview, type BoundedSvgPreviewResult }

const resolveSvgPendingLabel = (res: BoundedSvgPreviewResult | null): string => {
  if (!res) return "SVG 원문을 불러오는 중..."
  if (res.status === "too_large" || res.status === "error") return res.message
  return "이진 데이터가 포함된 파일입니다."
}

const clampZoom = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(v * 100) / 100))

const LightboxTextCodeStage = ({ file, contentUrl }: { file: CloudFile; contentUrl: string }) => {
  const [result, setResult] = useState<BoundedTextPreviewResult | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    void readBoundedCloudTextPreview(contentUrl, file.byteSize, MAX_TEXT_PREVIEW_BYTES, controller.signal)
      .then((res) => { if (!controller.signal.aborted) setResult(res) })
      .catch(() => { if (!controller.signal.aborted) setResult({ status: "error", message: "텍스트 파일을 읽어오지 못했습니다." }) })
    return () => controller.abort()
  }, [contentUrl, file.byteSize, file.id])

  if (!result) {
    return (
      <S.YarlMediaCard role="status" onClick={(e) => e.stopPropagation()}>
        <strong>문서 내용을 불러오는 중...</strong>
        <span>{file.originalFilename}</span>
      </S.YarlMediaCard>
    )
  }
  if (result.status !== "ready") {
    return (
      <S.YarlMediaCard role="alert" onClick={(e) => e.stopPropagation()}>
        <strong>{result.status === "binary" ? "텍스트로 미리볼 수 없는 바이너리 형식입니다" : result.message}</strong>
        <span>{file.originalFilename}</span>
        <S.YarlFallbackDownloadLink href={getCloudFileDownloadUrl(file.id)} download={file.originalFilename}>
          다운로드
        </S.YarlFallbackDownloadLink>
      </S.YarlMediaCard>
    )
  }
  return (
    <S.YarlCodeShell onClick={(e) => e.stopPropagation()}>
      {result.truncated ? (
        <S.YarlTruncationBanner role="status">
          안전한 메모리 보호를 위해 미리보기 상한(256KB)까지만 표시했습니다. 전체 파일은 다운로드해 확인하세요.
        </S.YarlTruncationBanner>
      ) : null}
      <S.YarlCodeScroll>
        {result.lines.map((line, idx) => (
          <div key={idx} className="codeLine">
            <span className="lineNo">{idx + 1}</span>
            <code>{line || " "}</code>
          </div>
        ))}
      </S.YarlCodeScroll>
    </S.YarlCodeShell>
  )
}

export type AdminCloudMediaLightboxProps = {
  open: boolean
  file: CloudFile | null
  files?: readonly CloudFile[]
  onClose: () => void
  onSelectFile?: (fileId: number) => void
  onCopyFileLink?: (file: CloudFile) => Promise<void> | void
}

export const AdminCloudMediaLightbox = ({
  open,
  file,
  files = [],
  onClose,
  onSelectFile,
}: AdminCloudMediaLightboxProps) => {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [imageZoom, setImageZoom] = useState(1)
  const [checkerboard, setCheckerboard] = useState(false)
  const [svgViewMode, setSvgViewMode] = useState<"render" | "code">("render")
  const [svgPreview, setSvgPreview] = useState<BoundedSvgPreviewResult | null>(null)
  const [naturalSize, setNaturalSize] = useState<CloudAssetDimensions | null>(null)
  const [imageError, setImageError] = useState(false)
  const [videoSpeed, setVideoSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1)
  const [pdfZoom, setPdfZoom] = useState(1)
  const [pdfPage, setPdfPage] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const fileId = file?.id ?? null
  const isSvg = Boolean(file && isSvgCloudFile(file))
  const isImage = Boolean(file && isImageCloudFile(file))
  const isVideo = file?.mediaKind === "VIDEO"
  const docSubtype = useMemo(() => (file ? getCloudDocumentSubtype(file) : "document"), [file])

  useEffect(() => {
    if (fileId === null) return
    setImageZoom(1)
    setCheckerboard(isSvg)
    setSvgViewMode("render")
    setSvgPreview(null)
    setNaturalSize(null)
    setImageError(false)
    setVideoSpeed(1)
    setPdfZoom(1)
    setPdfPage(1)
  }, [fileId, isSvg])

  useEffect(() => {
    if (!open || !file || !isSvg) return
    const controller = new AbortController()
    const versionedUrl = appendCloudAssetVersionUrl(getCloudFileContentUrl(file.id), file.modifiedAt || file.createdAt)
    void readBoundedCloudSvgPreview(versionedUrl, file.byteSize, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        setSvgPreview(res)
        if (res.status === "ready" && res.dimensions) setNaturalSize(res.dimensions)
      })
      .catch(() => {
        if (!controller.signal.aborted) setSvgPreview({ status: "error", message: "SVG 원문을 불러오지 못했습니다." })
      })
    return () => controller.abort()
  }, [file, isSvg, open])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = videoSpeed
  }, [videoSpeed, fileId])

  useEffect(() => {
    if (!open || typeof document === "undefined") return
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    syncFullscreen()
    document.addEventListener("fullscreenchange", syncFullscreen)
    return () => document.removeEventListener("fullscreenchange", syncFullscreen)
  }, [open])

  const currentIndex = useMemo(() => (file ? files.findIndex((c) => c.id === file.id) : -1), [file, files])
  const prevFile = currentIndex > 0 ? files[currentIndex - 1] : null
  const nextFile = currentIndex >= 0 && currentIndex < files.length - 1 ? files[currentIndex + 1] : null
  const goPrev = useCallback(() => { if (prevFile && onSelectFile) onSelectFile(prevFile.id) }, [onSelectFile, prevFile])
  const goNext = useCallback(() => { if (nextFile && onSelectFile) onSelectFile(nextFile.id) }, [nextFile, onSelectFile])

  useEffect(() => {
    if (!open || !file) return
    const onArrow = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "VIDEO" || tag === "AUDIO") return
      if (e.key === "ArrowLeft" && prevFile && onSelectFile) {
        e.preventDefault()
        onSelectFile(prevFile.id)
      } else if (e.key === "ArrowRight" && nextFile && onSelectFile) {
        e.preventDefault()
        onSelectFile(nextFile.id)
      }
    }
    window.addEventListener("keydown", onArrow)
    return () => window.removeEventListener("keydown", onArrow)
  }, [file, nextFile, onSelectFile, open, prevFile])

  const { handleKeyDown } = useModalFocusTrap({
    open: open && file !== null,
    onClose,
    containerRef: modalRef,
    initialFocusRef: closeButtonRef,
    lockScroll: true,
  })

  if (!open || !file) return null

  const rawContentUrl = getCloudFileContentUrl(file.id)
  const contentUrl = isImage
    ? appendCloudAssetVersionUrl(rawContentUrl, file.modifiedAt || file.createdAt)
    : rawContentUrl
  const downloadUrl = getCloudFileDownloadUrl(file.id)
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 1
  const displayTotal = files.length > 0 ? files.length : 1
  const canZoomImage = isImage && (!isSvg || svgViewMode === "render")
  const canZoomPdf = !isImage && !isVideo && docSubtype === "pdf"
  const activeZoom = canZoomImage ? imageZoom : pdfZoom
  const activeMinZoom = canZoomImage ? IMAGE_ZOOM_MIN : PDF_ZOOM_MIN
  const activeMaxZoom = canZoomImage ? IMAGE_ZOOM_MAX : PDF_ZOOM_MAX
  const FallbackIcon = getStrapiAssetIcon(file.contentType, file.originalFilename)

  const stepActiveZoom = (direction: 1 | -1) => {
    if (canZoomImage) {
      setImageZoom((z) => clampZoom(z + direction * IMAGE_ZOOM_STEP, IMAGE_ZOOM_MIN, IMAGE_ZOOM_MAX))
    } else if (canZoomPdf) {
      setPdfZoom((z) => clampZoom(z + direction * PDF_ZOOM_STEP, PDF_ZOOM_MIN, PDF_ZOOM_MAX))
    }
  }

  const handleToggleFullscreen = () => {
    if (typeof document === "undefined") return
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    else void modalRef.current?.requestFullscreen?.().catch(() => undefined)
  }

  return (
    <S.YarlPortal
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${file.originalFilename} 미리보기`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <S.YarlCounter aria-live="polite">
        <span className="yarlCounterIndex">{displayIndex} / {displayTotal}</span>
        <span className="yarlCounterCaption">
          {file.originalFilename}
          {naturalSize ? ` · ${naturalSize.width} × ${naturalSize.height}` : ""}
        </span>
      </S.YarlCounter>

      <S.YarlToolbar role="toolbar" aria-label="라이트박스 도구 모음" onClick={(e) => e.stopPropagation()}>
        {canZoomImage || canZoomPdf ? (
          <>
            <S.YarlToolbarButton type="button" aria-label="확대" disabled={activeZoom >= activeMaxZoom} onClick={() => stepActiveZoom(1)}>
              <YarlZoomInIcon />
            </S.YarlToolbarButton>
            <S.YarlToolbarButton type="button" aria-label="축소" disabled={activeZoom <= activeMinZoom} onClick={() => stepActiveZoom(-1)}>
              <YarlZoomOutIcon />
            </S.YarlToolbarButton>
          </>
        ) : null}
        {isSvg ? (
          <S.YarlToolbarButton type="button" aria-label={svgViewMode === "render" ? "SVG 코드 보기" : "SVG 렌더링 보기"} data-active={svgViewMode === "code" ? "true" : "false"} onClick={() => setSvgViewMode((m) => (m === "render" ? "code" : "render"))}>
            {svgViewMode === "render" ? <StrapiFileCodeIcon width={24} height={24} /> : <StrapiImageIcon width={24} height={24} />}
          </S.YarlToolbarButton>
        ) : null}
        {canZoomImage ? (
          <S.YarlToolbarButton type="button" aria-label="투명 배경 격자 전환" aria-pressed={checkerboard} data-active={checkerboard ? "true" : "false"} onClick={() => setCheckerboard((c) => !c)}>
            <StrapiGridFourIcon width={24} height={24} />
          </S.YarlToolbarButton>
        ) : null}
        <S.YarlToolbarLink href={downloadUrl} download={file.originalFilename} aria-label="다운로드">
          <YarlDownloadIcon />
        </S.YarlToolbarLink>
        <S.YarlToolbarButton type="button" aria-label="전체화면 전환" aria-pressed={isFullscreen} data-active={isFullscreen ? "true" : "false"} onClick={handleToggleFullscreen}>
          {isFullscreen ? <YarlExitFullscreenIcon /> : <YarlEnterFullscreenIcon />}
        </S.YarlToolbarButton>
        <S.YarlToolbarButton ref={closeButtonRef} type="button" aria-label="미리보기 닫기" onClick={onClose}>
          <YarlCloseIcon />
        </S.YarlToolbarButton>
      </S.YarlToolbar>

      {files.length > 1 && onSelectFile ? (
        <>
          <S.YarlNavigationButton type="button" $side="prev" aria-label="이전 파일 보기" disabled={!prevFile} onClick={(e) => { e.stopPropagation(); goPrev() }}>
            <YarlPreviousIcon width={32} height={32} />
          </S.YarlNavigationButton>
          <S.YarlNavigationButton type="button" $side="next" aria-label="다음 파일 보기" disabled={!nextFile} onClick={(e) => { e.stopPropagation(); goNext() }}>
            <YarlNextIcon width={32} height={32} />
          </S.YarlNavigationButton>
        </>
      ) : null}

      <S.YarlSlide onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        {isImage ? (
          isSvg && svgViewMode === "code" ? (
            svgPreview?.status === "ready" ? (
              <S.YarlCodeShell onClick={(e) => e.stopPropagation()}>
                <S.YarlCodeScroll>
                  {svgPreview.lines.map((line, idx) => (
                    <div key={idx} className="codeLine">
                      <span className="lineNo">{idx + 1}</span>
                      <code>{line || " "}</code>
                    </div>
                  ))}
                </S.YarlCodeScroll>
              </S.YarlCodeShell>
            ) : (
              <S.YarlMediaCard role="status" onClick={(e) => e.stopPropagation()}>
                <strong>{resolveSvgPendingLabel(svgPreview)}</strong>
                <span>{file.originalFilename}</span>
              </S.YarlMediaCard>
            )
          ) : imageError ? (
            <S.YarlMediaCard role="alert" onClick={(e) => e.stopPropagation()}>
              <YarlErrorIcon width={44} height={44} />
              <strong>이미지를 불러올 수 없습니다</strong>
              <span>{file.originalFilename}</span>
            </S.YarlMediaCard>
          ) : (
            <S.YarlImageStage
              $checkerboard={checkerboard}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={() => setImageZoom((z) => (z === 1 ? 2 : 1))}
            >
              <S.YarlSlideImage
                src={contentUrl}
                alt={file.originalFilename}
                decoding="async"
                data-zoom={imageZoom}
                data-svg={isSvg ? "true" : "false"}
                style={{
                  width: isSvg
                    ? `min(80vw, ${naturalSize ? Math.min(Math.max(naturalSize.width, 480), 960) : 720}px)`
                    : undefined,
                  transform: imageZoom === 1 ? undefined : `scale(${imageZoom})`,
                }}
                onLoad={(e) => {
                  if (isSvg) return
                  const { naturalWidth, naturalHeight } = e.currentTarget
                  if (naturalWidth > 0 && naturalHeight > 0) setNaturalSize({ width: naturalWidth, height: naturalHeight })
                }}
                onError={() => setImageError(true)}
              />
            </S.YarlImageStage>
          )
        ) : isVideo ? (
          <S.YarlVideoStage onClick={(e) => e.stopPropagation()}>
            <video ref={videoRef} src={rawContentUrl} controls autoPlay playsInline>
              <track kind="captions" />
            </video>
            <S.YarlBottomBar role="group" aria-label="라이트박스 동영상 배속">
              {PLAYBACK_SPEEDS.map((speed) => (
                <S.YarlDarkPill key={speed} type="button" data-active={videoSpeed === speed ? "true" : "false"} onClick={() => setVideoSpeed(speed)}>
                  {speed}x
                </S.YarlDarkPill>
              ))}
            </S.YarlBottomBar>
          </S.YarlVideoStage>
        ) : docSubtype === "pdf" ? (
          <LightboxPdfStage file={file} contentUrl={rawContentUrl} pdfZoom={pdfZoom} currentPage={pdfPage} onChangePage={setPdfPage} />
        ) : docSubtype === "code" ? (
          <LightboxTextCodeStage file={file} contentUrl={rawContentUrl} />
        ) : docSubtype === "audio" ? (
          <S.YarlMediaCard onClick={(e) => e.stopPropagation()}>
            <StrapiHeadphonesIcon width={48} height={48} />
            <strong>{file.originalFilename}</strong>
            <span>{getCloudKindBadge(file)} · {formatCloudFileSize(file.byteSize)}</span>
            <audio src={rawContentUrl} controls autoPlay />
          </S.YarlMediaCard>
        ) : (
          <S.YarlMediaCard onClick={(e) => e.stopPropagation()}>
            <FallbackIcon width={48} height={48} />
            <strong>{file.originalFilename}</strong>
            <span>{getCloudKindBadge(file)} · {formatCloudFileSize(file.byteSize)}</span>
            <S.YarlFallbackDownloadLink href={downloadUrl} download={file.originalFilename}>파일 다운로드</S.YarlFallbackDownloadLink>
          </S.YarlMediaCard>
        )}
      </S.YarlSlide>
    </S.YarlPortal>
  )
}

export default AdminCloudMediaLightbox
