import { expect, test } from "@playwright/test"
import {
  decodeNotificationEvent,
  decodeNotificationUnavailableEvent,
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
