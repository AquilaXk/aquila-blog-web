import {
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type MutableRefObject,
  useCallback,
  useRef,
} from "react"
import { ApiError, ApiNetworkError, ApiTimeoutError } from "src/apis/backend/client"
import { planReplaceSelection, type PlannedTextMutation } from "./markdownEditorTextMutation"
import {
  convertSafeHtmlPasteToMarkdown,
  shouldBypassHtmlPasteConversion,
  shouldReportEmptyHtmlPasteError,
} from "./markdownEditorHtmlPasteModel"
import {
  buildUploadingImagePlaceholder,
  createUploadPlaceholderId,
  listFilesFromDataTransfer,
  parseSingleHttpUrl,
  planAppendAtEnd,
  planLinkifySelectionWithUrl,
  planReplaceExactSubstring,
  planTransferFileReservations,
  readClipboardPlainText,
  readClipboardHtml,
  resolvePasteMediaRoute,
  shouldAppendMissingPlaceholder,
  toInlineMarkdownSnippet,
  type ReservedTransferJob,
} from "./markdownEditorPasteDropModel"
import {
  MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
  MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE,
  resolveMarkdownAttachmentLink,
  resolveMarkdownImageEmbed,
  validateMarkdownAttachmentSize,
  type MarkdownFileUploadResult,
  type MarkdownImageUploadResult,
} from "./markdownEditorUploadModel"

type TextareaSelection = {
  from: number
  to: number
}

type MarkdownMutationOptions = {
  clearUploadError?: boolean
}

export type ResolveMarkdownEditorUploadErrorOptions = {
  kind: "image" | "file"
  fileName: string
  fallbackMessage: string
}

const GENERIC_CLIENT_STATUS_MESSAGES = new Set([
  "요청 값이 올바르지 않습니다.",
  "요청 처리 중 오류가 발생했습니다.",
])

export const resolveMarkdownEditorUploadErrorMessage = (
  error: unknown,
  { fallbackMessage }: ResolveMarkdownEditorUploadErrorOptions
): string => {
  if (error instanceof ApiTimeoutError) {
    return "업로드 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."
  }
  if (error instanceof ApiNetworkError) {
    return "네트워크 연결에 실패했습니다. 잠시 후 다시 시도해주세요."
  }
  if (error instanceof ApiError) {
    if (error.status >= 500) return fallbackMessage
    if (error.status === 413) {
      return error.userMessage || "업로드 파일 용량이 너무 큽니다. 용량을 줄여 다시 시도해주세요."
    }
    if (error.status === 401 || error.status === 403 || error.status === 429) {
      return error.userMessage || fallbackMessage
    }
    if (error.userMessage && !GENERIC_CLIENT_STATUS_MESSAGES.has(error.userMessage)) {
      return error.userMessage
    }
    return fallbackMessage
  }
  if (error instanceof Error) {
    const trimmed = error.message.trim()
    if (trimmed && /[가-힣]/.test(trimmed) && !/Exception|endpoint|bucket|provider|stack/i.test(trimmed)) {
      return trimmed
    }
  }
  return fallbackMessage
}

type UseMarkdownEditorMediaTransfersArgs = {
  disabled: boolean
  viewMode?: "live" | "source" | "reading"
  valueRef: MutableRefObject<string>
  selectionRef: MutableRefObject<TextareaSelection>
  documentGenerationRef: MutableRefObject<number>
  onUploadImage?: (file: File) => Promise<MarkdownImageUploadResult>
  onUploadFile?: (file: File) => Promise<MarkdownFileUploadResult>
  applyPlannedMarkdownMutation: (plan: PlannedTextMutation, options?: MarkdownMutationOptions) => boolean
  applyRecordedMarkdownMutation: (plan: PlannedTextMutation) => boolean
  applyBackgroundMarkdownMutation: (plan: PlannedTextMutation) => boolean
  resolveActiveSelection: () => TextareaSelection
  resolveDropTargetPosition?: (coords: { x: number; y: number }) => number | null
  setUploadInFlight: (delta: number) => void
  setEditorError: (message: string) => void
  insertUploadedMarkdown: (markdown: string) => void
}

