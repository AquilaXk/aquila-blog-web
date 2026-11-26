/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetDetailsDrawer.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 */
/* eslint-disable @next/next/no-img-element */
import styled from "@emotion/styled"
import { useEffect, useId, useRef, useState } from "react"
import {
  getCloudFileDownloadUrl,
  promoteCloudFileToPostAsset,
  type CloudFile,
} from "src/apis/backend/cloud"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import { useLanguage } from "src/libs/language"
import {
  adminFloatingShadow,
  adminSurfaceMuted,
  adminTextMuted,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
import AppIcon from "./AdminAppIcon"
import { AdminCloudMediaLightbox } from "./AdminCloudMediaLightbox"
import { PreviewDrawer } from "./AdminCloudPreviewDrawer"
import {
  DetailEditField,
  DetailEditForm,
  DetailEditInput,
  DetailHeader,
  DetailMetaGrid,
  DetailMetaItem,
  DetailPanel as BaseDetailPanel,
  DetailPreviewBox,
  DetailScrim,
  DrawerBody,
  DrawerFooter,
  DrawerFooterActions,
  DrawerIconLink,
  DrawerSectionHeading,
  IconButton,
  PrimaryButton,
  SecondaryButton,
} from "./AdminCloudWorkspace.styles"
import {
  PLAYBACK_SPEEDS,
  formatCloudDate,
  formatCloudFileSize,
  getCloudKindBadge,
  isImageCloudFile,
  normalizeCloudFolderPathSearch,
  type CloudAssetDimensions,
} from "./AdminCloudWorkspaceModel"
import {
  StrapiArrowLineRightIcon,
  StrapiDownloadIcon,
  StrapiFileCodeIcon,
  StrapiLinkIcon,
  StrapiTrashIcon,
  getStrapiAssetIcon,
} from "./adminStrapiIcons"
import { getCloudFilePostPromotionEligibility } from "./EditorStudioCloudAssetPicker"
import { CloudInspectorVideoSection } from "./cloud/CloudInspectorVideoSection"
import { getCloudDictionary } from "./cloud/adminCloudI18n"

export type CloudFileDetailDrawerProps = {
  detailMode: "drawer" | "inline"
  isDeleteConfirmOpen?: boolean
  isLightboxOpen?: boolean
  onClose: () => void
  onCopyFileLink: (file: CloudFile) => Promise<void>
  onOpenLightbox?: (fileId: number) => void
  onOpenShareModal?: (file: CloudFile) => void
  onRequestDeleteFile: (file: CloudFile) => void
  onUpdateFile: (
    fileId: number,
    payload: { originalFilename: string; folderPath: string }
  ) => Promise<boolean>
  selectedFile: CloudFile | null
  onToast?: (toast: { tone: "success" | "error"; text: string }) => void
}

export const CloudFileDetailDrawer = ({
  detailMode,
  isDeleteConfirmOpen = false,
  isLightboxOpen = false,
  onClose,
  onCopyFileLink,
  onOpenLightbox,
  onOpenShareModal,
  onRequestDeleteFile,
  onUpdateFile,
  selectedFile,
  onToast,
}: CloudFileDetailDrawerProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const isEn = language === "en"
  const editFormId = useId()
  const normalizedOriginalFolder = normalizeCloudFolderPathSearch(selectedFile?.folderPath || "")

  const [draftFilename, setDraftFilename] = useState(selectedFile?.originalFilename || "")
  const [draftFolderPath, setDraftFolderPath] = useState(normalizedOriginalFolder)
  const [dimensions, setDimensions] = useState<CloudAssetDimensions | null>(null)
  const [isUpdatePending, setIsUpdatePending] = useState(false)
  const [isPromoting, setIsPromoting] = useState(false)
  const [fallbackLightboxOpen, setFallbackLightboxOpen] = useState(false)
  const [videoSpeed, setVideoSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1)

  const detailPanelRef = useRef<HTMLElement | null>(null)
  const isDrawerMode = detailMode === "drawer"
  const effectiveLightboxOpen = isLightboxOpen || fallbackLightboxOpen

  useEffect(() => {
    setDraftFilename(selectedFile?.originalFilename || "")
    setDraftFolderPath(normalizeCloudFolderPathSearch(selectedFile?.folderPath || ""))
  }, [selectedFile?.folderPath, selectedFile?.id, selectedFile?.originalFilename])

  useEffect(() => {
    setDimensions(null)
    setFallbackLightboxOpen(false)
    setVideoSpeed(1)
  }, [selectedFile?.id])

  const { handleKeyDown } = useModalFocusTrap({
    open: isDrawerMode && selectedFile !== null,
    paused: isDeleteConfirmOpen || effectiveLightboxOpen,
    onClose,
    containerRef: detailPanelRef,
  })

  if (!selectedFile) {
    if (isDrawerMode) return null
    return (
      <InspectorPanel
        ref={detailPanelRef}
        aria-label={isEn ? "Cloud details" : "클라우드 상세정보"}
        data-mode="inline"
      >
        <DetailHeader>
          <h2>{t.inspectorIdleTitle}</h2>
        </DetailHeader>
        <DrawerBody>
          <IdleHintCard>
            <AppIcon name="info" />
            <p>{t.inspectorIdleHint}</p>
          </IdleHintCard>
        </DrawerBody>
      </InspectorPanel>
    )
  }

  const isImage = isImageCloudFile(selectedFile)
  const DocIcon = getStrapiAssetIcon(selectedFile.contentType, selectedFile.originalFilename)
  const promotionEligibility = getCloudFilePostPromotionEligibility(selectedFile, language)
  const normalizedDraftFolder = normalizeCloudFolderPathSearch(draftFolderPath)
  const trimmedFilename = draftFilename.trim()
  const isModified =
    trimmedFilename !== selectedFile.originalFilename ||
    normalizedDraftFolder !== normalizedOriginalFolder

  const handleOpenExpand = () => {
    if (onOpenLightbox) onOpenLightbox(selectedFile.id)
    else setFallbackLightboxOpen(true)
  }

  const handleCopyMarkdown = async () => {
    if (!promotionEligibility.promotable) {
      onToast?.({ tone: "error", text: promotionEligibility.reason })
      return
    }
    setIsPromoting(true)
    try {
      const res = await promoteCloudFileToPostAsset(selectedFile.id)
      const promotedUrl = res.url?.trim() || ""
      const markdown =
        res.markdown?.trim() ||
        (promotedUrl ? `![${selectedFile.originalFilename}](${promotedUrl})` : "")
      if (!markdown) {
        throw new Error(
          isEn
            ? "Failed to create markdown image snippet."
            : "공개 포스트 에셋 마크다운을 생성하지 못했습니다."
        )
      }
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error(
          isEn
            ? "Clipboard permission is required to copy markdown."
            : "클립보드 접근 권한이 없어 마크다운 태그를 복사하지 못했습니다."
        )
      }
      await navigator.clipboard.writeText(markdown)
      onToast?.({
        tone: "success",
        text: isEn ? "Copied markdown image tag." : "마크다운 태그를 복사했습니다.",
      })
    } catch (err) {
      onToast?.({ tone: "error", text: toUserFacingMessage(err) })
    } finally {
      setIsPromoting(false)
    }
  }

  return (
    <>
      {isDrawerMode ? (
        <DetailScrim
          type="button"
          aria-label={isEn ? "Close details panel" : "상세 패널 닫기"}
          data-mode={detailMode}
          onClick={onClose}
        />
      ) : null}
      <InspectorPanel
        ref={detailPanelRef}
        role={isDrawerMode ? "dialog" : undefined}
        aria-modal={isDrawerMode ? "true" : undefined}
        aria-label={isEn ? "Cloud details" : "클라우드 상세정보"}
        data-mode={detailMode}
        onKeyDown={handleKeyDown}
      >
        <DetailHeader>
          <InspectorTitleRow>
            <TitleIconSlot aria-hidden="true">
              <DocIcon width={20} height={20} />
            </TitleIconSlot>
            <h2 title={selectedFile.originalFilename}>{selectedFile.originalFilename}</h2>
          </InspectorTitleRow>
          <IconButton
            type="button"
            aria-label={isEn ? "Close details panel" : "상세 패널 닫기"}
            onClick={onClose}
          >
            <StrapiArrowLineRightIcon width={18} height={18} />
          </IconButton>
        </DetailHeader>

        <DrawerBody>
          <DetailPreviewBox>
            <PreviewDrawer
              file={selectedFile}
              onRequestExpand={handleOpenExpand}
              onDimensionsChange={setDimensions}
              videoPlaybackSpeed={videoSpeed}
            />
          </DetailPreviewBox>

          <ShareActionStrip>
            <SecondaryButton
              type="button"
              onClick={() =>
                onOpenShareModal
                  ? onOpenShareModal(selectedFile)
                  : void onCopyFileLink(selectedFile)
              }
            >
              <StrapiLinkIcon width={14} height={14} />
              <span>{t.actionShare}</span>
            </SecondaryButton>
          </ShareActionStrip>

          <div>
            <DrawerSectionHeading>{t.inspectorMetadataTitle}</DrawerSectionHeading>
            <DetailMetaGrid>
              <DetailMetaItem>
                <dt>{t.inspectorModified}</dt>
                <dd>{formatCloudDate(selectedFile.modifiedAt || selectedFile.createdAt, language)}</dd>
              </DetailMetaItem>
              <DetailMetaItem>
                <dt>{t.inspectorSize}</dt>
                <dd>{formatCloudFileSize(selectedFile.byteSize)}</dd>
              </DetailMetaItem>
              {isImage && dimensions ? (
                <DetailMetaItem>
                  <dt>{t.inspectorDimensions}</dt>
                  <dd>{`${dimensions.width} × ${dimensions.height}`}</dd>
                </DetailMetaItem>
              ) : null}
              <DetailMetaItem>
                <dt>{isEn ? "Extension" : "확장자"}</dt>
                <dd>{getCloudKindBadge(selectedFile)}</dd>
              </DetailMetaItem>
              <DetailMetaItem>
                <dt>
                  <span aria-hidden="true">
                    <AppIcon name="lock" />
                  </span>
                  {isEn ? "Access" : "권한"}
                </dt>
                <dd>{isEn ? "Owner only (private)" : "계정 소유주만 볼 수 있음"}</dd>
              </DetailMetaItem>
            </DetailMetaGrid>
          </div>

          <DetailEditForm
            id={editFormId}
            key={selectedFile.id}
            onSubmit={(event) => {
              event.preventDefault()
              if (!isModified || isUpdatePending || !trimmedFilename) return
              setIsUpdatePending(true)
              void onUpdateFile(selectedFile.id, {
                originalFilename: trimmedFilename,
                folderPath: normalizedDraftFolder,
              }).finally(() => setIsUpdatePending(false))
            }}
          >
            <DetailEditField>
              <span>{isEn ? "Filename" : "파일 이름"}</span>
              <DetailEditInput
                aria-label={isEn ? "Edit filename" : "파일 이름 수정"}
                value={draftFilename}
                onChange={(event) => setDraftFilename(event.target.value)}
              />
            </DetailEditField>
            <DetailEditField>
              <span>
                <AppIcon name="folder" />
                {t.inspectorFolder}
              </span>
              <DetailEditInput
                aria-label={isEn ? "Edit folder path" : "폴더 경로 수정"}
                placeholder={isEn ? "e.g. 2026 Seminars/Notes" : "예: 2026 세미나/발표"}
                value={draftFolderPath}
                onChange={(event) => setDraftFolderPath(event.target.value)}
              />
            </DetailEditField>
          </DetailEditForm>

          {selectedFile.mediaKind === "VIDEO" ? (
            <CloudInspectorVideoSection
              fileId={selectedFile.id}
              videoSpeed={videoSpeed}
              onChangeVideoSpeed={setVideoSpeed}
              onToast={onToast}
            />
          ) : null}
        </DrawerBody>

        <DrawerFooter>
          <DrawerFooterActions>
            <IconButton
              type="button"
              aria-label={isEn ? "Delete file" : "파일 삭제"}
              onClick={() => onRequestDeleteFile(selectedFile)}
            >
              <StrapiTrashIcon width={18} height={18} />
            </IconButton>
            <IconButton
              type="button"
              aria-label={t.shareCopyInternalPath}
              onClick={() => void onCopyFileLink(selectedFile)}
            >
              <StrapiLinkIcon width={18} height={18} />
            </IconButton>
            <DrawerIconLink
              aria-label={t.actionDownload}
              href={getCloudFileDownloadUrl(selectedFile.id)}
              download={selectedFile.originalFilename}
            >
              <StrapiDownloadIcon width={18} height={18} />
            </DrawerIconLink>
            {isImage ? (
              <IconButton
                type="button"
                aria-label={isEn ? "Copy post markdown" : "마크다운 복사"}
                title={promotionEligibility.reason || undefined}
                disabled={isPromoting || !promotionEligibility.promotable}
                onClick={() => void handleCopyMarkdown()}
              >
                <StrapiFileCodeIcon width={18} height={18} />
              </IconButton>
            ) : null}
          </DrawerFooterActions>

          <PrimaryButton
            type="submit"
            form={editFormId}
            disabled={!isModified || isUpdatePending || !trimmedFilename}
          >
            {t.renameConfirm}
          </PrimaryButton>
        </DrawerFooter>
      </InspectorPanel>

      {!onOpenLightbox && fallbackLightboxOpen ? (
        <AdminCloudMediaLightbox
          open={fallbackLightboxOpen}
          file={selectedFile}
          files={[selectedFile]}
          onClose={() => setFallbackLightboxOpen(false)}
          onCopyFileLink={onCopyFileLink}
        />
      ) : null}
    </>
  )
}

const InspectorPanel = styled(BaseDetailPanel)`
  overscroll-behavior: contain;

  &[data-mode="drawer"] {
    box-shadow: ${adminFloatingShadow};
  }
`

const IdleHintCard = styled.div`
  display: grid;
  gap: 0.6rem;
  padding: 1rem;
  border-radius: 10px;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  font-size: 0.8rem;
  line-height: 1.55;
  svg {
    width: 18px;
    height: 18px;
    color: ${adminTextMuted};
  }
  p {
    margin: 0;
  }
`

const ShareActionStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
`

const InspectorTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1 1 auto;
`

const TitleIconSlot = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${adminTextSecondary};
`
