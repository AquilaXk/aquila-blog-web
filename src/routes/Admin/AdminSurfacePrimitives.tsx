import type { Theme } from "@emotion/react"
import styled from "@emotion/styled"
import {
  adminAccentSurface,
  adminCardBorder,
  adminFocusRing,
  adminGold,
  adminMutedSurface,
  adminMutedText,
  adminPlainSurface,
  adminPrimaryText,
  adminRaisedSurface,
  adminSecondaryText,
  adminStrongBorder,
} from "src/routes/Admin/adminColorTokens"

export const adminElevatedSurface = (theme: Theme) =>
  adminPlainSurface(theme)

export const adminElevatedBorder = (theme: Theme) =>
  adminCardBorder(theme)

export const adminElevatedShadow = (_theme: Theme) =>
  "none"

export const adminInteractiveFocusRing = (theme: Theme) =>
  adminFocusRing(theme)

export const AdminElevatedCard = styled.section`
  border-radius: 0;
  border: 0;
  border-bottom: 0;
  background: transparent;
  box-shadow: ${({ theme }) => adminElevatedShadow(theme)};
`

export const AdminPlainCard = styled.section`
  border-radius: 0;
  border: 0;
  border-bottom: 0;
  background: transparent;
`

export const AdminSubtleCard = styled.section`
  border-radius: 0;
  border: 0;
  border-bottom: 0;
  background: transparent;
`

export const AdminRailCard = styled(AdminSubtleCard)`
  display: grid;
  gap: 0.78rem;
  padding: 0.92rem;
`

export const AdminStickyRail = styled.aside`
  position: sticky;
  top: calc(var(--app-header-height, 64px) + 0.8rem);
  align-self: start;
  display: grid;
  gap: 0.82rem;
`

export * from "./AdminSurfaceLayoutPrimitives"

export const AdminLandingSectionLead = styled.p`
  margin: 0;
  color: ${({ theme }) => adminMutedText(theme)};
  font-size: 0.86rem;
  line-height: 1.58;
`

export const AdminWorkspaceHero = styled.section`
  display: grid;
  gap: 0.4rem;
  padding: 0 0 0.56rem;
  border-bottom: 0;
`

export const AdminWorkspaceSectionNav = styled(AdminStickyRail)`
  top: calc(var(--app-header-height, 64px) + 1rem);
  gap: 0.55rem;

  @media (max-width: 1180px) {
    position: static;
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.2rem;
    scroll-snap-type: x proximity;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`

export const AdminWorkspaceSectionNavStatus = styled(AdminRailCard)`
  gap: 0.22rem;
  padding: 0.72rem 0.78rem;
  border-radius: 8px;
  border: 0;
  border-bottom: 0;
  background: ${({ theme }) => adminMutedSurface(theme)};

  small {
    color: ${({ theme }) => adminMutedText(theme)};
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.03em;
  }

  strong {
    color: ${({ theme }) => adminPrimaryText(theme)};
    font-size: 0.92rem;
    font-weight: 780;
    letter-spacing: -0.02em;
  }

  &[data-jumping="true"] {
    border-bottom-color: ${({ theme }) => adminStrongBorder(theme)};
    background: ${({ theme }) => adminAccentSurface(theme)};
  }

  @media (max-width: 1180px) {
    min-width: 12.5rem;
    flex: 0 0 auto;
    scroll-snap-align: start;
  }
`

export const AdminWorkspaceSectionNavButton = styled.button`
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.42rem;
  min-height: 42px;
  padding: 0 0.9rem;
  border-radius: 0;
  border: 0;
  border-left: 3px solid transparent;
  background: transparent;
  color: ${({ theme }) => adminMutedText(theme)};
  font-size: 0.84rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    border-left-color: ${({ theme }) => adminStrongBorder(theme)};
    box-shadow: ${({ theme }) => adminInteractiveFocusRing(theme)};
  }

  &[data-active="true"] {
    color: ${adminGold};
    border-left-color: ${adminGold};
    background: ${({ theme }) => adminAccentSurface(theme)};
  }

  &[data-freshness="fresh"] {
    border-left-color: ${({ theme }) => theme.colors.statusSuccessBorder};
  }

  &[data-freshness="aging"] {
    border-left-color: ${({ theme }) => theme.colors.orange7};
  }

  &[data-freshness="stale"] {
    border-left-color: ${({ theme }) => theme.colors.gray7};
  }

  &[data-freshness]::before {
    content: "";
    position: absolute;
    left: 0;
    top: 7px;
    bottom: 7px;
    width: 3px;
    border-radius: 4px;
    background: ${({ theme }) => theme.colors.gray7};
  }

  &[data-freshness="fresh"]::before {
    background: ${({ theme }) => theme.colors.statusSuccessBorder};
  }

  &[data-freshness="aging"]::before {
    background: ${({ theme }) => theme.colors.orange8};
  }

  &[data-freshness="stale"]::before {
    background: ${({ theme }) => theme.colors.gray8};
  }

  &[data-tone="danger"] {
    border-left-color: ${({ theme }) => theme.colors.statusDangerBorder};
    color: ${({ theme }) => theme.colors.statusDangerText};
  }

  @media (max-width: 1180px), (pointer: coarse) {
    min-height: 44px;
    scroll-snap-align: start;
  }
`

