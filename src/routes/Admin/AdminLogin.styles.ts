// 참조 구현: shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/login-03/{page.tsx,components/login-form.tsx} (MIT) & TryGhost/Ghost apps/admin/src/auth/{auth-layout.tsx,signin.tsx,signin-verify.tsx} (MIT)
import styled from "@emotion/styled"
import Link from "next/link"
import {
  adminBorder,
  adminBorderSubtle,
  adminCardShadow,
  adminControlText,
  adminDisabledBg,
  adminDisabledBorder,
  adminDisabledFg,
  adminGoldTintFocus,
  adminLoginCanvasBg,
  adminStatusDangerBg,
  adminStatusDangerBorder,
  adminStatusDangerText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminSystemThemeVariables,
  adminTeal,
  adminTealHover,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

export const LoginSection = styled.section`
  ${({ theme }) => adminSystemThemeVariables(theme)}
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  min-height: 100svh;
  padding: 1.5rem;
  background-color: ${adminLoginCanvasBg};
  box-sizing: border-box;
`

export const LoginStack = styled.div`
  width: 100%;
  max-width: 24rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`

export const LoginBrandBanner = styled.div`
  display: flex;
  align-items: center;
  align-self: center;
  gap: 0.5rem;
  color: ${adminTextPrimary};
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: -0.015em;
`

export const LoginBrandOrb = styled.div`
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem;
  background: ${adminTeal};
  color: ${adminControlText};
  box-sizing: border-box;

  .brandLogoMark {
    display: block;
    width: 100%;
    height: 100%;
  }
`

export const LoginPanel = styled.div`
  width: 100%;
  padding: 1.75rem;
  border: 1px solid ${adminBorder};
  border-radius: 12px;
  background: ${adminSurface};
  box-shadow: ${adminCardShadow};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  @media (max-width: 480px) {
    padding: 1.35rem;
  }
`

export const LoginBrandHeader = styled.div`
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 0.35rem;
`

export const LoginHeadingGroup = styled.div`
  display: grid;
  gap: 0.35rem;
  background: ${adminSurface};
`

export const LoginHeading = styled.h1`
  margin: 0;
  color: ${adminTextPrimary};
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
`

export const LoginSubtitle = styled.p`
  margin: 0;
  color: ${adminTextMuted};
  font-size: 0.875rem;
  line-height: 1.45;
`

export const LoginForm = styled.form`
  display: grid;
  gap: 1rem;
`

export const LoginFields = styled.div`
  display: grid;
  gap: 1rem;
`

export const LoginStage = styled.div`
  display: grid;
  align-content: start;
  gap: 0.9rem;
  min-height: 3.25rem;
  animation: admin-login-stage-enter 150ms ease-out;

  @keyframes admin-login-stage-enter {
    from {
      opacity: 0;
      transform: translateY(0.2rem);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const LoginField = styled.div`
  display: grid;
  gap: 0.375rem;
`

export const LoginLabel = styled.label`
  color: ${adminTextPrimary};
  font-size: 0.875rem;
  font-weight: 500;
`

export const LoginFieldHeading = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

export const LoginFieldHint = styled.div`
  margin: 0;
  color: ${adminTextMuted};
  font-size: 0.8125rem;
  line-height: 1.45;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;

  [role="timer"] {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    color: ${adminTextSecondary};
  }
`

export const LoginInlineLink = styled.button`
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${adminTextPrimary};
  font: inherit;
  font-size: 0.875rem;
  line-height: 1.3;
  text-decoration: none;
  text-underline-offset: 4px;
  cursor: pointer;

  &:hover:not(:disabled):not([aria-disabled="true"]) {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${adminTeal};
    outline-offset: 2px;
    border-radius: 4px;
  }

  &:disabled,
  &[aria-disabled="true"] {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &[data-inline="true"] {
    margin-left: 0;
    font-size: 0.8125rem;
    color: ${adminTextSecondary};
    text-decoration: underline;
  }

  @media (pointer: coarse) {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
`

export const LoginInput = styled.input`
  width: 100%;
  height: 36px;
  min-height: 36px;
  box-sizing: border-box;
  padding: 0.25rem 0.75rem;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurface};
  color: ${adminTextPrimary};
  box-shadow: none;
  font-size: 0.875rem;
  transition: border-color 120ms ease, box-shadow 120ms ease;

  &::placeholder {
    color: ${adminTextMuted};
  }

  &[data-otp="true"] {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.24em;
    text-align: center;
    font-variant-numeric: tabular-nums;
    background: ${adminSurfaceRaised};
  }

  &[aria-invalid="true"] {
    border-color: ${adminStatusDangerBorder};
  }

  &:focus-visible {
    outline: 2px solid ${adminTeal};
    outline-offset: 0;
    border-color: ${adminTeal};
    box-shadow: 0 0 0 3px ${adminGoldTintFocus};
  }

  &:disabled {
    background: ${adminSurfaceMuted};
    color: ${adminTextSecondary};
    opacity: 0.82;
  }

  @media (max-width: 820px), (pointer: coarse) {
    height: auto;
    min-height: 44px;
    font-size: 16px;
  }
`

export const LoginError = styled.p`
  margin: 0;
  padding: 0.56rem 0.75rem;
  border-radius: 8px;
  border: 0;
  background: ${adminStatusDangerBg};
  color: ${adminStatusDangerText};
  font-size: 0.83rem;
  font-weight: 600;
  line-height: 1.45;
`

export const LoginStatus = styled.p`
  margin: 0;
  padding: 0.52rem 0.75rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  font-size: 0.83rem;
  line-height: 1.45;
`

export const LoginPreferencesRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.1rem 0.05rem 0;
  border: 0;
  background: transparent;
`

export const LoginPreference = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: ${adminTextSecondary};
  font-size: 0.83rem;
  font-weight: 500;
  cursor: pointer;

  input[type="checkbox"] {
    width: 0.96rem;
    height: 0.96rem;
    accent-color: ${adminTeal};
    cursor: pointer;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const LoginSubmit = styled.button`
  height: 36px;
  min-height: 36px;
  border: 1px solid ${adminTeal};
  border-radius: 6px;
  background: ${adminTeal};
  color: ${adminControlText};
  box-shadow: ${adminCardShadow};
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;

  &:hover:not(:disabled):not([aria-disabled="true"]) {
    background: ${adminTealHover};
    border-color: ${adminTealHover};
  }

  &:focus-visible {
    outline: 2px solid ${adminTeal};
    outline-offset: 2px;
  }

  &:disabled,
  &[aria-disabled="true"] {
    cursor: not-allowed;
    border-color: ${adminDisabledBorder};
    background: ${adminDisabledBg};
    color: ${adminDisabledFg};
    box-shadow: none;
  }

  @media (max-width: 820px), (pointer: coarse) {
    height: auto;
    min-height: 44px;
  }
`

export const LoginFooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 0.9rem;
  border-top: 1px solid ${adminBorderSubtle};
`

export const LoginBackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  padding: 0.32rem 0.5rem;
  border-radius: 6px;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: ${adminTextSecondary};
  font-size: 0.8rem;
  font-weight: 560;
  text-decoration: none;
  transition: color 120ms ease;

  &:hover {
    color: ${adminTextPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${adminTeal};
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`
