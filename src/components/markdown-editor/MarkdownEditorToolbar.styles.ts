/**
 * 참조 구현:
 * - Milkdown/milkdown packages/crepe/src/theme/common/top-bar.css (MIT License, Copyright (c) 2021 Mirone)
 * - TryGhost/Koenig packages/koenig-lexical/src/components/ui/ToolbarMenu.jsx (MIT License, Copyright (c) Ghost Foundation)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"

export const EditorToolbar = styled.div`
  box-sizing: border-box;
  flex: 0 0 auto;
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 44px;
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 0 12px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, ${({ theme }) => theme.colors.gray8}, transparent 80%);
  border-radius: 0;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: none;

  #editor-studio-toolbar-slot & {
    position: static;
    border-bottom: 0;
  }

  @media (max-width: 820px) {
    padding: 2px 8px;
    gap: 8px;
  }
`

export const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 0;
  min-width: 0;
  max-width: 100%;
  overflow: visible;

  &[data-align="end"] {
    margin-left: auto;
    gap: 2px;
  }

  @media (max-width: 820px) {
    &[data-align="end"] {
      flex: 0 0 auto;
    }

    &:not([data-align="end"]) {
      flex: 1 1 0%;
      width: 0;
      flex-wrap: nowrap;
      padding-right: 14px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      mask-image: linear-gradient(to right, currentColor 0, currentColor calc(100% - 14px), transparent 100%);
      -webkit-mask-image: linear-gradient(to right, currentColor 0, currentColor calc(100% - 14px), transparent 100%);
      &::-webkit-scrollbar {
        display: none;
      }
    }
  }
`

export const ToolbarButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  border-radius: 4px;
  width: 30px;
  height: 30px;
  min-width: 30px;
  min-height: 30px;
  margin: 2px 1px;
  padding: 4px;
  flex: 0 0 auto;
  background: ${({ theme, $active }) => ($active ? theme.colors.gray4 : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.colors.gray12 : theme.colors.gray10)};
  font-family: var(--aq-font-sans);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.12s ease, color 0.12s ease;

  ${focusVisibleRing}

  &[aria-pressed="true"] {
    background: ${({ theme }) => theme.colors.gray4};
    color: ${({ theme }) => theme.colors.gray12};
  }

  @media (hover: hover) {
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.gray3};
      color: ${({ theme }) => theme.colors.gray12};
    }
  }

  &:active:not(:disabled) {
    background: ${({ theme }) => theme.colors.gray4};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 820px) {
    width: auto;
    min-width: 38px;
    height: 38px;
    min-height: 38px;
    margin: 2px;

    &[data-mobile-hidden="true"] {
      display: none;
    }
  }

  @media (pointer: coarse) {
    min-width: 44px;
    min-height: 44px;
    height: 44px;
  }
`

export const ToolbarMenuRoot = styled.div`
  position: relative;
  flex: 0 0 auto;
`

export const ToolbarMenuTrigger = styled(ToolbarButton)`
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: auto;
  min-width: auto;
  height: 30px;
  padding: 4px 6px;
  margin: 2px 1px;
  border-radius: 4px;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0.1px;
  color: ${({ theme }) => theme.colors.gray12};

  &[aria-expanded="true"] {
    background: ${({ theme }) => theme.colors.gray4};
    color: ${({ theme }) => theme.colors.gray12};
  }
`

export const ToolbarMenuChevron = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.gray10};

  svg {
    width: 13px;
    height: 13px;
    display: block;
  }
`

type ToolbarMenuHorizontalAlign = "start" | "end"

const resolveToolbarMenuHorizontalPlacement = (
  $align: ToolbarMenuHorizontalAlign,
  $fixedPosition?: { top: number; left: number } | null
): string => {
  if ($fixedPosition) return `left: ${$fixedPosition.left}px; right: auto;`
  return $align === "end" ? "right: 0;" : "left: 0;"
}

export const ToolbarMenuPanel = styled.div<{
  $align: ToolbarMenuHorizontalAlign
  $horizontalOffset: number
  $fixedPosition?: { top: number; left: number } | null
}>`
  position: ${({ $fixedPosition }) => ($fixedPosition ? "fixed" : "absolute")};
  z-index: ${zIndexes.dropdownMenu};
  top: ${({ $fixedPosition }) => ($fixedPosition ? `${$fixedPosition.top}px` : "calc(100% + 4px)")};
  bottom: auto;
  ${({ $align, $fixedPosition }) => resolveToolbarMenuHorizontalPlacement($align, $fixedPosition)}
  transform: ${({ $fixedPosition, $horizontalOffset }) =>
    $fixedPosition ? "none" : `translateX(${$horizontalOffset}px)`};
  display: grid;
  min-width: 176px;
  max-width: min(280px, calc(100vw - 24px));
  max-height: min(360px, calc(100vh - 110px));
  overflow-y: auto;
  padding: 5px;
  border: 1px solid ${({ theme }) => theme.publicDesign.border};
  border-radius: 6px;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow:
    0 12px 32px ${boxShadowColor.popover},
    0 2px 6px ${boxShadowColor.subtleHover};
`

export const ToolbarMenuItem = styled.button`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  border: 0;
  border-radius: 4px;
  padding: 6px 10px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray12};
  font-size: 13.5px;
  font-weight: 450;
  line-height: 20px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;

  ${focusVisibleRing}

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    background: ${({ theme }) => theme.colors.gray3};
    color: ${({ theme }) => theme.colors.gray12};
  }

  &:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
  }
`

export const ToolbarHiddenInput = styled.input`
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
  pointer-events: none;
`

export const ToolbarRailInner = styled.div`
  width: 100%;
  max-width: 960px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px;
  min-width: 0;
  overflow: visible;

  @media (max-width: 820px) {
    flex-wrap: nowrap;
    gap: 6px;
  }
`

export const ToolbarCluster = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
  min-width: 0;
`

export const ToolbarDivider = styled.span`
  display: inline-block;
  width: 1px;
  height: 18px;
  margin: 0 6px;
  background: color-mix(in srgb, ${({ theme }) => theme.colors.gray8}, transparent 75%);
  flex-shrink: 0;

  @media (max-width: 820px) {
    margin: 0 4px;
  }
`

export const ToolbarModeSegmentGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 5px;
  border: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  flex-shrink: 0;
`

export const ToolbarModeSegmentButton = styled(ToolbarButton)`
  width: auto;
  min-width: auto;
  height: 26px;
  min-height: 26px;
  margin: 0;
  gap: 4px;
  border-radius: 4px;
  padding: 0 8px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray10};
  font-size: 12px;
  font-weight: 600;
  box-shadow: none;

  &[aria-pressed="true"] {
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray12};
    box-shadow: 0 1px 2px ${boxShadowColor.subtleHover};
  }

  @media (hover: hover) {
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.publicDesign.readableSurface};
      color: ${({ theme }) => theme.colors.gray12};
    }
  }

  @media (max-width: 820px) {
    min-height: 36px;
    height: 36px;
    font-size: 13px;
  }

  @media (max-width: 520px) {
    padding: 4px 7px;
    span {
      display: none;
    }
  }

  @media (pointer: coarse) {
    min-height: 44px;
    height: 44px;
  }
`
