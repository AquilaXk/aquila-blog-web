/**
 * 참조 구현:
 * - Milkdown/milkdown packages/crepe/src/theme/common/link-tooltip.css & feature/link-tooltip/ (MIT License, Copyright (c) 2021 Mirone)
 */
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor } from "src/design-system/tokens"
import { useLanguage, type SiteLanguage } from "src/libs/language"
import { hasAsciiControlCharacters, normalizeSafeMarkdownLinkHref } from "src/libs/markdown/safeMarkdownUrl"
import { editorT } from "./markdownEditorI18n"
import { zIndexes } from "src/styles/zIndexes"
import {
  EditorIconCheck,
  EditorIconClose,
  EditorIconUnlink,
} from "./MarkdownEditorIcons"
import { clampBoxToVisualViewport, findMarkdownLinkAtOffset } from "./markdownEditorLinkUtils"
import { planReplaceSelection, type PlannedTextMutation } from "./markdownEditorTextMutation"

export type ParsedMarkdownLinkSelection = {
  label: string
  url: string
}

const EXPLICIT_SCHEME_PREFIX_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/
const BARE_DOMAIN_CANDIDATE_PATTERN = /^[^\s/?#]+\.[^\s/]+(?:\/.*)?$/

const hasControlOrSpaceChar = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code <= 32 || code === 127) return true
  }
  return false
}

export const parseMarkdownLinkSelection = (selectedText: string): ParsedMarkdownLinkSelection | null => {
  const trimmed = selectedText.trim()
  if (
    !trimmed.startsWith("[") ||
    !trimmed.endsWith(")") ||
    trimmed.includes("\n") ||
    trimmed.includes("\r")
  ) {
    return null
  }
  const hit = findMarkdownLinkAtOffset(trimmed, 0)
  if (!hit || hit.from !== 0 || hit.to !== trimmed.length || !hit.url || hasControlOrSpaceChar(hit.url)) {
    return null
  }
  return {
    label: hit.label,
    url: hit.url,
  }
}

export const normalizeBubbleLinkInput = (
  rawInput: string,
  language: SiteLanguage = "ko"
): { ok: true; url: string } | { ok: false; error: string } => {
  const trimmed = rawInput.trim()
  if (!trimmed) {
    return { ok: false, error: editorT("linkErrEmpty", language) }
  }
  if (hasAsciiControlCharacters(trimmed) || trimmed.includes("\\")) {
    return { ok: false, error: editorT("linkErrControlChars", language) }
  }

  let candidate = trimmed
  const lower = trimmed.toLowerCase()
  const hasExplicitRelativeOrHash =
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("#") ||
    lower.startsWith("mailto:")

  if (!hasExplicitRelativeOrHash && !EXPLICIT_SCHEME_PREFIX_PATTERN.test(trimmed)) {
    if (!BARE_DOMAIN_CANDIDATE_PATTERN.test(trimmed)) {
      return { ok: false, error: editorT("linkErrInvalidFormat", language) }
    }
    candidate = `https://${trimmed}`
  }

  const normalized = normalizeSafeMarkdownLinkHref(candidate)
  if (!normalized) {
    return { ok: false, error: editorT("linkErrDisallowed", language) }
  }
  const markdownSafeUrl = normalized.replace(/\(/g, "%28").replace(/\)/g, "%29")
  return { ok: true, url: markdownSafeUrl }
}

export const planBubbleLinkApply = (
  value: string,
  selection: { from: number; to: number },
  rawUrl: string,
  language: SiteLanguage = "ko"
): { ok: true; plan: PlannedTextMutation; url: string } | { ok: false; error: string } => {
  const validated = normalizeBubbleLinkInput(rawUrl, language)
  if (!validated.ok) return validated

  const selected = value.slice(selection.from, selection.to)
  const existing = parseMarkdownLinkSelection(selected)
  const label = existing ? existing.label || validated.url : selected || editorT("linkTextFallback", language)
  const nextMarkdown = `[${label}](${validated.url})`
  return {
    ok: true,
    url: validated.url,
    plan: planReplaceSelection(selection.from, selection.to, nextMarkdown),
  }
}

export const planBubbleLinkRemove = (
  value: string,
  selection: { from: number; to: number }
): PlannedTextMutation | null => {
  const selected = value.slice(selection.from, selection.to)
  const existing = parseMarkdownLinkSelection(selected)
  if (!existing) return null
  return planReplaceSelection(selection.from, selection.to, existing.label)
}

const LinkPopoverSurface = styled.form<{ $top: number; $left: number }>`
  position: fixed;
  z-index: ${zIndexes.dropdownMenu + 6};
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  max-width: calc(100vw - 24px);
  display: grid;
  gap: 6px;
`

const LinkEditPill = styled.div`
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px 4px 16px;
  gap: 8px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 2px 6px ${boxShadowColor.cardHover}, 0 12px 28px ${boxShadowColor.popover};
  box-sizing: border-box;

  @media (pointer: coarse), (max-width: 768px) {
    min-height: 44px;
    padding: 4px 10px 4px 12px;
  }
`

