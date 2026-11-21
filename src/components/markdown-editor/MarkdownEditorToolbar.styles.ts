// 참조 구현: Milkdown/milkdown packages/crepe/src/theme/common/top-bar.css (MIT License, Copyright (c) 2021 Mirone)
import styled from "@emotion/styled"
import { boxShadowColor } from "src/design-system/tokens"
import { ToolbarButton } from "./MarkdownEditor.styles"

export const ToolbarRailInner = styled.div`
  width: 100%;
  max-width: 100%;
  margin-inline: auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px;
  min-width: 0;
  overflow: visible;
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
  height: 24px;
  margin: 10px;
  background: color-mix(in srgb, ${({ theme }) => theme.colors.gray8}, transparent 80%);
  flex-shrink: 0;

  @media (max-width: 820px) {
    margin: 6px;
  }
`

export const ToolbarModeSegmentGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  flex-shrink: 0;
`

export const ToolbarModeSegmentButton = styled(ToolbarButton)`
  width: auto;
  min-width: auto;
  height: 28px;
  min-height: 28px;
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

  @media (max-width: 820px), (pointer: coarse) {
    min-height: 36px;
    height: 36px;
    font-size: 13px;
  }
`
