import styled from "@emotion/styled"
import {
  adminBorder as border,
  adminBorderStrong as borderStrong,
  adminControlText as controlText,
  adminGold as accentGold,
  adminSurface as surface,
  adminSurfaceAccent as surfaceAccent,
  adminSurfaceMuted as surfaceMuted,
  adminSurfaceRaised as surfaceRaised,
  adminTeal as accentTeal,
  adminTextMuted as textMuted,
  adminTextPrimary as textPrimary,
  adminTextSecondary as textSecondary,
} from "src/routes/Admin/adminColorTokens"

export const CloudNavigationRail = styled.aside`
  display: grid;
  align-content: start;
  gap: 1.25rem;
  min-width: 0;
  padding: 1.25rem 1rem;
  border-right: 1px solid ${border};
  background: ${surfaceRaised};

  @media (max-width: 840px) {
    border-right: 0;
    border-bottom: 1px solid ${border};
    padding: 0.9rem;
  }
`

export const CloudNavGroup = styled.div`
  display: grid;
  gap: 0.18rem;
  min-width: 0;
`

export const CloudNavDivider = styled.hr`
  width: 100%;
  border: 0;
  border-top: 1px solid ${border};
  margin: 0.25rem 0;
`

export const CloudNavButton = styled.button`
  width: 100%;
  min-height: 2.3rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  border-radius: 0;
  padding: 0.35rem 0.45rem;
  background: transparent;
  color: ${textPrimary};
  font-size: 0.9rem;
  font-weight: 760;
  text-align: left;
  cursor: pointer;

  span:first-of-type {
    width: 1.35rem;
    display: inline-grid;
    place-items: center;
    color: ${textMuted};
    font-size: 0.86rem;
  }

  small {
    color: ${accentGold};
    font-size: 0.76rem;
    font-weight: 850;
  }

  &[data-active="true"] {
    color: ${accentGold};
    background: ${surfaceAccent};
  }

  &:hover {
    background: ${surfaceMuted};
  }
`

export const CloudSearchField = styled.label`
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;

  svg {
    position: absolute;
    left: 0.86rem;
    color: ${textMuted};
    pointer-events: none;
  }
`

export const SearchDetail = styled.span`
  position: absolute;
  right: 0.85rem;
  color: ${textMuted};
  font-size: 0.75rem;
  font-weight: 750;
`

