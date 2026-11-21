/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetDetailsDrawer.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 */
/* eslint-disable @next/next/no-img-element */
import styled from "@emotion/styled"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import {
  getCloudFileDownloadUrl,
  issueCloudExternalPlaybackToken,
  listCloudExternalPlaybackTokens,
  promoteCloudFileToPostAsset,
  revokeAllCloudExternalPlaybackTokens,
  revokeCloudExternalPlaybackToken,
  type CloudFile,
} from "src/apis/backend/cloud"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import AppIcon from "./AdminAppIcon"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import {
  adminFloatingShadow,
  adminSurfaceMuted,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
import { AdminCloudMediaLightbox } from "./AdminCloudMediaLightbox"
import { PreviewDrawer, resolveCloudErrorMessage } from "./AdminCloudPreviewDrawer"
import {
  ActionGroup,
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
  FilterGroup,
  GhostButton,
  IconButton,
  PlayerBar,
  PreviewInlineStatusList,
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

type ExternalPlaybackPlayer = "iina" | "mpv"
type ExternalPlaybackCommandState = { status: "pending" | "success" | "error"; message: string }

const EXTERNAL_PLAYBACK_PLAYER_LABELS: Record<ExternalPlaybackPlayer, string> = {
  iina: "IINA",
  mpv: "mpv",
}

const quoteShellArg = (value: string) => `"${value.replace(/(["\\$`])/g, String.raw`\$1`)}"`

const buildExternalPlaybackCommand = (player: ExternalPlaybackPlayer, contentUrl: string) =>
  `${player} ${quoteShellArg(contentUrl)}`

const copyCommandWithClipboardOrPrompt = async (
  command: string,
  playerLabel: string,
  isStaleRequest: () => boolean,
  onState: (state: ExternalPlaybackCommandState) => void
) => {
  const showManualCopyPrompt = () => {
    if (isStaleRequest() || typeof window === "undefined") return false
    window.prompt("명령을 복사하세요.", command)
    if (!isStaleRequest()) {
      onState({ status: "success", message: `${playerLabel} 명령을 표시했습니다. 6시간 동안 유효합니다.` })
    }
    return true
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      if (isStaleRequest()) return
      await navigator.clipboard.writeText(command)
      if (!isStaleRequest()) {
        onState({ status: "success", message: `${playerLabel} 명령을 복사했습니다. 6시간 동안 유효합니다.` })
      }
      return
    } catch (error) {
      if (showManualCopyPrompt()) return
      throw error
    }
  }
  if (!showManualCopyPrompt()) throw new Error("clipboard를 사용할 수 없습니다.")
}

export type CloudFileDetailDrawerProps = {
  detailMode: "drawer" | "inline"
  isDeleteConfirmOpen?: boolean
  isLightboxOpen?: boolean
  onClose: () => void
  onCopyFileLink: (file: CloudFile) => Promise<void>
  onOpenLightbox?: (fileId: number) => void
  onRequestDeleteFile: (file: CloudFile) => void
  onUpdateFile: (fileId: number, payload: { originalFilename: string; folderPath: string }) => Promise<boolean>
  selectedFile: CloudFile
  onToast?: (toast: { tone: "success" | "error"; text: string }) => void
}

