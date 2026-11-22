/**
 * 참조 구현:
 * - codemirror/search src/search.ts SearchPanel (.cm-panel.cm-search, MIT License, Copyright (c) Marijn Haverbeke)
 */
import { useEffect, useRef } from "react"
import { useLanguage } from "../../libs/language"
import { editorT } from "./markdownEditorI18n"
import { EditorIconClose } from "./MarkdownEditorIcons"
import {
  FindReplaceCheckbox,
  FindReplaceCloseButton,
  FindReplaceInput,
  FindReplaceRegion,
  FindReplaceRow,
  FindReplaceStatus,
} from "./MarkdownEditorFindReplace.styles"

type MarkdownEditorFindReplaceProps = {
  query: string
  replacement: string
  caseSensitive: boolean
  scopeLabel: string
  currentMatch: number
  totalMatches: number
  disabled?: boolean
  replaceCurrentDisabled?: boolean
  onQueryChange: (value: string) => void
  onReplacementChange: (value: string) => void
  onCaseSensitiveChange: (checked: boolean) => void
  onPrevious: () => void
  onNext: () => void
  onReplaceCurrent: () => void
  onReplaceAll: () => void
  onClose: () => void
}

export const MarkdownEditorFindReplace = ({
  query,
  replacement,
  caseSensitive,
  scopeLabel,
  currentMatch,
  totalMatches,
  disabled = false,
  replaceCurrentDisabled = false,
  onQueryChange,
  onReplacementChange,
  onCaseSensitiveChange,
  onPrevious,
  onNext,
  onReplaceCurrent,
  onReplaceAll,
  onClose,
}: MarkdownEditorFindReplaceProps) => {
  const { language } = useLanguage()
  const queryInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (disabled) return
    queryInputRef.current?.focus()
    queryInputRef.current?.select()
  }, [disabled])

  return (
    <FindReplaceRegion
      className="cm-panel cm-search"
      data-testid="markdown-editor-find-replace"
      aria-label={editorT("findReplaceAria", language)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <FindReplaceRow>
        <FindReplaceInput
          ref={queryInputRef}
          className="cm-textfield"
          name="search"
          aria-label={editorT("findQueryPlaceholder", language)}
          placeholder={editorT("findQueryPlaceholder", language)}
          disabled={disabled}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault()
              if (!disabled && totalMatches > 0) {
                const input = event.currentTarget
                if (event.shiftKey) onPrevious()
                else onNext()
                input.focus()
              }
            }
          }}
          value={query}
        />
        <button className="cm-button" name="next" disabled={disabled || totalMatches === 0} onClick={onNext} type="button">
          {editorT("findNext", language)}
        </button>
        <button className="cm-button" name="prev" disabled={disabled || totalMatches === 0} onClick={onPrevious} type="button">
          {editorT("findPrev", language)}
        </button>
        <FindReplaceCheckbox>
          <input
            name="case"
            checked={caseSensitive}
            disabled={disabled}
            onChange={(event) => onCaseSensitiveChange(event.currentTarget.checked)}
            type="checkbox"
          />
          {editorT("findCaseSensitive", language)}
        </FindReplaceCheckbox>
        <FindReplaceStatus role="status">{`${scopeLabel} · ${currentMatch} / ${totalMatches}`}</FindReplaceStatus>
      </FindReplaceRow>

      <FindReplaceRow>
        <FindReplaceInput
          className="cm-textfield"
          name="replace"
          aria-label={editorT("replacePlaceholder", language)}
          placeholder={editorT("replacePlaceholder", language)}
          disabled={disabled}
          onChange={(event) => onReplacementChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault()
              if (!disabled && !replaceCurrentDisabled) {
                const input = event.currentTarget
                onReplaceCurrent()
                input.focus()
              }
            }
          }}
          value={replacement}
        />
        <button className="cm-button" name="replace" disabled={disabled || replaceCurrentDisabled} onClick={onReplaceCurrent} type="button">
          {editorT("replaceCurrent", language)}
        </button>
        <button className="cm-button" name="replaceAll" disabled={disabled || totalMatches === 0} onClick={onReplaceAll} type="button">
          {editorT("replaceAll", language)}
        </button>
      </FindReplaceRow>

      <FindReplaceCloseButton name="close" aria-label={editorT("closeLabel", language)} onClick={onClose} type="button">
        <EditorIconClose size={14} />
      </FindReplaceCloseButton>
    </FindReplaceRegion>
  )
}
