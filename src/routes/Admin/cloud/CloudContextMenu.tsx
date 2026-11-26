// 참조 구현: supabase/supabase StorageExplorer 컨텍스트 메뉴 패턴 — 뷰포트 클램핑 우클릭/케밥 메뉴
import { useEffect, useRef } from "react"
import type { CloudFile } from "src/apis/backend/cloud"
import { useLanguage } from "src/libs/language"
import { ContextMenuButton, ContextMenuSurface } from "./AdminCloudOverlay.styles"
import { getCloudDictionary } from "./adminCloudI18n"

export type CloudContextMenuState = {
  file: CloudFile
  x: number
  y: number
} | null

export type CloudContextMenuProps = {
  state: CloudContextMenuState
  onClose: () => void
  onPreview: (file: CloudFile) => void
  onRename: (file: CloudFile) => void
  onMove: (file: CloudFile) => void
  onShare: (file: CloudFile) => void
  onDownload: (file: CloudFile) => void
  onDelete: (file: CloudFile) => void
}

const MENU_APPROX_WIDTH = 210
const MENU_APPROX_HEIGHT = 230
const VIEWPORT_PADDING = 8

export const CloudContextMenu = ({
  state,
  onClose,
  onPreview,
  onRename,
  onMove,
  onShare,
  onDownload,
  onDelete,
}: CloudContextMenuProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state) return
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }
    const handleScrollOrResize = () => onClose()

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", handleScrollOrResize)
    window.addEventListener("scroll", handleScrollOrResize, true)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", handleScrollOrResize)
      window.removeEventListener("scroll", handleScrollOrResize, true)
    }
  }, [onClose, state])

  useEffect(() => {
    if (!state) return
    const firstBtn = menuRef.current?.querySelector<HTMLButtonElement>("button")
    firstBtn?.focus({ preventScroll: true })
  }, [state])

  if (!state) return null

  const maxLeft =
    typeof window !== "undefined"
      ? Math.max(VIEWPORT_PADDING, window.innerWidth - MENU_APPROX_WIDTH - VIEWPORT_PADDING)
      : state.x
  const maxTop =
    typeof window !== "undefined"
      ? Math.max(VIEWPORT_PADDING, window.innerHeight - MENU_APPROX_HEIGHT - VIEWPORT_PADDING)
      : state.y

  const left = Math.min(Math.max(VIEWPORT_PADDING, state.x), maxLeft)
  const top = Math.min(Math.max(VIEWPORT_PADDING, state.y), maxTop)
  const { file } = state

  const runAction = (fn: (target: CloudFile) => void) => {
    onClose()
    fn(file)
  }

  return (
    <ContextMenuSurface
      ref={menuRef}
      role="menu"
      aria-label={`${file.originalFilename} ${t.actionMore}`}
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <ContextMenuButton type="button" role="menuitem" onClick={() => runAction(onPreview)}>
        <span>{t.actionPreview}</span>
        <kbd>Enter</kbd>
      </ContextMenuButton>
      <ContextMenuButton type="button" role="menuitem" onClick={() => runAction(onRename)}>
        <span>{t.actionRename}</span>
        <kbd>F2</kbd>
      </ContextMenuButton>
      <ContextMenuButton type="button" role="menuitem" onClick={() => runAction(onMove)}>
        <span>{t.actionMove}</span>
      </ContextMenuButton>
      <ContextMenuButton type="button" role="menuitem" onClick={() => runAction(onShare)}>
        <span>{t.actionShare}</span>
      </ContextMenuButton>
      <ContextMenuButton type="button" role="menuitem" onClick={() => runAction(onDownload)}>
        <span>{t.actionDownload}</span>
      </ContextMenuButton>
      <ContextMenuButton
        type="button"
        role="menuitem"
        $danger
        onClick={() => runAction(onDelete)}
      >
        <span>{t.actionDelete}</span>
        <kbd>Del</kbd>
      </ContextMenuButton>
    </ContextMenuSurface>
  )
}