export const useMarkdownEditorMediaTransfers = ({
  disabled,
  viewMode = "live",
  valueRef,
  selectionRef,
  documentGenerationRef,
  onUploadImage,
  onUploadFile,
  applyPlannedMarkdownMutation,
  applyRecordedMarkdownMutation,
  applyBackgroundMarkdownMutation,
  resolveActiveSelection,
  resolveDropTargetPosition,
  setUploadInFlight,
  setEditorError,
  insertUploadedMarkdown,
}: UseMarkdownEditorMediaTransfersArgs) => {
  const retainedUploadErrorRef = useRef("")

  const clearUploadError = useCallback(() => {
    retainedUploadErrorRef.current = ""
    setEditorError("")
  }, [setEditorError])

  const reportUploadError = useCallback(
    (message: string) => {
      if (retainedUploadErrorRef.current) return
      retainedUploadErrorRef.current = message
      setEditorError(message)
    },
    [setEditorError]
  )

  const insertAtActiveSelection = useCallback(
    (text: string, options?: MarkdownMutationOptions, explicitPos?: number) => {
      const { from, to } =
        typeof explicitPos === "number"
          ? { from: explicitPos, to: explicitPos }
          : resolveActiveSelection()
      applyPlannedMarkdownMutation(planReplaceSelection(from, to, text), options)
    },
    [applyPlannedMarkdownMutation, resolveActiveSelection]
  )

  const replaceExactOrAppend = useCallback(
    (
      exact: string,
      inlineReplacement: string,
      appendMarkdown: string,
      startedGeneration: number
    ) => {
      const selectionFrom = selectionRef.current.from
      const selectionTo = selectionRef.current.to
      const plan = planReplaceExactSubstring(
        valueRef.current,
        exact,
        inlineReplacement,
        selectionFrom,
        selectionTo
      )
      if (plan) {
        applyBackgroundMarkdownMutation(plan)
        return
      }
      if (!shouldAppendMissingPlaceholder(startedGeneration, documentGenerationRef.current)) {
        return
      }
      applyBackgroundMarkdownMutation(
        planAppendAtEnd(valueRef.current, appendMarkdown, selectionFrom, selectionTo)
      )
    },
    [applyBackgroundMarkdownMutation, documentGenerationRef, selectionRef, valueRef]
  )

  const removeExactPlaceholder = useCallback(
    (exact: string) => {
      const plan = planReplaceExactSubstring(
        valueRef.current,
        exact,
        "",
        selectionRef.current.from,
        selectionRef.current.to
      )
      if (plan) applyBackgroundMarkdownMutation(plan)
    },
    [applyBackgroundMarkdownMutation, selectionRef, valueRef]
  )

  const completeReservedImageUpload = useCallback(
    async (
      file: File,
      placeholder: string,
      options?: { manageInFlight?: boolean; startedGeneration: number }
    ) => {
      if (!onUploadImage) return
      const manageInFlight = options?.manageInFlight !== false
      const startedGeneration = options?.startedGeneration ?? documentGenerationRef.current
      if (manageInFlight) setUploadInFlight(1)
      let uploaded: MarkdownImageUploadResult
      try {
        uploaded = await onUploadImage(file)
      } catch (error) {
        removeExactPlaceholder(placeholder)
        reportUploadError(
          resolveMarkdownEditorUploadErrorMessage(error, {
            kind: "image",
            fileName: file.name,
            fallbackMessage: MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE,
          })
        )
        return
      } finally {
        if (manageInFlight) setUploadInFlight(-1)
      }

      const resolved = resolveMarkdownImageEmbed(uploaded, file.name)
      if ("error" in resolved) {
        removeExactPlaceholder(placeholder)
        reportUploadError(resolved.error)
        return
      }

      replaceExactOrAppend(
        placeholder,
        toInlineMarkdownSnippet(resolved.markdown),
        resolved.markdown,
        startedGeneration
      )
    },
    [
      documentGenerationRef,
      onUploadImage,
      removeExactPlaceholder,
      replaceExactOrAppend,
      reportUploadError,
      setUploadInFlight,
    ]
  )

  const completeReservedAttachmentUpload = useCallback(
    async (
      file: File,
      placeholder: string,
      options?: { manageInFlight?: boolean; startedGeneration: number }
    ) => {
      if (!onUploadFile) return
      const manageInFlight = options?.manageInFlight !== false
      const startedGeneration = options?.startedGeneration ?? documentGenerationRef.current
      if (manageInFlight) setUploadInFlight(1)
      let uploaded: MarkdownFileUploadResult
      try {
        uploaded = await onUploadFile(file)
      } catch (error) {
        removeExactPlaceholder(placeholder)
        reportUploadError(
          resolveMarkdownEditorUploadErrorMessage(error, {
            kind: "file",
            fileName: file.name,
            fallbackMessage: MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
          })
        )
        return
      } finally {
        if (manageInFlight) setUploadInFlight(-1)
      }

      const resolved = resolveMarkdownAttachmentLink(uploaded, file.name)
      if ("error" in resolved) {
        removeExactPlaceholder(placeholder)
        reportUploadError(resolved.error)
        return
      }

      replaceExactOrAppend(
        placeholder,
        toInlineMarkdownSnippet(resolved.markdown),
        resolved.markdown,
        startedGeneration
      )
    },
    [
      documentGenerationRef,
      onUploadFile,
      removeExactPlaceholder,
      replaceExactOrAppend,
      reportUploadError,
      setUploadInFlight,
    ]
  )

  const completeReservedJob = useCallback(
    async (
      job: ReservedTransferJob,
      options: { manageInFlight?: boolean; startedGeneration: number }
    ) => {
      if (job.kind === "image") {
        await completeReservedImageUpload(job.file, job.placeholder, options)
        return
      }
      await completeReservedAttachmentUpload(job.file, job.placeholder, options)
    },
    [completeReservedAttachmentUpload, completeReservedImageUpload]
  )

  const uploadImageWithPlaceholder = useCallback(
    async (file: File) => {
      if (!onUploadImage) return
      clearUploadError()
      const startedGeneration = documentGenerationRef.current
      const placeholder = buildUploadingImagePlaceholder(file.name || "image", createUploadPlaceholderId())
      insertAtActiveSelection(placeholder)
      await completeReservedImageUpload(file, placeholder, { startedGeneration })
    },
    [
      clearUploadError,
      completeReservedImageUpload,
      documentGenerationRef,
      insertAtActiveSelection,
      onUploadImage,
    ]
  )

  const handleImageInput = useCallback(
    async (file: File | null) => {
      if (!file || !onUploadImage) return
      clearUploadError()
      setUploadInFlight(1)
      let uploaded: MarkdownImageUploadResult
      try {
        uploaded = await onUploadImage(file)
      } catch (error) {
        setEditorError(
          resolveMarkdownEditorUploadErrorMessage(error, {
            kind: "image",
            fileName: file.name,
            fallbackMessage: MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE,
          })
        )
        return
      } finally {
        setUploadInFlight(-1)
      }
      const resolved = resolveMarkdownImageEmbed(uploaded, file.name)
      if ("error" in resolved) {
        setEditorError(resolved.error)
        return
      }
      insertUploadedMarkdown(resolved.markdown)
    },
    [clearUploadError, insertUploadedMarkdown, onUploadImage, setEditorError, setUploadInFlight]
  )

  const handleFileInput = useCallback(
    async (file: File | null) => {
      if (!file || !onUploadFile) return
      clearUploadError()
      const sizeError = validateMarkdownAttachmentSize(file)
      if (sizeError) {
        setEditorError(sizeError)
        return
      }

      setUploadInFlight(1)
      let uploaded: MarkdownFileUploadResult
      try {
        uploaded = await onUploadFile(file)
      } catch (error) {
        setEditorError(
          resolveMarkdownEditorUploadErrorMessage(error, {
            kind: "file",
            fileName: file.name,
            fallbackMessage: MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
          })
        )
        return
      } finally {
        setUploadInFlight(-1)
      }

      const resolved = resolveMarkdownAttachmentLink(uploaded, file.name)
      if ("error" in resolved) {
        setEditorError(resolved.error)
        return
      }
      insertUploadedMarkdown(resolved.markdown)
    },
    [clearUploadError, insertUploadedMarkdown, onUploadFile, setEditorError, setUploadInFlight]
  )

  const processTransferFiles = useCallback(
    async (files: readonly File[], explicitInsertPos?: number) => {
      clearUploadError()
      const startedGeneration = documentGenerationRef.current

      const { jobs, errors } = planTransferFileReservations(files, {
        canUploadImage: Boolean(onUploadImage),
        canUploadFile: Boolean(onUploadFile),
      })

      if (jobs.length > 0) {
        insertAtActiveSelection(
          jobs.map((job) => job.placeholder).join(""),
          { clearUploadError: false },
          explicitInsertPos
        )
      }

      if (errors[0]) {
        reportUploadError(errors[0])
      }

      if (jobs.length === 0) return

      setUploadInFlight(jobs.length)
      try {
        for (const job of jobs) {
          await completeReservedJob(job, { manageInFlight: false, startedGeneration })
        }
      } finally {
        setUploadInFlight(-jobs.length)
      }
    },
    [
      clearUploadError,
      completeReservedJob,
      documentGenerationRef,
      insertAtActiveSelection,
      onUploadFile,
      onUploadImage,
      reportUploadError,
      setUploadInFlight,
    ]
  )

  const handlePaste = useCallback(
    (event: ReactClipboardEvent<HTMLElement>) => {
      if (disabled) return
      const target = event.target as HTMLElement | null
      const targetTagName = target?.tagName
      if (targetTagName === "INPUT" || targetTagName === "TEXTAREA") return

      const mediaRoute = resolvePasteMediaRoute(event.clipboardData, {
        canUploadImage: Boolean(onUploadImage),
        canUploadFile: Boolean(onUploadFile),
      })
      if (mediaRoute.kind === "transfer-files") {
        event.preventDefault()
        void processTransferFiles(mediaRoute.files)
        return
      }
      if (mediaRoute.kind === "clipboard-image") {
        event.preventDefault()
        void uploadImageWithPlaceholder(mediaRoute.file)
        return
      }

      const { from, to } = resolveActiveSelection()
      const plainText = readClipboardPlainText(event.clipboardData)
      if (from < to) {
        const url = parseSingleHttpUrl(plainText)
        if (url) {
          event.preventDefault()
          const selectedText = valueRef.current.slice(from, to)
          applyPlannedMarkdownMutation(planLinkifySelectionWithUrl(from, to, selectedText, url))
          return
        }
      }

      const html = readClipboardHtml(event.clipboardData)
      if (html !== null) {
        const clipboardTypes = Array.from(event.clipboardData?.types ?? [])
        if (
          shouldBypassHtmlPasteConversion({
            viewMode,
            markdown: valueRef.current,
            selectionFrom: from,
            clipboardTypes,
            html,
            plainText,
          })
        ) {
          return
        }
        const imported = convertSafeHtmlPasteToMarkdown(html)
        event.preventDefault()
        if (imported.kind === "error") {
          if (shouldReportEmptyHtmlPasteError(html, plainText)) {
            setEditorError(imported.message)
            return
          }
          applyRecordedMarkdownMutation(planReplaceSelection(from, to, plainText.replace(/\r\n?/g, "\n")))
          return
        }
        if (imported.kind === "markdown") {
          applyRecordedMarkdownMutation(planReplaceSelection(from, to, imported.markdown))
        }
        return
      }
    },
    [
      applyPlannedMarkdownMutation,
      applyRecordedMarkdownMutation,
      disabled,
      onUploadFile,
      onUploadImage,
      processTransferFiles,
      resolveActiveSelection,
      setEditorError,
      uploadImageWithPlaceholder,
      valueRef,
      viewMode,
    ]
  )

  const handleDragOver = useCallback(
    (event: ReactDragEvent<HTMLElement>) => {
      if (disabled || (!onUploadImage && !onUploadFile)) return
      if (!event.dataTransfer?.types?.includes("Files")) return
      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"
    },
    [disabled, onUploadFile, onUploadImage]
  )

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>) => {
      if (disabled || (!onUploadImage && !onUploadFile)) return
      const files = listFilesFromDataTransfer(event.dataTransfer)
      if (files.length === 0) return
      event.preventDefault()
      const dropPos = resolveDropTargetPosition?.({ x: event.clientX, y: event.clientY })
      const resolvedDropPos = typeof dropPos === "number" ? dropPos : undefined
      if (resolvedDropPos !== undefined) {
        selectionRef.current = { from: resolvedDropPos, to: resolvedDropPos }
      }
      void processTransferFiles(files, resolvedDropPos)
    },
    [disabled, onUploadFile, onUploadImage, processTransferFiles, resolveDropTargetPosition, selectionRef]
  )

  return {
    handleImageInput,
    handleFileInput,
    handlePaste,
    handleDragOver,
    handleDrop,
  }
}
