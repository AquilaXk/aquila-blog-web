// 클라우드 인스펙터 동영상 배속·외부 플레이어 명령(IINA/mpv)·재생 토큰 관리 섹션
import styled from "@emotion/styled"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  issueCloudExternalPlaybackToken,
  listCloudExternalPlaybackTokens,
  revokeAllCloudExternalPlaybackTokens,
  revokeCloudExternalPlaybackToken,
} from "src/apis/backend/cloud"
import { toUserFacingMessage } from "src/apis/backend/errorClassification"
import { useLanguage } from "src/libs/language"
import {
  adminSurfaceMuted,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
import {
  ActionGroup,
  FilterGroup,
  GhostButton,
  PlayerBar,
  PreviewInlineStatusList,
  SecondaryButton,
} from "../AdminCloudWorkspace.styles"
import { PLAYBACK_SPEEDS, formatCloudDate } from "../AdminCloudWorkspaceModel"
import { ModalInput } from "./AdminCloudOverlay.styles"
import { getCloudDictionary } from "./adminCloudI18n"
import { resolveCloudErrorMessage } from "./cloudPreviewHelpers"

type ExternalPlaybackPlayer = "iina" | "mpv"
type ExternalPlaybackCommandState = {
  status: "pending" | "success" | "error"
  message: string
  manualCommand?: string
}

const EXTERNAL_PLAYBACK_PLAYER_LABELS: Record<ExternalPlaybackPlayer, string> = {
  iina: "IINA",
  mpv: "mpv",
}

const quoteShellArg = (value: string) => `"${value.replace(/(["\\$`])/g, String.raw`\$1`)}"`

const buildExternalPlaybackCommand = (player: ExternalPlaybackPlayer, contentUrl: string) =>
  `${player} ${quoteShellArg(contentUrl)}`

const copyCommandWithClipboardOrInline = async (
  command: string,
  playerLabel: string,
  isEn: boolean,
  isStaleRequest: () => boolean,
  onState: (state: ExternalPlaybackCommandState) => void
) => {
  const showManualFallback = () => {
    if (isStaleRequest()) return false
    onState({
      status: "success",
      message: isEn
        ? `${playerLabel} command ready below. Valid for 6 hours.`
        : `${playerLabel} 명령을 표시했습니다. 6시간 동안 유효합니다.`,
      manualCommand: command,
    })
    return true
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      if (isStaleRequest()) return
      await navigator.clipboard.writeText(command)
      if (!isStaleRequest()) {
        onState({
          status: "success",
          message: isEn
            ? `Copied ${playerLabel} command. Valid for 6 hours.`
            : `${playerLabel} 명령을 복사했습니다. 6시간 동안 유효합니다.`,
        })
      }
      return
    } catch (error) {
      if (showManualFallback()) return
      throw error
    }
  }
  if (!showManualFallback()) {
    throw new Error(isEn ? "Clipboard is unavailable." : "clipboard를 사용할 수 없습니다.")
  }
}

