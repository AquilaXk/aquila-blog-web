// 참조 구현: TryGhost/Ghost apps/shade/src/components/patterns/setting-group.tsx (MIT), medusajs/medusa packages/admin/dashboard/src/components/layout/settings-layout/settings-layout.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { control } from "src/design-system/tokens"
import {
  AdminPaneHeader,
  AdminSubtleCard,
  AdminWorkspaceSectionNav,
  AdminWorkspaceSectionNavButton,
} from "src/routes/Admin/AdminSurfacePrimitives"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminFocusRing,
  adminStatusWarnText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

export const WorkspaceShell = styled.section`
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 1.75rem;
  align-items: start;

  @media (max-width: 1060px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
`

export const SectionRail = styled(AdminWorkspaceSectionNav)`
  display: grid;
  gap: 0.22rem;
  padding: 0;
  border: 0;

  @media (max-width: 1060px) and (min-width: 769px) {
    display: flex;
    gap: 0.35rem;
    overflow-x: auto;
    padding-bottom: 0.2rem;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  @media (max-width: 768px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.38rem;
    overflow-x: visible;
    padding-bottom: 0;
  }
`

export const SectionRailButton = styled(AdminWorkspaceSectionNavButton)`
  position: relative;
  width: 100%;
  min-height: 36px;
  justify-content: flex-start;
  padding: 0.45rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: ${adminTextSecondary};
  font-size: 0.84rem;
  font-weight: 500;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  ${focusVisibleRing}

  &:hover {
    background: ${adminSurfaceRaised};
    color: ${adminTextPrimary};
  }

  &[aria-selected="true"],
  &[data-active="true"] {
    background: ${adminSurfaceMuted};
    border-color: ${adminBorder};
    color: ${adminTextPrimary};
    font-weight: 600;
  }

  @media (max-width: 1060px) and (min-width: 769px) {
    width: auto;
    border-color: ${adminBorder};
    padding: 0 0.85rem;

    &[aria-selected="true"]::after,
    &[data-active="true"]::after {
      content: "";
      position: absolute;
      left: 0.45rem;
      right: 0.45rem;
      top: auto;
      bottom: 0;
      border-left: 0;
      border-bottom: 2px solid ${adminTeal};
    }
  }

  @media (max-width: 768px) {
    min-height: 44px;
    padding: 0 0.55rem;
    border-color: ${adminBorder};
    font-size: 0.81rem;
    justify-content: center;
  }
`

export const EditorColumn = styled.div`
  display: grid;
  gap: 0;
  min-width: 0;
`

export const EditorPaneHeader = styled(AdminPaneHeader)`
  display: grid;
  gap: 0.3rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${adminBorderSubtle};

  .titleRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  h2 {
    margin: 0;
    font-size: 1.12rem;
    line-height: 1.3;
    font-weight: 760;
    letter-spacing: -0.02em;
    color: ${adminTextPrimary};
  }

  p {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.5;
    color: ${adminTextSecondary};
  }

  .exposureMissingHint {
    margin-top: 0.15rem;
    color: ${adminStatusWarnText};
    font-size: 0.78rem;
    font-weight: 650;
  }
`

export const EditorSurface = styled(AdminSubtleCard)`
  max-width: none;
  width: 100%;
  padding: 1.4rem 1.6rem;
  border: 1px solid ${adminBorder};
  border-radius: 12px;
  background: ${adminSurface};
  box-shadow: none;
  display: grid;
  gap: 0.5rem;

  @media (max-width: 768px) {
    padding: 1.05rem;
  }
`

export const SectionStack = styled.div`
  display: grid;
  gap: 0.25rem;
`

