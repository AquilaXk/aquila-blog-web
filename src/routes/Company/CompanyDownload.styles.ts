import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { breakpoint, control } from "src/design-system/tokens"

export const DownloadAnnouncementBar = styled.div`
  width: 100%;
  border-bottom: 1px solid ${light.gridBorder};
  background: ${light.surfaceScaffold};
`

export const DownloadAnnouncementInner = styled.div`
  max-width: 75rem;
  margin: 0 auto;
  min-height: 2.5rem;
  padding: 0.375rem 2rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: ${light.inkSecondary};

  .annBadge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5625rem;
    border-radius: 9999px;
    background: ${light.inkPrimary};
    color: ${light.surface};
    font-size: 0.72rem;
    font-weight: 600;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 28px;
    color: ${light.inkPrimary};
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 0.5rem 1rem;
    justify-content: flex-start;
  }
`

export const DownloadHeaderBand = styled.section`
  width: 100%;
  background: ${light.surface};
  padding: 4.5rem 1.5rem 2.75rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 2.75rem 1rem 2rem;
  }
`

export const DownloadHeaderRow = styled.div`
  max-width: 75rem;
  margin: 0 auto;
  padding: 0 0.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;

  h1 {
    margin: 0;
    color: ${light.inkPrimary};
    font-size: clamp(2.25rem, 4.4vw, 3.25rem);
    line-height: 1.12;
    font-weight: 600;
    letter-spacing: -0.035em;
    word-break: keep-all;

    span {
      display: block;
    }
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 0;
    align-items: flex-start;
  }
`

export const SecondaryActionPill = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.375rem;
  border-radius: 9999px;
  border: 1px solid ${light.border};
  background: ${light.surfaceScaffold};
  color: ${light.inkPrimary};
  font-size: 0.90625rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease;

  &:hover {
    border-color: ${light.borderStrong};
    background: ${light.surface};
    box-shadow: ${light.hoverRing};
  }
`

export const PrimaryActionPill = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.375rem;
  border-radius: 9999px;
  background: ${light.inkPrimary};
  color: ${light.surface};
  font-size: 0.90625rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 150ms ease, box-shadow 150ms ease;

  &:hover {
    background: ${light.accentPressed};
    box-shadow: ${light.hoverRing};
  }
`

export const StickyOsNav = styled.div`
  position: sticky;
  top: 4rem;
  z-index: 30;
  width: 100%;
  background: ${light.surface};
  border-bottom: 1px solid ${light.gridBorder};

  @media (max-width: ${breakpoint.md - 1}px) {
    top: 5.75rem;
  }
`

export const StickyOsNavInner = styled.div`
  max-width: 75rem;
  margin: 0 auto;
  padding: 0.875rem 2rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 0.75rem 1rem;
  }
`

export const OsTabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.25rem;
  border-radius: 9999px;
  border: 1px solid ${({ $active }) => ($active ? light.inkPrimary : light.border)};
  background: ${({ $active }) => ($active ? light.inkPrimary : light.surface)};
  color: ${({ $active }) => ($active ? light.surface : light.inkPrimary)};
  font-family: inherit;
  font-size: 0.90625rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;

  &:hover {
    border-color: ${({ $active }) => ($active ? light.accentPressed : light.borderStrong)};
    background: ${({ $active }) => ($active ? light.accentPressed : light.surfaceScaffold)};
  }
`

export const DownloadSectionBand = styled.section`
  width: 100%;
  background: ${light.surface};
  padding: 0 1.5rem;

  & + & > div {
    border-top: 1px solid ${light.gridBorder};
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 0 1rem;
  }
`

export const DownloadSectionInner = styled.div`
  max-width: 75rem;
  margin: 0 auto;
  padding: 3.75rem 0.5rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 2.5rem 0;
  }
`

export const SectionHeaderRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;

  h2 {
    margin: 0;
    color: ${light.inkPrimary};
    font-size: clamp(1.5rem, 2.8vw, 2rem);
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: -0.025em;
  }
`

export const VersionChip = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: 1.75rem;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  background: ${light.surfaceBrand};
  color: ${light.onSignature};
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 140ms ease;

  &:hover {
    background: ${light.surfaceBrandStrong};
  }
`

export const SectionDescription = styled.p`
  margin: 0.875rem 0 0;
  max-width: 44rem;
  color: ${light.inkSecondary};
  font-size: 0.96875rem;
  line-height: 1.66;
  word-break: keep-all;
`

export const CtaRow = styled.div`
  margin-top: 1.75rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
`

export const RequirementBlock = styled.div`
  margin-top: 1.75rem;

  .reqLabel {
    margin: 0 0 0.25rem;
    color: ${light.inkMuted};
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .reqBody {
    margin: 0;
    color: ${light.inkPrimary};
    font-size: 0.90625rem;
    line-height: 1.55;
    word-break: keep-all;
  }

  .reqNote {
    margin: 0.5rem 0 0;
    color: ${light.inkSecondary};
    font-size: 0.84375rem;
    line-height: 1.55;
    word-break: keep-all;
  }
`

export const SnippetList = styled.div`
  margin-top: 1.5rem;
  display: grid;
  gap: 1.25rem;
  max-width: 56rem;
`

export const SnippetGroup = styled.div`
  display: grid;
  gap: 0.5rem;
`

export const SnippetHeader = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: ${light.inkPrimary};
  font-size: 0.90625rem;
  font-weight: 600;
`

export const SnippetBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surfaceScaffold};

  code {
    min-width: 0;
    overflow-wrap: anywhere;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.84375rem;
    line-height: 1.5;
    color: ${light.inkPrimary};
  }
`

export const CopyButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  min-width: ${control.lg}px;
  min-height: ${control.lg}px;
  padding: 0 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  background: transparent;
  color: ${light.inkSecondary};
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  flex-shrink: 0;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;

  &:hover {
    background: ${light.surface};
    border-color: ${light.border};
    color: ${light.inkPrimary};
  }
`

export const StudioModulesGrid = styled.div`
  margin-top: 2.5rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2.75rem 3.5rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
  }
`

export const StudioModuleCardWrap = styled.article`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;

  .moduleHead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.625rem;
  }

  .moduleIcon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${light.accent};
  }

  h3 {
    margin: 0;
    color: ${light.inkPrimary};
    font-size: 1.125rem;
    line-height: 1.3;
    font-weight: 600;
    letter-spacing: -0.015em;
  }

  p {
    margin: 0;
    color: ${light.inkSecondary};
    font-size: 0.90625rem;
    line-height: 1.62;
    word-break: keep-all;
  }
`

export const FormatChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5625rem;
  border-radius: 9999px;
  background: ${light.surfaceBrand};
  color: ${light.onSignature};
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.75rem;
  font-weight: 600;
`
