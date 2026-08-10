import { expect, test } from "@playwright/test"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { registeredBrowserStorageKeys } from "src/libs/privacy/browserStorageRegistry"
import {
  decodeNotificationEvent,
  decodeNotificationUnavailableEvent,
  resolveNotificationReconnectPlan,
  selectLatestNotificationEventId,
} from "src/layouts/RootLayout/Header/NotificationBellModel"

const notification = {
  id: 61,
  type: "POST_COMMENT" as const,
  createdAt: "2026-08-10T00:00:00Z",
  actorId: 7,
  actorName: "작성자",
  actorProfileImageUrl: "/avatar.png",
  postId: 507,
  commentId: 91,
  postTitle: "알림 계약",
  commentPreview: "댓글 미리보기",
  message: "댓글이 등록되었습니다.",
  isRead: false,
}

test("standard notification은 exact event ID와 schema가 모두 유효할 때만 cursor outcome을 만든다", () => {
  const data = JSON.stringify({ notification, unreadCount: 3 })

  expect(decodeNotificationEvent({ data, lastEventId: "notification-61" })).toEqual({
    eventId: "notification-61",
    notification,
    unreadCount: 3,
  })
  expect(decodeNotificationEvent({ data, lastEventId: "notification-60" })).toBeNull()
  expect(decodeNotificationEvent({ data: "{", lastEventId: "notification-61" })).toBeNull()
  expect(
    decodeNotificationEvent({
      data: JSON.stringify({ notification: { ...notification, message: null }, unreadCount: 3 }),
      lastEventId: "notification-61",
    })
  ).toBeNull()
})

test("notification-unavailable은 event ID와 payload ID가 일치할 때만 cursor outcome을 만든다", () => {
  const data = JSON.stringify({ notificationId: 61, status: "UNAVAILABLE" })

  expect(decodeNotificationUnavailableEvent({ data, lastEventId: "notification-61" })).toEqual({
    eventId: "notification-61",
    notificationId: 61,
  })
  expect(decodeNotificationUnavailableEvent({ data, lastEventId: "notification-62" })).toBeNull()
  expect(
    decodeNotificationUnavailableEvent({
      data: JSON.stringify({ notificationId: 61, status: "AVAILABLE" }),
      lastEventId: "notification-61",
    })
  ).toBeNull()
})

test("manual reconnect cursor는 duplicate·out-of-order event로 후퇴하지 않는다", () => {
  expect(selectLatestNotificationEventId(null, "notification-61")).toBe("notification-61")
  expect(selectLatestNotificationEventId("notification-61", "notification-61")).toBe("notification-61")
  expect(selectLatestNotificationEventId("notification-61", "notification-59")).toBe("notification-61")
  expect(selectLatestNotificationEventId("notification-61", "notification-72")).toBe("notification-72")
  expect(selectLatestNotificationEventId("notification-61", "invalid")).toBe("notification-61")
})

test("SSE reconnect는 네 번까지만 지연 재시도하고 소진 뒤 중단한다", () => {
  expect(resolveNotificationReconnectPlan(0)).toEqual({ nextAttempt: 1, retryDelayMs: 1_500 })
  expect(resolveNotificationReconnectPlan(1)).toEqual({ nextAttempt: 2, retryDelayMs: 3_000 })
  expect(resolveNotificationReconnectPlan(2)).toEqual({ nextAttempt: 3, retryDelayMs: 4_500 })
  expect(resolveNotificationReconnectPlan(3)).toEqual({ nextAttempt: 4, retryDelayMs: 6_000 })
  expect(resolveNotificationReconnectPlan(4)).toEqual({ nextAttempt: 5, retryDelayMs: null })
})

test("notification snapshot과 stream URL은 stale·relative fallback 없이 실패한다", () => {
  const clientSource = readFileSync(path.resolve(__dirname, "../../src/apis/backend/client.ts"), "utf8")
  const notificationApiSource = readFileSync(
    path.resolve(__dirname, "../../src/apis/backend/notifications.ts"),
    "utf8"
  )
  const snapshotPolicy = clientSource.match(
    /matcher: \/\^\\\/member\\\/api\\\/v1\\\/notifications\\\/snapshot[\s\S]*?\n  },/
  )?.[0]
  const streamBuilder = notificationApiSource.slice(
    notificationApiSource.indexOf("export const buildNotificationStreamUrl")
  )

  expect(snapshotPolicy).toContain('cacheMode: "no-store"')
  expect(snapshotPolicy).toContain("staleIfError: false")
  expect(streamBuilder).not.toContain("try {")
  expect(streamBuilder).not.toContain("catch {")
})

test("notification runtime은 polling이나 legacy session snapshot을 healthy source로 사용하지 않는다", () => {
  const headerRoot = path.resolve(__dirname, "../../src/layouts/RootLayout/Header")
  const modelSource = readFileSync(path.join(headerRoot, "NotificationBellModel.ts"), "utf8")
  const stateSource = readFileSync(path.join(headerRoot, "useNotificationBellState.ts"), "utf8")
  const transportSource = readFileSync(path.join(headerRoot, "useNotificationBellTransport.ts"), "utf8")

  expect(existsSync(path.join(headerRoot, "notificationStreamRecovery.ts"))).toBe(false)
  for (const source of [modelSource, stateSource, transportSource]) {
    expect(source).not.toContain("NEXT_PUBLIC_NOTIFICATION_STREAM_MODE")
    expect(source).not.toContain("persistSnapshot")
    expect(source).not.toContain("loadStoredSnapshot")
    expect(source).not.toContain('setStreamMode("poll")')
  }
  expect(stateSource).not.toContain("toLatestNotificationEventId")
  expect(modelSource).toContain("window.sessionStorage.removeItem(LEGACY_SNAPSHOT_STORAGE_KEY)")
  expect(modelSource).not.toContain("window.sessionStorage.getItem(LEGACY_SNAPSHOT_STORAGE_KEY)")
  expect(modelSource).not.toContain("window.sessionStorage.setItem(LEGACY_SNAPSHOT_STORAGE_KEY")
})

test("legacy notification snapshot registry는 신규 저장 없이 초기화 삭제만 기록한다", () => {
  const legacySnapshotEntry = registeredBrowserStorageKeys.find(
    (entry) => entry.key === "member.notification.snapshot.v1"
  )

  expect(legacySnapshotEntry).toEqual(
    expect.objectContaining({
      area: "sessionStorage",
      purpose: "notification-legacy-snapshot-cleanup",
      retention: "removed on next notification initialization",
      stores: "no new data; legacy notification snapshot key removal only",
    })
  )
})
