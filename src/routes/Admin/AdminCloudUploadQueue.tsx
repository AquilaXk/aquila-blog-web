/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/components/UploadAssetDialog/UploadProgressDialog.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - transloadit/uppy packages/@uppy/status-bar/src/StatusBar.tsx (MIT License, Copyright (c) Transloadit Ltd)
 */
import styled from "@emotion/styled"
import { type CSSProperties, useMemo } from "react"
import { useLanguage } from "src/libs/language"
import {
  adminFloatingShadow,
  adminGold,
  adminStatusDangerText,
  adminStatusSuccessText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTextMuted,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
import {
  GhostButton,
  QueueHeader,
  QueueItem as BaseQueueItem,
  QueueList,
  QueuePanel as BaseQueuePanel,
} from "./AdminCloudWorkspace.styles"
import {
  formatCloudFileSize,
  getUploadStatusLabel,
  isUploadActive,
  type UploadQueueItem,
} from "./AdminCloudWorkspaceModel"
import { StrapiCheckIcon, StrapiCrossIcon, StrapiUploadIcon } from "./adminStrapiIcons"
import {
  type AggregateQueueProgress,
  computeAggregateQueueProgress,
  formatCloudEta,
  formatCloudTransferRate,
} from "./cloudUploadQueueModel"
import { getCloudDictionary } from "./cloud/adminCloudI18n"

export {
  CloudDeleteConfirmDialog,
  CloudFileTableSection,
  FileTableHead,
  FileThumbnail,
  type CloudFileTableSectionProps,
  type SortableColumnKey,
} from "./cloud/CloudFileTableSection"

type AdminCloudUploadQueueProps = {
  uploadQueue: UploadQueueItem[]
  activeUploadCount: number
  completedUploadCount: number
  aggregateProgress?: AggregateQueueProgress
  onCancelUpload: (item: UploadQueueItem) => void
  onRetryUpload: (item: UploadQueueItem) => void
  onClearFinishedUploads: () => void
}

const AdminCloudUploadQueue = ({
  uploadQueue,
  activeUploadCount,
  completedUploadCount,
  aggregateProgress,
  onCancelUpload,
  onRetryUpload,
  onClearFinishedUploads,
}: AdminCloudUploadQueueProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const isEn = language === "en"
  const computedAggregate = useMemo(
    () => aggregateProgress ?? computeAggregateQueueProgress(uploadQueue),
    [aggregateProgress, uploadQueue]
  )

  if (uploadQueue.length === 0) return null

  const allCompleted = completedUploadCount === uploadQueue.length
  const failedOrCancelledCount = uploadQueue.filter(
    (item) => item.status === "failed" || item.status === "cancelled"
  ).length
  const title =
    activeUploadCount > 0
      ? isEn
        ? `Uploading ${activeUploadCount} item(s)`
        : `항목 ${activeUploadCount}개 업로드 중`
      : allCompleted
        ? isEn
          ? `${completedUploadCount} item(s) uploaded`
          : `항목 ${completedUploadCount}개 업로드 완료`
        : isEn
          ? `${failedOrCancelledCount} upload(s) failed/cancelled`
          : `항목 ${failedOrCancelledCount}개 업로드 실패/취소`
  const StatusTone = activeUploadCount > 0 ? "active" : allCompleted ? "done" : "failed"
  const aggSpeedLabel = formatCloudTransferRate(computedAggregate.speedBps)
  const aggEtaLabel = formatCloudEta(computedAggregate.etaSeconds, language)

  return (
    <ElevatedQueuePanel aria-label={isEn ? "Upload queue" : "업로드 중인 파일"}>
      <QueueHeader>
        <QueueTitleGroup>
          <QueueStatusIcon data-tone={StatusTone} aria-hidden="true">
            {activeUploadCount > 0 ? (
              <StrapiUploadIcon width={18} height={18} />
            ) : allCompleted ? (
              <StrapiCheckIcon width={18} height={18} />
            ) : (
              <StrapiCrossIcon width={18} height={18} />
            )}
          </QueueStatusIcon>
          <div>
            <h2>{title}</h2>
            <p>
              {isEn
                ? `${activeUploadCount} active · ${completedUploadCount} done`
                : `진행 중 ${activeUploadCount}개 · 완료 ${completedUploadCount}개`}
            </p>
          </div>
        </QueueTitleGroup>
        <GhostButton
          type="button"
          aria-label={isEn ? "Clear finished uploads" : "종료된 업로드 항목 지우기"}
          disabled={uploadQueue.every((item) => isUploadActive(item.status))}
          onClick={onClearFinishedUploads}
        >
          <StrapiCrossIcon width={16} height={16} />
        </GhostButton>
      </QueueHeader>
      {activeUploadCount > 0 ? (
        <AggregateProgressBox
          role="progressbar"
          aria-label={isEn ? "Overall upload progress" : "전체 업로드 진행률"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={computedAggregate.percent}
        >
          <AggregateProgressMeta>
            <span>
              {isEn ? "Overall progress" : "전체 업로드 진행률"}
              {aggSpeedLabel ? ` · ${aggSpeedLabel}` : ""}
              {aggEtaLabel ? ` · ${aggEtaLabel}` : ""}
            </span>
            <strong>{computedAggregate.percent}%</strong>
          </AggregateProgressMeta>
          <ProgressTrack style={{ "--progress": `${computedAggregate.percent}%` } as CSSProperties}>
            <span />
          </ProgressTrack>
        </AggregateProgressBox>
      ) : null}
      <QueueList>
        {uploadQueue.map((item) => {
          const itemRate = item.status === "uploading" ? formatCloudTransferRate(item.speedBps) : ""
          const itemEta = item.status === "uploading" ? formatCloudEta(item.etaSeconds, language) : ""
          const byteProgressLabel =
            item.status === "uploading" && typeof item.loadedBytes === "number" && item.loadedBytes > 0
              ? `${formatCloudFileSize(item.loadedBytes)} / ${formatCloudFileSize(item.byteSize)}`
              : formatCloudFileSize(item.byteSize)
          return (
            <SafeQueueItem key={item.id}>
              <div title={item.name}>
                <strong>{item.name}</strong>
                <p>
                  {byteProgressLabel} · {item.message}
                  {itemRate ? ` · ${itemRate}` : ""}
                  {itemEta ? ` · ${itemEta}` : ""}
                </p>
              </div>
              <StatusPill data-status={item.status}>
                {getUploadStatusLabel(item.status, language)}
              </StatusPill>
              {isUploadActive(item.status) ? (
                <GhostButton
                  type="button"
                  aria-label={t.queueCancelFile(item.name)}
                  onClick={() => onCancelUpload(item)}
                >
                  {t.cancel}
                </GhostButton>
              ) : null}
              {item.status === "failed" || item.status === "cancelled" ? (
                <GhostButton
                  type="button"
                  aria-label={t.queueRetryFile(item.name)}
                  onClick={() => onRetryUpload(item)}
                >
                  {isEn ? "Retry" : "다시 시도"}
                </GhostButton>
              ) : null}
              <ProgressTrack style={{ "--progress": `${item.progress}%` } as CSSProperties}>
                <span />
              </ProgressTrack>
            </SafeQueueItem>
          )
        })}
      </QueueList>
    </ElevatedQueuePanel>
  )
}

const ElevatedQueuePanel = styled(BaseQueuePanel)`
  box-shadow: ${adminFloatingShadow};
`

const QueueTitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
`

const QueueStatusIcon = styled.span`
  width: 30px;
  height: 30px;
  border-radius: 6px;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  &[data-tone="done"] {
    color: ${adminStatusSuccessText};
  }
  &[data-tone="failed"] {
    color: ${adminStatusDangerText};
  }
`

const SafeQueueItem = styled(BaseQueueItem)`
  > div:first-of-type {
    min-width: 0;
    overflow: hidden;
  }
`

const AggregateProgressBox = styled.div`
  display: grid;
  gap: 0.32rem;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceMuted};
`

const AggregateProgressMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${adminTextSecondary};
  font-variant-numeric: tabular-nums;
`

const StatusPill = styled.span`
  justify-self: end;
  min-width: 3.55rem;
  max-width: 5.6rem;
  border-radius: 4px;
  padding: 0.22rem 0.45rem;
  background: ${adminSurface};
  color: ${adminGold};
  font-size: 0.7rem;
  font-weight: 750;
  text-align: center;
  white-space: nowrap;

  &[data-status="failed"] {
    color: ${adminStatusDangerText};
  }
  &[data-status="cancelled"] {
    color: ${adminTextMuted};
  }
  &[data-status="done"] {
    color: ${adminStatusSuccessText};
  }
`

const ProgressTrack = styled.div`
  grid-column: 1 / -1;
  height: 0.28rem;
  overflow: hidden;
  border-radius: 2px;
  background: ${adminSurfaceRaised};

  span {
    display: block;
    height: 100%;
    width: var(--progress, 0%);
    border-radius: inherit;
    background: ${adminTeal};
    transition: width 180ms ease;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
`

export default AdminCloudUploadQueue
