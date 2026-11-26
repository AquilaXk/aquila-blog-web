// 참조 구현: transloadit/uppy (MIT) — 대용량 동영상 분할 이어올리기 세션·조각 재시도·언마운트 보존
import type { components } from "@shared/contracts"
import { ApiError, apiFetch } from "./client"
import {
  createUploadSpeedEstimator,
  isRetryableCloudUploadError,
  resolveCloudRetryDelayMs,
  sendCloudUploadXhr,
} from "./cloudXhrTransport"

export type CloudFileDto = components["schemas"]["CloudFileDto"]
export type CloudMediaKind = NonNullable<CloudFileDto["mediaKind"]>
type RsDataCloudFileDto = components["schemas"]["RsDataCloudFileDto"]
type RsDataVoid = components["schemas"]["RsDataVoid"]
export type CloudVideoUploadSession = components["schemas"]["CloudVideoUploadSessionDto"]
type CloudVideoUploadPartResult = components["schemas"]["CloudVideoUploadPartResultDto"]
type RsDataCloudVideoUploadSession = components["schemas"]["RsDataCloudVideoUploadSessionDto"]

export const CLOUD_SYNC_UPLOAD_MAX_BYTES = 95 * 1024 * 1024
const CLOUD_VIDEO_RESUMABLE_PART_BYTES = 64 * 1024 * 1024
const CLOUD_VIDEO_RESUMABLE_CHUNK_TIMEOUT_MS = 5 * 60_000
const CLOUD_VIDEO_UPLOAD_SESSION_STORAGE_PREFIX = "aquila-cloud-video-upload-session"
const VIDEO_PART_RETRY_BACKOFF_MS = [600, 1500]
export const UPLOADING_PART_CONVERGENCE_BACKOFF_MS = [250, 500, 1000, 1500] as const

export type CloudFile = Required<
  Pick<
    CloudFileDto,
    "id" | "ownerMemberId" | "originalFilename" | "contentType" | "byteSize" | "mediaKind" | "folderPath"
  >
> &
  Pick<CloudFileDto, "createdAt" | "modifiedAt">

export type CloudUploadProgress = {
  progress: number
  message: string
  loadedBytes?: number
  totalBytes?: number
  speedBps?: number
  etaSeconds?: number | null
}

export type CloudUploadOptions = {
  onProgress?: (progress: CloudUploadProgress) => void
  cancelSignal?: AbortSignal
}

export const normalizeCloudFile = (file: CloudFileDto): CloudFile => ({
  id: Number(file.id || 0),
  ownerMemberId: Number(file.ownerMemberId || 0),
  originalFilename: file.originalFilename || "cloud-file",
  contentType: file.contentType || "application/octet-stream",
  byteSize: Number(file.byteSize || 0),
  mediaKind: file.mediaKind || "DOCUMENT",
  folderPath: file.folderPath || "/",
  createdAt: file.createdAt,
  modifiedAt: file.modifiedAt,
})

export const isResumableVideoUploadFile = (file: File) => {
  const lowerName = file.name.toLowerCase()
  const looksLikeVideo =
    file.type.startsWith("video/") ||
    lowerName.endsWith(".mp4") ||
    lowerName.endsWith(".m4v") ||
    lowerName.endsWith(".mov") ||
    lowerName.endsWith(".webm") ||
    lowerName.endsWith(".mkv")
  return looksLikeVideo && file.size > CLOUD_SYNC_UPLOAD_MAX_BYTES
}

const createVideoUploadSession = async (
  file: File,
  folderPath: string,
  signal?: AbortSignal
): Promise<CloudVideoUploadSession> => {
  const response = await apiFetch<RsDataCloudVideoUploadSession>(
    "/system/api/v1/adm/cloud/files/video-upload-sessions",
    {
      method: "POST",
      body: JSON.stringify({
        originalFilename: file.name,
        contentType: file.type || "application/octet-stream",
        byteSize: file.size,
        folderPath,
      }),
      signal,
      timeoutMs: 30_000,
    }
  )
  if (!response.data?.id) throw new Error("대용량 동영상 업로드를 시작하지 못했습니다.")
  return response.data
}

const sleepWithSignal = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Upload aborted", "AbortError"))
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException("Upload aborted", "AbortError"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })

export const isExplicitUploadAbort = (error: unknown, signal?: AbortSignal) => {
  if (signal?.aborted) return true
  if (!(error instanceof Error)) return false
  return error.name === "AbortError"
}

