import { createSecureRandomUuid } from "src/libs/security/secureRandomUuid"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"
import {
  escapeMarkdownLinkLabel,
  validateMarkdownAttachmentSize,
} from "./markdownEditorUploadModel"

export const createUploadPlaceholderId = (): string => createSecureRandomUuid()

export const sanitizeUploadPlaceholderFileName = (fileName: string): string => {
  const normalized = String(fileName || "")
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .trim()
  return escapeMarkdownLinkLabel(normalized || "file")
}

export const shouldAppendMissingPlaceholder = (
  startedGeneration: number,
  currentGeneration: number
): boolean => startedGeneration === currentGeneration

export const buildUploadingImagePlaceholder = (fileName: string, uploadId: string): string =>
  `![업로드 중: ${sanitizeUploadPlaceholderFileName(fileName)} · ${uploadId}…]()`

export const buildUploadingAttachmentPlaceholder = (fileName: string, uploadId: string): string =>
  `[업로드 중: ${sanitizeUploadPlaceholderFileName(fileName)} · ${uploadId}…]()`

export const isImageFile = (file: File): boolean => file.type.startsWith("image/")

export const extractImageFileFromClipboard = (clipboardData: DataTransfer | null): File | null => {
  if (!clipboardData) return null

  const directFile = Array.from(clipboardData.files || []).find((file) => isImageFile(file))
  if (directFile) return directFile

  const clipboardItem = Array.from(clipboardData.items || []).find(
    (item) => item.kind === "file" && item.type.startsWith("image/")
  )
  if (!clipboardItem) return null

  const pastedFile = clipboardItem.getAsFile()
  if (!pastedFile || !isImageFile(pastedFile)) return null
  return pastedFile
}

export const listFilesFromDataTransfer = (dataTransfer: DataTransfer | null): File[] => {
  if (!dataTransfer) return []
  return Array.from(dataTransfer.files || [])
}

export const partitionUploadFiles = (files: readonly File[]): { images: File[]; attachments: File[] } => {
  const images: File[] = []
  const attachments: File[] = []
  for (const file of files) {
    if (isImageFile(file)) images.push(file)
    else attachments.push(file)
  }
  return { images, attachments }
}

export type PasteMediaRoute =
  | { kind: "transfer-files"; files: File[] }
  | { kind: "clipboard-image"; file: File }
  | { kind: "none" }

export type ReservedTransferJob =
  | { kind: "image"; file: File; placeholder: string }
  | { kind: "attachment"; file: File; placeholder: string }

export const planTransferFileReservations = (
  files: readonly File[],
  options: {
    canUploadImage: boolean
    canUploadFile: boolean
    createId?: () => string
  }
): { jobs: ReservedTransferJob[]; errors: string[] } => {
  const createId = options.createId ?? createUploadPlaceholderId
  const jobs: ReservedTransferJob[] = []
  const errors: string[] = []

  for (const file of files) {
    if (isImageFile(file)) {
      if (!options.canUploadImage) continue
      jobs.push({
        kind: "image",
        file,
        placeholder: buildUploadingImagePlaceholder(file.name || "image", createId()),
      })
      continue
    }

    if (!options.canUploadFile) continue
    const sizeError = validateMarkdownAttachmentSize(file)
    if (sizeError) {
      errors.push(sizeError)
      continue
    }
    jobs.push({
      kind: "attachment",
      file,
      placeholder: buildUploadingAttachmentPlaceholder(file.name || "file", createId()),
    })
  }

  return { jobs, errors }
}

