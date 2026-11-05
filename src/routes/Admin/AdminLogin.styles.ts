import styled from "@emotion/styled"
import Link from "next/link"

export const LoginSection = styled.section`
  display: grid;
  min-height: 100dvh;
  padding: 1.5rem;
  place-items: center;
`

export const LoginPanel = styled.div`
  width: min(100%, 26rem);
  padding: 2rem;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.gray1};
`

export const LoginHeading = styled.h1`
  margin: 0;
  color: ${({ theme }) => theme.colors.gray12};
  font-size: 1.5rem;
`

export const LoginForm = styled.form`
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;
`

export const LoginFields = styled.div`
  display: grid;
  gap: 1rem;
`

export const LoginStage = styled.div`
  display: grid;
  align-content: start;
  gap: 1rem;
  min-height: 7.5rem;
  animation: admin-login-stage-enter 160ms ease-out;

  @keyframes admin-login-stage-enter {
    from {
      opacity: 0;
      transform: translateY(0.25rem);
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

export const LoginField = styled.label`
  display: grid;
  gap: 0.45rem;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 0.9rem;
  font-weight: 650;
`

export const LoginFieldHeading = styled.span`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
`

export const LoginTimer = styled.span`
  color: ${({ theme }) => theme.colors.gray12};
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
`

export const LoginInput = styled.input`
  width: 100%;
  min-height: 2.75rem;
  box-sizing: border-box;
  padding: 0.65rem 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.gray7};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.gray1};
  color: ${({ theme }) => theme.colors.gray12};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.blue7};
    outline-offset: 1px;
  }

  &:disabled {
    opacity: 0.65;
  }
`

export const LoginError = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.red11};
  font-size: 0.9rem;
`

export const LoginStatus = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 0.9rem;
  line-height: 1.5;
`

export const LoginPreference = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 0.9rem;

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const LoginSecondaryActions = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
`

export const LoginSecondaryButton = styled.button`
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.gray7};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.gray1};
  color: ${({ theme }) => theme.colors.gray11};
  font: inherit;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.blue7};
    outline-offset: 1px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const LoginSubmit = styled.button`
  min-height: 2.75rem;
  border: 0;
  border-radius: 6px;
  background: ${({ theme }) => theme.publicDesign.accent};
  color: ${({ theme }) => theme.colors.gray1};
  font: inherit;
  font-weight: 700;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.blue7};
    outline-offset: 1px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
`

export const LoginBackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  margin-top: 1.25rem;
  color: ${({ theme }) => theme.colors.gray10};
  font-size: 0.85rem;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.gray12};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.blue7};
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`
