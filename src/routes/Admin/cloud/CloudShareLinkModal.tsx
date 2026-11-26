// 참조 구현: supabase/supabase CustomExpiryModal & SignedUrl (Apache-2.0) — 만료 기한 선택형 서명 외부 공유·재생 링크 모달
import styled from "@emotion/styled"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  type CloudExternalPlaybackToken,
  type CloudExternalPlaybackTokenItem,
  type CloudFile,
  type CloudShareLinkTtlSeconds,
  getCloudFileContentUrl,
  issueCloudExternalPlaybackToken,
  issueCloudShareLink,
  listCloudExternalPlaybackTokens,
  listCloudShareLinks,
  revokeAllCloudExternalPlaybackTokens,
  revokeAllCloudShareLinks,
  revokeCloudExternalPlaybackToken,
  revokeCloudShareLink,
} from "src/apis/backend/cloud"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import { useLanguage } from "src/libs/language"
import {
  adminStatusDangerBorder,
  adminStatusDangerText,
} from "src/routes/Admin/adminColorTokens"
import { formatCloudDate } from "../AdminCloudWorkspaceModel"
import { PrimaryButton, SecondaryButton } from "../AdminCloudWorkspaceControls.styles"
import {
  CloudModalBackdrop,
  CloudModalCard,
  ModalInput,
  ModalPillButton,
  ModalSegmentedRow,
  ShareTokenList,
} from "./AdminCloudOverlay.styles"
import { getCloudDictionary } from "./adminCloudI18n"
import { resolveCloudErrorMessage } from "./cloudPreviewHelpers"

type ShareTab = "external" | "player" | "internal"

const TTL_OPTIONS: readonly CloudShareLinkTtlSeconds[] = [3600, 21600, 86400, 604800]

const quotePosixShellArg = (value: string) => `'${value.replace(/'/g, "'\\''")}'`

export type CloudShareLinkModalProps = {
  open: boolean
  file: CloudFile | null
  onClose: () => void
  onToast: (toast: { tone: "success" | "error"; text: string }) => void
}

