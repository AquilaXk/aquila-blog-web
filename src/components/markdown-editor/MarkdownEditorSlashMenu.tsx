import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { zIndexes } from "src/styles/zIndexes"

export type SlashMenuItem = {
  id: string
  label: string
  description: string
  icon: string
  action: () => void
}

type MarkdownEditorSlashMenuProps = {
  isOpen: boolean
  position: { top: number; left: number } | null
  items: SlashMenuItem[]
  onClose: () => void
}

const SlashMenuContainer = styled.div<{ $top: number; $left: number }>`
  position: fixed;
  z-index: ${zIndexes.dropdownMenu + 10};
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: 260px;
  max-height: 320px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: slashMenuFadeIn 0.12s ease-out;

  @keyframes slashMenuFadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`

const SlashMenuHeading = styled.div`
  padding: 4px 8px 6px;
  font: 700 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.gray9};
  border-bottom: 1px solid ${({ theme }) => theme.publicDesign.border};
  margin-bottom: 4px;
`

const SlashMenuItemButton = styled.button<{ $active: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: ${({ theme, $active }) => ($active ? theme.publicDesign.surfaceElevated : "transparent")};
  color: ${({ theme }) => theme.colors.gray12};
  cursor: pointer;
  text-align: left;
  transition: background-color 0.1s ease;

  ${focusVisibleRing}

  &:hover {
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 4px;
    border: 1px solid ${({ theme }) => theme.colors.gray6};
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    font: 700 12px/1 ui-monospace, SFMono-Regular, monospace;
    color: ${({ theme }) => theme.publicDesign.accent};
    flex-shrink: 0;
  }

  .text-group {
    display: flex;
    flex-direction: column;
    min-width: 0;

    .label {
      font-size: 13px;
      font-weight: 650;
      line-height: 1.25;
      color: ${({ theme }) => theme.colors.gray12};
    }

    .description {
      font-size: 11px;
      color: ${({ theme }) => theme.colors.gray9};
      line-height: 1.3;
      margin-top: 1px;
    }
  }
`

export const MarkdownEditorSlashMenu = ({
  isOpen,
  position,
  items,
  onClose,
}: MarkdownEditorSlashMenuProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setSelectedIndex(0)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % items.length)
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
        return
      }

      if (event.key === "Enter") {
        event.preventDefault()
        const selected = items[selectedIndex]
        if (selected) {
          selected.action()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [isOpen, items, selectedIndex, onClose])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDownOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    window.addEventListener("pointerdown", handlePointerDownOutside)
    return () => window.removeEventListener("pointerdown", handlePointerDownOutside)
  }, [isOpen, onClose])

  if (!isOpen || !position || items.length === 0) return null

  return (
    <SlashMenuContainer
      ref={menuRef}
      $top={position.top}
      $left={position.left}
      role="menu"
      aria-label="빠른 서식 삽입 메뉴"
    >
      <SlashMenuHeading>블록 빠른 삽입</SlashMenuHeading>
      {items.map((item, index) => (
        <SlashMenuItemButton
          key={item.id}
          type="button"
          role="menuitem"
          $active={index === selectedIndex}
          onClick={() => item.action()}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="icon" aria-hidden="true">
            {item.icon}
          </span>
          <div className="text-group">
            <span className="label">{item.label}</span>
            <span className="description">{item.description}</span>
          </div>
        </SlashMenuItemButton>
      ))}
    </SlashMenuContainer>
  )
}
