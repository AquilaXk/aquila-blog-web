/**
 * 참조 구현:
 * - TryGhost/Ghost apps/admin/src/editor/post-settings-sidebar.tsx (MIT License, Copyright (c) Ghost Foundation)
 * - TryGhost/Koenig & payloadcms/payload (MIT License)
 */
import styled from "@emotion/styled"
import type { components } from "@shared/contracts"
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react"
import { apiFetch } from "src/apis/backend/client"
import { EditorIconChevronDown } from "src/components/markdown-editor/MarkdownEditorIcons"
import { useLanguage, type SiteLanguage } from "src/libs/language"
import type { RsData } from "src/types"
import {
  adminBorder,
  adminBorderSubtle,
  adminSurface,
  adminSurfaceMuted,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"
import { adminT } from "./adminI18n"
import { SecondaryButton } from "./EditorStudioDedicatedEditorSurfaceParts"
import { EditorStudioRevisionDiffPanel } from "./EditorStudioRevisionDiffPanel"
import { computePostRevisionDiff } from "./postRevisionDiffModel"

const MAX_REVISION_ITEMS = 20

type RawPostRevisionSummaryDto = components["schemas"]["PostRevisionSummaryDto"]
type RawPostRevisionSnapshotDto = components["schemas"]["PostRevisionSnapshotDto"]

export type PostRevisionSummaryItem = {
  id: number
  postId: number
  title: string
  summaryText: string | null
  contentLength: number
  createdAt: string
}

export type PostRevisionSnapshotItem = {
  id: number
  postId: number
  title: string
  content: string
  createdAt?: string
}

export type EditorStudioRevisionHistoryCardProps = {
  postId?: number | null
  disabled?: boolean
  initialOpen?: boolean
  initialRevisions?: PostRevisionSummaryItem[]
  initialSnapshots?: Record<number, PostRevisionSnapshotItem>
  currentTitle?: string
  currentTags?: string[]
  currentContent?: string
  onRevisionRestored?: () => Promise<void> | void
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0

export const normalizePostRevisionSummaries = (
  rows: readonly RawPostRevisionSummaryDto[] | unknown
): PostRevisionSummaryItem[] => {
  if (!Array.isArray(rows)) return []
  const normalized: PostRevisionSummaryItem[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const candidate = row as RawPostRevisionSummaryDto
    if (!isPositiveInteger(candidate.id) || !isPositiveInteger(candidate.postId)) continue
    const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : "제목 없음"
    const summaryText =
      typeof candidate.summaryText === "string" && candidate.summaryText.trim()
        ? candidate.summaryText.trim()
        : null
    const contentLength =
      typeof candidate.contentLength === "number" && Number.isFinite(candidate.contentLength)
        ? Math.max(0, Math.trunc(candidate.contentLength))
        : 0
    const createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt.trim() : ""
    normalized.push({
      id: candidate.id,
      postId: candidate.postId,
      title,
      summaryText,
      contentLength,
      createdAt,
    })
    if (normalized.length >= MAX_REVISION_ITEMS) break
  }
  return normalized
}

const normalizePostRevisionSnapshot = (
  raw: unknown,
  fallbackItem?: PostRevisionSummaryItem
): PostRevisionSnapshotItem | null => {
  if (!raw || typeof raw !== "object") return null
  const candidate =
    "data" in raw && (raw as { data?: unknown }).data && typeof (raw as { data?: unknown }).data === "object"
      ? ((raw as { data: unknown }).data as Record<string, unknown>)
      : (raw as Record<string, unknown>)
  const id = isPositiveInteger(candidate.id) ? candidate.id : fallbackItem?.id
  const postId = isPositiveInteger(candidate.postId) ? candidate.postId : fallbackItem?.postId
  if (!id || !postId || typeof candidate.content !== "string") return null
  const title =
    typeof candidate.title === "string" && candidate.title.trim()
      ? candidate.title.trim()
      : fallbackItem?.title ?? "제목 없음"
  return {
    id,
    postId,
    title,
    content: candidate.content,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt.trim() : fallbackItem?.createdAt,
  }
}

export const formatRevisionTimestampLabel = (
  rawIso: string,
  language: SiteLanguage = "ko"
): string => {
  if (!rawIso) return language === "en" ? "Unknown time" : "시각 미상"
  const parsed = Date.parse(rawIso)
  if (!Number.isFinite(parsed)) return rawIso
  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-US" : "ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(parsed))
  } catch {
    return new Date(parsed).toISOString().slice(0, 16).replace("T", " ")
  }
}

