import type {
  TMemberNotification,
  TMemberNotificationStreamPayload,
  TMemberNotificationUnavailablePayload,
} from "src/types"

export type SnapshotLoadStatus = "success" | "blocked" | "error"
export type NotificationAccessState = "pending" | "ready" | "unavailable" | "blocked"

export const STREAM_MAX_RECONNECT_ATTEMPTS = 4
export const HIDDEN_GRACE_CLOSE_MS = 45_000
export const LAST_EVENT_ID_STORAGE_KEY = "member.notification.lastEventId.v1"
export const LEGACY_SNAPSHOT_STORAGE_KEY = "member.notification.snapshot.v1"
export const NOTIFICATION_EVENT_ID_REGEX = /^notification-[1-9]\d*$/
export const AVATAR_PRELOAD_LIMIT = 8
export const AVATAR_PRELOAD_CACHE_MAX = 128

export type EventSourceLifecycleState = "idle" | "connecting" | "open"
export type NotificationReconnectPlan = {
  nextAttempt: number
  retryDelayMs: number | null
}

export const resolveNotificationReconnectPlan = (completedAttempts: number): NotificationReconnectPlan => {
  const nextAttempt = completedAttempts + 1
  return {
    nextAttempt,
    retryDelayMs: nextAttempt > STREAM_MAX_RECONNECT_ATTEMPTS ? null : Math.min(1_500 * nextAttempt, 10_000),
  }
}

export const sanitizeNotificationEventId = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  const normalized = raw.trim()
  if (!NOTIFICATION_EVENT_ID_REGEX.test(normalized)) return null
  return normalized
}

type NotificationEventInput = {
  data: string
  lastEventId: string
}

export type DecodedNotificationEvent = TMemberNotificationStreamPayload & {
  eventId: string
}

export type DecodedNotificationUnavailableEvent = Pick<TMemberNotificationUnavailablePayload, "notificationId"> & {
  eventId: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0

const isMemberNotification = (value: unknown): value is TMemberNotification => {
  if (!isRecord(value)) return false
  if (value.type !== "COMMENT_REPLY" && value.type !== "POST_COMMENT") return false

  return (
    isPositiveSafeInteger(value.id) &&
    typeof value.createdAt === "string" &&
    isPositiveSafeInteger(value.actorId) &&
    typeof value.actorName === "string" &&
    (value.actorProfileImageDirectUrl === undefined || typeof value.actorProfileImageDirectUrl === "string") &&
    typeof value.actorProfileImageUrl === "string" &&
    isPositiveSafeInteger(value.postId) &&
    isPositiveSafeInteger(value.commentId) &&
    typeof value.postTitle === "string" &&
    typeof value.commentPreview === "string" &&
    typeof value.message === "string" &&
    typeof value.isRead === "boolean"
  )
}

const parseNotificationEventData = (data: string): unknown => {
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export const decodeNotificationEvent = ({
  data,
  lastEventId,
}: NotificationEventInput): DecodedNotificationEvent | null => {
  const eventId = sanitizeNotificationEventId(lastEventId)
  const parsed = parseNotificationEventData(data)
  if (!eventId || !isRecord(parsed) || !isMemberNotification(parsed.notification)) return null
  if (!isNonNegativeSafeInteger(parsed.unreadCount)) return null
  if (eventId !== `notification-${parsed.notification.id}`) return null

  return {
    eventId,
    notification: parsed.notification,
    unreadCount: parsed.unreadCount,
  }
}

export const decodeNotificationUnavailableEvent = ({
  data,
  lastEventId,
}: NotificationEventInput): DecodedNotificationUnavailableEvent | null => {
  const eventId = sanitizeNotificationEventId(lastEventId)
  const parsed = parseNotificationEventData(data)
  if (!eventId || !isRecord(parsed) || parsed.status !== "UNAVAILABLE") return null
  if (!isPositiveSafeInteger(parsed.notificationId)) return null
  if (eventId !== `notification-${parsed.notificationId}`) return null

  return {
    eventId,
    notificationId: parsed.notificationId,
  }
}

export const selectLatestNotificationEventId = (
  current: string | null,
  candidate: string | null
): string | null => {
  const currentEventId = sanitizeNotificationEventId(current)
  const candidateEventId = sanitizeNotificationEventId(candidate)
  if (!candidateEventId) return currentEventId
  if (!currentEventId) return candidateEventId

  const currentId = BigInt(currentEventId.slice("notification-".length))
  const candidateId = BigInt(candidateEventId.slice("notification-".length))
  return candidateId > currentId ? candidateEventId : currentEventId
}

export const resolveNotificationEventAdvance = (current: string | null, candidate: string | null) => {
  const currentEventId = sanitizeNotificationEventId(current)
  const eventId = selectLatestNotificationEventId(currentEventId, candidate)
  return {
    eventId,
    advanced: eventId !== currentEventId,
  }
}

export const persistLastEventId = (eventId: string | null) => {
  if (typeof window === "undefined") return
  if (!eventId) {
    window.sessionStorage.removeItem(LAST_EVENT_ID_STORAGE_KEY)
    return
  }
  window.sessionStorage.setItem(LAST_EVENT_ID_STORAGE_KEY, eventId)
}

export const loadStoredLastEventId = (): string | null => {
  if (typeof window === "undefined") return null
  return sanitizeNotificationEventId(window.sessionStorage.getItem(LAST_EVENT_ID_STORAGE_KEY))
}

export const clearLegacyStoredNotificationSnapshot = () => {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(LEGACY_SNAPSHOT_STORAGE_KEY)
}

export const isSameNotification = (left: TMemberNotification, right: TMemberNotification) =>
  left.id === right.id &&
  left.type === right.type &&
  left.createdAt === right.createdAt &&
  left.actorId === right.actorId &&
  left.actorName === right.actorName &&
  left.actorProfileImageDirectUrl === right.actorProfileImageDirectUrl &&
  left.actorProfileImageUrl === right.actorProfileImageUrl &&
  left.postId === right.postId &&
  left.commentId === right.commentId &&
  left.postTitle === right.postTitle &&
  left.commentPreview === right.commentPreview &&
  left.message === right.message &&
  left.isRead === right.isRead

export const isSameNotificationList = (left: TMemberNotification[], right: TMemberNotification[]) => {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    if (!isSameNotification(left[i], right[i])) return false
  }
  return true
}

export const resolveNotificationAvatarSrc = (item: TMemberNotification) =>
  item.actorProfileImageDirectUrl || item.actorProfileImageUrl || ""