const uploadVideoPart = async (
  sessionId: number,
  partNumber: number,
  chunk: Blob,
  signal?: AbortSignal,
  onPartProgress?: (loadedBytes: number) => void
): Promise<CloudVideoUploadPartResult> => {
  let attempt = 0
  while (true) {
    if (signal?.aborted) throw new DOMException("Upload aborted", "AbortError")
    try {
      const partPath = `/system/api/v1/adm/cloud/files/video-upload-sessions/${sessionId}/parts/${partNumber}`
      if (typeof XMLHttpRequest !== "undefined") {
        return await sendCloudUploadXhr<CloudVideoUploadPartResult>({
          path: partPath,
          method: "PUT",
          body: chunk,
          headers: { "Content-Type": "application/octet-stream" },
          signal,
          timeoutMs: CLOUD_VIDEO_RESUMABLE_CHUNK_TIMEOUT_MS,
          onProgress: (loadedBytes) => onPartProgress?.(loadedBytes),
        })
      }
      return await apiFetch<CloudVideoUploadPartResult>(partPath, {
        method: "PUT",
        body: chunk,
        headers: { "Content-Type": "application/octet-stream" },
        signal,
        timeoutMs: CLOUD_VIDEO_RESUMABLE_CHUNK_TIMEOUT_MS,
      })
    } catch (error) {
      if (isExplicitUploadAbort(error, signal)) throw error
      if (attempt < VIDEO_PART_RETRY_BACKOFF_MS.length && isRetryableCloudUploadError(error)) {
        const delayMs = resolveCloudRetryDelayMs(error, VIDEO_PART_RETRY_BACKOFF_MS[attempt]!)
        attempt += 1
        await sleepWithSignal(delayMs, signal)
        continue
      }
      throw error
    }
  }
}

const completeVideoUploadSession = async (
  sessionId: number,
  signal?: AbortSignal
): Promise<CloudFile> => {
  const response = await apiFetch<RsDataCloudFileDto>(
    `/system/api/v1/adm/cloud/files/video-upload-sessions/${sessionId}/complete`,
    {
      method: "POST",
      signal,
      timeoutMs: 60_000,
    }
  )
  return normalizeCloudFile(response.data || {})
}

const getCloudFile = async (fileId: number, signal?: AbortSignal): Promise<CloudFile> =>
  normalizeCloudFile(
    await apiFetch<CloudFileDto>(`/system/api/v1/adm/cloud/files/${fileId}`, {
      signal,
      timeoutMs: 30_000,
    })
  )

const getVideoUploadSession = (
  sessionId: number,
  signal?: AbortSignal
): Promise<CloudVideoUploadSession> =>
  apiFetch<CloudVideoUploadSession>(`/system/api/v1/adm/cloud/files/video-upload-sessions/${sessionId}`, {
    signal,
    timeoutMs: 30_000,
  })

const cancelVideoUploadSession = async (sessionId: number) => {
  await apiFetch<RsDataVoid>(`/system/api/v1/adm/cloud/files/video-upload-sessions/${sessionId}`, {
    method: "DELETE",
    timeoutMs: 30_000,
  })
}

const buildVideoUploadStorageKey = (file: File, folderPath: string) =>
  [
    CLOUD_VIDEO_UPLOAD_SESSION_STORAGE_PREFIX,
    folderPath.trim(),
    file.name,
    String(file.size),
    String(file.lastModified || 0),
  ].join(":")

export const readStoredVideoUploadSessionId = (storageKey: string): number | null => {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed = Number.parseInt(raw || "", 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

export const storeVideoUploadSessionId = (storageKey: string, sessionId: number) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey, String(sessionId))
  } catch {}
}

export const clearStoredVideoUploadSessionId = (storageKey: string) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(storageKey)
  } catch {}
}

const isMatchingVideoUploadSessionFile = (session: CloudVideoUploadSession, file: File) =>
  Number(session.byteSize || 0) === file.size

export const isDefinitiveStaleVideoUploadSessionError = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 410)

export type ResolvedVideoUploadSession =
  | { kind: "inProgress"; session: CloudVideoUploadSession }
  | { kind: "completing"; session: CloudVideoUploadSession }
  | { kind: "completed"; file: CloudFile }

export const resolveVideoUploadSession = async (
  file: File,
  folderPath: string,
  storageKey: string,
  signal?: AbortSignal,
  backoffScheduleMs: readonly number[] = UPLOADING_PART_CONVERGENCE_BACKOFF_MS
): Promise<ResolvedVideoUploadSession> => {
  const storedSessionId = readStoredVideoUploadSessionId(storageKey)
  if (storedSessionId) {
    try {
      let storedSession = await getVideoUploadSession(storedSessionId, signal)
      let attempt = 0
      while (
        isMatchingVideoUploadSessionFile(storedSession, file) &&
        storedSession.status === "UPLOADING_PART" &&
        attempt < backoffScheduleMs.length
      ) {
        await sleepWithSignal(backoffScheduleMs[attempt]!, signal)
        attempt += 1
        storedSession = await getVideoUploadSession(storedSessionId, signal)
      }
      if (isMatchingVideoUploadSessionFile(storedSession, file)) {
        if (storedSession.status === "COMPLETING") {
          return { kind: "completing", session: storedSession }
        }
        if (storedSession.status === "IN_PROGRESS") {
          return { kind: "inProgress", session: storedSession }
        }
        if (storedSession.status === "COMPLETED" && storedSession.completedFileId) {
          return {
            kind: "completed",
            file: await getCloudFile(storedSession.completedFileId, signal),
          }
        }
        if (storedSession.status === "UPLOADING_PART") {
          throw new ApiError(
            409,
            `/system/api/v1/adm/cloud/files/video-upload-sessions/${storedSessionId}`,
            JSON.stringify({
              msg: "이전 동영상 조각 업로드가 아직 처리 중입니다. 잠시 후 다시 시도해주세요.",
            })
          )
        }
      }
    } catch (error) {
      if (!isDefinitiveStaleVideoUploadSessionError(error)) throw error
    }
    clearStoredVideoUploadSessionId(storageKey)
  }

  const session = await createVideoUploadSession(file, folderPath, signal)
  if (session.id) {
    storeVideoUploadSessionId(storageKey, session.id)
  }
  return { kind: "inProgress", session }
}

