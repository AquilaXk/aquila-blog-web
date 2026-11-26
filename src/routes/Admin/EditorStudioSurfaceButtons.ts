import styled from "@emotion/styled"
import {
  adminBorder,
  adminBorderStrong,
  adminControlText,
  adminFocusRing,
  adminSurface,
  adminSurfaceMuted,
  adminTeal,
  adminTealBorder,
  adminTealBorderHover,
  adminTealHover,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"

const EditorBaseButton = styled.button`
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  padding: 0.48rem 0.88rem;
  min-height: 36px;
  background: ${adminSurface};
  color: ${adminTextSecondary};
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 550;

  @media (pointer: coarse) {
    min-height: 44px;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition:
      border-color 0.16s ease,
      background-color 0.16s ease,
      color 0.16s ease,
      box-shadow 0.16s ease;
  }

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }

  &:focus-visible {
    outline: none;
    border-color: ${adminBorderStrong};
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`

export const PrimaryButton = styled(EditorBaseButton)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  padding: 0 14px;
  border-color: ${adminTealBorder};
  background: ${adminTeal};
  color: ${adminControlText};
  font-weight: 600;

  &:hover:not(:disabled) {
    border-color: ${adminTealBorderHover};
    background: ${adminTealHover};
    color: ${adminControlText};
  }
`

export const SecondaryButton = styled(EditorBaseButton)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  border-color: ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  font-weight: 550;

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceMuted};
  }
`

export const EditorInspectorFullWidthAction = styled(SecondaryButton)`
  width: 100%;
  margin-top: 8px;
  border-radius: 8px;
`