const LinkUrlInput = styled.input`
  outline: none;
  border: 0;
  padding: 0;
  background: transparent;
  width: 200px;
  min-width: 0;
  flex: 1 1 auto;
  font-size: 14px;
  line-height: 24px;
  color: ${({ theme }) => theme.colors.gray12};

  &::placeholder {
    color: ${({ theme }) => theme.colors.gray9};
  }

  @media (pointer: coarse), (max-width: 768px) {
    width: min(200px, 50vw);
    font-size: 16px;
    min-height: 36px;
  }
`

const LinkActionButton = styled.button<{ $tone?: "primary" | "danger" }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 3px 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${({ theme, $tone }) =>
    $tone === "danger"
      ? theme.colors.red11
      : $tone === "primary"
        ? theme.colors.gray12
        : theme.colors.gray10};
  font-size: 12px;
  font-weight: 600;
  line-height: 24px;
  white-space: nowrap;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${({ theme, $tone }) =>
      $tone === "danger" ? theme.colors.red3 : theme.colors.gray3};
  }

  ${focusVisibleRing}
  @media (pointer: coarse), (max-width: 768px) {
    min-height: 44px;
    min-width: 44px;
  }
`

const LinkErrorBanner = styled.p`
  margin: 0;
  padding: 5px 10px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.red3};
  color: ${({ theme }) => theme.colors.red11};
  font: 600 11.5px/1.35 var(--aq-font-sans);
  box-shadow: 0 2px 6px ${boxShadowColor.cardHover};
`

const LinkOpenAnchor = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 6px;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 12px;
  font-weight: 600;
  line-height: 24px;
  text-decoration: none;
  white-space: nowrap;
  ${focusVisibleRing}
  &:hover {
    background: ${({ theme }) => theme.colors.gray3};
    color: ${({ theme }) => theme.colors.gray12};
  }
  @media (pointer: coarse), (max-width: 768px) {
    min-height: 44px;
    min-width: 44px;
  }
`

type MarkdownEditorBubbleLinkPopoverProps = {
  isOpen: boolean
  top: number
  left: number
  value: string
  selection: { from: number; to: number }
  autoFocus?: boolean
  onApplyPlan: (plan: PlannedTextMutation) => void
  onClose: () => void
}

export const MarkdownEditorBubbleLinkPopover = ({
  isOpen,
  top,
  left,
  value,
  selection,
  autoFocus = true,
  onApplyPlan,
  onClose,
}: MarkdownEditorBubbleLinkPopoverProps) => {
  const { language } = useLanguage()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectedText = value.slice(selection.from, selection.to)
  const existingLink = parseMarkdownLinkSelection(selectedText)
  const safeExistingHref = existingLink?.url ? normalizeSafeMarkdownLinkHref(existingLink.url) : ""
  const [urlInput, setUrlInput] = useState(existingLink?.url ?? "")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const nextLink = parseMarkdownLinkSelection(value.slice(selection.from, selection.to))
    setUrlInput(nextLink?.url ?? "")
    setErrorMessage(null)
    if (autoFocus) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [autoFocus, isOpen, selection.from, selection.to, value])

  if (!isOpen) return null

  const { top: clampedTop, left: clampedLeft } = clampBoxToVisualViewport(top + 48, left, 336, 96)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const applied = planBubbleLinkApply(value, selection, urlInput, language)
    if (!applied.ok) {
      setErrorMessage(applied.error)
      inputRef.current?.focus()
      return
    }
    onApplyPlan(applied.plan)
    onClose()
  }

  const handleRemoveLink = () => {
    const removal = planBubbleLinkRemove(value, selection)
    if (!removal) return
    onApplyPlan(removal)
    onClose()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <LinkPopoverSurface
      role="dialog"
      aria-label={editorT("linkDialogAria", language)}
      data-testid="markdown-bubble-link-popover"
      $top={clampedTop}
      $left={clampedLeft}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <LinkEditPill>
        <LinkUrlInput
          ref={inputRef}
          type="text"
          aria-label={editorT("linkUrlAria", language)}
          placeholder={editorT("linkUrlPlaceholder", language)}
          value={urlInput}
          onChange={(event) => {
            setUrlInput(event.currentTarget.value)
            if (errorMessage) setErrorMessage(null)
          }}
        />
        <LinkActionButton type="submit" $tone="primary" aria-label={editorT("linkApplyAria", language)}>
          <EditorIconCheck size={18} />
        </LinkActionButton>
        {safeExistingHref ? (
          <LinkOpenAnchor
            href={safeExistingHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="markdown-link-open-btn"
            aria-label={editorT("linkOpenAria", language)}
            title={editorT("linkOpenAria", language)}
          >
            {editorT("linkOpenLabel", language)}
          </LinkOpenAnchor>
        ) : null}
        {existingLink ? (
          <LinkActionButton
            type="button"
            $tone="danger"
            aria-label={editorT("linkRemoveAria", language)}
            title={editorT("linkRemoveAria", language)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleRemoveLink}
          >
            <EditorIconUnlink size={18} />
          </LinkActionButton>
        ) : null}
        <LinkActionButton
          type="button"
          aria-label={editorT("linkCloseAria", language)}
          title={editorT("closeLabel", language)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClose}
        >
          <EditorIconClose size={18} />
        </LinkActionButton>
      </LinkEditPill>
      {errorMessage ? <LinkErrorBanner role="alert">{errorMessage}</LinkErrorBanner> : null}
    </LinkPopoverSurface>
  )
}
