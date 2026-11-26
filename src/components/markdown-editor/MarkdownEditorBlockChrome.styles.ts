/**
 * 참조 구현:
 * - Milkdown/milkdown packages/crepe/src/feature/block-edit/ (MIT License, Copyright (c) 2021 Mirone)
 * - steven-tey/novel packages/headless/src/components/editor-bubble.tsx (Apache-2.0 License, Copyright (c) Steven Tey)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"

export const BlockActionMenuPopover = styled.div<{ $top: number; $left: number }>`
  position: fixed;
  z-index: ${zIndexes.dropdownMenu + 8};
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: 224px;
  max-height: 480px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 2px 6px ${boxShadowColor.cardHover}, 0 12px 28px ${boxShadowColor.popover};
  display: flex;
  flex-direction: column;
  gap: 1px;
  user-select: none;
`

export const BlockMenuSectionHeader = styled.div`
  padding: 5px 8px 3px;
  font: 600 10.5px/1.2 var(--aq-font-mono);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.gray9};
`

export const BlockMenuSectionDivider = styled.div`
  height: 1px;
  margin: 4px 2px;
  background: ${({ theme }) => theme.publicDesign.border};
`

export const BlockMenuItemButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray12};
  font: 550 12.5px/1.2 var(--aq-font-sans);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.1s ease;
  ${focusVisibleRing}

  @media (pointer: coarse), (max-width: 768px) {
    min-height: 44px;
  }

  &:hover,
  &:focus {
    background: ${({ theme }) => theme.colors.gray3};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.gray12};
    outline-offset: -2px;
    background: ${({ theme }) => theme.colors.gray3};
  }

  &[data-active="true"] {
    font-weight: 650;
  }

  .glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    border: 0;
    background: ${({ theme }) => theme.colors.gray3};
    font: 700 10.5px/1 ui-monospace, SFMono-Regular, monospace;
    color: ${({ theme }) => theme.colors.gray12};
    flex-shrink: 0;
  }

  .check {
    display: inline-flex;
    align-items: center;
    margin-left: auto;
    color: ${({ theme }) => theme.colors.gray11};
  }
`

export const ColorSwatchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 6px 4px;
`

export const ColorSwatchMenuButton = styled.button<{ $color: string }>`
  flex: 1 1 0;
  height: 26px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  color: ${({ $color }) => $color};
  font: 750 11.5px/1 var(--aq-font-sans);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  ${focusVisibleRing}

  @media (pointer: coarse), (max-width: 768px) {
    min-width: 44px;
    min-height: 44px;
  }

  &:hover,
  &:focus {
    border-color: ${({ $color }) => $color};
    background: ${({ theme }) => theme.publicDesign.readableSurface};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.gray12};
    outline-offset: -2px;
    border-color: ${({ $color }) => $color};
    background: ${({ theme }) => theme.publicDesign.readableSurface};
  }
`

export const ColorSwatchDot = styled.span<{ $color: string }>`
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: ${({ $color }) => $color};
  border: 1px solid ${boxShadowColor.swatchBorder};
  flex-shrink: 0;
`

export const BubbleColorSwatchPopover = styled.div<{ $top: number; $left: number }>`
  position: fixed;
  z-index: ${zIndexes.dropdownMenu + 7};
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 6px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 2px 8px ${boxShadowColor.popover};
`

export const BubbleColorTriggerGlyph = styled.span`
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font: 700 12px/1 var(--aq-font-sans);
  gap: 1.5px;

  &::after {
    content: "";
    width: 11px;
    height: 2px;
    border-radius: 1px;
    background: currentColor;
    opacity: 0.78;
  }
`

export const BubbleDivider = styled.span`
  width: 1px;
  height: 16px;
  margin: 0 3px;
  background: color-mix(in srgb, ${({ theme }) => theme.colors.gray8}, transparent 80%);
  flex-shrink: 0;
`

export const BubbleActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray10};
  font: 700 12px/1 var(--aq-font-sans);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.12s ease, color 0.12s ease;
  ${focusVisibleRing}
  &:hover {
    background: ${({ theme }) => theme.colors.gray3};
    color: ${({ theme }) => theme.colors.gray12};
  }
  &:active, &[aria-pressed="true"], &[aria-expanded="true"] {
    background: ${({ theme }) => theme.colors.gray4};
    color: ${({ theme }) => theme.colors.gray12};
  }
  @media (pointer: coarse), (max-width: 768px) { min-width: 44px; min-height: 44px; margin: 2px; }
`