export const CloudInspectorVideoSection = ({
  fileId,
  videoSpeed,
  onChangeVideoSpeed,
  onToast,
}: {
  fileId: number
  videoSpeed: (typeof PLAYBACK_SPEEDS)[number]
  onChangeVideoSpeed: (next: (typeof PLAYBACK_SPEEDS)[number]) => void
  onToast?: (toast: { tone: "success" | "error"; text: string }) => void
}) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const isEn = language === "en"

  const [commandState, setCommandState] = useState<ExternalPlaybackCommandState | null>(null)
  const [playbackTokens, setPlaybackTokens] = useState<
    Array<{ id: number; fileId: number; createdAt: string; expiresAt: string }>
  >([])
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)

  const isMountedRef = useRef(false)
  const activeFileIdRef = useRef<number | null>(fileId)
  activeFileIdRef.current = fileId

  const loadPlaybackTokens = useCallback(async (targetId: number) => {
    setIsLoadingTokens(true)
    try {
      const data = await listCloudExternalPlaybackTokens(targetId)
      setPlaybackTokens(
        (data || []).map((item) => ({
          id: Number(item.id || 0),
          fileId: Number(item.fileId || targetId),
          createdAt: item.createdAt || "",
          expiresAt: item.expiresAt || "",
        }))
      )
    } catch {
      setPlaybackTokens([])
    } finally {
      setIsLoadingTokens(false)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    activeFileIdRef.current = fileId
    setCommandState(null)
    void loadPlaybackTokens(fileId)
    return () => {
      isMountedRef.current = false
      activeFileIdRef.current = null
    }
  }, [fileId, loadPlaybackTokens])

  const copyExternalPlaybackCommand = async (player: ExternalPlaybackPlayer) => {
    const requestedFileId = fileId
    const playerLabel = EXTERNAL_PLAYBACK_PLAYER_LABELS[player]
    setCommandState({
      status: "pending",
      message: isEn ? `Preparing ${playerLabel} command...` : `${playerLabel} 명령 발급 중`,
    })
    const isStaleRequest = () =>
      !isMountedRef.current || activeFileIdRef.current !== requestedFileId

    try {
      const token = await issueCloudExternalPlaybackToken(requestedFileId)
      if (isStaleRequest()) return
      const command = buildExternalPlaybackCommand(player, token.contentUrl)
      await copyCommandWithClipboardOrInline(
        command,
        playerLabel,
        isEn,
        isStaleRequest,
        setCommandState
      )
      if (!isStaleRequest()) void loadPlaybackTokens(requestedFileId)
    } catch (error) {
      if (isStaleRequest()) return
      setCommandState({
        status: "error",
        message: `${playerLabel}: ${resolveCloudErrorMessage(error)}`,
      })
    }
  }

  const handleRevokeToken = async (tokenId: number) => {
    try {
      await revokeCloudExternalPlaybackToken(fileId, tokenId)
      setPlaybackTokens((current) => current.filter((token) => token.id !== tokenId))
      onToast?.({
        tone: "success",
        text: isEn ? "Revoked playback token." : "재생 토큰을 폐기했습니다.",
      })
    } catch (err) {
      onToast?.({ tone: "error", text: toUserFacingMessage(err) })
    }
  }

  const handleRevokeAllTokens = async () => {
    try {
      const res = await revokeAllCloudExternalPlaybackTokens(fileId)
      setPlaybackTokens([])
      onToast?.({
        tone: "success",
        text: isEn
          ? `Revoked ${res.revokedCount} playback token(s).`
          : `${res.revokedCount}개의 재생 토큰을 모두 폐기했습니다.`,
      })
    } catch (err) {
      onToast?.({ tone: "error", text: toUserFacingMessage(err) })
    }
  }

  const isCommandPending = commandState?.status === "pending"

  return (
    <VideoSection aria-label={isEn ? "Cloud video playback controls" : "클라우드 동영상 재생 제어"}>
      <PlayerBar>
        <FilterGroup aria-label={isEn ? "Video playback speed" : "동영상 재생 속도"}>
          {PLAYBACK_SPEEDS.map((candidate) => (
            <GhostButton
              key={candidate}
              type="button"
              data-active={videoSpeed === candidate ? "true" : "false"}
              onClick={() => onChangeVideoSpeed(candidate)}
            >
              {candidate}x
            </GhostButton>
          ))}
        </FilterGroup>
        <ActionGroup aria-label={isEn ? "Copy external player command" : "외부 플레이어 명령 복사"}>
          <SecondaryButton
            type="button"
            disabled={isCommandPending}
            onClick={() => void copyExternalPlaybackCommand("iina")}
          >
            {isEn ? "Copy IINA command" : "IINA 명령 복사"}
          </SecondaryButton>
          <SecondaryButton
            type="button"
            disabled={isCommandPending}
            onClick={() => void copyExternalPlaybackCommand("mpv")}
          >
            {isEn ? "Copy mpv command" : "mpv 명령 복사"}
          </SecondaryButton>
        </ActionGroup>
        {commandState ? (
          <PreviewInlineStatusList role="status" aria-live="polite" data-tone={commandState.status}>
            <span>{commandState.message}</span>
            {commandState.manualCommand ? (
              <ModalInput
                type="text"
                readOnly
                aria-label={isEn ? "Manual player command copy" : "수동 복사 명령"}
                value={commandState.manualCommand}
              />
            ) : null}
          </PreviewInlineStatusList>
        ) : null}
      </PlayerBar>

      <PlaybackTokenSection>
        <PlaybackTokenHeader>
          <strong>
            {isEn
              ? `External playback tokens (${playbackTokens.length})`
              : `외부 재생 토큰 (${playbackTokens.length}개)`}
          </strong>
          {playbackTokens.length > 0 ? (
            <CompactTokenButton type="button" onClick={() => void handleRevokeAllTokens()}>
              {t.shareRevokeAll}
            </CompactTokenButton>
          ) : null}
        </PlaybackTokenHeader>
        {isLoadingTokens ? (
          <PlaybackTokenEmpty>{isEn ? "Loading tokens..." : "토큰 목록 조회 중..."}</PlaybackTokenEmpty>
        ) : playbackTokens.length === 0 ? (
          <PlaybackTokenEmpty>
            {isEn ? "No active external playback tokens." : "활성 외부 재생 토큰이 없습니다."}
          </PlaybackTokenEmpty>
        ) : (
          <PlaybackTokenList>
            {playbackTokens.map((tokenItem) => (
              <li key={tokenItem.id}>
                <span>
                  #{tokenItem.id} ({t.shareExpiresAt}:{" "}
                  {formatCloudDate(tokenItem.expiresAt, language)})
                </span>
                <CompactTokenButton
                  type="button"
                  onClick={() => void handleRevokeToken(tokenItem.id)}
                >
                  {t.shareRevokeOne}
                </CompactTokenButton>
              </li>
            ))}
          </PlaybackTokenList>
        )}
      </PlaybackTokenSection>
    </VideoSection>
  )
}

const VideoSection = styled.section`
  display: grid;
  gap: 0.75rem;
`

const PlaybackTokenSection = styled.div`
  display: grid;
  gap: 0.45rem;
  padding: 0.72rem;
  border-radius: 8px;
  background: ${adminSurfaceMuted};
`

const PlaybackTokenHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  strong {
    font-size: 0.78rem;
    color: ${adminTextPrimary};
  }
`

const PlaybackTokenEmpty = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: ${adminTextMuted};
`

const PlaybackTokenList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.74rem;
    color: ${adminTextSecondary};
  }
`

const CompactTokenButton = styled.button`
  border: 0;
  border-radius: 5px;
  padding: 0.2rem 0.45rem;
  background: transparent;
  color: ${adminTextSecondary};
  font-size: 0.74rem;
  font-weight: 650;
  cursor: pointer;
  &:hover {
    color: ${adminTextPrimary};
  }
  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`
