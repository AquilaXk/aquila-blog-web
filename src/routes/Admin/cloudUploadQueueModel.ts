// 참조 구현: transloadit/uppy (MIT) — Uppy 동시성 큐 모델·EMA 전송 속도·ETA·합산 진행률
import { formatFileSize } from "src/libs/utils"
import type { UploadQueueItem } from "./AdminCloudWorkspaceModel"

export const MAX_CONCURRENT_CLOUD_UPLOADS = 3

export type AggregateQueueProgress = {
  totalCount: number
  activeCount: number
  completedCount: number
  failedCount: number
  cancelledCount: number
  queuedCount: number
  percent: number
  loadedBytes: number
  totalBytes: number
  speedBps: number
  etaSeconds: number | null
}

export const formatCloudTransferRate = (speedBps?: number): string => {
  if (!speedBps || !Number.isFinite(speedBps) || speedBps <= 0) return ""
  return `${formatFileSize(speedBps, { fallback: "0 B" })}/s`
}

export const formatCloudEta = (
  etaSeconds: number | null | undefined,
  language: "ko" | "en" = "ko"
): string => {
  if (etaSeconds === null || etaSeconds === undefined || !Number.isFinite(etaSeconds) || etaSeconds <= 0) {
    return ""
  }
  const rounded = Math.ceil(etaSeconds)
  if (rounded < 60) {
    return language === "en" ? `~${rounded}s left` : `약 ${rounded}초 남음`
  }
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return language === "en"
    ? `~${minutes}m ${seconds}s left`
    : `약 ${minutes}분 ${seconds}초 남음`
}

export const computeAggregateQueueProgress = (
  queue: readonly UploadQueueItem[]
): AggregateQueueProgress => {
  const totalCount = queue.length
  if (totalCount === 0) {
    return {
      totalCount: 0,
      activeCount: 0,
      completedCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      queuedCount: 0,
      percent: 100,
      loadedBytes: 0,
      totalBytes: 0,
      speedBps: 0,
      etaSeconds: null,
    }
  }

  let activeCount = 0
  let completedCount = 0
  let failedCount = 0
  let cancelledCount = 0
  let queuedCount = 0
  let totalBytes = 0
  let loadedBytes = 0
  let activeSpeedBps = 0

  for (const item of queue) {
    const bytes = Math.max(1, item.byteSize)
    totalBytes += bytes

    switch (item.status) {
      case "uploading": {
        activeCount += 1
        const itemLoaded =
          typeof item.loadedBytes === "number" && item.loadedBytes >= 0
            ? Math.min(bytes, item.loadedBytes)
            : (bytes * Math.min(100, Math.max(0, item.progress))) / 100
        loadedBytes += itemLoaded
        if (typeof item.speedBps === "number" && item.speedBps > 0) {
          activeSpeedBps += item.speedBps
        }
        break
      }
      case "done":
        completedCount += 1
        loadedBytes += bytes
        break
      case "queued":
        queuedCount += 1
        break
      case "failed":
        failedCount += 1
        break
      case "cancelled":
        cancelledCount += 1
        break
    }
  }

  const percent = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0
  const remainingBytes = Math.max(0, totalBytes - loadedBytes)
  const etaSeconds =
    activeSpeedBps > 0 && remainingBytes > 0
      ? Math.max(1, Math.ceil(remainingBytes / activeSpeedBps))
      : null

  return {
    totalCount,
    activeCount,
    completedCount,
    failedCount,
    cancelledCount,
    queuedCount,
    percent: Math.min(100, Math.max(0, percent)),
    loadedBytes: Math.round(loadedBytes),
    totalBytes,
    speedBps: Math.round(activeSpeedBps),
    etaSeconds,
  }
}

export const computeShiftRangeSelection = (
  lastIndex: number,
  currentIndex: number,
  allIds: readonly number[]
): number[] => {
  const start = Math.min(lastIndex, currentIndex)
  const end = Math.max(lastIndex, currentIndex)
  return allIds.slice(start, end + 1)
}