export const AvatarWorkspaceCard = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 0 1.15rem;
  border-bottom: 1px solid ${adminBorderSubtle};
  background: transparent;

  .avatarPreview {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    border: 1px solid ${adminBorderStrong};
    background: ${adminSurfaceMuted};

    & > span {
      width: 100% !important;
      height: 100% !important;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  .avatarMeta {
    display: grid;
    gap: 0.18rem;
    min-width: 0;
    text-align: left;
  }

  .avatarMeta strong {
    color: ${adminTextPrimary};
    font-size: 0.94rem;
    font-weight: 740;
    overflow-wrap: anywhere;
  }

  .avatarMeta span {
    color: ${adminTextSecondary};
    font-size: 0.78rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    grid-template-columns: auto minmax(0, 1fr);

    > button {
      grid-column: 1 / -1;
      justify-self: start;
    }
  }
`

export const FieldSectionCard = styled.div`
  display: grid;
  gap: 0;
  padding: 0.5rem 0;
  border-bottom: 1px solid ${adminBorderSubtle};
  background: transparent;

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  > div[data-columns],
  > div:not([class]) {
    min-width: 0;
  }
`

export const SectionBlockHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  padding: 0.5rem 0 0.75rem;

  h3 {
    margin: 0;
    font-size: 0.94rem;
    font-weight: 740;
    color: ${adminTextPrimary};
  }

  p {
    margin: 0.14rem 0 0;
    color: ${adminTextSecondary};
    font-size: 0.78rem;
    line-height: 1.45;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
`

export const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
`

export const FieldLabelGroup = styled.div`
  display: grid;
  gap: 0.2rem;
  align-content: start;
`

export const FieldHint = styled.span`
  color: ${adminTextMuted};
  font-size: 0.75rem;
  line-height: 1.45;
`

export const FieldBox = styled.div`
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr);
  gap: 0.45rem 1.5rem;
  align-items: start;
  min-width: 0;
  padding: 0.9rem 0;
  border-bottom: 1px solid ${adminBorderSubtle};

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0.25rem;
  }

  &[data-span="full"] {
    grid-column: 1 / -1;
  }

  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.4rem;
    padding: 0.72rem 0;
  }
`

export const FieldLabel = styled.label`
  color: ${adminTextPrimary};
  font-size: 0.83rem;
  font-weight: 660;
  line-height: 1.45;
  padding-top: 0.45rem;

  @media (max-width: 768px) {
    padding-top: 0;
  }
`

export const Input = styled.input`
  width: 100%;
  min-height: 40px;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  padding: 0.62rem 0.82rem;
  font-size: 0.88rem;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
    font-size: 1rem;
  }

  &::placeholder {
    color: ${adminTextMuted};
  }

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
  }

  &:focus-visible {
    outline: none;
    border-color: ${adminTeal};
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }
`

export const TextArea = styled.textarea`
  width: 100%;
  min-height: 112px;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  padding: 0.72rem 0.85rem;
  font-size: 0.88rem;
  resize: vertical;
  line-height: 1.6;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;

  @media (pointer: coarse) {
    font-size: 1rem;
  }

  &::placeholder {
    color: ${adminTextMuted};
  }

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
  }

  &:focus-visible {
    outline: none;
    border-color: ${adminTeal};
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }
`

export const AboutSectionList = styled.div`
  display: grid;
  gap: 0;
  border-top: 1px solid ${adminBorderSubtle};
`

export const AboutSectionCard = styled.div`
  display: grid;
  gap: 0.72rem;
  padding: 1.05rem 0;
  border: 0;
  border-bottom: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0.25rem;
  }

  ${FieldGrid} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  ${FieldBox} {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.35rem;
    padding: 0;
    border-bottom: 0;
  }

  ${FieldLabel} {
    padding-top: 0;
    font-size: 0.78rem;
    color: ${adminTextSecondary};
  }
`

export const AboutProjectList = styled(AboutSectionList)``
export const AboutProjectCard = styled(AboutSectionCard)``

export {
  AboutSectionCardHeader,
  EmptyStateCard,
  InlineActionRow,
  ItemList,
  ItemRow,
} from "./AdminProfileWorkspace.styles.tokens"

export {
  DragHandleButton,
  IconOptionButton,
  IconOptionText,
  IconPickerButton,
  IconPickerCopy,
  IconPickerField,
  IconPickerPanel,
  IconPreview,
  LinkCardList,
  LinkInputs,
  LinkManagerHeader,
  LinkRowCard,
  SegmentButton,
  SegmentedControl,
} from "./AdminProfileWorkspace.styles.links"