export const CloudShareLinkModal = ({
  open,
  file,
  onClose,
  onToast,
}: CloudShareLinkModalProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const [activeTab, setActiveTab] = useState<ShareTab>("external")
  const [selectedTtl, setSelectedTtl] = useState<CloudShareLinkTtlSeconds>(86400)
  const [issuedShare, setIssuedShare] = useState<CloudExternalPlaybackToken | null>(null)
  const [issuedPlayer, setIssuedPlayer] = useState<CloudExternalPlaybackToken | null>(null)
  const [activeShareTokens, setActiveShareTokens] = useState<CloudExternalPlaybackTokenItem[]>([])
  const [activePlaybackTokens, setActivePlaybackTokens] = useState<CloudExternalPlaybackTokenItem[]>([])
  const [busy, setBusy] = useState(false)
  const [loadingTokens, setLoadingTokens] = useState(false)
  const [copiedTarget, setCopiedTarget] = useState("")

  const containerRef = useRef<HTMLDivElement>(null)
  const { handleKeyDown } = useModalFocusTrap({ open, onClose, containerRef })

  const fileId = file?.id ?? 0
  const isVideo = file?.mediaKind === "VIDEO"

  const getTtlLabel = (ttl: CloudShareLinkTtlSeconds) => {
    if (ttl === 3600) return t.shareTtl1h
    if (ttl === 21600) return t.shareTtl6h
    if (ttl === 604800) return t.shareTtl7d
    return t.shareTtl24h
  }

  const refreshActiveTokens = useCallback(async () => {
    if (!fileId) return
    setLoadingTokens(true)
    try {
      const shareList = await listCloudShareLinks(fileId)
      setActiveShareTokens(shareList)
      if (isVideo) {
        const playbackList = await listCloudExternalPlaybackTokens(fileId)
        setActivePlaybackTokens(playbackList)
      } else {
        setActivePlaybackTokens([])
      }
    } catch {
      // 목록 조회 실패 시 기존 상태 유지
    } finally {
      setLoadingTokens(false)
    }
  }, [fileId, isVideo])

  useEffect(() => {
    if (!open || !fileId) return
    setActiveTab("external")
    setIssuedShare(null)
    setIssuedPlayer(null)
    setCopiedTarget("")
    void refreshActiveTokens()
  }, [fileId, open, refreshActiveTokens])

  if (!open || !file) return null

  const internalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${getCloudFileContentUrl(file.id)}`
      : getCloudFileContentUrl(file.id)

  const copyTextToClipboard = async (label: string, text: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error(
          language === "en"
            ? "Clipboard permission is unavailable. Please copy the link manually below."
            : "클립보드 접근 권한이 없습니다. 아래 입력창에서 직접 복사해주세요."
        )
      }
      await navigator.clipboard.writeText(text)
      setCopiedTarget(label)
      onToast({ tone: "success", text: `${label} — ${t.shareCopied}` })
    } catch (error) {
      onToast({ tone: "error", text: resolveCloudErrorMessage(error, language) })
    }
  }

  const handleIssueShare = async () => {
    setBusy(true)
    try {
      const issued = await issueCloudShareLink(file.id, selectedTtl)
      setIssuedShare(issued)
      await copyTextToClipboard(t.shareTabExternal, issued.contentUrl)
      await refreshActiveTokens()
    } catch (error) {
      onToast({ tone: "error", text: resolveCloudErrorMessage(error, language) })
    } finally {
      setBusy(false)
    }
  }

  const handleCopyPlayerCommand = async (player: "iina" | "mpv") => {
    setBusy(true)
    try {
      const issued = await issueCloudExternalPlaybackToken(file.id, selectedTtl)
      setIssuedPlayer(issued)
      const cmd =
        player === "iina"
          ? `open "iina://weblink?url=${encodeURIComponent(issued.contentUrl)}"`
          : `mpv ${quotePosixShellArg(issued.contentUrl)}`
      await copyTextToClipboard(player.toUpperCase(), cmd)
      await refreshActiveTokens()
    } catch (error) {
      onToast({ tone: "error", text: resolveCloudErrorMessage(error, language) })
    } finally {
      setBusy(false)
    }
  }

  const shownTokens = activeTab === "player" ? activePlaybackTokens : activeShareTokens

  return (
    <CloudModalBackdrop onClick={busy ? undefined : onClose}>
      <CloudModalCard
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-share-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <h2 id="cloud-share-modal-title">{t.shareModalTitle}</h2>
          <SecondaryButton type="button" onClick={onClose}>
            {t.close}
          </SecondaryButton>
        </div>

        <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, overflowWrap: "anywhere" }}>
          {file.originalFilename}
        </p>

        <ModalSegmentedRow role="tablist" aria-label={t.shareModalTitle}>
          <ModalPillButton
            type="button"
            role="tab"
            aria-selected={activeTab === "external"}
            data-active={activeTab === "external"}
            onClick={() => setActiveTab("external")}
          >
            {t.shareTabExternal}
          </ModalPillButton>
          {isVideo ? (
            <ModalPillButton
              type="button"
              role="tab"
              aria-selected={activeTab === "player"}
              data-active={activeTab === "player"}
              onClick={() => setActiveTab("player")}
            >
              {t.shareTabPlayer}
            </ModalPillButton>
          ) : null}
          <ModalPillButton
            type="button"
            role="tab"
            aria-selected={activeTab === "internal"}
            data-active={activeTab === "internal"}
            onClick={() => setActiveTab("internal")}
          >
            {t.shareTabInternal}
          </ModalPillButton>
        </ModalSegmentedRow>

        {activeTab === "internal" ? (
          <div style={{ display: "grid", gap: "0.65rem" }}>
            <p style={{ margin: 0, fontSize: "0.78rem", lineHeight: 1.5 }}>
              {t.shareIssueInternalNotice}
            </p>
            <ModalInput type="text" readOnly value={internalUrl} aria-label={t.shareTabInternal} />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <SecondaryButton
                type="button"
                onClick={() => void copyTextToClipboard(t.shareTabInternal, internalUrl)}
              >
                {copiedTarget === t.shareTabInternal ? t.shareCopied : t.shareCopyInternalPath}
              </SecondaryButton>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: "0.78rem", lineHeight: 1.5 }}>
              {activeTab === "player" ? t.sharePlayerNotice : t.shareExternalNotice}
            </p>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.76rem", fontWeight: 700 }}>{t.shareTtlLabel}</span>
              <ModalSegmentedRow role="group" aria-label={t.shareTtlLabel}>
                {TTL_OPTIONS.map((ttl) => (
                  <ModalPillButton
                    key={ttl}
                    type="button"
                    data-active={selectedTtl === ttl}
                    aria-pressed={selectedTtl === ttl}
                    onClick={() => setSelectedTtl(ttl)}
                  >
                    {getTtlLabel(ttl)}
                  </ModalPillButton>
                ))}
              </ModalSegmentedRow>
            </div>

            {activeTab === "external" ? (
              <>
                <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                  <PrimaryButton type="button" disabled={busy} onClick={() => void handleIssueShare()}>
                    {t.shareIssueExternal}
                  </PrimaryButton>
                  {issuedShare ? (
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        void copyTextToClipboard(t.shareTabExternal, issuedShare.contentUrl)
                      }
                    >
                      {t.shareCopyLink}
                    </SecondaryButton>
                  ) : null}
                </div>
                {issuedShare ? (
                  <ModalInput
                    type="text"
                    readOnly
                    value={issuedShare.contentUrl}
                    aria-label={t.shareTabExternal}
                  />
                ) : null}
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                  <PrimaryButton
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCopyPlayerCommand("iina")}
                  >
                    IINA
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCopyPlayerCommand("mpv")}
                  >
                    mpv
                  </SecondaryButton>
                </div>
                {issuedPlayer ? (
                  <ModalInput
                    type="text"
                    readOnly
                    value={issuedPlayer.contentUrl}
                    aria-label={t.shareTabPlayer}
                  />
                ) : null}
              </>
            )}

            <div style={{ display: "grid", gap: "0.45rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>{t.shareActiveTokensTitle}</span>
                {shownTokens.length > 0 ? (
                  <DangerActionButton
                    type="button"
                    disabled={busy || loadingTokens}
                    onClick={async () => {
                      setBusy(true)
                      try {
                        if (activeTab === "player") {
                          await revokeAllCloudExternalPlaybackTokens(file.id)
                        } else {
                          await revokeAllCloudShareLinks(file.id)
                        }
                        await refreshActiveTokens()
                      } catch (error) {
                        onToast({ tone: "error", text: resolveCloudErrorMessage(error, language) })
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    {t.shareRevokeAll}
                  </DangerActionButton>
                ) : null}
              </div>

              {shownTokens.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.75rem" }}>{t.shareNoActiveTokens}</p>
              ) : (
                <ShareTokenList>
                  {shownTokens.map((tokenItem) => (
                    <li key={tokenItem.id}>
                      <span>
                        #{tokenItem.id} · {t.shareExpiresAt}:{" "}
                        {formatCloudDate(tokenItem.expiresAt, language)}
                      </span>
                      <SecondaryButton
                        type="button"
                        disabled={busy || !tokenItem.id}
                        onClick={async () => {
                          if (!tokenItem.id) return
                          setBusy(true)
                          try {
                            if (activeTab === "player") {
                              await revokeCloudExternalPlaybackToken(file.id, tokenItem.id)
                            } else {
                              await revokeCloudShareLink(file.id, tokenItem.id)
                            }
                            await refreshActiveTokens()
                          } catch (error) {
                            onToast({ tone: "error", text: resolveCloudErrorMessage(error, language) })
                          } finally {
                            setBusy(false)
                          }
                        }}
                      >
                        {t.shareRevokeOne}
                      </SecondaryButton>
                    </li>
                  ))}
                </ShareTokenList>
              )}
            </div>
          </div>
        )}
      </CloudModalCard>
    </CloudModalBackdrop>
  )
}

const DangerActionButton = styled(SecondaryButton)`
  color: ${adminStatusDangerText};
  border-color: ${adminStatusDangerBorder};
`
