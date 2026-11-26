// 참조 구현: strapi/strapi (MIT) & mozilla/pdf.js (Apache-2.0) — PDF CMap·SVG 안전 스트림·Range 텍스트 미리보기 유틸
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import { type MutableRefObject, useEffect, useRef, useState } from "react"
import type { CloudFile } from "src/apis/backend/cloud"
import {
  MAX_SVG_MARKUP_BYTES,
  isImageCloudFile,
  parseSvgDimensionsFromMarkup,
  type CloudAssetDimensions,
} from "../AdminCloudWorkspaceModel"

export const MAX_TEXT_PREVIEW_BYTES = 256 * 1024
export const MAX_INLINE_TEXT_SNIPPET_BYTES = 16 * 1024
export const MAX_TEXT_PREVIEW_LINES = 2500
export const MAX_INLINE_TEXT_LINES = 36
const MAX_SVG_PREVIEW_LINES = 1500
const PDF_STANDARD_FONT_DATA_URL = "/pdfjs/standard_fonts/"
const PDF_CMAP_URL = "/pdfjs/cmaps/"

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "flac", "aac", "opus", "weba"])
const TEXT_EXTENSIONS = new Set([
  "md",
  "markdown",
  "mdx",
  "json",
  "jsonl",
  "txt",
  "csv",
  "tsv",
  "yml",
  "yaml",
  "xml",
  "log",
  "ini",
  "toml",
  "conf",
  "sql",
  "sh",
  "bash",
  "zsh",
  "py",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "kt",
  "java",
  "go",
  "rs",
  "c",
  "cpp",
  "h",
  "css",
  "scss",
  "html",
  "properties",
  "diff",
])
const ARCHIVE_EXTENSIONS = new Set(["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "zst"])
const TEXT_MIMES = new Set([
  "application/json",
  "application/ld+json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/javascript",
  "application/typescript",
  "application/sql",
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
  return (
    mime.startsWith("text/") ||
    TEXT_MIMES.has(mime) ||
    TEXT_EXTENSIONS.has(extractLowerExt(file.originalFilename))
  )
}

export const getCloudDocumentSubtype = (file: CloudFile): CloudDocumentSubtype => {
  if (isPdfCloudFile(file)) return "pdf"
  if (isAudioCloudFile(file)) return "audio"
  if (isTextPreviewableCloudFile(file)) return "code"
  const ext = extractLowerExt(file.originalFilename)
  const mime = file.contentType.toLowerCase()
  return ARCHIVE_EXTENSIONS.has(ext) ||
    mime.includes("zip") ||
    mime.includes("compressed") ||
    mime.includes("tar") ||
    mime.includes("7z") ||
    mime.includes("gzip")
    ? "archive"
    : "document"
}

export type BoundedTextPreviewResult =
  | { status: "ready"; lines: string[]; bytesRead: number; truncated: boolean }
  | { status: "binary" }
  | { status: "error"; message: string }

export type BoundedSvgPreviewResult =
  | { status: "ready"; svgText: string; lines: string[]; dimensions: CloudAssetDimensions | null }
  | { status: "binary" }
  | { status: "too_large"; message: string }
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
  while (idx >= 0 && cont < 3 && (bytes[idx]! & 0xc0) === 0x80) {
    cont += 1
    idx -= 1
  }
  if (idx < 0 || bytes[idx]! < 0x80) return bytes
  const lead = bytes[idx]!
  const need =
    (lead & 0xe0) === 0xc0 ? 2 : (lead & 0xf0) === 0xe0 ? 3 : (lead & 0xf8) === 0xf0 ? 4 : 1
  return cont + 1 < need ? bytes.subarray(0, idx) : bytes
}

export const splitBoundedLines = (
  text: string,
  maxLines: number
): { lines: string[]; lineTruncated: boolean } => {
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
    if (hasNullByteInSlice(rawBuf, fullNullScan ? rawBuf.byteLength : 512)) {
      return { kind: "binary" }
    }
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
  const safeMaxBytes = Math.max(1, maxBytes)
  const response = await fetch(url, {
    credentials: "include",
    signal,
    headers: { Range: `bytes=0-${safeMaxBytes - 1}` },
  })
  if (!response.ok) {
    return { status: "error", message: `미리보기를 불러오지 못했습니다. (HTTP ${response.status})` }
  }

  const streamRes = await readStreamBytesWithGuard(response, safeMaxBytes, "truncate", false)
  if (streamRes.kind === "binary") return { status: "binary" }
  if (streamRes.kind === "too_large") return { status: "error", message: "파일 크기 상한을 초과했습니다." }

  const truncated =
    streamRes.overflowed || (Number.isFinite(declaredByteSize) && declaredByteSize > safeMaxBytes)
  const safeBytes = truncated ? trimIncompleteUtf8Tail(streamRes.bytes) : streamRes.bytes
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(safeBytes)
  const { lines, lineTruncated } = splitBoundedLines(decoded, maxLines)
  return {
    status: "ready",
    lines,
    bytesRead: safeBytes.byteLength,
    truncated: truncated || lineTruncated,
  }
}

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
  const onRej = (e: PromiseRejectionEvent) => {
    if (isTerminated(e.reason)) e.preventDefault()
  }
  const onErr = (e: ErrorEvent) => {
    if (isTerminated(e.error) || isTerminated(e.message)) e.preventDefault()
  }
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
  const fileId = file?.id ?? 0
  const modifiedAt = file?.modifiedAt ?? ""

  useEffect(() => {
    if (!enabled || !fileId) return
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
        loadingTask = pdfjs.getDocument({
          url: contentUrl,
          cMapUrl: PDF_CMAP_URL,
          cMapPacked: true,
          standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL,
          withCredentials: true,
        })
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
      releaseGuard(10_000)
    }
  }, [contentUrl, enabled, fileId, modifiedAt])

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