export const ActionBar = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  min-width: 0;
  margin-bottom: 1rem;

  @media (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  flex-wrap: wrap;

  &[data-align="end"] {
    justify-content: flex-end;
  }

  @media (max-width: 760px) {
    &[data-align="end"] {
      justify-content: flex-start;
    }
  }
`

export const UploadInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`

export const PrimaryButton = styled.button`
  border: 0;
  border-radius: 5px;
  min-height: 2.25rem;
  padding: 0 0.82rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  background: ${accentTeal};
  color: ${controlText};
  font-size: 0.84rem;
  font-weight: 850;
  white-space: nowrap;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--admin-focus-ring, rgba(185, 149, 79, 0.18));
  }
`

export const SecondaryButton = styled.button`
  border: 0;
  border-radius: 5px;
  min-height: 2.25rem;
  padding: 0 0.82rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  background: ${surfaceMuted};
  color: ${textPrimary};
  font-size: 0.83rem;
  font-weight: 820;
  white-space: nowrap;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    color: ${textMuted};
  }
`

export const IconButton = styled.button`
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid ${border};
  border-radius: 5px;
  background: ${surface};
  color: ${textSecondary};
  cursor: pointer;

  &[data-active="true"] {
    color: ${accentGold};
    border-color: ${borderStrong};
    background: ${surfaceAccent};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--admin-focus-ring, rgba(111, 149, 255, 0.22));
  }
`

export const ViewModeButton = styled.button`
  min-height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  flex-shrink: 0;
  border: 1px solid ${border};
  border-radius: 5px;
  padding: 0 0.64rem;
  background: ${surface};
  color: ${textSecondary};
  font-size: 0.8rem;
  font-weight: 820;
  white-space: nowrap;
  cursor: pointer;

  &[data-active="true"] {
    color: ${accentGold};
    border-color: ${borderStrong};
    background: ${surfaceAccent};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--admin-focus-ring, rgba(111, 149, 255, 0.22));
  }
`

export const FilterGroup = styled.div`
  display: flex;
  gap: 0.32rem;
  align-items: center;
  flex-wrap: wrap;
`

export const GhostButton = styled.button`
  border: 1px solid transparent;
  border-radius: 5px;
  min-height: 2.25rem;
  padding: 0 0.7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  background: ${surfaceMuted};
  color: ${textSecondary};
  font-size: 0.82rem;
  font-weight: 820;
  white-space: nowrap;
  cursor: pointer;

  &[data-active="true"] {
    border-color: ${borderStrong};
    background: ${surfaceAccent};
    color: ${accentGold};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.54;
  }
`

export const Notice = styled.p`
  margin: 0;
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${accentGold};
  font-size: 0.82rem;
  font-weight: 780;
`

export const FileTableScroll = styled.div`
  min-width: 0;
  overflow-x: visible;
`

export const SelectBoxCell = styled.td`
  width: 2.75rem;
`

export const RowCheckbox = styled.input`
  width: 1rem;
  height: 1rem;
  accent-color: ${accentGold};
`

export const FileTypeIcon = styled.span`
  min-width: 2.45rem;
  flex: 0 0 2.65rem;
  height: 1.58rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: ${surfaceRaised};
  color: ${accentGold};
  border: 1px solid ${border};
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &[data-selected="true"] {
    background: ${surfaceMuted};
    border-color: ${borderStrong};
    color: ${textPrimary};
  }
`

export const FileIdentity = styled.div`
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: 0.72rem;
  align-items: center;
  min-width: 0;
`

export const FileNameStack = styled.div`
  display: grid;
  gap: 0.18rem;
  min-width: 0;
`

export const FileMetaLine = styled.span`
  display: flex;
  align-items: center;
  gap: 0.38rem;
  min-width: 0;
  color: ${textMuted};
  font-size: 0.74rem;
  font-weight: 760;

  > span:not([data-file-kind-badge]) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const FileNameButton = styled.button`
  && {
    border-radius: 0;
  }

  border: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  background: transparent;
  color: ${textPrimary};
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 800;
  text-align: left;
  outline: none;

  strong {
    display: grid;
    grid-template-columns: minmax(0, auto) auto;
    justify-content: start;
    min-width: 0;
    max-width: 100%;
  }

  [data-filename-stem] {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-filename-extension] {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  &:focus,
  &:focus-visible {
    outline: none;
    color: ${accentGold};
    box-shadow: inset 0 -2px 0 #58a6ff;
  }
`

export const EmptyTableState = styled.div`
  display: grid;
  place-items: center;
  gap: 0.62rem;
  min-height: 20rem;
  padding: 1.25rem;
  border: 1px solid ${border};
  color: ${textMuted};
  text-align: center;

  &::before {
    content: "";
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 999px;
    border: 1px solid ${border};
    background: linear-gradient(135deg, ${surfaceRaised}, ${surfaceMuted});
  }

  strong {
    color: ${textPrimary};
    font-size: 1rem;
  }
`

export const LoadingTableStatus = styled.div`
  display: grid;
  place-items: center;
  min-height: 12rem;
  color: ${textMuted};
  font-size: 0.86rem;
  font-weight: 800;
`

export const SkeletonRows = styled.div`
  display: grid;
  gap: 0.6rem;
  width: min(100%, 44rem);
`

export const EmptyState = styled.div`
  display: grid;
  place-items: center;
  gap: 0.45rem;
  min-height: 10rem;
  padding: 1.4rem;
  text-align: center;
  color: ${textMuted};

  strong {
    color: ${textPrimary};
    font-size: 0.94rem;
  }

  p {
    margin: 0;
    color: ${textMuted};
    font-size: 0.8rem;
    line-height: 1.5;
  }
`
