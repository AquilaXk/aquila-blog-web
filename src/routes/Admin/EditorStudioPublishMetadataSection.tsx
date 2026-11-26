import styled from "@emotion/styled"
import { useEffect, useState } from "react"
import { useLanguage } from "src/libs/language"
import { adminT } from "./adminI18n"
import {
  adminBorder,
  adminBorderSubtle,
  adminFocusRing,
  adminStatusDangerText,
  adminSurface,
  adminSurfaceMuted,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"
import {
  CANONICAL_URL_MAX_LENGTH,
  SERIES_NAME_MAX_LENGTH,
  normalizeSafeCanonicalUrl,
} from "./editorStudioMetaModel"
import {
  fromLocalDateTimeInputValue,
  isScheduleTimestampValid,
  toLocalDateTimeInputValue,
} from "./useEditorStudioPublishingMetadata"
import { SectionKicker, FieldHelp } from "./EditorStudioPublishModalStyles"
import type { PostVisibility } from "./editorStudioState"

const MetadataSection = styled.section`
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem 0;
  border-top: 1px solid ${adminBorderSubtle};
  border-bottom: 1px solid ${adminBorderSubtle};
`

const TwoColRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 0.6rem;

  @media (max-width: 600px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const FieldBlock = styled.label`
  display: grid;
  gap: 0.32rem;
  min-width: 0;

  > span {
    font-size: 0.76rem;
    font-weight: 600;
    color: ${adminTextSecondary};
  }

  input {
    width: 100%;
    min-height: 36px;
    padding: 0.42rem 0.65rem;
    border-radius: 7px;
    border: 1px solid ${adminBorder};
    background: ${adminSurface};
    color: ${adminTextPrimary};
    font-size: 0.84rem;
    outline: none;

    &:focus {
      box-shadow: ${({ theme }) => adminFocusRing(theme)};
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    @media (pointer: coarse) {
      min-height: 44px;
      font-size: 1rem;
    }
  }
`

const ScheduleModeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
`

const ScheduleChoiceButton = styled.button<{ $active: boolean }>`
  min-height: 34px;
  padding: 0.35rem 0.75rem;
  border-radius: 7px;
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.accentBorder : adminBorder)};
  background: ${({ $active }) => ($active ? adminSurfaceMuted : adminSurface)};
  color: ${adminTextPrimary};
  font-size: 0.78rem;
  font-weight: ${({ $active }) => ($active ? 650 : 500)};
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

const ScheduleInputRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;

  input {
    flex: 1 1 220px;
    min-height: 36px;
    padding: 0.42rem 0.65rem;
    border-radius: 7px;
    border: 1px solid ${adminBorder};
    background: ${adminSurface};
    color: ${adminTextPrimary};
    font-size: 0.84rem;

    @media (pointer: coarse) {
      min-height: 44px;
      font-size: 1rem;
    }
  }
`

const ValidationAlert = styled.p`
  margin: 0;
  font-size: 0.76rem;
  font-weight: 550;
  color: ${adminStatusDangerText};
`

type Props = {
  postVisibility: PostVisibility
  postScheduledAt: string
  postSeriesName: string
  postSeriesOrder: number | null
  postCanonicalUrl: string
  seriesCatalog: string[]
  onScheduledAtChange: (nextIso: string) => void
  onSeriesNameChange: (nextName: string) => void
  onSeriesOrderChange: (nextOrder: number | null) => void
  onCanonicalUrlChange: (nextUrl: string) => void
}

export const EditorStudioPublishMetadataSection = ({
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
  const [clientMinLocal, setClientMinLocal] = useState("")
  const isPrivate = postVisibility === "PRIVATE"
  const isScheduled = Boolean(postScheduledAt.trim()) && !isPrivate

  useEffect(() => {
    setClientMinLocal(toLocalDateTimeInputValue(new Date().toISOString()))
  }, [])

  const localInputValue = toLocalDateTimeInputValue(postScheduledAt)
  const isPastSchedule = Boolean(postScheduledAt.trim()) && !isScheduleTimestampValid(postScheduledAt)
  const isInvalidCanonical = Boolean(postCanonicalUrl.trim()) && !normalizeSafeCanonicalUrl(postCanonicalUrl)

  return (
    <MetadataSection data-testid="publish-metadata-section">
      <SectionKicker>{adminT("editorScheduleLabel", language)}</SectionKicker>
      <ScheduleModeRow>
        <ScheduleChoiceButton
          type="button"
          $active={!isScheduled}
          aria-pressed={!isScheduled}
          onClick={() => onScheduledAtChange("")}
        >
          {adminT("editorScheduleNow", language)}
        </ScheduleChoiceButton>
        <ScheduleChoiceButton
          type="button"
          $active={isScheduled}
          aria-pressed={isScheduled}
          disabled={isPrivate}
          data-testid="publish-schedule-toggle"
          onClick={() => {
            if (isPrivate) return
            if (!postScheduledAt.trim()) {
              const defaultFuture = new Date(Date.now() + 60 * 60 * 1000).toISOString()
              onScheduledAtChange(defaultFuture)
            }
          }}
        >
          {adminT("editorScheduleLater", language)}
        </ScheduleChoiceButton>
      </ScheduleModeRow>

      {isPrivate ? (
        <FieldHelp>{adminT("editorSchedulePrivateHint", language)}</FieldHelp>
      ) : isScheduled ? (
        <ScheduleInputRow>
          <input
            type="datetime-local"
            aria-label={adminT("editorScheduleInputLabel", language)}
            data-testid="publish-schedule-input"
            value={localInputValue}
            min={clientMinLocal || undefined}
            onChange={(event) => onScheduledAtChange(fromLocalDateTimeInputValue(event.target.value))}
          />
          <ScheduleChoiceButton
            type="button"
            $active={false}
            onClick={() => onScheduledAtChange("")}
          >
            {adminT("editorScheduleClear", language)}
          </ScheduleChoiceButton>
        </ScheduleInputRow>
      ) : null}

      {isPastSchedule ? (
        <ValidationAlert role="alert">{adminT("editorSchedulePastError", language)}</ValidationAlert>
      ) : null}

      <TwoColRow>
        <FieldBlock>
          <span>{adminT("editorSeriesNameLabel", language)}</span>
          <input
            type="text"
            list="publish-series-suggestions"
            maxLength={SERIES_NAME_MAX_LENGTH}
            placeholder={adminT("editorSeriesNamePlaceholder", language)}
            data-testid="publish-series-name-input"
            value={postSeriesName}
            onChange={(event) => onSeriesNameChange(event.target.value)}
          />
          <datalist id="publish-series-suggestions">
            {seriesCatalog.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </FieldBlock>
        <FieldBlock>
          <span>{adminT("editorSeriesOrderLabel", language)}</span>
          <input
            type="number"
            min={1}
            step={1}
            placeholder={adminT("editorSeriesOrderPlaceholder", language)}
            data-testid="publish-series-order-input"
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
        </FieldBlock>
      </TwoColRow>

      <FieldBlock>
        <span>{adminT("editorCanonicalUrlLabel", language)}</span>
        <input
          type="url"
          maxLength={CANONICAL_URL_MAX_LENGTH}
          placeholder={adminT("editorCanonicalUrlPlaceholder", language)}
          data-testid="publish-canonical-url-input"
          value={postCanonicalUrl}
          onChange={(event) => onCanonicalUrlChange(event.target.value)}
        />
      </FieldBlock>
      {isInvalidCanonical ? (
        <ValidationAlert role="alert">{adminT("editorCanonicalUrlInvalid", language)}</ValidationAlert>
      ) : null}
    </MetadataSection>
  )
}
