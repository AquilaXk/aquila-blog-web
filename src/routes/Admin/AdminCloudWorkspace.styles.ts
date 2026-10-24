import styled from "@emotion/styled"
import {
  adminAppBackground as appBackground,
  adminBorder as border,
  adminBorderStrong as borderStrong,
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

export * from "./AdminCloudWorkspaceControls.styles"
export * from "./AdminCloudWorkspaceDetail.styles"

export const CloudMain = styled.main`
  display: grid;
  min-width: 0;
  color: ${textPrimary};
  background: ${appBackground};
  border: 0;
  border-radius: 0;
  overflow: hidden;
  box-shadow: none;
`

export const CloudWorkspace = styled.section`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: calc(100vh - var(--app-header-height, 73px) - 3.95rem);

  &[data-detail-open="true"][data-detail-mode="inline"] {
    grid-template-columns: minmax(0, 5.7fr) minmax(20rem, 3fr);

    tbody {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &[data-detail-open="true"][data-detail-mode="drawer"] {
    grid-template-columns: minmax(0, 1fr);
  }

  @media (max-width: 1080px) {
    &[data-detail-open="true"][data-detail-mode] {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`

export const CloudContent = styled.div`
  display: grid;
  align-content: start;
  min-width: 0;
  padding: 2rem 2.125rem 4.375rem;
  background: ${surface};

  @media (max-width: 820px) {
    padding: 1.5rem 1rem 3.75rem;
  }
`

export const CloudTitleBar = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem;
  margin-bottom: 1.5rem;

  span {
    color: ${accentGold};
    font-size: 0.68rem;
    line-height: 1.4;
    font-weight: 850;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-family: var(--font-mono, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace);
  }

  h1 {
    margin: 0.32rem 0 0;
    color: ${textPrimary};
    font-size: 2.125rem;
    line-height: 1.08;
    font-weight: 850;
    letter-spacing: 0;
  }

  p {
    margin: 0.45rem 0 0;
    color: ${textMuted};
    font-size: 0.88rem;
    line-height: 1.45;
  }

  @media (max-width: 980px) {
    align-items: flex-start;
    flex-direction: column;
  }
`

export const SearchInput = styled.input`
  width: 100%;
  min-height: 2.42rem;
  border: 0;
  border-radius: 2px;
  padding: 0 7.5rem 0 2.45rem;
  background: ${surfaceRaised};
  color: ${textPrimary};
  font-size: 0.86rem;
  font-weight: 700;

  &::placeholder {
    color: ${textMuted};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px var(--admin-focus-ring, rgba(185, 149, 79, 0.18));
  }
`

export const UploadZone = styled.button`
  display: grid;
  place-items: center;
  gap: 0.25rem;
  width: 100%;
  min-height: 4.75rem;
  margin: 0 0 1.15rem;
  border: 1px dashed ${borderStrong};
  border-radius: 2px;
  padding: 0.9rem 1.25rem;
  background: transparent;
  color: ${textMuted};
  text-align: center;
  cursor: pointer;

  svg {
    color: ${accentGold};
  }

  strong {
    display: block;
    color: ${textPrimary};
    font-size: 0.9rem;
    font-weight: 850;
  }

  span {
    color: ${textMuted};
    font-size: 0.78rem;
    font-weight: 700;
  }

  &:hover,
  &:focus-visible {
    border-color: ${accentGold};
    background: ${surfaceRaised};
  }

  &[data-drag-active="true"] {
    border-color: ${accentGold};
    background: ${surfaceAccent};
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--admin-focus-ring, rgba(9, 105, 218, 0.2));
  }
