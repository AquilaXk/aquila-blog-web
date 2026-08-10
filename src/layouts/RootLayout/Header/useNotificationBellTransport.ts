import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect } from "react"
import { buildNotificationStreamUrl } from "src/apis/backend/notifications"
import type { TMemberNotification } from "src/types"
import {
  decodeNotificationEvent,
  decodeNotificationUnavailableEvent,
  type EventSourceLifecycleState,
  HIDDEN_GRACE_CLOSE_MS,
  type NotificationAccessState,
  type SnapshotLoadStatus,
  resolveNotificationReconnectPlan,
} from "./NotificationBellModel"

type UseNotificationBellTransportParams = {
  enabled: boolean
  isRealtimeActive: boolean
  notificationAccessState: NotificationAccessState
  isDocumentVisible: boolean
  isDocumentVisibleRef: MutableRefObject<boolean>
  eventSourceRef: MutableRefObject<EventSource | null>
  eventSourceCleanupRef: MutableRefObject<(() => void) | null>
  attachEventSourceRef: MutableRefObject<(() => void) | null>
  clearReconnectTimerRef: MutableRefObject<() => void>
  hiddenCloseTimerRef: MutableRefObject<number | null>
  intentionalCloseRef: MutableRefObject<boolean>
  streamLifecycleRef: MutableRefObject<EventSourceLifecycleState>
  reconnectTimerRef: MutableRefObject<number | null>
  reconnectAttemptRef: MutableRefObject<number>
  lastEventIdRef: MutableRefObject<string | null>
  unreadCountRef: MutableRefObject<number>
  closeEventSource: (intentional: boolean) => void
  clearHiddenCloseTimer: () => void
  loadSnapshot: () => Promise<SnapshotLoadStatus>
  pushNotification: (incoming: TMemberNotification) => void
  markNotificationDataUnavailable: () => void
  setLastNotificationEventId: (eventId: string | null) => void
  setUnreadCount: Dispatch<SetStateAction<number>>
  setIsReady: Dispatch<SetStateAction<boolean>>
}

const canUseNotificationStream = (accessState: NotificationAccessState) =>
  accessState === "ready" || accessState === "unavailable"

