/**
 * 참조 구현:
 * - codemirror/search src/search.ts baseTheme (.cm-panel.cm-search, MIT License, Copyright (c) Marijn Haverbeke)
 */
import styled from "@emotion/styled"
import { boxShadowColor } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"

export const FindReplaceRegion = styled.section`
  position: absolute;
  top: 48px;
  right: 16px;
  z-index: ${zIndexes.dropdownMenu + 4};
  max-width: calc(100% - 32px);
  padding: 6px 26px 8px 10px;
  border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
  border-radius: 6px;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 4px 16px ${boxShadowColor.popover};
  display: flex;
  flex-direction: column;
  gap: 4px;

  button.cm-button {
    height: 26px;
    margin: 0.15em 0.4em 0.15em 0;
    padding: 0 8px;
    border: 1px solid ${({ theme }) => theme.colors.gray5};
    border-radius: 4px;
    background: ${({ theme }) => theme.colors.gray2};
    color: ${({ theme }) => theme.colors.gray12};
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.gray3};
    }

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.gray12};
      outline-offset: 1px;
    }

    &:disabled {
      opacity: 0.42;
      cursor: not-allowed;
    }

    @media (max-width: 768px), (pointer: coarse) {
      min-height: 44px;
      min-width: 44px;
    }
  }

  @media (max-width: 768px) {
    position: relative;
    top: auto;
    right: auto;
    max-width: 100%;
    border-radius: 0;
    border-inline: 0;
    border-top: 0;
    box-shadow: none;
  }
`

export const FindReplaceRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 4px;
`

export const FindReplaceInput = styled.input`
  width: 160px;
  height: 26px;
  margin: 0.15em 0.4em 0.15em 0;
  box-sizing: border-box;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  border-radius: 4px;
  padding: 0 8px;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray12};
  font-size: 12.5px;

  &:focus-visible {
    outline: none;
    border-color: ${({ theme }) => theme.colors.gray12};
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
    font-size: 16px;
  }
`

export const FindReplaceCheckbox = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0.15em 0.5em 0.15em 0;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 80%;
  white-space: pre;
  cursor: pointer;

  input[type="checkbox"] {
    margin-right: 0.2em;
    accent-color: ${({ theme }) => theme.colors.gray12};
  }

  input:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.gray12};
    outline-offset: 1px;
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
  }
`

export const FindReplaceStatus = styled.output`
  margin: 0.15em 0.2em 0.15em auto;
  color: ${({ theme }) => theme.colors.gray10};
  font: 600 11px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
`

export const FindReplaceCloseButton = styled.button`
  position: absolute;
  top: 4px;
  right: 6px;
  width: 22px;
  height: 22px;
  background: inherit;
  border: none;
  border-radius: 4px;
  color: ${({ theme }) => theme.colors.gray10};
  font: inherit;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  margin: 0;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.gray12};
    background: ${({ theme }) => theme.colors.gray3};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.gray12};
    outline-offset: 1px;
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-width: 44px;
    min-height: 44px;
    top: 2px;
    right: 2px;
  }
`
