// 참조 구현: transloadit/uppy (MIT) — @uppy/xhr-upload 바이트 진행률 및 @uppy/utils emaFilter EMA 속도/ETA 추정
import {
  ApiError,
  ApiNetworkError,
  ApiTimeoutError,
  CSRF_PREFLIGHT_HEADERS,
  getApiRequestUrl,
} from "./client"

export class CloudApiError extends ApiError {
  retryAfterMs: number | null

  constructor(
    status: number,
    url: string,
    body: string,
    requestId: string | null = null,
    retryAfterMs: number | null = null
  ) {
    super(status, url, body, requestId)
    this.retryAfterMs = retryAfterMs
  }
}

export const isRetryableCloudUploadError = (error: unknown): boolean => {
  if (error instanceof ApiNetworkError || error instanceof ApiTimeoutError) {
    return true
  }
  if (error instanceof ApiError) {
    return (
      error.status === 408 ||
      error.status === 429 ||
      error.status === 500 ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504
    )
  }
  if (error instanceof TypeError) {
    return true
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return true
  }
  return false
}

export const resolveCloudRetryDelayMs = (error: unknown, fallbackMs: number): number => {
  if (error instanceof CloudApiError && error.retryAfterMs !== null) {
    return Math.max(fallbackMs, error.retryAfterMs)
  }
  return fallbackMs
}

export const parseRetryAfterMs = (headerValue: string | null, nowMs = Date.now()): number | null => {
  if (!headerValue) return null
  const trimmed = headerValue.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10)
    if (!Number.isFinite(seconds) || seconds < 0) return null
    return Math.min(30_000, Math.max(250, seconds * 1_000))
  }
  const targetEpoch = Date.parse(trimmed)
  if (!Number.isFinite(targetEpoch)) return null
  const delta = targetEpoch - nowMs
  return Math.min(30_000, Math.max(250, delta))
}

export type UploadTransferMetrics = {
  loadedBytes: number
  totalBytes: number
  speedBps: number
  etaSeconds: number | null
}

// transloadit/uppy @uppy/utils/src/emaFilter.ts 알고리즘 (time-weighted EMA)
const EMA_HALF_LIFE_MS = 2_000
const MIN_SAMPLE_DELTA_MS = 80

export const createUploadSpeedEstimator = (totalBytes: number, startTimeMs = Date.now()) => {
  let lastBytes = 0
  let lastSampleMs = startTimeMs
  let emaSpeedBps = 0

  return (loadedBytes: number, nowMs = Date.now()): UploadTransferMetrics => {
    const clampedLoaded = Math.max(0, Math.min(totalBytes, loadedBytes))
    const dtMs = nowMs - lastSampleMs
    const deltaBytes = clampedLoaded - lastBytes

    if (dtMs >= MIN_SAMPLE_DELTA_MS && deltaBytes >= 0) {
      const instantSpeedBps = (deltaBytes * 1_000) / dtMs
      const alpha = 1 - Math.pow(0.5, dtMs / EMA_HALF_LIFE_MS)
      emaSpeedBps =
        emaSpeedBps === 0
          ? instantSpeedBps
          : emaSpeedBps + alpha * (instantSpeedBps - emaSpeedBps)
      lastBytes = clampedLoaded
      lastSampleMs = nowMs
    }

    const remainingBytes = Math.max(0, totalBytes - clampedLoaded)
    const speedBps = Math.max(0, Math.round(emaSpeedBps))
    const etaSeconds =
      remainingBytes === 0
        ? 0
        : speedBps > 0
          ? Math.max(1, Math.ceil(remainingBytes / speedBps))
          : null

    return {
      loadedBytes: clampedLoaded,
      totalBytes,
      speedBps,
      etaSeconds,
    }
  }
}

export type XhrUploadParams = {
  path: string
  method: "POST" | "PUT"
  body: FormData | Blob
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs: number
  onProgress?: (loadedBytes: number, totalBytes: number) => void
}

const PROGRESS_THROTTLE_MS = 80

export const sendCloudUploadXhr = <T>({
  path,
  method,
  body,
  headers,
  signal,
  timeoutMs,
  onProgress,
}: XhrUploadParams): Promise<T> => {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Upload aborted", "AbortError"))
  }

  const url = getApiRequestUrl(path)
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let settled = false
    let lastEmitAt = 0

    const cleanup = () => {
      signal?.removeEventListener("abort", handleAbort)
    }

    const handleAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      try {
        xhr.abort()
      } catch {
        // ignore abort errors during teardown
      }
      reject(new DOMException("Upload aborted", "AbortError"))
    }

    signal?.addEventListener("abort", handleAbort, { once: true })

    xhr.open(method, url, true)
    xhr.withCredentials = true
    xhr.timeout = timeoutMs
    xhr.setRequestHeader(
      "X-Aquila-CSRF",
      CSRF_PREFLIGHT_HEADERS["X-Aquila-CSRF"]
    )
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== "x-aquila-csrf") {
          xhr.setRequestHeader(key, value)
        }
      })
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || settled) return
      const now = Date.now()
      const total = event.lengthComputable && event.total > 0 ? event.total : 0
      if (
        event.loaded === total ||
        lastEmitAt === 0 ||
        now - lastEmitAt >= PROGRESS_THROTTLE_MS
      ) {
        lastEmitAt = now
        onProgress(event.loaded, total)
      }
    }

    xhr.onload = () => {
      if (settled) return
      settled = true
      cleanup()

      const requestId = xhr.getResponseHeader("x-request-id")
      if (xhr.status < 200 || xhr.status >= 300) {
        const retryAfterMs = parseRetryAfterMs(xhr.getResponseHeader("retry-after"))
        reject(
          new CloudApiError(
            xhr.status,
            url,
            xhr.responseText || "",
            requestId,
            retryAfterMs
          )
        )
        return
      }

      if (xhr.status === 204 || !xhr.responseText || xhr.responseText.trim() === "") {
        resolve(undefined as T)
        return
      }

      try {
        resolve(JSON.parse(xhr.responseText) as T)
      } catch {
        resolve(xhr.responseText as unknown as T)
      }
    }

    xhr.onerror = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new ApiNetworkError(url, xhr.getResponseHeader("x-request-id")))
    }

    xhr.ontimeout = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new ApiTimeoutError(url, timeoutMs, xhr.getResponseHeader("x-request-id")))
    }

    xhr.onabort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new DOMException("Upload aborted", "AbortError"))
    }

    xhr.send(body)
  })
}