export const resolvePasteMediaRoute = (
  clipboardData: DataTransfer | null,
  options: { canUploadImage: boolean; canUploadFile: boolean }
): PasteMediaRoute => {
  const files = listFilesFromDataTransfer(clipboardData)
  if (files.length > 0) {
    const { images, attachments } = partitionUploadFiles(files)
    const hasHandledImage = Boolean(options.canUploadImage && images.length > 0)
    const hasHandledAttachment = Boolean(options.canUploadFile && attachments.length > 0)
    if (hasHandledImage || hasHandledAttachment) {
      return { kind: "transfer-files", files }
    }
    return { kind: "none" }
  }

  if (options.canUploadImage) {
    const imageFile = extractImageFileFromClipboard(clipboardData)
    if (imageFile) return { kind: "clipboard-image", file: imageFile }
  }

  return { kind: "none" }
}

export const readClipboardPlainText = (clipboardData: DataTransfer | null): string => {
  if (!clipboardData) return ""
  return String(clipboardData.getData("text/plain") || "")
}

export const hasClipboardHtml = (clipboardData: DataTransfer | null): boolean =>
  Boolean(clipboardData && Array.from(clipboardData.types || []).includes("text/html"))

export const readClipboardHtml = (clipboardData: DataTransfer | null): string | null => {
  if (!hasClipboardHtml(clipboardData)) return null
  return String(clipboardData?.getData("text/html") || "")
}

export const parseSingleHttpUrl = (text: string): string | null => {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return trimmed
  } catch {
    return null
  }
}

export const escapeMarkdownLinkDestination = (url: string): string =>
  url.replace(/[\\()]/g, "\\$&")

const EXISTING_MARKDOWN_LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/

export const planLinkifySelectionWithUrl = (
  selectionStart: number,
  selectionEnd: number,
  selectedText: string,
  url: string
): PlannedTextMutation => {
  const leading = selectedText.match(/^\s*/)?.[0] ?? ""
  const trailing = selectedText.match(/\s*$/)?.[0] ?? ""
  const core = selectedText.trim()

  if (!core) {
    const replacement = `[${escapeMarkdownLinkLabel(selectedText)}](${escapeMarkdownLinkDestination(url)})`
    const cursor = selectionStart + replacement.length
    return {
      rangeStart: selectionStart,
      rangeEnd: selectionEnd,
      replacement,
      selectionStart: cursor,
      selectionEnd: cursor,
    }
  }

  const existingLinkMatch = EXISTING_MARKDOWN_LINK_PATTERN.exec(core)
  const label = existingLinkMatch ? existingLinkMatch[1]! : escapeMarkdownLinkLabel(core)
  const innerLink = `[${label}](${escapeMarkdownLinkDestination(url)})`
  const replacement = `${leading}${innerLink}${trailing}`
  const cursor = selectionStart + leading.length + innerLink.length
  return {
    rangeStart: selectionStart,
    rangeEnd: selectionEnd,
    replacement,
    selectionStart: cursor,
    selectionEnd: cursor,
  }
}

export const findExactSubstringIndex = (value: string, exact: string): number => {
  if (!exact) return -1
  return value.indexOf(exact)
}

export const planReplaceExactSubstring = (
  value: string,
  exact: string,
  replacement: string,
  selectionFrom: number,
  selectionTo: number
): PlannedTextMutation | null => {
  const index = findExactSubstringIndex(value, exact)
  if (index === -1) return null

  const delta = replacement.length - exact.length
  const adjust = (pos: number) => {
    if (pos <= index) return pos
    if (pos >= index + exact.length) return pos + delta
    return index + replacement.length
  }

  return {
    rangeStart: index,
    rangeEnd: index + exact.length,
    replacement,
    selectionStart: adjust(selectionFrom),
    selectionEnd: adjust(selectionTo),
  }
}

export const planAppendAtEnd = (
  value: string,
  markdown: string,
  selectionFrom: number,
  selectionTo: number
): PlannedTextMutation => {
  const end = value.length
  return {
    rangeStart: end,
    rangeEnd: end,
    replacement: markdown,
    selectionStart: selectionFrom,
    selectionEnd: selectionTo,
  }
}

export const toInlineMarkdownSnippet = (markdown: string): string =>
  markdown.replace(/^\n+/, "").replace(/\n+$/, "")
