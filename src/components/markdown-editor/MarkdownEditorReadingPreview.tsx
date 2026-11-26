import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ComponentType,
  type MutableRefObject,
} from "react"
import dynamic from "next/dynamic"
import styled from "@emotion/styled"
import { useLanguage } from "../../libs/language"
import { buildPostInternalLinkTargets } from "../../libs/markdown/internalWikilinkResolver"
import type {
  MarkdownImageWidthCommitPayload,
  MarkdownRendererProps,
} from "../../libs/markdown/MarkdownRenderer.types"
import { adminT } from "../../routes/Admin/adminI18n"
import {
  getRegisteredPostSuggestions,
  subscribeInternalPostSuggestions,
  type InternalPostSuggestion,
} from "./markdownEditorCompletions"
import {
  restoreMarkdownScrollSnapshot,
  type MarkdownEditorSurfaceMode,
  type MarkdownScrollSnapshot,
} from "./markdownEditorLivePreview"

const READING_PREVIEW_LOADING_SELECTOR = '[data-reading-preview-loading="true"]'

export const ReadingPreviewLoadingPlaceholder = () => {
  const { language } = useLanguage()
  return (
    <div aria-busy="true" data-reading-preview-loading="true">
      {adminT("editorReadingPreviewLoading", language)}
    </div>
  )
}

const DynamicMarkdownRenderer = dynamic(
  () => import("../../libs/markdown/MarkdownRenderer"),
  {
    ssr: false,
    loading: () => <ReadingPreviewLoadingPlaceholder />,
  }
)

const ReadingPreviewRoot = styled.div`
  min-width: 0;
  min-height: 0;
  overflow-x: auto;
  overflow-y: visible;
  padding: 12px 56px 64px;
  overscroll-behavior-x: contain;

  @media (max-width: 820px) {
    padding: 14px 16px 32px;
  }
`

const ReadingPreviewCanvas = styled.div`
  width: 100%;
  max-width: 744px;
  margin-inline: auto;
  min-width: 0;

  @media (max-width: 820px) {
    max-width: 100%;
  }
`

const EMPTY_POST_SUGGESTIONS: InternalPostSuggestion[] = []
const getServerPostSuggestions = () => EMPTY_POST_SUGGESTIONS

type MarkdownEditorReadingPreviewProps = {
  value: string
  disableMermaid?: boolean
  internalLinkTargets?: Readonly<Record<string, string>>
  onImageWidthCommit?: (payload: MarkdownImageWidthCommitPayload) => void
  viewMode?: MarkdownEditorSurfaceMode
  pendingScrollSnapshotRef?: MutableRefObject<MarkdownScrollSnapshot | null>
  getScrollBodyNode?: () => HTMLElement | null
  rendererComponent?: ComponentType<MarkdownRendererProps>
}

export const MarkdownEditorReadingPreview = ({
  value,
  disableMermaid = false,
  internalLinkTargets,
  onImageWidthCommit,
  viewMode = "reading",
  pendingScrollSnapshotRef,
  getScrollBodyNode,
  rendererComponent: Renderer = DynamicMarkdownRenderer,
}: MarkdownEditorReadingPreviewProps) => {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const getScrollBodyNodeRef = useRef(getScrollBodyNode)
  getScrollBodyNodeRef.current = getScrollBodyNode
  const registeredSuggestions = useSyncExternalStore(
    subscribeInternalPostSuggestions,
    getRegisteredPostSuggestions,
    getServerPostSuggestions
  )
  const resolvedInternalLinkTargets = useMemo(() => {
    if (internalLinkTargets) return internalLinkTargets
    const computed = buildPostInternalLinkTargets(value, registeredSuggestions)
    return Object.keys(computed).length > 0 ? computed : undefined
  }, [internalLinkTargets, registeredSuggestions, value])

  useEffect(() => {
    const snapshotRef = pendingScrollSnapshotRef
    if (!snapshotRef?.current || viewMode !== "reading") return
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    let restoreScheduled = false
    let rafOne: number | null = null
    let rafTwo: number | null = null
    let observer: MutationObserver | null = null

    const isPlaceholderMounted = () => Boolean(canvas.querySelector(READING_PREVIEW_LOADING_SELECTOR))

    const scheduleRestore = () => {
      if (cancelled || restoreScheduled) return
      if (!snapshotRef.current) return
      restoreScheduled = true
      const commit = () => {
        if (cancelled) return
        const snapshot = snapshotRef.current
        if (!snapshot) return
        snapshotRef.current = null
        restoreMarkdownScrollSnapshot(snapshot, getScrollBodyNodeRef.current?.() ?? canvas)
      }
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        rafOne = window.requestAnimationFrame(() => {
          rafTwo = window.requestAnimationFrame(commit)
        })
      } else {
        commit()
      }
    }

    if (!isPlaceholderMounted()) {
      scheduleRestore()
    } else if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => {
        if (!isPlaceholderMounted()) {
          observer?.disconnect()
          observer = null
          scheduleRestore()
        }
      })
      observer.observe(canvas, { childList: true, subtree: true })
    } else {
      scheduleRestore()
    }

    return () => {
      cancelled = true
      observer?.disconnect()
      if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        if (rafOne !== null) window.cancelAnimationFrame(rafOne)
        if (rafTwo !== null) window.cancelAnimationFrame(rafTwo)
      }
    }
  }, [pendingScrollSnapshotRef, viewMode])

  return (
    <ReadingPreviewRoot
      className="aq-editor-reading-surface"
      data-testid="markdown-editor-reading-surface"
    >
      <ReadingPreviewCanvas ref={canvasRef}>
        <Renderer
          content={value}
          disableMermaid={disableMermaid}
          editableImages={Boolean(onImageWidthCommit)}
          internalLinkTargets={resolvedInternalLinkTargets}
          onImageWidthCommit={onImageWidthCommit}
        />
      </ReadingPreviewCanvas>
    </ReadingPreviewRoot>
  )
}