export const useNotificationBellTransport = ({
  enabled,
  isRealtimeActive,
  notificationAccessState,
  isDocumentVisible,
  isDocumentVisibleRef,
  eventSourceRef,
  eventSourceCleanupRef,
  attachEventSourceRef,
  clearReconnectTimerRef,
  hiddenCloseTimerRef,
  intentionalCloseRef,
  streamLifecycleRef,
  reconnectTimerRef,
  reconnectAttemptRef,
  lastEventIdRef,
  unreadCountRef,
  closeEventSource,
  clearHiddenCloseTimer,
  loadSnapshot,
  pushNotification,
  markNotificationDataUnavailable,
  setLastNotificationEventId,
  setUnreadCount,
  setIsReady,
}: UseNotificationBellTransportParams) => {
  useEffect(() => {
    if (!enabled || !isRealtimeActive || !canUseNotificationStream(notificationAccessState)) {
      clearReconnectTimerRef.current()
      attachEventSourceRef.current = null
      closeEventSource(true)
      return
    }

    let disposed = false

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    clearReconnectTimerRef.current = clearReconnectTimer

    const scheduleReconnect = () => {
      if (disposed || reconnectTimerRef.current !== null || intentionalCloseRef.current) return

      setIsReady(false)
      markNotificationDataUnavailable()
      const reconnectPlan = resolveNotificationReconnectPlan(reconnectAttemptRef.current)
      reconnectAttemptRef.current = reconnectPlan.nextAttempt
      if (reconnectPlan.retryDelayMs === null) {
        closeEventSource(false)
        return
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        attachEventSourceRef.current?.()
      }, reconnectPlan.retryDelayMs)
    }

    const attachEventSource = () => {
      if (disposed || !isDocumentVisibleRef.current) return
      if (streamLifecycleRef.current === "connecting" || streamLifecycleRef.current === "open") return
      if (eventSourceRef.current) return

      clearReconnectTimer()
      intentionalCloseRef.current = false
      streamLifecycleRef.current = "connecting"
      const streamUrl = new URL(buildNotificationStreamUrl(), window.location.origin)
      if (lastEventIdRef.current) {
        streamUrl.searchParams.set("lastEventId", lastEventIdRef.current)
      }

      const eventSource = new EventSource(streamUrl.toString(), { withCredentials: true })
      eventSourceRef.current = eventSource

      const markStreamOpen = () => {
        streamLifecycleRef.current = "open"
      }

      const handleNotification = (event: MessageEvent<string>) => {
        markStreamOpen()
        const decoded = decodeNotificationEvent(event)
        if (!decoded) {
          markNotificationDataUnavailable()
          return
        }

        setLastNotificationEventId(decoded.eventId)
        pushNotification(decoded.notification)
        setUnreadCount((previous) => {
          if (previous === decoded.unreadCount) return previous
          unreadCountRef.current = decoded.unreadCount
          return decoded.unreadCount
        })
        setIsReady(true)
      }

      const handleNotificationUnavailable = (event: MessageEvent<string>) => {
        markStreamOpen()
        const decoded = decodeNotificationUnavailableEvent(event)
        if (!decoded) {
          markNotificationDataUnavailable()
          return
        }

        setLastNotificationEventId(decoded.eventId)
        markNotificationDataUnavailable()
        setIsReady(true)
      }

      const handleConnected = () => {
        markStreamOpen()
        const recovered = reconnectAttemptRef.current > 0
        reconnectAttemptRef.current = 0
        setIsReady(true)
        if (recovered) {
          void loadSnapshot()
        }
      }

      const handleHeartbeat = () => {
        markStreamOpen()
        reconnectAttemptRef.current = 0
        setIsReady(true)
      }

      const detachListeners = () => {
        eventSource.removeEventListener("connected", handleConnected)
        eventSource.removeEventListener("notification", handleNotification)
        eventSource.removeEventListener("notification-unavailable", handleNotificationUnavailable)
        eventSource.removeEventListener("heartbeat", handleHeartbeat)
        eventSource.onerror = null
      }

      eventSourceCleanupRef.current = detachListeners
      eventSource.addEventListener("connected", handleConnected)
      eventSource.addEventListener("notification", handleNotification)
      eventSource.addEventListener("notification-unavailable", handleNotificationUnavailable)
      eventSource.addEventListener("heartbeat", handleHeartbeat)
      eventSource.onerror = () => {
        const isIntentionalClose = intentionalCloseRef.current || disposed
        detachListeners()
        eventSource.close()
        if (eventSourceRef.current === eventSource) {
          eventSourceRef.current = null
        }
        streamLifecycleRef.current = "idle"
        if (isIntentionalClose) return
        markNotificationDataUnavailable()
        scheduleReconnect()
      }
    }

    attachEventSourceRef.current = attachEventSource
    if (isDocumentVisibleRef.current) {
      attachEventSource()
    }

    return () => {
      disposed = true
      attachEventSourceRef.current = null
      clearReconnectTimer()
      clearReconnectTimerRef.current = () => {}
      closeEventSource(true)
    }
  }, [
    attachEventSourceRef,
    clearReconnectTimerRef,
    closeEventSource,
    enabled,
    eventSourceCleanupRef,
    eventSourceRef,
    intentionalCloseRef,
    isDocumentVisibleRef,
    isRealtimeActive,
    lastEventIdRef,
    loadSnapshot,
    markNotificationDataUnavailable,
    notificationAccessState,
    pushNotification,
    reconnectAttemptRef,
    reconnectTimerRef,
    setIsReady,
    setLastNotificationEventId,
    setUnreadCount,
    streamLifecycleRef,
    unreadCountRef,
  ])

  useEffect(() => {
    if (!enabled || !isRealtimeActive || !canUseNotificationStream(notificationAccessState)) {
      clearHiddenCloseTimer()
      return
    }

    if (!isDocumentVisible) {
      if (hiddenCloseTimerRef.current !== null) return
      hiddenCloseTimerRef.current = window.setTimeout(() => {
        hiddenCloseTimerRef.current = null
        clearReconnectTimerRef.current()
        closeEventSource(true)
      }, HIDDEN_GRACE_CLOSE_MS)
      return
    }

    clearHiddenCloseTimer()
    reconnectAttemptRef.current = 0
    attachEventSourceRef.current?.()
  }, [
    attachEventSourceRef,
    clearHiddenCloseTimer,
    clearReconnectTimerRef,
    closeEventSource,
    enabled,
    hiddenCloseTimerRef,
    isDocumentVisible,
    isRealtimeActive,
    notificationAccessState,
    reconnectAttemptRef,
  ])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handlePageExit = () => {
      clearHiddenCloseTimer()
      clearReconnectTimerRef.current()
      closeEventSource(true)
    }

    window.addEventListener("pagehide", handlePageExit)
    window.addEventListener("beforeunload", handlePageExit)
    return () => {
      window.removeEventListener("pagehide", handlePageExit)
      window.removeEventListener("beforeunload", handlePageExit)
    }
  }, [clearHiddenCloseTimer, clearReconnectTimerRef, closeEventSource])

  useEffect(() => {
    if (!enabled || !isRealtimeActive || !isDocumentVisible) return
    if (!canUseNotificationStream(notificationAccessState)) return

    const handleOnline = () => {
      clearReconnectTimerRef.current()
      reconnectAttemptRef.current = 0
      attachEventSourceRef.current?.()
    }

    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [
    attachEventSourceRef,
    clearReconnectTimerRef,
    enabled,
    isDocumentVisible,
    isRealtimeActive,
    notificationAccessState,
    reconnectAttemptRef,
  ])
}
