/**
 * 참조 구현:
 * - TryGhost/Koenig packages/koenig-lexical/src/components/ui/FeatureImage (MIT License, Copyright (c) Ghost Foundation)
 * - TryGhost/Ghost apps/admin/src/editor/feature-image.tsx (MIT License, Copyright (c) Ghost Foundation)
 */
import { useEffect, useState } from "react"
import styled from "@emotion/styled"
import { EditorIconImage } from "src/components/markdown-editor/MarkdownEditorIcons"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor } from "src/design-system/tokens"
import { useLanguage } from "src/libs/language"
import { adminT } from "./adminI18n"
import { adminBorder, adminSurfaceMuted, adminTextPrimary } from "./adminColorTokens"
import { normalizeSafePreviewThumbnailUrl } from "./editorStudioMetaModel"

export type EditorStudioFeatureImageBarProps = {
  postThumbnailUrl?: string
  safePreviewThumbnail?: string
  isThumbnailUploading?: boolean
  isThumbnailUploadDisabled?: boolean
  onOpenThumbnailFileInput?: () => void
  onResetThumbnailToAutoMode?: () => void
}

const FeatureImageWrap = styled.div`
  margin-bottom: 14px;
`

const FeatureAddButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-block-size: 30px;
  padding: 0 10px;
  margin-left: -10px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray10};
  font: 600 13px/1 var(--aq-font-sans);
  cursor: pointer;

  ${focusVisibleRing}

  @media (prefers-reduced-motion: no-preference) {
    transition:
      background-color 0.16s ease,
      border-color 0.16s ease,
      color 0.16s ease;
  }

  @media (hover: hover) {
    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.publicDesign.border};
      background: ${({ theme }) => theme.publicDesign.surfaceElevated};
      color: ${({ theme }) => theme.colors.gray12};
    }
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (pointer: coarse), (max-width: 768px) {
    margin-left: 0;
    min-block-size: 44px;
    border-color: ${({ theme }) => theme.publicDesign.border};
  }
`

const FeatureCoverCard = styled.figure`
  margin: 0 0 8px;
  display: grid;
  gap: 10px;
`

const FeatureCoverHeroFrame = styled.div`
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  box-shadow: 0 8px 24px ${boxShadowColor.cardSubtle};
`

const FeatureCoverHeroImage = styled.img`
  display: block;
  width: 100%;
  max-height: 292px;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: ${({ theme }) => theme.publicDesign.surfaceElevated};
`

const FeatureCoverPlaceholder = styled.div`
  width: 100%;
  min-height: 132px;
  border-radius: 12px;
  background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  color: ${({ theme }) => theme.colors.gray10};
  font: 650 12px/1.3 var(--aq-font-sans);
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

const FeatureCoverCaptionBar = styled.figcaption`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;

  @media (max-width: 640px) {
    flex-wrap: wrap;
    gap: 8px;
  }
`

const FeatureCoverMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

const FeatureCoverBadge = styled.span`
  display: inline-flex;
  align-items: center;
  width: max-content;
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceMuted};
  color: ${adminTextPrimary};
  font: 600 10.5px/1.2 var(--aq-font-sans);
`

const FeatureCoverUrlCaption = styled.span`
  font: 500 11.5px/1.25 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: ${({ theme }) => theme.colors.gray10};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 340px;
`

const FeatureCoverActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`

const FeatureCoverActionButton = styled.button<{ $tone?: "neutral" | "danger" }>`
  min-block-size: 30px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid
    ${({ theme, $tone }) =>
      $tone === "danger" ? theme.colors.red6 : theme.publicDesign.borderStrong};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme, $tone }) =>
    $tone === "danger" ? theme.colors.red11 : theme.colors.gray11};
  font: 650 12px/1 var(--aq-font-sans);
  white-space: nowrap;
  cursor: pointer;

  ${focusVisibleRing}

  &:hover:not(:disabled) {
    background: ${({ theme, $tone }) =>
      $tone === "danger" ? theme.colors.red2 : theme.colors.gray3};
    color: ${({ theme, $tone }) =>
      $tone === "danger" ? theme.colors.red11 : theme.colors.gray12};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (pointer: coarse), (max-width: 768px) {
    min-block-size: 44px;
  }
`

export const EditorStudioFeatureImageBar = ({
  postThumbnailUrl = "",
  safePreviewThumbnail = "",
  isThumbnailUploading = false,
  isThumbnailUploadDisabled = false,
  onOpenThumbnailFileInput,
  onResetThumbnailToAutoMode,
}: EditorStudioFeatureImageBarProps) => {
  const { language } = useLanguage()
  const manualUrl = postThumbnailUrl.trim()
  const resolvedPreviewSrc =
    normalizeSafePreviewThumbnailUrl(safePreviewThumbnail) ||
    normalizeSafePreviewThumbnailUrl(manualUrl)
  const [isImageBroken, setIsImageBroken] = useState(false)

  useEffect(() => {
    setIsImageBroken(false)
  }, [resolvedPreviewSrc])

  if (!onOpenThumbnailFileInput && !manualUrl) {
    return null
  }

  if (!manualUrl) {
    return (
      <FeatureImageWrap>
        <FeatureAddButton
          type="button"
          data-testid="editor-feature-image-add"
          disabled={isThumbnailUploading || isThumbnailUploadDisabled}
          onClick={onOpenThumbnailFileInput}
        >
          <EditorIconImage size={14} />
          <span>
            {isThumbnailUploading
              ? adminT("editorFeatureUploadingCover", language)
              : adminT("editorFeatureAddCover", language)}
          </span>
        </FeatureAddButton>
      </FeatureImageWrap>
    )
  }

  return (
    <FeatureImageWrap>
      <FeatureCoverCard data-testid="editor-feature-image-card">
        <FeatureCoverHeroFrame>
          {resolvedPreviewSrc && !isImageBroken ? (
            <FeatureCoverHeroImage
              src={resolvedPreviewSrc}
              alt={adminT("editorFeaturePreviewAlt", language)}
              loading="lazy"
              onError={() => setIsImageBroken(true)}
            />
          ) : (
            <FeatureCoverPlaceholder aria-hidden="true">
              {adminT("editorFeatureNoImage", language)}
            </FeatureCoverPlaceholder>
          )}
        </FeatureCoverHeroFrame>
        <FeatureCoverCaptionBar>
          <FeatureCoverMeta>
            <FeatureCoverBadge>{adminT("editorFeatureBadge", language)}</FeatureCoverBadge>
            <FeatureCoverUrlCaption title={manualUrl}>{manualUrl}</FeatureCoverUrlCaption>
          </FeatureCoverMeta>
          <FeatureCoverActions>
            {onOpenThumbnailFileInput ? (
              <FeatureCoverActionButton
                type="button"
                disabled={isThumbnailUploading || isThumbnailUploadDisabled}
                onClick={onOpenThumbnailFileInput}
              >
                {isThumbnailUploading
                  ? adminT("editorFeatureUploadingShort", language)
                  : adminT("editorFeatureChangeImage", language)}
              </FeatureCoverActionButton>
            ) : null}
            {onResetThumbnailToAutoMode ? (
              <FeatureCoverActionButton
                type="button"
                $tone="danger"
                disabled={isThumbnailUploading}
                onClick={onResetThumbnailToAutoMode}
              >
                {adminT("editorFeatureResetAuto", language)}
              </FeatureCoverActionButton>
            ) : null}
          </FeatureCoverActions>
        </FeatureCoverCaptionBar>
      </FeatureCoverCard>
    </FeatureImageWrap>
  )
}
