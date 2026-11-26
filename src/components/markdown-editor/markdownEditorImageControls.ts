/**
 * 참조 구현:
 * - TryGhost/Koenig packages/koenig-lexical (MIT License, Copyright (c) Ghost Foundation)
 * - WordPress/gutenberg packages/block-library/src/image/ (GPL-2.0 제외, 개념만 참고 / 직접 작성)
 */
import { EditorView } from "@codemirror/view"
import type { MarkdownImageWidthCommitPayload } from "../../libs/markdown/MarkdownRenderer.types"
export type { MarkdownImageWidthCommitPayload }
import {
  clampImageWidthPx,
  parseStandaloneMarkdownImageLine,
  serializeStandaloneMarkdownImageLine,
  type ParsedStandaloneMarkdownImage,
} from "../../libs/markdown/renderingImageModel"
import { resolveEditorViewLanguage } from "./markdownEditorLanguageState"
import { planReplaceSelection, type PlannedTextMutation } from "./markdownEditorTextMutation"
import { getImageControlLabels } from "./markdownEditorWidgetLabels"

export const IMAGE_WIDTH_PRESETS = [320, 520, 720] as const
const IMAGE_ALIGN_OPTIONS: readonly { value: NonNullable<ParsedStandaloneMarkdownImage["align"]>; label: string }[] = [
  { value: "left", label: "L" },
  { value: "center", label: "C" },
  { value: "right", label: "R" },
]

export const applyImageWidthCommitToMarkdown = (
  markdown: string,
  payload: MarkdownImageWidthCommitPayload
): PlannedTextMutation | null => {
  const normalizedWidth = clampImageWidthPx(payload.widthPx)
  let inFence = false
  let fenceMarker = ""
  let fenceLen = 0
  let standaloneIdx = 0
  let fallbackMatch: PlannedTextMutation | null = null
  let pos = 0

  while (pos <= markdown.length) {
    const nextBreak = markdown.indexOf("\n", pos)
    const lineEnd = nextBreak === -1 ? markdown.length : nextBreak
    const line = markdown.slice(pos, lineEnd)
    const trimmed = line.trim()
    const fenceMatch = /^( {0,3})(`{3,}|~{3,})/.exec(trimmed)

    if (fenceMatch) {
      const marker = fenceMatch[2]?.[0] ?? "`"
      const len = fenceMatch[2]?.length ?? 3
      if (!inFence) {
        inFence = true
        fenceMarker = marker
        fenceLen = len
      } else if (marker === fenceMarker && len >= fenceLen) {
        inFence = false
      }
    } else if (!inFence) {
      const parsed = parseStandaloneMarkdownImageLine(line)
      if (parsed) {
        const currentIdx = standaloneIdx++
        if (parsed.src === payload.src) {
          const replacement = serializeStandaloneMarkdownImageLine({
            ...parsed,
            widthPx: normalizedWidth,
            align: parsed.align === "full" ? undefined : parsed.align,
          })
          const candidate = planReplaceSelection(pos, lineEnd, replacement)
          if (currentIdx === payload.index) return candidate
          if (!fallbackMatch) fallbackMatch = candidate
        }
      }
    }

    if (nextBreak === -1) break
    pos = nextBreak + 1
  }

  return fallbackMatch
}

const resolveImageSpanBounds = (view: EditorView, wrap: HTMLElement, fallbackFrom: number): { from: number; to: number } => {
  let start = fallbackFrom
  try {
    const domPos = view.posAtDOM(wrap)
    if (typeof domPos === "number" && domPos >= 0) start = domPos
  } catch {
    // fallbackFrom 사용
  }
  const line = view.state.doc.lineAt(Math.min(start, view.state.doc.length))
  const lineParsed = parseStandaloneMarkdownImageLine(line.text)
  if (lineParsed) {
    return { from: line.from, to: line.to }
  }
  const raw = view.state.doc.sliceString(line.from, line.to)
  const relStart = Math.max(0, start - line.from)
  const sliceAfter = raw.slice(relStart)
  const inlineMatch = /^!\[[^\][\r\n]*\]\([^()\r\n]*\)(?:\s*\{[^}\r\n]*\})?/.exec(sliceAfter)
  if (inlineMatch) {
    return { from: start, to: start + inlineMatch[0].length }
  }
  return { from: line.from, to: line.to }
}