export const EditorStudioRevisionHistoryCard = ({
  postId,
  disabled = false,
  initialOpen = false,
  initialRevisions,
  initialSnapshots,
  currentTitle = "",
  currentTags = [],
  currentContent = "",
  onRevisionRestored,
}: EditorStudioRevisionHistoryCardProps) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const [hasLoaded, setHasLoaded] = useState(Boolean(initialRevisions))
  const [isLoading, setIsLoading] = useState(false)
  const [restoringRevisionId, setRestoringRevisionId] = useState<number | null>(null)
  const [comparedRevisionId, setComparedRevisionId] = useState<number | null>(null)
  const [loadingSnapshotId, setLoadingSnapshotId] = useState<number | null>(null)
  const [diffErrorText, setDiffErrorText] = useState("")
  const [snapshotsById, setSnapshotsById] = useState<Record<number, PostRevisionSnapshotItem>>(
    initialSnapshots ?? {}
  )
  const [errorText, setErrorText] = useState("")
  const [statusText, setStatusText] = useState("")
  const [revisions, setRevisions] = useState<PostRevisionSummaryItem[]>(initialRevisions ?? [])
  const compareRequestSeqRef = useRef(0)
  const deferredCurrentContent = useDeferredValue(currentContent)

  useEffect(() => {
    setSnapshotsById(initialSnapshots ?? {})
    setComparedRevisionId(null)
    setDiffErrorText("")
  }, [initialSnapshots, postId])

  useEffect(() => {
    if (initialRevisions) {
      setRevisions(initialRevisions)
      setHasLoaded(true)
      return
    }
    setRevisions([])
    setHasLoaded(false)
    setErrorText("")
    setStatusText("")
  }, [initialRevisions, postId])

  const loadRevisions = useCallback(async () => {
    if (!isPositiveInteger(postId)) return
    setIsLoading(true)
    setErrorText("")
    try {
      const rows = await apiFetch<RawPostRevisionSummaryDto[]>(
        `/post/api/v1/adm/posts/${postId}/revisions`
      )
      setRevisions(normalizePostRevisionSummaries(rows))
      setHasLoaded(true)
    } catch (error) {
      setErrorText(
        error instanceof Error && error.message.trim()
          ? error.message
          : isEn
            ? "Failed to load revision history."
            : "리비전 기록을 불러오지 못했습니다."
      )
    } finally {
      setIsLoading(false)
    }
  }, [isEn, postId])

  const handleToggle = useCallback(
    (event: SyntheticEvent<HTMLDetailsElement>) => {
      if (event.currentTarget.open && !hasLoaded && !isLoading) {
        void loadRevisions()
      }
    },
    [hasLoaded, isLoading, loadRevisions]
  )

  const handleCompareRevision = useCallback(
    async (item: PostRevisionSummaryItem) => {
      if (comparedRevisionId === item.id) {
        compareRequestSeqRef.current += 1
        setComparedRevisionId(null)
        setLoadingSnapshotId(null)
        setDiffErrorText("")
        return
      }
      const requestSeq = ++compareRequestSeqRef.current
      setComparedRevisionId(item.id)
      setDiffErrorText("")
      if (snapshotsById[item.id] || !isPositiveInteger(postId)) {
        setLoadingSnapshotId(null)
        return
      }
      setLoadingSnapshotId(item.id)
      try {
        const response = await apiFetch<RawPostRevisionSnapshotDto>(
          `/post/api/v1/adm/posts/${postId}/revisions/${item.id}`
        )
        const normalized = normalizePostRevisionSnapshot(response, item)
        if (!normalized) {
          throw new Error(adminT("editorRevisionLoadError", language))
        }
        setSnapshotsById((prev) => ({ ...prev, [item.id]: normalized }))
      } catch (error) {
        if (compareRequestSeqRef.current !== requestSeq) return
        setDiffErrorText(
          error instanceof Error && error.message.trim()
            ? error.message
            : adminT("editorRevisionLoadError", language)
        )
      } finally {
        if (compareRequestSeqRef.current === requestSeq) {
          setLoadingSnapshotId(null)
        }
      }
    },
    [comparedRevisionId, language, postId, snapshotsById]
  )

  const activeComparedDiff = useMemo(() => {
    if (comparedRevisionId === null) return null
    const snapshot = snapshotsById[comparedRevisionId]
    if (!snapshot) return null
    return computePostRevisionDiff({
      revisionTitle: snapshot.title,
      revisionContent: snapshot.content,
      currentTitle,
      currentTags,
      currentContent: deferredCurrentContent,
    })
  }, [comparedRevisionId, currentTags, currentTitle, deferredCurrentContent, snapshotsById])

  const handleRestoreRevision = useCallback(
    async (revisionId: number) => {
      if (!isPositiveInteger(postId) || restoringRevisionId !== null || disabled) return
      setRestoringRevisionId(revisionId)
      setErrorText("")
      setStatusText("")
      try {
        await apiFetch<RsData<unknown>>(
          `/post/api/v1/adm/posts/${postId}/revisions/${revisionId}/restore`,
          { method: "POST" }
        )
        await onRevisionRestored?.()
        await loadRevisions()
        setStatusText(
          isEn ? `Restored revision #${revisionId}.` : `#${revisionId} 리비전을 복원했습니다.`
        )
      } catch (error) {
        setErrorText(
          error instanceof Error && error.message.trim()
            ? error.message
            : isEn
              ? "Failed to restore revision."
              : "리비전 복원에 실패했습니다."
        )
      } finally {
        setRestoringRevisionId(null)
      }
    },
    [disabled, isEn, loadRevisions, onRevisionRestored, postId, restoringRevisionId]
  )

  if (!isPositiveInteger(postId)) return null

  return (
    <RevisionCardDetails
      data-testid="editor-revision-history-card"
      open={initialOpen || undefined}
      onToggle={handleToggle}
    >
      <RevisionCardSummary>
        <span className="summaryLead">
          <span className="chevronWrap" aria-hidden="true">
            <EditorIconChevronDown size={13} />
          </span>
          <span>{isEn ? "Revision History" : "리비전 기록"}</span>
        </span>
        <span className="summaryBadge">
          {hasLoaded
            ? isEn
              ? `${revisions.length}`
              : `${revisions.length}건`
            : isEn
              ? "Latest 20"
              : "최근 20건"}
        </span>
      </RevisionCardSummary>
      <RevisionCardBody>
        <div className="revisionToolbar">
          <small>
            {isEn
              ? "Inspect, compare, and restore saved server snapshots."
              : "저장 시점의 서버 원장 스냅샷을 조회하고 복원합니다."}
          </small>
          <SecondaryButton
            type="button"
            disabled={disabled || isLoading || restoringRevisionId !== null}
            onClick={() => void loadRevisions()}
          >
            {isLoading ? (isEn ? "Loading" : "불러오는 중") : isEn ? "Refresh" : "새로고침"}
          </SecondaryButton>
        </div>
        {errorText ? <p className="revisionError" role="alert">{errorText}</p> : null}
        {statusText ? <p className="revisionStatus" role="status">{statusText}</p> : null}
        {!isLoading && !errorText && revisions.length === 0 ? (
          <p className="revisionEmpty">
            {isEn ? "No saved revisions yet." : "아직 기록된 이전 리비전이 없습니다."}
          </p>
        ) : null}
        {revisions.length > 0 ? (
          <ul className="revisionList">
            {revisions.map((item) => {
              const isRestoring = restoringRevisionId === item.id
              const isComparing = comparedRevisionId === item.id
              return (
                <li key={item.id} className="revisionItemBlock">
                  <div className="revisionItem">
                    <div className="revisionMeta">
                      <strong title={item.title}>{item.title}</strong>
                      <span>
                        {formatRevisionTimestampLabel(item.createdAt, language)} ·{" "}
                        {isEn ? `${item.contentLength} chars` : `${item.contentLength}자`}
                      </span>
                    </div>
                    <div className="revisionActions">
                      <SecondaryButton
                        type="button"
                        disabled={disabled || isLoading || restoringRevisionId !== null}
                        aria-expanded={isComparing}
                        onClick={() => void handleCompareRevision(item)}
                      >
                        {isComparing
                          ? adminT("editorRevisionCloseCompare", language)
                          : adminT("editorRevisionCompare", language)}
                      </SecondaryButton>
                      <SecondaryButton
                        type="button"
                        disabled={disabled || isLoading || restoringRevisionId !== null}
                        aria-label={isEn ? `Restore revision ${item.title}` : `${item.title} 리비전 복원`}
                        onClick={() => void handleRestoreRevision(item.id)}
                      >
                        {isRestoring ? (isEn ? "Restoring" : "복원 중") : isEn ? "Restore" : "복원"}
                      </SecondaryButton>
                    </div>
                  </div>
                  {isComparing ? (
                    <EditorStudioRevisionDiffPanel
                      language={language}
                      revisionTitle={snapshotsById[item.id]?.title ?? item.title}
                      currentTitle={currentTitle}
                      isLoading={loadingSnapshotId === item.id}
                      errorText={diffErrorText}
                      diff={activeComparedDiff}
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </RevisionCardBody>
    </RevisionCardDetails>
  )
}

const RevisionCardDetails = styled.details`
  margin: 0;
  border: 0;
  border-bottom: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;

  &[open] > summary .chevronWrap {
    transform: rotate(0deg);
  }
`

const RevisionCardSummary = styled.summary`
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 0;
  cursor: pointer;
  user-select: none;

  &::-webkit-details-marker {
    display: none;
  }

  .summaryLead {
    display: inline-flex;
    align-items: center;
    gap: 0.5ch;
    font: 600 12.5px/1.2 var(--aq-font-sans);
    color: ${adminTextPrimary};
  }

  .chevronWrap {
    display: inline-flex;
    align-items: center;
    color: ${adminTextMuted};
    transform: rotate(-90deg);

    @media (prefers-reduced-motion: no-preference) {
      transition: transform 0.18s ease;
    }
  }

  .summaryBadge {
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid ${adminBorder};
    background: ${adminSurfaceMuted};
    color: ${adminTextSecondary};
    font: 600 10.5px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }
`

const RevisionCardBody = styled.div`
  display: grid;
  gap: 8px;
  padding: 0 0 14px;

  .revisionToolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    small {
      margin: 0;
      font-size: 0.72rem;
      color: ${adminTextMuted};
    }
  }

  .revisionError {
    margin: 0;
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.red11};
  }

  .revisionStatus {
    margin: 0;
    font-size: 0.75rem;
    color: ${adminTextPrimary};
  }

  .revisionEmpty {
    margin: 0;
    font-size: 0.75rem;
    color: ${adminTextMuted};
  }

  .revisionList {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
    max-height: 13rem;
    overflow-y: auto;
  }

  .revisionItemBlock {
    display: grid;
    gap: 6px;
  }

  .revisionItem {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 9px;
    border-radius: 6px;
    border: 1px solid ${adminBorderSubtle};
    background: ${adminSurface};
  }

  .revisionActions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .revisionMeta {
    min-width: 0;
    display: grid;
    gap: 2px;

    strong {
      font-size: 0.75rem;
      font-weight: 600;
      color: ${adminTextPrimary};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      font-size: 0.68rem;
      color: ${adminTextMuted};
      font-variant-numeric: tabular-nums;
    }
  }
`
