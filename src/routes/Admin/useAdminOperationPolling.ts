// 참조 구현: felixmosh/bull-board (MIT) — 작업 상태 지수 백오프 자동 폴링 훅
import { useCallback, useEffect, useRef, useState } from "react"
import { apiFetch } from "src/apis/backend/client"

export const POLLING_DELAYS_MS = [700, 1400, 2800, 4000, 4000, 4000, 4000, 4000] as const
export const MAX_POLL_ATTEMPTS = POLLING_DELAYS_MS.length

export type OperationPollingOptions = {
  operationId: string | null | undefined
  isAccepted: boolean
  onReceipt: (response: unknown) => void
  onFailure?: (error: unknown) => void
  enabled?: boolean
}

export const formatOperationPollingStatus = (
  isPolling: boolean,
  pollAttempt: number,
  maxAttempts: number = MAX_POLL_ATTEMPTS
): string => {
  if (isPolling) {
    return `자동 폴링 확인 중 (${Math.max(1, pollAttempt)}/${maxAttempts})`
  }
  if (pollAttempt >= maxAttempts) {
    return `자동 폴링 완료 (${maxAttempts}/${maxAttempts})`
  }
  return `자동 폴링 대기 (${pollAttempt}/${maxAttempts})`
}

export const useAdminOperationPolling = ({
  operationId,
  isAccepted,
  onReceipt,
  onFailure,
  enabled = true,
}: OperationPollingOptions) => {
  const [pollAttempt, setPollAttempt] = useState(0)
  const [isPolling, setIsPolling] = useState(false)
  const timerRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)
  const onReceiptRef = useRef(onReceipt)
  const onFailureRef = useRef(onFailure)

  onReceiptRef.current = onReceipt
  onFailureRef.current = onFailure

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const pollOnce = useCallback(async (opId: string) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsPolling(true)
    try {
      const response = await apiFetch(`/system/api/v1/adm/operations/${opId}`, {
        cache: "no-store",
      })
      onReceiptRef.current(response)
    } catch (err) {
      onFailureRef.current?.(err)
    } finally {
      inFlightRef.current = false
      setIsPolling(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !operationId || !isAccepted) {
      clearTimer()
      setPollAttempt(0)
      setIsPolling(false)
      return
    }

    if (pollAttempt >= MAX_POLL_ATTEMPTS) {
      clearTimer()
      setIsPolling(false)
      return
    }

    const delay = POLLING_DELAYS_MS[pollAttempt] ?? 4000
    timerRef.current = window.setTimeout(() => {
      setPollAttempt((prev) => prev + 1)
      void pollOnce(operationId)
    }, delay)

    return clearTimer
  }, [clearTimer, enabled, isAccepted, operationId, pollAttempt, pollOnce])

  return {
    isPolling,
    pollAttempt,
    maxAttempts: MAX_POLL_ATTEMPTS,
    resetPolling: () => {
      clearTimer()
      setPollAttempt(0)
      setIsPolling(false)
    },
  }
}
