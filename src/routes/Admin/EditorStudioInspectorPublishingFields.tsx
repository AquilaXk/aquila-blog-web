import styled from "@emotion/styled"
import { useEffect } from "react"
import { useLanguage } from "src/libs/language"
import { adminT } from "./adminI18n"
import { adminStatusDangerText } from "./adminColorTokens"
import {
  CANONICAL_URL_MAX_LENGTH,
  SERIES_NAME_MAX_LENGTH,
  normalizeSafeCanonicalUrl,
} from "./editorStudioMetaModel"
import { toLocalDateTimeInputValue, fromLocalDateTimeInputValue } from "./useEditorStudioPublishingMetadata"
import { EditorInspectorTagInputRow, EditorSectionEyebrow, SecondaryButton } from "./EditorStudioDedicatedEditorSurfaceParts"

const PublishingFieldGroup = styled.div`
  display: grid;
  gap: 0.65rem;
`

const CompactRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 84px;
  gap: 0.45rem;
`

const FieldErrorText = styled.small`
  color: ${adminStatusDangerText};
`

type Props = {
  postVisibility: string
  postScheduledAt: string
  postSeriesName: string
  postSeriesOrder: number | null
  postCanonicalUrl: string
  seriesCatalog: string[]
  onScheduledAtChange: (value: string) => void
  onSeriesNameChange: (value: string) => void
  onSeriesOrderChange: (value: number | null) => void
  onCanonicalUrlChange: (value: string) => void
}

export const EditorStudioInspectorPublishingFields = ({
  postVisibility,
  postScheduledAt,
  postSeriesName,
  postSeriesOrder,
  postCanonicalUrl,
  seriesCatalog,
  onScheduledAtChange,
  onSeriesNameChange,
  onSeriesOrderChange,
  onCanonicalUrlChange,
}: Props) => {
  const { language } = useLanguage()
  const isPrivate = postVisibility === "PRIVATE"
  const isInvalidCanonical = Boolean(postCanonicalUrl.trim()) && !normalizeSafeCanonicalUrl(postCanonicalUrl)

  useEffect(() => {
    if (isPrivate && postScheduledAt.trim()) {
      onScheduledAtChange("")
    }
  }, [isPrivate, onScheduledAtChange, postScheduledAt])

  return (
    <PublishingFieldGroup data-testid="editor-inspector-publishing">
      <EditorSectionEyebrow aria-hidden="true">
        {adminT("editorSectionPublishingEyebrow", language)}
      </EditorSectionEyebrow>
      <label>
        <span>{adminT("editorScheduleInputLabel", language)}</span>
        <EditorInspectorTagInputRow>
          <input
            type="datetime-local"
            disabled={isPrivate}
            value={toLocalDateTimeInputValue(postScheduledAt)}
            onChange={(event) => onScheduledAtChange(fromLocalDateTimeInputValue(event.target.value))}
          />
          <SecondaryButton
            type="button"
            disabled={!postScheduledAt.trim()}
            onClick={() => onScheduledAtChange("")}
          >
            {adminT("editorScheduleClear", language)}
          </SecondaryButton>
        </EditorInspectorTagInputRow>
        {isPrivate ? <small>{adminT("editorSchedulePrivateHint", language)}</small> : null}
      </label>

      <label>
        <span>{adminT("editorSeriesNameLabel", language)}</span>
        <CompactRow>
          <input
            type="text"
            list="inspector-series-suggestions"
            maxLength={SERIES_NAME_MAX_LENGTH}
            placeholder={adminT("editorSeriesNamePlaceholder", language)}
            value={postSeriesName}
            onChange={(event) => onSeriesNameChange(event.target.value)}
          />
          <input
            type="number"
            min={1}
            step={1}
            aria-label={adminT("editorSeriesOrderLabel", language)}
            placeholder={adminT("editorSeriesOrderPlaceholder", language)}
            disabled={!postSeriesName.trim()}
            value={postSeriesOrder ?? ""}
            onChange={(event) => {
              const raw = event.target.value.trim()
              if (!raw) {
                onSeriesOrderChange(null)
                return
              }
              const parsed = Number(raw)
              if (Number.isFinite(parsed) && parsed >= 1) {
                onSeriesOrderChange(Math.trunc(parsed))
              }
            }}
          />
        </CompactRow>
        <datalist id="inspector-series-suggestions">
          {seriesCatalog.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>

      <label>
        <span>{adminT("editorCanonicalUrlLabel", language)}</span>
        <input
          type="url"
          maxLength={CANONICAL_URL_MAX_LENGTH}
          placeholder={adminT("editorCanonicalUrlPlaceholder", language)}
          value={postCanonicalUrl}
          onChange={(event) => onCanonicalUrlChange(event.target.value)}
        />
        {isInvalidCanonical ? (
          <FieldErrorText role="alert">{adminT("editorCanonicalUrlInvalid", language)}</FieldErrorText>
        ) : null}
      </label>
    </PublishingFieldGroup>
  )
}
