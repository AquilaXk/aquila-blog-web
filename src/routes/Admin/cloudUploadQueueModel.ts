// 참조 구현: transloadit/uppy (MIT) — Uppy 동시성 큐 모델 및 합산 진행률
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
    }
  }

  let activeCount = 0
  let completedCount = 0
  let failedCount = 0
  let cancelledCount = 0
  let queuedCount = 0
  let totalBytes = 0
  let loadedBytes = 0

  for (const item of queue) {
    const bytes = Math.max(1, item.byteSize)
    totalBytes += bytes

    switch (item.status) {
      case "uploading":
        activeCount += 1
        loadedBytes += (bytes * Math.min(100, Math.max(0, item.progress))) / 100
        break
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

  return {
    totalCount,
    activeCount,
    completedCount,
    failedCount,
    cancelledCount,
    queuedCount,
    percent: Math.min(100, Math.max(0, percent)),
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
