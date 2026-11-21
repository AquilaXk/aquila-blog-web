/**
 * 참조 구현:
 * - TryGhost/Ghost ghost/admin/app/components/editor/modals/publish-flow/ (MIT License, Copyright (c) Ghost Foundation)
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/ui/sheet.tsx (MIT License, Copyright (c) shadcn)
 */
import styled from "@emotion/styled"
import { boxShadowColor, overlayScrim } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"
import {
  adminBorder,
  adminBorderSubtle,
  adminSurface,
  adminSystemThemeVariables,
  adminTextPrimary,
} from "./adminColorTokens"

export const PublishModalBackdrop = styled.div`
  ${({ theme }) => adminSystemThemeVariables(theme)}
  position: fixed;
  inset: 0;
  background: ${overlayScrim.modal};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  overscroll-behavior: contain;
  z-index: ${zIndexes.publishModal};
  padding: 1rem;

  &[data-variant="drawer"] {
    justify-content: flex-end;
    padding: 0;
  }
`

export const PublishDialog = styled.div`
  width: min(1120px, calc(100vw - 2rem));
  max-height: min(88vh, 940px);
  overflow: hidden;
  overscroll-behavior: contain;
  border-radius: 12px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  padding: 1.15rem 1.35rem 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  align-content: start;
  gap: 0;
  box-shadow: 0 18px 48px ${boxShadowColor.modalStrong};

  &[data-variant="drawer"] {
    width: min(560px, 100vw);
    max-height: 100vh;
    height: 100vh;
    max-height: 100dvh;
    height: 100dvh;
    border-radius: 0;
    border-left: 1px solid ${adminBorder};
    border-right: 0;
    border-top: 0;
    border-bottom: 0;
    padding-top: max(1.1rem, env(safe-area-inset-top, 0px));
    padding-bottom: 0;
    box-shadow: -18px 0 44px ${boxShadowColor.drawerStrong};
  }

  @media (max-width: 720px) {
    width: min(100%, 34rem);
    max-height: min(92vh, 980px);
    padding: 0.82rem 0.95rem 0;
    gap: 0;

    &[data-variant="drawer"] {
      padding-top: max(0.82rem, env(safe-area-inset-top, 0px));
    }
  }
`

export const PublishModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.95rem;
  border-bottom: 1px solid ${adminBorderSubtle};

  h4 {
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.3;
  }
`

export const PublishModalBody = styled.div`
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: grid;
  align-content: start;
  gap: 1.05rem;
  padding: 1.05rem 0 1.1rem;
`

export const PublishModalFooter = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.52rem;
  padding: 0.78rem 0 max(0.78rem, env(safe-area-inset-bottom, 0px));
  border-top: 1px solid ${adminBorderSubtle};
  background: ${adminSurface};

  @media (max-width: 480px) {
    flex-direction: column-reverse;
    align-items: stretch;

    > button {
      width: 100%;
      justify-content: center;
    }
  }
`