export const uploadCloudVideoFileResumable = async (
  file: File,
  folderPath: string,
  signal?: AbortSignal,
  options: CloudUploadOptions = {}
): Promise<CloudFile> => {
  let session: CloudVideoUploadSession | null = null
  const storageKey = buildVideoUploadStorageKey(file, folderPath)
  try {
    options.onProgress?.({
      progress: 2,
      message: "대용량 업로드 준비 중",
      loadedBytes: 0,
      totalBytes: file.size,
    })
    const resolvedSession = await resolveVideoUploadSession(file, folderPath, storageKey, signal)
    if (resolvedSession.kind === "completed") {
      clearStoredVideoUploadSessionId(storageKey)
      return resolvedSession.file
    }

    if (resolvedSession.kind === "completing" && resolvedSession.session.id) {
      session = resolvedSession.session
      const completingId = Number(resolvedSession.session.id)
      options.onProgress?.({
        progress: 98,
        message: "동영상 업로드 완료 처리 중",
        loadedBytes: file.size,
        totalBytes: file.size,
      })
      const completed = await completeVideoUploadSession(completingId, signal)
      clearStoredVideoUploadSessionId(storageKey)
      return completed
    }

    session = resolvedSession.session
    const sessionId = Number(session.id || 0)
    const partSize = Number(session.partSizeBytes || CLOUD_VIDEO_RESUMABLE_PART_BYTES)
    const uploadedParts = new Set(session.uploadedParts || [])
    const totalParts = Number(session.totalParts || Math.ceil(file.size / partSize))
    const estimator = createUploadSpeedEstimator(Math.max(1, file.size))

    let completedBytes = 0
    for (let pn = 1; pn <= totalParts; pn += 1) {
      if (uploadedParts.has(pn)) {
        const s = (pn - 1) * partSize
        const e = Math.min(s + partSize, file.size)
        completedBytes += e - s
      }
    }

    for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
      if (signal?.aborted) throw new DOMException("Upload aborted", "AbortError")
      const start = (partNumber - 1) * partSize
      const end = Math.min(start + partSize, file.size)
      if (!uploadedParts.has(partNumber)) {
        const chunk = file.slice(start, end)
        await uploadVideoPart(sessionId, partNumber, chunk, signal, (partLoadedBytes) => {
          const totalLoaded = Math.min(file.size, completedBytes + partLoadedBytes)
          const metrics = estimator(totalLoaded)
          const progress = Math.min(
            96,
            Math.max(5, Math.round((totalLoaded / Math.max(1, file.size)) * 94))
          )
          options.onProgress?.({
            progress,
            loadedBytes: metrics.loadedBytes,
            totalBytes: metrics.totalBytes,
            speedBps: metrics.speedBps,
            etaSeconds: metrics.etaSeconds,
            message: `동영상 조각 ${uploadedParts.size + 1}/${totalParts} 업로드`,
          })
        })
        completedBytes += end - start
      }
      uploadedParts.add(partNumber)
      const metrics = estimator(completedBytes)
      const progress = Math.min(
        96,
        Math.max(5, Math.round((completedBytes / Math.max(1, file.size)) * 94))
      )
      options.onProgress?.({
        progress,
        loadedBytes: metrics.loadedBytes,
        totalBytes: metrics.totalBytes,
        speedBps: metrics.speedBps,
        etaSeconds: metrics.etaSeconds,
        message: `동영상 조각 ${uploadedParts.size}/${totalParts} 업로드`,
      })
    }

    options.onProgress?.({
      progress: 98,
      message: "동영상 업로드 완료 처리 중",
      loadedBytes: file.size,
      totalBytes: file.size,
    })
    const completed = await completeVideoUploadSession(sessionId, signal)
    clearStoredVideoUploadSessionId(storageKey)
    return completed
  } catch (error) {
    const isUserCancel = Boolean(options.cancelSignal?.aborted)
    if (session?.id && isUserCancel) {
      await cancelVideoUploadSession(session.id).catch(() => undefined)
      clearStoredVideoUploadSessionId(storageKey)
    }
    throw error
  }
}
