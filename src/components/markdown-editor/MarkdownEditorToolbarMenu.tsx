import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import {
  ToolbarMenuChevron,
  ToolbarMenuItem,
  ToolbarMenuPanel,
  ToolbarMenuRoot,
  ToolbarMenuTrigger,
} from "./MarkdownEditor.styles"
import {
  resolveToolbarMenuInitialIndex,
  resolveToolbarMenuMoveIndex,
} from "./markdownEditorToolbarMenuModel"

export type MarkdownEditorToolbarMenuAction = {
  id: string
  label: string
  disabled?: boolean
  onSelect: () => void
}

type MarkdownEditorToolbarMenuProps = {
  label: string
  triggerLabel?: string
  actions: readonly MarkdownEditorToolbarMenuAction[]
  disabled?: boolean
  align?: "start" | "end"
  onBeforeOpen?: () => void
}

export const MarkdownEditorToolbarMenu = ({
  label,
  triggerLabel = label,
  actions,
  disabled = false,
  align = "start",
  onBeforeOpen,
}: MarkdownEditorToolbarMenuProps) => {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()
  const disabledItems = useMemo(
    () => actions.map((action) => Boolean(action.disabled)),
    [actions]
  )

  const openMenu = useCallback((edge: "first" | "last") => {
    if (disabled) return
    onBeforeOpen?.()
    setActiveIndex(resolveToolbarMenuInitialIndex(disabledItems, edge))
    setOpen(true)
  }, [disabled, disabledItems, onBeforeOpen])

  const closeMenu = useCallback((restoreTriggerFocus: boolean) => {
    setOpen(false)
    setActiveIndex(-1)
    if (restoreTriggerFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      closeMenu(false)
    }
    document.addEventListener("pointerdown", handlePointerDown)
    const frameId = window.requestAnimationFrame(() => itemRefs.current[activeIndex]?.focus())
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      window.cancelAnimationFrame(frameId)
    }
  }, [activeIndex, closeMenu, open])

  useEffect(() => {
    if (disabled && open) closeMenu(false)
  }, [closeMenu, disabled, open])

  return (
    <ToolbarMenuRoot ref={rootRef}>
      <ToolbarMenuTrigger
        ref={triggerRef}
        type="button"
        aria-label={`${label} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) {
            closeMenu(false)
            return
          }
          openMenu("first")
        }}
        onKeyDown={(event) => {
          if (open && event.key === "Escape") {
            event.preventDefault()
            closeMenu(true)
            return
          }
          if (open && event.key === "Tab") {
            closeMenu(false)
            return
          }
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openMenu("first")
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            openMenu("last")
          }
        }}
      >
        {triggerLabel}
        <ToolbarMenuChevron aria-hidden="true">▾</ToolbarMenuChevron>
      </ToolbarMenuTrigger>
      {open ? (
        <ToolbarMenuPanel
          id={menuId}
          role="menu"
          aria-label={label}
          $align={align}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            closeMenu(false)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              closeMenu(true)
              return
            }
            let nextIndex = -1
            if (event.key === "ArrowDown") {
              nextIndex = resolveToolbarMenuMoveIndex(disabledItems, activeIndex, "next")
            } else if (event.key === "ArrowUp") {
              nextIndex = resolveToolbarMenuMoveIndex(disabledItems, activeIndex, "previous")
            } else if (event.key === "Home") {
              nextIndex = resolveToolbarMenuInitialIndex(disabledItems, "first")
            } else if (event.key === "End") {
              nextIndex = resolveToolbarMenuInitialIndex(disabledItems, "last")
            } else {
              return
            }

            event.preventDefault()
            setActiveIndex(nextIndex)
          }}
        >
          {actions.map((action, index) => (
            <ToolbarMenuItem
              key={action.id}
              ref={(element) => {
                itemRefs.current[index] = element
              }}
              type="button"
              role="menuitem"
              tabIndex={index === activeIndex ? 0 : -1}
              disabled={action.disabled}
              onMouseEnter={() => {
                if (!action.disabled) setActiveIndex(index)
              }}
              onClick={() => {
                if (action.disabled) return
                action.onSelect()
                closeMenu(false)
              }}
            >
              {action.label}
            </ToolbarMenuItem>
          ))}
        </ToolbarMenuPanel>
      ) : null}
    </ToolbarMenuRoot>
  )
}
