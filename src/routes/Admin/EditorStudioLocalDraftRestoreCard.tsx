import { useLanguage } from "src/libs/language"
import { adminT } from "./adminI18n"
import { LocalDraftRestoreCard, SecondaryButton } from "./EditorStudioDedicatedEditorSurfaceParts"

export type LocalDraftRestoreSuggestionProps = {
  visible: boolean
  disabled: boolean
  onRestore: () => void
  candidates: Array<{ key: string; label: string }>
  selectedKey: string
  onSelect: (key: string) => void
  onDiscard: () => void
  onClear: () => void
  onDismiss: () => void
}

export const LocalDraftRestoreSuggestion = ({
  visible,
  disabled,
  onRestore,
  candidates,
  selectedKey,
  onSelect,
  onDiscard,
  onClear,
  onDismiss,
}: LocalDraftRestoreSuggestionProps) => {
  const { language } = useLanguage()
  if (!visible) return null
  return (
    <LocalDraftRestoreCard role="status" aria-live="polite">
      <div className="card-header">
        <span>{adminT("editorDraftBannerTitle", language)}</span>
      </div>
      <select
        aria-label={adminT("editorDraftSelectAria", language)}
        disabled={disabled}
        value={selectedKey}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">{adminT("editorDraftSelectPlaceholder", language)}</option>
        {candidates.map((candidate) => (
          <option key={candidate.key} value={candidate.key}>
            {candidate.label}
          </option>
        ))}
      </select>
      <div className="card-actions">
        <SecondaryButton
          type="button"
          disabled={disabled || !selectedKey}
          onClick={onRestore}
        >
          {adminT("editorDraftRestore", language)}
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={disabled || !selectedKey}
          onClick={selectedKey ? onDiscard : onClear}
        >
          {adminT("editorDraftDelete", language)}
        </SecondaryButton>
        <SecondaryButton type="button" disabled={disabled} onClick={onDismiss}>
          {adminT("editorDraftDismiss", language)}
        </SecondaryButton>
      </div>
    </LocalDraftRestoreCard>
  )
}