`

export const FileTable = styled.table`
  width: 100%;
  min-width: 0;
  border-collapse: separate;
  border-spacing: 0;
  display: grid;
  color: ${textPrimary};

  thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  tbody {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.875rem;
  }

  th,
  td {
    text-align: left;
    vertical-align: middle;
  }

  th {
    height: 2.4rem;
    padding: 0 0.7rem;
    color: ${textMuted};
    background: ${surfaceRaised};
    font-size: 0.75rem;
    font-weight: 800;
  }

  td {
    height: auto;
    min-width: 0;
    padding: 0;
    color: ${textSecondary};
    font-size: 0.82rem;
    font-weight: 700;
  }

  tbody tr {
    display: grid;
    grid-template-columns: 1.6rem minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    gap: 0.65rem 0.52rem;
    align-items: center;
    min-width: 0;
    min-height: 6.75rem;
    border: 1px solid ${border};
    padding: 0.8rem 0.875rem;
    background: ${surface};
    transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
  }

  tbody tr[data-loading-row="true"] {
    grid-template-columns: minmax(0, 1fr);
    min-height: 12rem;
  }

  tbody tr[data-loading-row="true"] td {
    grid-column: 1 / -1;
  }

  tbody tr[data-selected="true"] {
    background: ${surfaceAccent};
    border-color: ${borderStrong};
  }

  tbody tr:hover,
  tbody tr:focus-within {
    background: ${surfaceMuted};
  }

  tbody tr td:first-of-type {
    align-self: stretch;
    border-left: 3px solid transparent;
    padding-left: 0.35rem;
  }

  tbody tr[data-selected="true"] td:first-of-type {
    border-left-color: #58a6ff;
  }

  th:nth-of-type(1),
  td:nth-of-type(1) {
    grid-column: 1;
    grid-row: 1;
    width: auto;
  }

  th:nth-of-type(2),
  td:nth-of-type(2) {
    grid-column: 2 / 4;
    grid-row: 1;
    width: auto;
    min-width: 0;
  }

  th:nth-of-type(3),
  td:nth-of-type(3) {
    grid-column: 1 / 3;
    grid-row: 2;
    align-self: end;
    width: auto;
    color: ${textMuted};
    font-size: 0.76rem;
  }

  th:nth-of-type(4),
  td:nth-of-type(4) {
    grid-column: 3;
    grid-row: 2;
    align-self: end;
    justify-self: end;
    width: auto;
    color: ${textMuted};
    font-size: 0.76rem;
  }

  @media (max-width: 1180px) {
    tbody {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    tbody {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`

export const FileThumbnailFrame = styled.span`
  width: 3.3rem;
  height: 3.3rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: ${surfaceMuted};
  color: ${accentGold};
  font-size: 0.68rem;
  font-weight: 900;

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  &[data-selected="true"] {
    background: ${surfaceAccent};
    color: ${accentGold};
  }
`

export const SkeletonRow = styled.span`
  display: block;
  height: 0.78rem;
  border-radius: 2px;
  background: linear-gradient(90deg, ${surfaceRaised}, ${surfaceMuted}, ${surfaceRaised});
  background-size: 220% 100%;
  animation: admin-cloud-skeleton 1.2s ease-in-out infinite;

  &:nth-of-type(2) {
    width: 78%;
  }

  &:nth-of-type(3) {
    width: 58%;
  }

  @keyframes admin-cloud-skeleton {
    0% {
      background-position: 0% 50%;
    }

    100% {
      background-position: -220% 50%;
    }
  }
`

export const DocumentFallbackBox = styled.div`
  display: grid;
  gap: 0.65rem;
  place-items: center;
  min-height: 12rem;
  padding: 1.25rem;
  border: 0;
  border-radius: 2px;
  background: ${surfaceRaised};
  color: ${textSecondary};
  text-align: center;

  strong {
    color: ${textPrimary};
    font-size: 0.95rem;
    font-weight: 850;
  }

  p {
    margin: 0;
    max-width: 18rem;
    font-size: 0.78rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  a {
    border: 0;
    border-radius: 2px;
    padding: 0.45rem 0.7rem;
    background: ${surfaceMuted};
    color: ${textPrimary};
    font-size: 0.78rem;
    font-weight: 850;
    text-decoration: none;
  }
`

export const InlineList = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;

  span {
    border: 0;
    border-radius: 2px;
    padding: 0;
    background: transparent;
    color: ${textSecondary};
    font-size: 0.72rem;
    font-weight: 760;
  }
`

export const StatusPill = styled.span`
  justify-self: end;
  min-width: 3.55rem;
  max-width: 5.6rem;
  border-radius: 2px;
  padding: 0.22rem 0.45rem;
  background: ${surfaceRaised};
  color: ${accentGold};
  font-size: 0.7rem;
  font-weight: 850;
  text-align: center;
  white-space: nowrap;

  &[data-status="failed"] {
    color: ${({ theme }) => theme.colors.statusDangerText};
  }

  &[data-status="cancelled"] {
    color: ${({ theme }) => theme.colors.gray10};
  }

  &[data-status="done"] {
    color: ${({ theme }) => theme.colors.statusSuccessText};
  }
`

export const ProgressTrack = styled.div`
  grid-column: 1 / -1;
  height: 0.28rem;
  overflow: hidden;
  border-radius: 2px;
  background: ${surfaceMuted};

  span {
    display: block;
    height: 100%;
    width: var(--progress, 0%);
    border-radius: inherit;
    background: linear-gradient(90deg, ${accentGold}, ${accentTeal});
    transition: width 180ms ease;
  }
`