export const CloudFileDetailDrawer = ({
  detailMode,
  isDeleteConfirmOpen = false,
  isLightboxOpen = false,
  onClose,
  onCopyFileLink,
  onOpenLightbox,
  onRequestDeleteFile,
  onUpdateFile,
  selectedFile,
  onToast,
}: CloudFileDetailDrawerProps) => {
  const editFormId = useId()
  const normalizedOriginalFolder = normalizeCloudFolderPathSearch(selectedFile.folderPath || "")

  const [draftFilename, setDraftFilename] = useState(selectedFile.originalFilename)
  const [draftFolderPath, setDraftFolderPath] = useState(normalizedOriginalFolder)
  const [dimensions, setDimensions] = useState<CloudAssetDimensions | null>(null)
  const [isUpdatePending, setIsUpdatePending] = useState(false)
  const [isPromoting, setIsPromoting] = useState(false)
  const [fallbackLightboxOpen, setFallbackLightboxOpen] = useState(false)
  const [videoSpeed, setVideoSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1)
  const [commandState, setCommandState] = useState<ExternalPlaybackCommandState | null>(null)
  const [playbackTokens, setPlaybackTokens] = useState<
    Array<{ id: number; fileId: number; createdAt: string; expiresAt: string }>
  >([])
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)

  const detailPanelRef = useRef<HTMLElement | null>(null)
  const isMountedRef = useRef(false)
  const activeFileIdRef = useRef<number | null>(selectedFile.id)
  activeFileIdRef.current = selectedFile.id

  const isDrawerMode = detailMode === "drawer"
  const effectiveLightboxOpen = isLightboxOpen || fallbackLightboxOpen
  const isImage = isImageCloudFile(selectedFile)
  const DocIcon = getStrapiAssetIcon(selectedFile.contentType, selectedFile.originalFilename)

  useEffect(() => {
    setDraftFilename(selectedFile.originalFilename)
    setDraftFolderPath(normalizeCloudFolderPathSearch(selectedFile.folderPath || ""))
  }, [selectedFile.folderPath, selectedFile.id, selectedFile.originalFilename])

  useEffect(() => {
    setDimensions(null)
    setFallbackLightboxOpen(false)
    setVideoSpeed(1)
    setCommandState(null)
  }, [selectedFile.id])

  useEffect(() => {
    isMountedRef.current = true
    activeFileIdRef.current = selectedFile.id
    return () => {
      isMountedRef.current = false
      activeFileIdRef.current = null
    }
  }, [selectedFile.id])

  const loadPlaybackTokens = useCallback(async (fileId: number) => {
    setIsLoadingTokens(true)
    try {
      const data = await listCloudExternalPlaybackTokens(fileId)
      setPlaybackTokens(data || [])
    } catch {
      setPlaybackTokens([])
    } finally {
      setIsLoadingTokens(false)
    }
  }, [])

  useEffect(() => {
    if (selectedFile.mediaKind === "VIDEO") {
      void loadPlaybackTokens(selectedFile.id)
    } else {
      setPlaybackTokens([])
    }
  }, [loadPlaybackTokens, selectedFile.id, selectedFile.mediaKind])

  const { handleKeyDown } = useModalFocusTrap({
    open: isDrawerMode,
    paused: isDeleteConfirmOpen || effectiveLightboxOpen,
    onClose,
    containerRef: detailPanelRef,
  })

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
    setIsPromoting(true)
    try {
      const res = await promoteCloudFileToPostAsset(selectedFile.id)
      const promotedUrl = res.url?.trim() || ""
      const markdown =
        res.markdown?.trim() || (promotedUrl ? `![${selectedFile.originalFilename}](${promotedUrl})` : "")
      if (!markdown) throw new Error("공개 포스트 에셋 마크다운을 생성하지 못했습니다.")
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("클립보드 접근 권한이 없어 마크다운 태그를 복사하지 못했습니다.")
      }
      await navigator.clipboard.writeText(markdown)
      onToast?.({ tone: "success", text: "마크다운 태그를 복사했습니다." })
    } catch (err) {
      onToast?.({ tone: "error", text: toUserFacingMessage(err) })
    } finally {
      setIsPromoting(false)
    }
  }

  const copyExternalPlaybackCommand = async (player: ExternalPlaybackPlayer) => {
    const requestedFileId = selectedFile.id
    const playerLabel = EXTERNAL_PLAYBACK_PLAYER_LABELS[player]
    setCommandState({ status: "pending", message: `${playerLabel} 명령 발급 중` })
    const isStaleRequest = () => !isMountedRef.current || activeFileIdRef.current !== requestedFileId

    try {
      const token = await issueCloudExternalPlaybackToken(requestedFileId)
      if (isStaleRequest()) return
      const command = buildExternalPlaybackCommand(player, token.contentUrl)
      await copyCommandWithClipboardOrPrompt(command, playerLabel, isStaleRequest, setCommandState)
      if (!isStaleRequest()) void loadPlaybackTokens(requestedFileId)
    } catch (error) {
      if (isStaleRequest()) return
      setCommandState({
        status: "error",
        message: `${playerLabel} 명령 복사 실패: ${resolveCloudErrorMessage(error)}`,
      })
    }
  }

  const handleRevokeToken = async (tokenId: number) => {
    try {
      await revokeCloudExternalPlaybackToken(selectedFile.id, tokenId)
      setPlaybackTokens((current) => current.filter((t) => t.id !== tokenId))
      onToast?.({ tone: "success", text: "재생 토큰을 폐기했습니다." })
    } catch (err) {
      onToast?.({ tone: "error", text: toUserFacingMessage(err) })
    }
  }

  const handleRevokeAllTokens = async () => {
    try {
      const res = await revokeAllCloudExternalPlaybackTokens(selectedFile.id)
      setPlaybackTokens([])
      onToast?.({ tone: "success", text: `${res.revokedCount}개의 재생 토큰을 모두 폐기했습니다.` })
    } catch (err) {
      onToast?.({ tone: "error", text: toUserFacingMessage(err) })
    }
  }

  const isCommandPending = commandState?.status === "pending"

  return (
    <>
      <DetailScrim type="button" aria-label="상세 패널 닫기" data-mode={detailMode} onClick={onClose} />
      <InspectorPanel
        ref={detailPanelRef}
        role={isDrawerMode ? "dialog" : undefined}
        aria-modal={isDrawerMode ? "true" : undefined}
        aria-label="클라우드 상세정보"
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
          <IconButton type="button" aria-label="상세 패널 닫기" onClick={onClose}>
            <StrapiArrowLineRightIcon width={18} height={18} />
          </IconButton>
        </DetailHeader>

        <DrawerBody>
          <DetailPreviewBox>
            <PreviewDrawer
              file={selectedFile}
              hideHeader={true}
              onRequestExpand={handleOpenExpand}
              onDimensionsChange={setDimensions}
              videoPlaybackSpeed={videoSpeed}
            />
          </DetailPreviewBox>

          <div>
            <DrawerSectionHeading>파일 정보</DrawerSectionHeading>
            <DetailMetaGrid>
              <DetailMetaItem>
                <dt>생성일</dt>
                <dd>{formatCloudDate(selectedFile.createdAt)}</dd>
              </DetailMetaItem>
              <DetailMetaItem>
                <dt>수정일</dt>
                <dd>{formatCloudDate(selectedFile.modifiedAt || selectedFile.createdAt)}</dd>
              </DetailMetaItem>
              <DetailMetaItem>
                <dt>크기</dt>
                <dd>{formatCloudFileSize(selectedFile.byteSize)}</dd>
              </DetailMetaItem>
              {isImage && dimensions ? (
                <DetailMetaItem>
                  <dt>해상도</dt>
                  <dd>{`${dimensions.width} × ${dimensions.height}`}</dd>
                </DetailMetaItem>
              ) : null}
              <DetailMetaItem>
                <dt>확장자</dt>
                <dd>{getCloudKindBadge(selectedFile)}</dd>
              </DetailMetaItem>
              <DetailMetaItem>
                <dt>
                  <span aria-hidden="true">
                    <AppIcon name="lock" />
                  </span>
                  권한
                </dt>
                <dd>계정 소유주만 볼 수 있음</dd>
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
              <span>파일 이름</span>
              <DetailEditInput
                aria-label="파일 이름 수정"
                value={draftFilename}
                onChange={(event) => setDraftFilename(event.target.value)}
              />
            </DetailEditField>
            <DetailEditField>
              <span>
                <AppIcon name="folder" />
                폴더 위치
              </span>
              <DetailEditInput
                aria-label="폴더 경로 수정"
                placeholder="예: ops/reports"
                value={draftFolderPath}
                onChange={(event) => setDraftFolderPath(event.target.value)}
              />
            </DetailEditField>
          </DetailEditForm>

          {selectedFile.mediaKind === "VIDEO" ? (
            <VideoSection aria-label="클라우드 동영상 재생 제어">
              <PlayerBar>
                <FilterGroup aria-label="동영상 재생 속도">
                  {PLAYBACK_SPEEDS.map((candidate) => (
                    <GhostButton
                      key={candidate}
                      type="button"
                      data-active={videoSpeed === candidate ? "true" : "false"}
                      onClick={() => setVideoSpeed(candidate)}
                    >
                      {candidate}x
                    </GhostButton>
                  ))}
                </FilterGroup>
                <ActionGroup aria-label="외부 플레이어 명령 복사">
                  <SecondaryButton type="button" disabled={isCommandPending} onClick={() => void copyExternalPlaybackCommand("iina")}>
                    IINA 명령 복사
                  </SecondaryButton>
                  <SecondaryButton type="button" disabled={isCommandPending} onClick={() => void copyExternalPlaybackCommand("mpv")}>
                    mpv 명령 복사
                  </SecondaryButton>
                </ActionGroup>
                {commandState ? (
                  <PreviewInlineStatusList role="status" aria-live="polite" data-tone={commandState.status}>
                    <span>{commandState.message}</span>
                  </PreviewInlineStatusList>
                ) : null}
              </PlayerBar>

              <PlaybackTokenSection>
                <PlaybackTokenHeader>
                  <strong>외부 재생 토큰 ({playbackTokens.length}개)</strong>
                  {playbackTokens.length > 0 ? (
                    <CompactTokenButton type="button" onClick={() => void handleRevokeAllTokens()}>
                      전체 폐기
                    </CompactTokenButton>
                  ) : null}
                </PlaybackTokenHeader>
                {isLoadingTokens ? (
                  <PlaybackTokenEmpty>토큰 목록 조회 중...</PlaybackTokenEmpty>
                ) : playbackTokens.length === 0 ? (
                  <PlaybackTokenEmpty>활성 외부 재생 토큰이 없습니다.</PlaybackTokenEmpty>
                ) : (
                  <PlaybackTokenList>
                    {playbackTokens.map((t) => (
                      <li key={t.id}>
                        <span>토큰 #{t.id} (만료: {formatCloudDate(t.expiresAt)})</span>
                        <CompactTokenButton type="button" onClick={() => void handleRevokeToken(t.id)}>
                          폐기
                        </CompactTokenButton>
                      </li>
                    ))}
                  </PlaybackTokenList>
                )}
              </PlaybackTokenSection>
            </VideoSection>
          ) : null}
        </DrawerBody>

        <DrawerFooter>
          <DrawerFooterActions>
            <IconButton type="button" aria-label="파일 삭제" onClick={() => onRequestDeleteFile(selectedFile)}>
              <StrapiTrashIcon width={18} height={18} />
            </IconButton>
            <IconButton type="button" aria-label="링크 복사" onClick={() => void onCopyFileLink(selectedFile)}>
              <StrapiLinkIcon width={18} height={18} />
            </IconButton>
            <DrawerIconLink aria-label="다운로드" href={getCloudFileDownloadUrl(selectedFile.id)} download={selectedFile.originalFilename}>
              <StrapiDownloadIcon width={18} height={18} />
            </DrawerIconLink>
            {isImage ? (
              <IconButton type="button" aria-label="마크다운 복사" disabled={isPromoting} onClick={() => void handleCopyMarkdown()}>
                <StrapiFileCodeIcon width={18} height={18} />
              </IconButton>
            ) : null}
          </DrawerFooterActions>

          <PrimaryButton type="submit" form={editFormId} disabled={!isModified || isUpdatePending || !trimmedFilename}>
            저장
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

const VideoSection = styled.section`
  display: grid;
  gap: 0.75rem;
`

const PlaybackTokenSection = styled.div`
  padding: 0.78rem 0.9rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceMuted};
`

const PlaybackTokenHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;

  strong {
    font-size: 0.8rem;
    color: ${adminTextPrimary};
  }
`

const PlaybackTokenEmpty = styled.span`
  font-size: 0.74rem;
  color: ${adminTextMuted};
`

const PlaybackTokenList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.74rem;
    color: ${adminTextSecondary};
  }
`

const CompactTokenButton = styled(GhostButton)`
  min-height: 26px;
  padding: 0.1rem 0.48rem;
  font-size: 0.72rem;
`