const dispatchImageUpdate = ({
  view,
  wrap,
  fallbackFrom,
  src,
  alt,
  title,
  widthPx,
  align,
  patch,
}: {
  view: EditorView
  wrap: HTMLElement
  fallbackFrom: number
  src: string
  alt: string
  title?: string
  widthPx?: number
  align?: string
  patch: {
    widthPx?: number | null
    align?: ParsedStandaloneMarkdownImage["align"] | ""
    alt?: string
  }
}) => {
  if (!view.state.facet(EditorView.editable)) {
    return
  }
  const bounds = resolveImageSpanBounds(view, wrap, fallbackFrom)
  const existingText = view.state.doc.sliceString(bounds.from, bounds.to)
  const parsed = parseStandaloneMarkdownImageLine(existingText)
  const base: ParsedStandaloneMarkdownImage = parsed ?? {
    src,
    alt,
    title: title ?? "",
    widthPx,
    align: align as ParsedStandaloneMarkdownImage["align"] | undefined,
  }
  const nextWidthPx = patch.widthPx === null ? undefined : (patch.widthPx ?? base.widthPx)
  const nextAlign = patch.align === "" ? undefined : (patch.align ?? base.align)
  const nextAlt = patch.alt !== undefined ? patch.alt : base.alt
  const insert = serializeStandaloneMarkdownImageLine({
    ...base,
    alt: nextAlt,
    widthPx: nextWidthPx,
    align: nextAlign,
  })
  if (insert === existingText) return
  view.dispatch({
    changes: { from: bounds.from, to: bounds.to, insert },
  })
}

const stopControlPropagation = (element: HTMLElement) => {
  for (const eventName of ["mousedown", "pointerdown", "click"] as const) {
    element.addEventListener(eventName, (event) => {
      event.stopPropagation()
    })
  }
}

