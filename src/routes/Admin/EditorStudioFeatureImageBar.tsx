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
import {
  adminBorder,
  adminBorderStrong,
  adminSurface,
  adminSurfaceMuted,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"
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
  margin-bottom: 16px;
`

const FeatureEmptyRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

const FeatureEyebrow = styled.span`
  font: 650 10.5px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${adminTextMuted};
`

const FeatureAddButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-block-size: 28px;
  padding: 0 9px;
  border-radius: 4px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextSecondary};
  font: 600 12px/1 var(--aq-font-sans);
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
      border-color: ${adminBorderStrong};
      background: ${adminSurfaceMuted};
      color: ${adminTextPrimary};
    }
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (pointer: coarse), (max-width: 768px) {
    min-block-size: 44px;
  }
`

const FeatureCoverCard = styled.figure`
  position: relative;
  margin: 0 0 8px;
  display: grid;
  gap: 8px;
`

const FeatureCoverHeroFrame = styled.div`
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceMuted};
`

const FeatureCoverHeroImage = styled.img`
  display: block;
  width: 100%;
  max-height: 292px;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: ${adminSurfaceMuted};
`

const FeatureCoverPlaceholder = styled.div`
  width: 100%;
  min-height: 132px;
  border-radius: 6px;
  background: ${adminSurfaceMuted};
  color: ${adminTextMuted};
  font: 650 12px/1.3 var(--aq-font-sans);
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

const FeatureCoverOverlayBar = styled.figcaption`
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  pointer-events: none;

  @media (hover: hover) {
    opacity: 0.92;
  }

  ${FeatureCoverCard}:hover &,
  ${FeatureCoverCard}:focus-within & {
    opacity: 1;
  }

  @media (max-width: 640px) {
    position: static;
    flex-wrap: wrap;
    pointer-events: auto;
  }
`

const FeatureCoverBadge = styled.span`
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid ${adminBorder};
  background: color-mix(in srgb, ${adminSurface} 92%, transparent);
  backdrop-filter: blur(8px);
  color: ${adminTextPrimary};
  font: 600 11px/1.2 var(--aq-font-sans);
  box-shadow: 0 2px 8px ${boxShadowColor.subtleHover};
`

const FeatureCoverDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.green9};
`

const FeatureCoverActions = styled.div`
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`

const FeatureCoverActionButton = styled.button<{ $tone?: "neutral" | "danger" }>`
  min-block-size: 28px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid
    ${({ theme, $tone }) =>
      $tone === "danger" ? theme.colors.red6 : adminBorderStrong};
  background: color-mix(in srgb, ${adminSurface} 94%, transparent);
  backdrop-filter: blur(8px);
  color: ${({ theme, $tone }) =>
    $tone === "danger" ? theme.colors.red11 : adminTextPrimary};
  font: 650 11.5px/1 var(--aq-font-sans);
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 2px 8px ${boxShadowColor.subtleHover};

  ${focusVisibleRing}

  &:hover:not(:disabled) {
    background: ${({ theme, $tone }) =>
      $tone === "danger" ? theme.colors.red2 : adminSurfaceMuted};
    color: ${({ theme, $tone }) =>
      $tone === "danger" ? theme.colors.red11 : adminTextPrimary};
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
        <FeatureEmptyRow>
          <FeatureEyebrow>{adminT("editorCoverEyebrow", language)}</FeatureEyebrow>
          <FeatureAddButton
            type="button"
            data-testid="editor-feature-image-add"
            disabled={isThumbnailUploading || isThumbnailUploadDisabled}
            onClick={onOpenThumbnailFileInput}
          >
            <EditorIconImage size={13} />
            <span>
              {isThumbnailUploading
                ? adminT("editorFeatureUploadingCover", language)
                : adminT("editorFeatureAddCover", language)}
            </span>
          </FeatureAddButton>
        </FeatureEmptyRow>
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
        <FeatureCoverOverlayBar>
          <FeatureCoverBadge>
            <FeatureCoverDot aria-hidden="true" />
            <span>{adminT("editorFeatureBadge", language)}</span>
          </FeatureCoverBadge>
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
        </FeatureCoverOverlayBar>
      </FeatureCoverCard>
    </FeatureImageWrap>
  )
}