export const AdminInfoLinkCard = styled.a<{ $withIcon?: boolean }>`
  display: grid;
  grid-template-columns: ${({ $withIcon = true }) => ($withIcon ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)")};
  gap: ${({ $withIcon = true }) => ($withIcon ? "0.7rem" : "0.18rem")};
  align-items: center;
  padding: 0.78rem 0.82rem;
  border-radius: 8px;
  border: 0;
  border-bottom: 0;
  background: transparent;
  color: inherit;
  text-decoration: none;
  min-width: 0;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => adminInteractiveFocusRing(theme)};
  }

  &:hover {
    background: ${({ theme }) => adminMutedSurface(theme)};
  }

  .iconWrap {
    display: ${({ $withIcon = true }) => ($withIcon ? "grid" : "none")};
    width: 2.35rem;
    height: 2.35rem;
    border-radius: 6px;
    place-items: center;
    background: transparent;
    color: ${({ theme }) => adminSecondaryText(theme)};
  }

  .copy {
    min-width: 0;
    display: grid;
    gap: 0.12rem;
  }

  .copy strong,
  > strong {
    color: ${({ theme }) => adminPrimaryText(theme)};
    font-size: 0.86rem;
    font-weight: 780;
    overflow-wrap: anywhere;
  }

  .copy span,
  > span {
    color: ${({ theme }) => adminMutedText(theme)};
    font-size: 0.75rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
`

export const AdminStatusPill = styled.span<{ $size?: "sm" | "md" }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: ${({ $size = "md" }) => ($size === "sm" ? "28px" : "32px")};
  padding: ${({ $size = "md" }) => ($size === "sm" ? "0 0.62rem" : "0 0.72rem")};
  border-radius: 4px;
  border: 1px solid ${({ theme }) => adminCardBorder(theme)};
  background: ${({ theme }) => adminRaisedSurface(theme)};
  color: ${({ theme }) => adminSecondaryText(theme)};
  font-size: ${({ $size = "md" }) => ($size === "sm" ? "0.76rem" : "0.78rem")};
  font-weight: 800;
  line-height: 1;

  &[data-tone="neutral"] {
    border-color: ${({ theme }) => adminCardBorder(theme)};
    background: ${({ theme }) => adminRaisedSurface(theme)};
    color: ${({ theme }) => adminMutedText(theme)};
  }

  &[data-tone="accent"] {
    border-color: ${({ theme }) => adminStrongBorder(theme)};
    color: ${adminGold};
  }

  &[data-tone="success"] {
    border-color: ${({ theme }) => theme.colors.statusSuccessBorder};
    color: ${({ theme }) => theme.colors.statusSuccessText};
  }

  &[data-tone="warn"] {
    border-color: ${({ theme }) => theme.colors.orange7};
    color: ${({ theme }) => theme.colors.orange11};
  }

  &[data-tone="danger"] {
    border-color: ${({ theme }) => theme.colors.statusDangerBorder};
    color: ${({ theme }) => theme.colors.statusDangerText};
  }
`

export const AdminInlineActionRow = styled.div`
  display: flex;
  gap: 0.55rem;
  align-items: center;
  flex-wrap: wrap;
  width: fit-content;
  max-width: 100%;
  padding: 0.42rem 0.48rem;
  border-radius: 6px;
  background: ${({ theme }) => adminMutedSurface(theme)};

  & + & {
    margin-top: 0.4rem;
  }
`

export const AdminTextActionButton = styled.button`
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${({ theme }) => adminSecondaryText(theme)};
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => adminInteractiveFocusRing(theme)};
  }

  &:disabled {
    opacity: 0.56;
    cursor: not-allowed;
  }

  &[data-tone="primary"] {
    color: ${adminGold};
    font-weight: 800;
  }

  &[data-tone="danger"] {
    color: ${({ theme }) => theme.colors.red11};
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
    padding: 0 0.35rem;
  }
`

export const AdminTextActionLink = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: 0;
  border-radius: 4px;
  color: ${({ theme }) => adminSecondaryText(theme)};
  font-size: 0.84rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => adminInteractiveFocusRing(theme)};
  }

  &[data-tone="primary"] {
    color: ${adminGold};
    font-weight: 800;
  }

  &[data-tone="danger"] {
    color: ${({ theme }) => theme.colors.red11};
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
    padding: 0 0.35rem;
  }
`

export const AdminActionCardButton = styled.button`
  text-align: left;
  display: grid;
  gap: 0.16rem;
  padding: 0.82rem 0.88rem;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => adminCardBorder(theme)};
  background: ${({ theme }) => adminRaisedSurface(theme)};
  color: ${({ theme }) => adminPrimaryText(theme)};
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    border-color: ${({ theme }) => adminStrongBorder(theme)};
    box-shadow: ${({ theme }) => adminInteractiveFocusRing(theme)};
  }

  &:hover:not(:disabled) {
    background: ${({ theme }) => adminAccentSurface(theme)};
  }

  &:disabled {
    opacity: 0.56;
    cursor: not-allowed;
  }

  span {
    font-size: 0.88rem;
    font-weight: 760;
  }

  small {
    color: ${({ theme }) => adminMutedText(theme)};
    line-height: 1.55;
  }
`
