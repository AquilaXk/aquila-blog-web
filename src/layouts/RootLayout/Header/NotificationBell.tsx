import AppIcon from "src/components/icons/AppIcon"
import { NotificationBellPanel } from "./NotificationBellPanel"
import { StyledWrapper } from "./NotificationBell.styles"
import { useNotificationBellState } from "./useNotificationBellState"

type Props = {
  enabled: boolean
}

const NotificationBell: React.FC<Props> = ({ enabled }) => {
  const {
    rootRef,
    triggerRef,
    panelRef,
    open,
    setOpen,
    isMobileViewport,
    items,
    isSnapshotFallback,
    hasUnavailableNotifications,
    isUnreadCountUnavailable,
    hasUnread,
    unreadBadge,
    handleOpenChange,
    handleMarkAllRead,
    handleMoveToNotification,
  } = useNotificationBellState(enabled)
  const hasUnavailableState = hasUnavailableNotifications || isUnreadCountUnavailable

  if (!enabled) {
    return null
  }

  return (
    <StyledWrapper ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="trigger"
        data-ui="nav-control"
        data-open={open}
        aria-label={hasUnavailableState ? "알림, 상태 확인 필요" : "알림"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => void handleOpenChange()}
      >
        <AppIcon name="bell" />
        {(hasUnread || hasUnavailableState) && (
          <span className="badge" data-unavailable={hasUnavailableState}>
            {hasUnavailableState ? "!" : unreadBadge}
          </span>
        )}
      </button>
      {open && (
        <NotificationBellPanel
          panelRef={panelRef}
          isMobileViewport={isMobileViewport}
          isSnapshotFallback={isSnapshotFallback}
          hasUnavailableNotifications={hasUnavailableNotifications}
          isUnreadCountUnavailable={isUnreadCountUnavailable}
          hasUnread={hasUnread}
          items={items}
          onClose={() => setOpen(false)}
          onMarkAllRead={() => void handleMarkAllRead()}
          onMoveToNotification={(item) => void handleMoveToNotification(item)}
        />
      )}
    </StyledWrapper>
  )
}

export default NotificationBell