export const attachLiveImageControls = ({
  view,
  wrap,
  img,
  src,
  alt,
  widthPx,
  align,
  title,
  fallbackFrom = 0,
}: {
  view?: EditorView
  wrap: HTMLElement
  img: HTMLImageElement
  src: string
  alt: string
  widthPx?: number
  align?: string
  title?: string
  fallbackFrom?: number
}) => {
  const editable = Boolean(view?.state.facet(EditorView.editable))
  const frame = document.createElement("span")
  frame.className = "cm-live-image-frame"
  frame.appendChild(img)
  wrap.appendChild(frame)

  if (!editable || !view) return
  const labels = getImageControlLabels(resolveEditorViewLanguage(view, "ko"))

  const resizeHandle = document.createElement("button")
  resizeHandle.type = "button"
  resizeHandle.className = "cm-live-image-resize-handle"
  resizeHandle.setAttribute("aria-label", labels.resizeAria)
  resizeHandle.title = labels.resizeTitle
  stopControlPropagation(resizeHandle)

  let dragStartX = 0
  let dragStartWidth = 0
  let dragLiveWidth: number | null = null
  const initialWidthAttr = widthPx

  const onDragKeyDown = (keyEvent: KeyboardEvent) => {
    if (keyEvent.key !== "Escape") return
    keyEvent.preventDefault()
    dragLiveWidth = null
    if (initialWidthAttr) {
      wrap.style.setProperty("--aq-image-width", `${initialWidthAttr}px`)
    } else {
      wrap.style.removeProperty("--aq-image-width")
    }
    window.removeEventListener("keydown", onDragKeyDown, true)
  }

  resizeHandle.addEventListener("pointerdown", (event) => {
    event.preventDefault()
    event.stopPropagation()
    const measuredWidth = img.getBoundingClientRect().width || frame.getBoundingClientRect().width || widthPx || 520
    dragStartX = event.clientX
    dragStartWidth = measuredWidth
    dragLiveWidth = clampImageWidthPx(measuredWidth)
    try {
      resizeHandle.setPointerCapture(event.pointerId)
    } catch {
      // 합성 이벤트 환경 허용
    }
    window.addEventListener("keydown", onDragKeyDown, true)
  })

  resizeHandle.addEventListener("pointermove", (event) => {
    if (dragLiveWidth === null) return
    const nextWidth = clampImageWidthPx(dragStartWidth + (event.clientX - dragStartX))
    dragLiveWidth = nextWidth
    wrap.style.setProperty("--aq-image-width", `${nextWidth}px`)
    img.width = nextWidth
  })

  const finishDrag = (commit: boolean) => {
    window.removeEventListener("keydown", onDragKeyDown, true)
    const committedWidth = dragLiveWidth
    dragLiveWidth = null
    if (!commit || committedWidth === null) return
    dispatchImageUpdate({
      view,
      wrap,
      fallbackFrom,
      src,
      alt,
      title,
      widthPx,
      align,
      patch: { widthPx: committedWidth, align: align === "full" ? "" : undefined },
    })
  }

  resizeHandle.addEventListener("pointerup", () => finishDrag(true))
  resizeHandle.addEventListener("pointercancel", () => finishDrag(false))
  frame.appendChild(resizeHandle)

  const controls = document.createElement("span")
  controls.className = "cm-live-image-controls"
  controls.dataset.testid = "cm-live-image-controls"
  stopControlPropagation(controls)

  for (const preset of IMAGE_WIDTH_PRESETS) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "cm-live-image-ctrl-btn"
    button.textContent = `${preset}`
    if (widthPx === preset && align !== "full") button.dataset.active = "true"
    button.setAttribute("aria-label", labels.presetWidthAria(preset))
    button.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      dispatchImageUpdate({
        view,
        wrap,
        fallbackFrom,
        src,
        alt,
        title,
        widthPx,
        align,
        patch: { widthPx: preset, align: align === "full" ? "" : undefined },
      })
    })
    controls.appendChild(button)
  }

  const fullButton = document.createElement("button")
  fullButton.type = "button"
  fullButton.className = "cm-live-image-ctrl-btn"
  fullButton.textContent = "100%"
  if (align === "full") fullButton.dataset.active = "true"
  fullButton.setAttribute("aria-label", labels.fullWidthAria)
  fullButton.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    dispatchImageUpdate({
      view,
      wrap,
      fallbackFrom,
      src,
      alt,
      title,
      widthPx,
      align,
      patch: { widthPx: null, align: "full" },
    })
  })
  controls.appendChild(fullButton)

  const separator = document.createElement("span")
  separator.className = "cm-live-image-ctrl-sep"
  separator.setAttribute("aria-hidden", "true")
  controls.appendChild(separator)

  for (const opt of IMAGE_ALIGN_OPTIONS) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "cm-live-image-ctrl-btn"
    button.textContent = opt.label
    if (align === opt.value) button.dataset.active = "true"
    button.setAttribute("aria-label", labels.alignAria(opt.value))
    button.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      dispatchImageUpdate({
        view,
        wrap,
        fallbackFrom,
        src,
        alt,
        title,
        widthPx,
        align,
        patch: { align: align === opt.value ? "" : opt.value },
      })
    })
    controls.appendChild(button)
  }

  const captionInput = document.createElement("input")
  captionInput.type = "text"
  captionInput.className = "cm-live-image-caption-input"
  captionInput.value = alt
  captionInput.placeholder = labels.captionPlaceholder
  captionInput.setAttribute("aria-label", labels.captionAria)
  let isCaptionComposing = false

  const commitCaption = () => {
    const sanitized = captionInput.value.replace(/[\r\n[\]]/g, " ").trim()
    if (sanitized === alt) return
    dispatchImageUpdate({
      view,
      wrap,
      fallbackFrom,
      src,
      alt,
      title,
      widthPx,
      align,
      patch: { alt: sanitized },
    })
  }

  captionInput.addEventListener("compositionstart", () => {
    isCaptionComposing = true
  })
  captionInput.addEventListener("compositionend", () => {
    isCaptionComposing = false
  })
  captionInput.addEventListener("keydown", (event) => {
    event.stopPropagation()
    if (event.key === "Enter") {
      if (isCaptionComposing || event.isComposing || event.keyCode === 229) return
      event.preventDefault()
      commitCaption()
      captionInput.blur()
    } else if (event.key === "Escape") {
      event.preventDefault()
      captionInput.value = alt
      captionInput.blur()
    }
  })
  captionInput.addEventListener("blur", commitCaption)
  controls.appendChild(captionInput)

  wrap.appendChild(controls)
}
